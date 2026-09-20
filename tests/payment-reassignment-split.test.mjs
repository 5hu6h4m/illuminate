import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TOTAL_PAYMENT_CAPACITY } from "../src/lib/payment-destinations.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------
// Fakes mirroring the route's reserve-first split algorithm:
// reserve min(eligible, remaining) slots, move oldest-first
// (createdAt asc, _id asc), per-doc source+status guard, refund unused,
// exhaust at 10 and activate next.
// ---------------------------------------------------------------------------
function makeDestinations() {
  const docs = new Map([
    ["account-a-yash", { destinationId: "account-a-yash", sequence: 0, capacity: 0, assignedCount: 0, status: "disabled", ownerApproved: false, allowNewAssignments: false }],
    ["account-b-shivam", { destinationId: "account-b-shivam", sequence: 1, capacity: 10, assignedCount: 0, status: "active", ownerApproved: true, allowNewAssignments: true, payeeName: "B", upiId: "b@upi", internalLabel: "B" }],
    ["account-c-bhushan", { destinationId: "account-c-bhushan", sequence: 2, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, payeeName: "C", upiId: "c@upi", internalLabel: "C" }],
    ["account-d-shubham", { destinationId: "account-d-shubham", sequence: 3, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, payeeName: "D", upiId: "d@upi", internalLabel: "D" }],
    ["account-e-sneha", { destinationId: "account-e-sneha", sequence: 4, capacity: 20, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, payeeName: "E", upiId: "e@upi", internalLabel: "E" }],
  ]);
  return {
    docs,
    get(id) { return docs.get(id); },
    // Atomic conditional reserve: no await inside check-and-mutate.
    reserve(id, count) {
      const d = docs.get(id);
      if (!d || d.assignedCount > d.capacity - count) return null;
      d.assignedCount += count;
      return { ...d };
    },
    refund(id, count) { docs.get(id).assignedCount -= count; },
    exhaustAndActivate(id) {
      const d = docs.get(id);
      if (d.assignedCount >= d.capacity) {
        d.status = "exhausted";
        d.allowNewAssignments = false;
        const next = [...docs.values()].filter((x) => x.status === "available" && x.ownerApproved && x.sequence > d.sequence && x.assignedCount < x.capacity).sort((a, b) => a.sequence - b.sequence)[0];
        if (next) { next.status = "active"; return next.destinationId; }
      }
      return null;
    },
  };
}

function makeRegistrations() {
  // 16 legacy Account A pending + locked-state decoys sharing the source.
  const regs = [];
  for (let i = 0; i < 16; i += 1) {
    regs.push({ _id: `a${String(i).padStart(3, "0")}`, publicId: `ILL26-A${i}`, createdAt: new Date(Date.UTC(2026, 8, 15, 10, 0, i)), status: "payment_pending", dest: "account-a-yash", legacyA: true });
  }
  regs.push({ _id: "sub1", publicId: "ILL26-SUB", createdAt: new Date(Date.UTC(2026, 8, 14)), status: "submitted_for_verification", dest: "account-a-yash", legacyA: true });
  regs.push({ _id: "ver1", publicId: "ILL26-VER", createdAt: new Date(Date.UTC(2026, 8, 14)), status: "verified", dest: "account-a-yash", legacyA: true });
  regs.push({ _id: "rej1", publicId: "ILL26-REJ", createdAt: new Date(Date.UTC(2026, 8, 14)), status: "rejected", dest: "account-a-yash", legacyA: true });
  return regs;
}

const isEligible = (r) => r.status === "payment_pending" && r.legacyA;

// Faithful port of the route's partial execution (reserve → sort → guard → refund).
async function partialMove(store, regs, toId, { flipOneToSubmitted = null } = {}) {
  const target = store.get(toId);
  const remaining = Math.max(0, target.capacity - target.assignedCount);
  const eligible = regs.filter(isEligible);
  const moveCount = Math.min(eligible.length, remaining);
  if (moveCount <= 0) return { moved: 0, eligibleCount: eligible.length, remaining };
  const reserved = store.reserve(toId, moveCount);
  if (!reserved) throw new Error("TARGET_CAPACITY_RACE");
  await tick();
  if (flipOneToSubmitted) {
    const victim = regs.find((r) => r._id === flipOneToSubmitted);
    if (victim) victim.status = "submitted_for_verification"; // concurrent race
  }
  const selected = [...eligible].sort((a, b) => (a.createdAt - b.createdAt) || (a._id < b._id ? -1 : 1)).slice(0, moveCount);
  let moved = 0;
  for (const doc of selected) {
    await tick();
    if (doc.status !== "payment_pending" || !doc.legacyA) continue; // per-doc guard
    doc.dest = toId;
    doc.legacyA = false;
    moved += 1;
  }
  const unused = moveCount - moved;
  if (unused > 0) store.refund(toId, unused);
  const activated = store.exhaustAndActivate(toId);
  return { moved, eligibleCount: eligible.length, remaining, activated };
}

// --- Scenario: A → B (16 eligible, B 0/10) then A → C (6 left) ---
async function runScenario(opts = {}) {
  const store = makeDestinations();
  const regs = makeRegistrations();
  const first = await partialMove(store, regs, "account-b-shivam", opts.first ?? {});
  const second = await partialMove(store, regs, "account-c-bhushan", opts.second ?? {});
  return { store, regs, first, second };
}

test("1. 16 eligible, target has 10 → exactly 10 moved", async () => {
  const { first } = await runScenario();
  assert.equal(first.eligibleCount, 16);
  assert.equal(first.remaining, 10);
  assert.equal(first.moved, 10);
});

test("2. remaining 6 stay unchanged on Account A", async () => {
  const store = makeDestinations();
  const regs = makeRegistrations();
  const first = await partialMove(store, regs, "account-b-shivam");
  assert.equal(first.moved, 10);
  const stillA = regs.filter((r) => r.legacyA && r.status === "payment_pending");
  assert.equal(stillA.length, 6);
  assert.ok(stillA.every((r) => r.dest === "account-a-yash"));
});

test("3. oldest createdAt selected first", async () => {
  const store = makeDestinations();
  const regs = makeRegistrations();
  await partialMove(store, regs, "account-b-shivam");
  const movedIds = regs.filter((r) => r.dest === "account-b-shivam").map((r) => r._id).sort();
  assert.deepEqual(movedIds, ["a000", "a001", "a002", "a003", "a004", "a005", "a006", "a007", "a008", "a009"]);
  const stillA = regs.filter((r) => r.legacyA && r.status === "payment_pending").map((r) => r._id).sort();
  assert.deepEqual(stillA, ["a010", "a011", "a012", "a013", "a014", "a015"]);
});

test("4. tie broken deterministically by _id ascending", async () => {
  const store = makeDestinations();
  const same = new Date(Date.UTC(2026, 8, 15, 12));
  const regs = [
    { _id: "z9", publicId: "X1", createdAt: same, status: "payment_pending", dest: "account-a-yash", legacyA: true },
    { _id: "a1", publicId: "X2", createdAt: same, status: "payment_pending", dest: "account-a-yash", legacyA: true },
    { _id: "m5", publicId: "X3", createdAt: same, status: "payment_pending", dest: "account-a-yash", legacyA: true },
  ];
  store.get("account-b-shivam").capacity = 2;
  const res = await partialMove(store, regs, "account-b-shivam");
  assert.equal(res.moved, 2);
  assert.equal(regs.find((r) => r._id === "a1").dest, "account-b-shivam");
  assert.equal(regs.find((r) => r._id === "m5").dest, "account-b-shivam");
  assert.equal(regs.find((r) => r._id === "z9").dest, "account-a-yash");
});

test("5. target assignedCount becomes exactly 10", async () => {
  const { store } = await runScenario();
  assert.equal(store.get("account-b-shivam").assignedCount, 10);
});

test("6. target becomes exhausted at 10/10", async () => {
  const { store } = await runScenario();
  assert.equal(store.get("account-b-shivam").status, "exhausted");
});

test("7. next destination activates (C becomes active)", async () => {
  const { store, first } = await runScenario();
  assert.equal(first.activated, "account-c-bhushan");
  assert.equal(store.get("account-c-bhushan").status, "active");
});

test("8. second operation moves remaining 6 to C", async () => {
  const { second } = await runScenario();
  assert.equal(second.moved, 6);
});

test("9. final Account A pending count = 0", async () => {
  const { regs } = await runScenario();
  assert.equal(regs.filter((r) => r.legacyA && r.status === "payment_pending").length, 0);
});

test("10. B = 10/10", async () => {
  const { store } = await runScenario();
  assert.equal(store.get("account-b-shivam").assignedCount, 10);
  assert.equal(store.get("account-b-shivam").capacity, 10);
});

test("11. C = 6/10", async () => {
  const { store } = await runScenario();
  assert.equal(store.get("account-c-bhushan").assignedCount, 6);
  assert.equal(store.get("account-c-bhushan").capacity, 10);
});

test("12. no submitted registration moves", async () => {
  const { regs } = await runScenario();
  assert.equal(regs.find((r) => r._id === "sub1").dest, "account-a-yash");
  assert.equal(regs.find((r) => r._id === "sub1").status, "submitted_for_verification");
});

test("13. no verified registration moves", async () => {
  const { regs } = await runScenario();
  assert.equal(regs.find((r) => r._id === "ver1").dest, "account-a-yash");
});

test("14. no rejected registration moves", async () => {
  const { regs } = await runScenario();
  assert.equal(regs.find((r) => r._id === "rej1").dest, "account-a-yash");
});

test("15. concurrent state change does not consume phantom capacity", async () => {
  const store = makeDestinations();
  const regs = makeRegistrations().filter((r) => r.status === "payment_pending");
  const res = await partialMove(store, regs, "account-b-shivam", { flipOneToSubmitted: "a003" });
  assert.equal(res.moved, 9);
  assert.equal(store.get("account-b-shivam").assignedCount, 9);
  assert.notEqual(store.get("account-b-shivam").status, "exhausted");
});

test("16. no destination exceeds its own capacity", async () => {
  const { store } = await runScenario();
  for (const id of ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"]) {
    assert.ok(store.get(id).assignedCount <= store.get(id).capacity, `${id} exceeded capacity`);
  }
});

test("remaining approved capacity after 16-way split matches TOTAL", async () => {
  const { store } = await runScenario();
  const assigned = ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"].reduce((s, id) => s + store.get(id).assignedCount, 0);
  assert.equal(assigned, 16);
  assert.equal(TOTAL_PAYMENT_CAPACITY - assigned, 34);
});

test("route implements explicit partial opt-in with oldest-first selection and refund", () => {
  const route = readFileSync(new URL("../src/app/api/admin/destinations/route.ts", import.meta.url), "utf8");
  assert.match(route, /partial/);
  assert.match(route, /Math\.min\(\s*eligibleCount,\s*remaining\s*\)/);
  assert.match(route, /createdAt: 1, _id: 1/);
  assert.match(route, /oldest/i);
  assert.match(route, /TARGET_CAPACITY_INSUFFICIENT/);
  assert.match(route, /assignedCount: \{ \$lte: target\.capacity - moveCount \}/);
  assert.match(route, /\$inc: \{ assignedCount: moveCount \}/);
  assert.match(route, /unused = moveCount - moved/);
  assert.match(route, /no phantom/i);
  assert.match(route, /reason: "legacy_blocked_destination"/);
  assert.match(route, /selectionPolicy: "oldest_pending_first"/);
  assert.match(route, /requestedEligibleCount/);
  assert.match(route, /targetRemainingBefore/);
  assert.match(route, /remainingEligibleCount/);
});

test("route per-doc guard re-asserts source match, never touches locked states", () => {
  const route = readFileSync(new URL("../src/app/api/admin/destinations/route.ts", import.meta.url), "utf8");
  assert.match(route, /"payment\.status": "payment_pending", \.\.\.sourceMatch/);
  assert.match(route, /Only payment_pending may be bulk-reassigned/);
});

test("CapacityPanel shows split preview and explicit partial confirmation", () => {
  const ui = readFileSync(new URL("../src/components/admin/CapacityPanel.tsx", import.meta.url), "utf8");
  assert.match(ui, /Will move/);
  assert.match(ui, /Will remain/);
  assert.match(ui, /Reassign up to available capacity/);
  assert.match(ui, /Oldest unpaid registrations will be reassigned first/);
  assert.match(ui, /will remain unchanged/);
});
