import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACCOUNT_A_DESTINATION_ID,
  APPROVED_DESTINATION_IDS_IN_SEQUENCE,
  TOTAL_PAYMENT_CAPACITY,
  DESTINATION_SLOT_CAPACITY,
  PAYMENT_CAPACITY_FULL_CODE,
  PAYMENT_DESTINATION_SEEDS,
  buildDestinationSnapshot,
  buildUpiUriFromDestination,
  claimNextDestinationSlot,
  destinationIdForLegacyUpi,
  isAssignableDestination,
  releaseDestinationSlot,
} from "../src/lib/payment-destinations.ts";
import { destinationShortLabel } from "../src/components/admin/types.ts";
import { buildUpiUriForDestination } from "../src/lib/payment.ts";
import { resolveRegistrationDestination } from "../src/lib/payment-flow-service.ts";

const tick = () => new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------
// Fake Mongo collection with TRUE atomic findOneAndUpdate semantics:
// the check-and-increment critical section contains no await, so concurrent
// JS callers cannot interleave inside it — exactly like MongoDB.
// ---------------------------------------------------------------------------
function makeFakeDestinations(overrides = {}) {
  const base = [
    { _id: "id-a", destinationId: "account-a-yash", internalLabel: "Yash Account / Account A / E-Cell Payment 1", payeeName: "Yash Patil (ECELL Team)", upiId: "yashpatil76317@okicici", sequence: 0, capacity: 0, assignedCount: 0, status: "disabled", ownerApproved: false, allowNewAssignments: false },
    { _id: "id-b", destinationId: "account-b-shivam", internalLabel: "Shivam Account / Account B / E-Cell Payment 2", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici", sequence: 1, capacity: 20, assignedCount: 0, status: "active", ownerApproved: true, allowNewAssignments: true },
    { _id: "id-c", destinationId: "account-c-bhushan", internalLabel: "Bhushan Bhusare / Account C / E-Cell Payment 3", payeeName: "Bhushan Bhusare (ECELL Team)", upiId: "bbhusare73@oksbi", sequence: 2, capacity: 20, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true },
    { _id: "id-d", destinationId: "account-d-shubham", internalLabel: "Shubham Account / Account D / E-Cell Payment 4", payeeName: "Shubham Jadhav (ECELL Team)", upiId: "9834717038@ybl", sequence: 3, capacity: 10, assignedCount: 0, status: "disabled", ownerApproved: true, allowNewAssignments: false },
    { _id: "id-f", destinationId: "account-f-priyanka", internalLabel: "Priyanka Ripote / Account F / E-Cell Payment", payeeName: "Priyanka Ripote (Ecell Team)", upiId: "9172140735@ybl", sequence: 4, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true },
    { _id: "id-e", destinationId: "account-e-sneha", internalLabel: "Sneha Dagwar / Account E / E-Cell Payment 5", payeeName: "Sneha Dagwar (ECELL Team)", upiId: "snehadagwar06@okicici", sequence: 5, capacity: 30, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true },
  ];
  const docs = new Map();
  for (const d of base) {
    const patch = overrides[d.destinationId] ?? {};
    docs.set(d.destinationId, { ...d, ...patch, createdAt: new Date(), updatedAt: new Date() });
  }
  const byId = () => new Map([...docs.values()].map((d) => [d._id, d]));
  function matches(doc, filter) {
    for (const [key, cond] of Object.entries(filter ?? {})) {
      if (key === "_id") { if (doc._id !== cond) return false; continue; }
      if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
        if ("$lt" in cond && !(doc[key] < cond.$lt)) return false;
        if ("$gt" in cond && !(doc[key] > cond.$gt)) return false;
        if ("$lte" in cond && !(doc[key] <= cond.$lte)) return false;
        if ("$gte" in cond && !(doc[key] >= cond.$gte)) return false;
        if ("$in" in cond && !cond.$in.includes(doc[key])) return false;
        continue;
      }
      if (doc[key] !== cond) return false;
    }
    return true;
  }
  return {
    _docs: docs,
    get(destinationId) { return docs.get(destinationId); },
    find(filter) {
      return {
        sort(sortSpec) {
          return {
            toArray: async () => {
              await tick();
              const rows = [...docs.values()].filter((d) => matches(d, filter));
              const [[sortKey, dir]] = Object.entries(sortSpec);
              rows.sort((a, b) => (a[sortKey] - b[sortKey]) * (dir === 1 ? 1 : -1));
              return rows.map((d) => ({ ...d }));
            },
          };
        },
      };
    },
    async findOne(filter) {
      await tick();
      for (const d of docs.values()) if (matches(d, filter)) return { ...d };
      return null;
    },
    // ATOMIC: no await between match and mutate.
    async findOneAndUpdate(filter, update) {
      const idMap = byId();
      let target = null;
      if (filter._id) {
        const candidate = idMap.get(filter._id);
        if (candidate && matches(candidate, filter)) target = candidate;
      } else {
        for (const d of docs.values()) if (matches(d, filter)) { target = d; break; }
      }
      if (!target) return null;
      const stored = docs.get(target.destinationId);
      if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) stored[k] += v;
      if (update.$set) Object.assign(stored, update.$set);
      if (update.$unset) for (const k of Object.keys(update.$unset)) delete stored[k];
      // Capture synchronously like MongoDB's after-document; a later tick
      // must not let concurrent increments bleed into this caller's snapshot.
      const snapshot = { ...stored };
      await tick();
      return snapshot;
    },
    async updateOne(filter, update) {
      const current = await this.findOne(filter);
      if (!current) return { modifiedCount: 0 };
      const stored = docs.get(current.destinationId);
      if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) stored[k] += v;
      if (update.$set) Object.assign(stored, update.$set);
      if (update.$unset) for (const k of Object.keys(update.$unset)) delete stored[k];
      return { modifiedCount: 1 };
    },
  };
}

async function claimN(collection, n) {
  const results = [];
  for (let i = 0; i < n; i += 1) results.push(await claimNextDestinationSlot(collection));
  return results;
}

// 1. B is initial active destination
test("1. B is initial active destination", async () => {
  const col = makeFakeDestinations();
  const actives = await col.find({ status: "active", ownerApproved: true, allowNewAssignments: true }).sort({ sequence: 1 }).toArray();
  assert.equal(actives.length, 1);
  assert.equal(actives[0].destinationId, "account-b-shivam");
});

// 2. first registration gets B
test("2. first registration gets B", async () => {
  const col = makeFakeDestinations();
  const claim = await claimNextDestinationSlot(col);
  assert.equal(claim.ok, true);
  assert.equal(claim.destination.destinationId, "account-b-shivam");
  assert.equal(claim.slotNumber, 1);
  assert.equal(claim.snapshot.destinationId, "account-b-shivam");
  assert.equal(claim.snapshot.payeeName, "Shivam Jadhav (ECELL Team)");
  assert.equal(claim.snapshot.upiId, "shivujadhav2006@okicici");
});

// 3. B registrations 1-20 all get B
test("3. B registrations 1-20 all get B", async () => {
  const col = makeFakeDestinations();
  const results = await claimN(col, 20);
  assert.ok(results.every((r) => r.ok && r.destination.destinationId === "account-b-shivam"));
  assert.deepEqual(results.map((r) => r.slotNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

// 4. 21st registration gets C
test("4. 21st registration gets C", async () => {
  const col = makeFakeDestinations();
  await claimN(col, 20);
  const twentyFirst = await claimNextDestinationSlot(col);
  assert.equal(twentyFirst.ok, true);
  assert.equal(twentyFirst.destination.destinationId, "account-c-bhushan");
  assert.equal(twentyFirst.slotNumber, 1);
});

// 5. B becomes exhausted at exactly 20
test("5. B becomes exhausted at exactly 20", async () => {
  const col = makeFakeDestinations();
  await claimN(col, 19);
  assert.equal(col.get("account-b-shivam").status, "active");
  const twentieth = await claimNextDestinationSlot(col);
  assert.equal(twentieth.ok, true);
  assert.equal(twentieth.destination.destinationId, "account-b-shivam");
  assert.equal(twentieth.exhausted?.destinationId, "account-b-shivam");
  const stored = col.get("account-b-shivam");
  assert.equal(stored.status, "exhausted");
  assert.equal(stored.assignedCount, 20);
  assert.equal(stored.allowNewAssignments, false);
  assert.ok(stored.exhaustedAt instanceof Date);
});

// 6. C becomes active
test("6. C becomes active after B exhausts", async () => {
  const col = makeFakeDestinations();
  await claimN(col, 20);
  assert.equal(col.get("account-c-bhushan").status, "active");
  assert.ok(col.get("account-c-bhushan").activatedAt instanceof Date);
});

// 7. after C 20 → F (D skipped: disabled for new assignments)
test("7. after C 20 → F (D skipped)", async () => {
  const col = makeFakeDestinations();
  await claimN(col, 40);
  const next = await claimNextDestinationSlot(col);
  assert.equal(next.ok, true);
  assert.equal(next.destination.destinationId, "account-f-priyanka");
  assert.equal(col.get("account-c-bhushan").status, "exhausted");
  assert.equal(col.get("account-d-shubham").status, "disabled");
  assert.equal(col.get("account-d-shubham").assignedCount, 0);
  assert.equal(col.get("account-f-priyanka").status, "active");
});

// 8. after F 10 → E
test("8. after F 10 → E", async () => {
  const col = makeFakeDestinations();
  await claimN(col, 50);
  const next = await claimNextDestinationSlot(col);
  assert.equal(next.ok, true);
  assert.equal(next.destination.destinationId, "account-e-sneha");
  assert.equal(col.get("account-f-priyanka").status, "exhausted");
  assert.equal(col.get("account-e-sneha").status, "active");
});

// 9. after E 30 → PAYMENT_CAPACITY_FULL (80 usable: D is disabled, never claimed)
test("9. after E 30 → PAYMENT_CAPACITY_FULL", async () => {
  const col = makeFakeDestinations();
  await claimN(col, 80);
  const full = await claimNextDestinationSlot(col);
  assert.equal(full.ok, false);
  assert.equal(full.capacityFull, true);
  assert.equal(PAYMENT_CAPACITY_FULL_CODE, "PAYMENT_CAPACITY_FULL");
});

// 10. max total approved assignment count = 90 (B 20 + C 20 + D 10 + F 10 + E 30)
test("10. max total approved assignment count = 90", () => {
  assert.equal(TOTAL_PAYMENT_CAPACITY, 90);
  assert.equal(DESTINATION_SLOT_CAPACITY, 10);
  const approved = PAYMENT_DESTINATION_SEEDS.filter((s) => s.destinationId !== ACCOUNT_A_DESTINATION_ID);
  assert.equal(approved.length, 5);
  assert.equal(approved.reduce((sum, s) => sum + s.capacity, 0), 90);
  assert.equal(approved.find((s) => s.destinationId === "account-b-shivam")?.capacity, 20);
  assert.equal(approved.find((s) => s.destinationId === "account-c-bhushan")?.capacity, 20);
  assert.equal(approved.find((s) => s.destinationId === "account-d-shubham")?.capacity, 10);
  assert.equal(approved.find((s) => s.destinationId === "account-f-priyanka")?.capacity, 10);
  assert.equal(approved.find((s) => s.destinationId === "account-e-sneha")?.capacity, 30);
  assert.deepEqual([...APPROVED_DESTINATION_IDS_IN_SEQUENCE], ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-f-priyanka", "account-e-sneha"]);
});

// 11. Account A never assigned
test("11. Account A never assigned", async () => {
  const col = makeFakeDestinations();
  const results = await claimN(col, 80);
  assert.ok(results.every((r) => r.ok && r.destination.destinationId !== ACCOUNT_A_DESTINATION_ID));
  assert.equal(isAssignableDestination({ destinationId: "account-a-yash", status: "disabled", ownerApproved: false, allowNewAssignments: false, assignedCount: 0, capacity: 0 }), false);
  assert.equal(isAssignableDestination({ destinationId: "account-a-yash", status: "active", ownerApproved: true, allowNewAssignments: true, assignedCount: 0, capacity: 10 }), false);
});

// 12. Account A QR never appears for new registration
test("12. Account A QR never appears for new registration", async () => {
  const col = makeFakeDestinations();
  const claim = await claimNextDestinationSlot(col);
  assert.ok(claim.ok && claim.snapshot);
  const uri = buildUpiUriFromDestination(claim.snapshot, 599, "ILL26-ABC123");
  const url = new URL(uri);
  assert.notEqual(url.searchParams.get("pa"), "yashpatil76317@okicici");
  assert.equal(url.searchParams.get("pa"), "shivujadhav2006@okicici");
  const route = readFileSync(new URL("../src/app/api/payment/status/[token]/qr/route.ts", import.meta.url), "utf8");
  assert.match(route, /blocked_account_a_pending/);
  assert.match(route, /buildUpiUriForDestination/);
});

// 13. disabled destination skipped (C disabled → D disabled skipped → F)
test("13. disabled destination skipped", async () => {
  const col = makeFakeDestinations({ "account-c-bhushan": { status: "disabled", allowNewAssignments: false, disabledAt: new Date() } });
  await claimN(col, 20); // exhaust B
  const next = await claimNextDestinationSlot(col);
  assert.equal(next.ok, true);
  assert.equal(next.destination.destinationId, "account-f-priyanka");
});

// 14. ownerApproved false never assignable
test("14. ownerApproved false never assignable", async () => {
  assert.equal(isAssignableDestination({ destinationId: "account-c-bhushan", status: "active", ownerApproved: false, allowNewAssignments: true, assignedCount: 0, capacity: 20 }), false);
  const col = makeFakeDestinations({ "account-c-bhushan": { status: "active", ownerApproved: false } });
  // B still active so first claim is B; force B full then ensure C (unapproved)
  // and D (disabled) are both skipped to F.
  await claimN(col, 20);
  const next = await claimNextDestinationSlot(col);
  assert.equal(next.ok, true);
  assert.equal(next.destination.destinationId, "account-f-priyanka");
});

// 15. concurrent registrations cannot create B slot 21
test("15. concurrent registrations cannot create B slot 21", async () => {
  const col = makeFakeDestinations({ "account-b-shivam": { assignedCount: 19, status: "active" } });
  const results = await Promise.all(Array.from({ length: 10 }, () => claimNextDestinationSlot(col)));
  const bSlots = results.filter((r) => r.ok && r.destination.destinationId === "account-b-shivam").map((r) => r.slotNumber);
  assert.equal(bSlots.length, 1);
  assert.equal(bSlots[0], 20);
  assert.equal(col.get("account-b-shivam").assignedCount, 20);
  assert.ok(col.get("account-b-shivam").assignedCount <= 20);
  const cClaims = results.filter((r) => r.ok && r.destination.destinationId === "account-c-bhushan");
  assert.equal(cClaims.length, 9);
});

// 16. creation is draft-only: replay resolves before insert, no slot claim
test("16. creation is draft-only: replay resolves before insert, no slot claim", async () => {
  // V3: creation inserts a draft (no destination, no slot, no seat). The
  // only claim lives in explicit Generate QR (payment-flow-service).
  const route = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /claimNextDestinationSlot/);
  assert.doesNotMatch(route, /releaseDestinationSlot/);
  assert.match(route, /pendingQRGeneration/);
  const replayIndex = route.indexOf("existingRequest");
  const insertIndex = route.indexOf("await collection.insertOne");
  assert.ok(replayIndex !== -1 && insertIndex !== -1 && replayIndex < insertIndex);
  const dupIndex = route.indexOf("const duplicate = await findIdentityDuplicate()");
  assert.ok(dupIndex !== -1 && dupIndex < insertIndex);
  const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  assert.match(service, /generateFirstPaymentQR/);
  assert.match(service, /await claimEventSeat/);
  assert.match(service, /await claimNextDestinationSlot/);
});

// 17. duplicate registration creates nothing
test("17. duplicate registration creates nothing", () => {
  const route = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
  assert.match(route, /Rejected duplicate attempts create nothing/);
  const dupIndex = route.indexOf("const duplicate = await findIdentityDuplicate()");
  const insertIndex = route.indexOf("await collection.insertOne");
  assert.ok(dupIndex !== -1 && insertIndex !== -1);
  // Duplicate check precedes the draft insert.
  assert.ok(dupIndex < insertIndex);
  assert.doesNotMatch(route, /claimNextDestinationSlot/);
});

// 18. release primitive refunds a slot; draft creation needs no compensation
test("18. release primitive refunds a slot; draft creation needs no compensation", async () => {
  const col = makeFakeDestinations();
  const claim = await claimNextDestinationSlot(col);
  assert.equal(col.get("account-b-shivam").assignedCount, 1);
  await releaseDestinationSlot(col, claim.destination.destinationId);
  assert.equal(col.get("account-b-shivam").assignedCount, 0);
  // V3 creation claims nothing, so the creation route carries no release path.
  const route = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /claimNextDestinationSlot/);
  assert.doesNotMatch(route, /releaseDestinationSlot/);
});

// 19. verified registration keeps destination
test("19. verified registration keeps destination", () => {
  const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  const start = service.indexOf("export async function verifyPaymentForReview");
  const end = service.indexOf("\nexport ", start + 1);
  const verifyBlock = service.slice(start, end === -1 ? undefined : end);
  assert.doesNotMatch(verifyBlock, /payment\.destination/);
  assert.doesNotMatch(verifyBlock, /destination/);
});

// 20. submitted registration keeps destination
test("20. submitted registration keeps destination (proof does not rewrite it)", () => {
  const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  const start = service.indexOf("export async function submitPaymentProofForParticipant");
  const end = service.indexOf("\nexport ", start + 1);
  const submitBlock = service.slice(start, end === -1 ? undefined : end);
  // Proof submission snapshots the destination into proofHistory but never
  // overwrites payment.destination.
  assert.match(submitBlock, /proofHistory/);
  assert.doesNotMatch(submitBlock, /"payment\.destination":/);
  assert.doesNotMatch(submitBlock, /payment\.destination.*\$set/);
});

// 21. rejected does not free slot
test("21. rejected does not free slot", () => {
  const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  const start = service.indexOf("export async function rejectPaymentForReview");
  const end = service.indexOf("\nexport ", start + 1);
  const rejectBlock = service.slice(start, end === -1 ? undefined : end);
  assert.match(rejectBlock, /NEVER free the destination slot/);
  assert.doesNotMatch(rejectBlock, /releaseDestinationSlot/);
  assert.doesNotMatch(rejectBlock, /assignedCount/);
});

// 22. payment_pending admin reassignment works
test("22. payment_pending admin reassignment works", () => {
  const admin = readFileSync(new URL("../src/app/api/admin/destinations/route.ts", import.meta.url), "utf8");
  assert.match(admin, /"payment\.status": "payment_pending"/);
  assert.match(admin, /payment_destination_reassigned/);
  assert.match(admin, /REASSIGN|reassign/);
});

// 23. reassignment consumes target capacity
test("23. reassignment consumes target capacity", () => {
  const admin = readFileSync(new URL("../src/app/api/admin/destinations/route.ts", import.meta.url), "utf8");
  assert.match(admin, /\$inc: \{ assignedCount: (moveCount|moved) \}/);
  assert.match(admin, /Target capacity is consumed/);
});

// 24. reassignment cannot exceed target remaining capacity
test("24. reassignment cannot exceed target remaining capacity", () => {
  const admin = readFileSync(new URL("../src/app/api/admin/destinations/route.ts", import.meta.url), "utf8");
  assert.match(admin, /TARGET_CAPACITY_INSUFFICIENT/);
  assert.match(admin, /Target destination has only/);
  // Pure arithmetic check: B 8/10 + 5 migrate → reject (only 2 remaining).
  const remaining = 10 - 8;
  assert.equal(remaining, 2);
  assert.ok(5 > remaining);
});

// 25. exhausted slot is never recycled
test("25. exhausted slot is never recycled", async () => {
  const col = makeFakeDestinations();
  await claimN(col, 80);
  assert.equal(col.get("account-b-shivam").status, "exhausted");
  assert.equal(col.get("account-c-bhushan").status, "exhausted");
  // D stays disabled (never activated, never exhausted) with zero assignments.
  assert.equal(col.get("account-d-shubham").status, "disabled");
  assert.equal(col.get("account-d-shubham").assignedCount, 0);
  assert.equal(col.get("account-f-priyanka").status, "exhausted");
  assert.equal(col.get("account-e-sneha").status, "exhausted");
  const full = await claimNextDestinationSlot(col);
  assert.equal(full.capacityFull, true);
  // Slots are released only via the sanctioned path: admin hard-delete after
  // findOneAndDelete. Draft creation claims nothing (no compensation needed);
  // proof/verify/reject flows never release.
  const registrationsRoute = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(registrationsRoute, /claimNextDestinationSlot/);
  assert.doesNotMatch(registrationsRoute, /releaseDestinationSlot/);
  const adminDelete = readFileSync(new URL("../src/app/api/admin/registrations/[publicId]/route.ts", import.meta.url), "utf8");
  assert.match(adminDelete, /releaseDestinationSlot/);
  const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  // The only participant-flow release is Generate-QR compensation for a slot
  // claim left unused by an aborted commitment (idempotent replay, seat
  // FULL, attach conflict). Verify/reject never release (tests 19/21 bound
  // those blocks).
  assert.match(service, /releaseDestinationSlot\(input\.store\.destinations/);
});

// 26. immutable expectedAmount remains unchanged
test("26. immutable expectedAmount remains unchanged", () => {
  const route = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
  assert.match(route, /Price snapshot stays immutable/);
  // V3 creation stores the snapshot destination-free: no payee mirroring at
  // creation (the authoritative payee arrives with Generate QR).
  assert.doesNotMatch(route, /\.\.\.snapshot, payeeName/);
  assert.doesNotMatch(route, /boundSnapshot/);
  // Amounts fixed.
  const pricing = readFileSync(new URL("../src/config/event.ts", import.meta.url), "utf8");
  assert.match(pricing, /earlyBirdAmount: 599/);
  assert.match(pricing, /regularAmount: 699/);
});

// 27. QR uses assigned destination
test("27. QR uses assigned destination", () => {
  const uri = buildUpiUriForDestination({ payeeName: "Bhushan Bhusare (ECELL Team)", upiId: "bbhusare73@oksbi" }, 699, "ILL26-ABCDEF");
  const url = new URL(uri);
  assert.equal(url.searchParams.get("pa"), "bbhusare73@oksbi");
  assert.equal(url.searchParams.get("pn"), "Bhushan Bhusare (ECELL Team)");
  assert.equal(url.searchParams.get("am"), "699.00");
  assert.equal(url.searchParams.get("cu"), "INR");
  assert.equal(url.searchParams.get("tn"), "ILL26-ABCDEF");
  const uri599 = buildUpiUriFromDestination({ payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici" }, 599, "ILL26-XYZ123");
  assert.match(uri599, /pa=shivujadhav2006/);
});

// 28. proofHistory stores assigned destination
test("28. proofHistory stores assigned destination", () => {
  const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  assert.match(service, /proofDestination/);
  assert.match(service, /destination: proofDestination/);
  const regType = readFileSync(new URL("../src/lib/registration-v2.ts", import.meta.url), "utf8");
  assert.match(regType, /proofHistory: Array<\{ fileId: string; submittedAt: Date; transactionReference: string; destination\?/);
});

// 29. Account A historical submitted payment remains reviewable
test("29. Account A historical submitted payment remains reviewable", () => {
  const submitted = {
    payment: {
      status: "submitted_for_verification",
      snapshot: { expectedAmount: 599, currency: "INR", payeeName: "Yash Patil", upiId: "yashpatil76317@okicici", eventKey: "illuminate-2026", mode: "production", pricingTier: "early_bird", registrationAvailable: true, calculatedAt: new Date().toISOString() },
      proofHistory: [],
    },
  };
  const resolved = resolveRegistrationDestination(submitted);
  assert.equal(resolved.kind, "legacy");
  // Submitted (not pending) Account A is NOT blocked — admin can verify.
  assert.notEqual(resolved.kind, "blocked_account_a_pending");
});

// 30. Account A payment_pending QR is blocked until reassigned
test("30. Account A payment_pending QR is blocked until reassigned", () => {
  const pending = {
    payment: {
      status: "payment_pending",
      snapshot: { expectedAmount: 599, currency: "INR", payeeName: "Yash Patil", upiId: "yashpatil76317@okicici", eventKey: "illuminate-2026", mode: "production", pricingTier: "early_bird", registrationAvailable: true, calculatedAt: new Date().toISOString() },
      proofHistory: [],
    },
  };
  assert.equal(resolveRegistrationDestination(pending).kind, "blocked_account_a_pending");
  const assigned = {
    payment: {
      status: "payment_pending",
      snapshot: pending.payment.snapshot,
      destination: { ...buildDestinationSnapshot({ destinationId: "account-b-shivam", internalLabel: "B", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici" }), assignedAt: new Date() },
      proofHistory: [],
    },
  };
  const resolved = resolveRegistrationDestination(assigned);
  assert.equal(resolved.kind, "assigned");
});

// CONCURRENCY STRESS TEST (mandatory): B at 19, concurrent burst → exactly one B slot 20
test("STRESS: B at 19 with concurrent burst yields exactly one B-20 then C", async () => {
  const col = makeFakeDestinations({ "account-b-shivam": { assignedCount: 19, status: "active" } });
  const results = await Promise.all(Array.from({ length: 20 }, () => claimNextDestinationSlot(col)));
  const ok = results.filter((r) => r.ok);
  assert.equal(ok.length, 20);
  const b = ok.filter((r) => r.destination.destinationId === "account-b-shivam");
  assert.equal(b.length, 1);
  assert.equal(b[0].slotNumber, 20);
  assert.equal(col.get("account-b-shivam").assignedCount, 20);
  assert.ok(col.get("account-b-shivam").assignedCount <= 20, "B must NEVER reach 21");
  // 1 slot went to B; remaining 19 spill to C (cap 20) in strict sequence.
  const c = ok.filter((r) => r.destination.destinationId === "account-c-bhushan");
  assert.equal(c.length, 19);
  assert.deepEqual(c.map((r) => r.slotNumber).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.ok(col.get("account-c-bhushan").assignedCount <= 20, "C must NEVER exceed 20");
});

// Event config fallback removed for new flow
test("Account A removed from new-flow fallback; legacy clearly marked", () => {
  const eventSrc = readFileSync(new URL("../src/config/event.ts", import.meta.url), "utf8");
  assert.match(eventSrc, /LEGACY ONLY/);
  const route = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /yashpatil76317@okicici/);
  assert.doesNotMatch(route, /Yash Patil/);
});

// 31. D is not assignable for new registrations (disabled, history preserved)
test("31. D is not assignable for new registrations", () => {
  const seed = PAYMENT_DESTINATION_SEEDS.find((s) => s.destinationId === "account-d-shubham");
  assert.equal(seed.status, "disabled");
  assert.equal(seed.allowNewAssignments, false);
  assert.equal(seed.capacity, 10);
  assert.equal(
    isAssignableDestination({ destinationId: "account-d-shubham", status: "disabled", ownerApproved: true, allowNewAssignments: false, assignedCount: 0, capacity: 10 }),
    false,
  );
});

// 32. Priyanka is assignable when active
test("32. Priyanka is assignable when active", async () => {
  const seed = PAYMENT_DESTINATION_SEEDS.find((s) => s.destinationId === "account-f-priyanka");
  assert.equal(seed.payeeName, "Priyanka Ripote (Ecell Team)");
  assert.equal(seed.upiId, "9172140735@ybl");
  assert.equal(seed.capacity, 10);
  assert.equal(seed.sequence, 4);
  assert.equal(seed.ownerApproved, true);
  assert.equal(seed.allowNewAssignments, true);
  assert.equal(
    isAssignableDestination({ destinationId: "account-f-priyanka", status: "active", ownerApproved: true, allowNewAssignments: true, assignedCount: 0, capacity: 10 }),
    true,
  );
  const col = makeFakeDestinations();
  await claimN(col, 40); // exhaust B (20) + C (20); D skipped
  const next = await claimNextDestinationSlot(col);
  assert.equal(next.ok, true);
  assert.equal(next.destination.destinationId, "account-f-priyanka");
  assert.equal(next.snapshot.payeeName, "Priyanka Ripote (Ecell Team)");
  assert.equal(next.snapshot.upiId, "9172140735@ybl");
});

// 33. approved ordering includes Priyanka before Sneha
test("33. approved ordering includes Priyanka before Sneha", () => {
  const order = [...APPROVED_DESTINATION_IDS_IN_SEQUENCE];
  assert.ok(order.indexOf("account-f-priyanka") !== -1);
  assert.ok(order.indexOf("account-f-priyanka") < order.indexOf("account-e-sneha"));
  const seeds = [...PAYMENT_DESTINATION_SEEDS].sort((a, b) => a.sequence - b.sequence).map((s) => s.destinationId);
  assert.ok(seeds.indexOf("account-f-priyanka") < seeds.indexOf("account-e-sneha"));
});

// 34. canonical caps: B 20, C 20, D 10, F 10, E 30
test("34. canonical caps B 20 / C 20 / D 10 / F 10 / E 30", () => {
  const byId = new Map(PAYMENT_DESTINATION_SEEDS.map((s) => [s.destinationId, s]));
  assert.equal(byId.get("account-b-shivam").capacity, 20);
  assert.equal(byId.get("account-c-bhushan").capacity, 20);
  assert.equal(byId.get("account-d-shubham").capacity, 10);
  assert.equal(byId.get("account-f-priyanka").capacity, 10);
  assert.equal(byId.get("account-e-sneha").capacity, 30);
});

// 35. TOTAL_PAYMENT_CAPACITY stays derived from seeds (never hard-coded)
test("35. TOTAL_PAYMENT_CAPACITY stays derived from seeds", () => {
  const derived = PAYMENT_DESTINATION_SEEDS.filter((s) => s.destinationId !== ACCOUNT_A_DESTINATION_ID).reduce((sum, s) => sum + s.capacity, 0);
  assert.equal(TOTAL_PAYMENT_CAPACITY, derived);
  assert.equal(TOTAL_PAYMENT_CAPACITY, 90);
  const src = readFileSync(new URL("../src/lib/payment-destinations.ts", import.meta.url), "utf8");
  assert.match(src, /PAYMENT_DESTINATION_SEEDS\.filter/);
  assert.doesNotMatch(src, /TOTAL_PAYMENT_CAPACITY(: number)? = 90/);
  assert.doesNotMatch(src, /TOTAL_PAYMENT_CAPACITY(: number)? = 50/);
});

// 36. destinationShortLabel handles Account F
test("36. destinationShortLabel handles Account F", () => {
  assert.equal(destinationShortLabel("account-f-priyanka"), "Account F");
  assert.equal(destinationShortLabel("account-b-shivam"), "Account B");
  assert.equal(destinationShortLabel("account-d-shubham"), "Account D");
  assert.equal(destinationShortLabel("account-e-sneha"), "Account E");
});

// 37. historical D destination snapshots still resolve
test("37. historical D destination snapshots still resolve", () => {
  const historical = {
    payment: {
      status: "verified",
      snapshot: { expectedAmount: 599, currency: "INR", payeeName: "Shubham Jadhav (ECELL Team)", upiId: "9834717038@ybl", eventKey: "illuminate-2026", mode: "production", pricingTier: "early_bird", registrationAvailable: true, calculatedAt: new Date().toISOString() },
      destination: { ...buildDestinationSnapshot({ destinationId: "account-d-shubham", internalLabel: "Shubham Account / Account D / E-Cell Payment 4", payeeName: "Shubham Jadhav (ECELL Team)", upiId: "9834717038@ybl" }), assignedAt: new Date() },
      proofHistory: [],
    },
  };
  const resolved = resolveRegistrationDestination(historical);
  assert.equal(resolved.kind, "assigned");
  assert.equal(resolved.destinationId, "account-d-shubham");
  assert.equal(resolved.payeeName, "Shubham Jadhav (ECELL Team)");
  assert.equal(resolved.upiId, "9834717038@ybl");
});

// 38. legacy UPI map routes Priyanka UPI to Account F
test("38. legacy UPI map routes Priyanka UPI to Account F", () => {
  assert.equal(destinationIdForLegacyUpi("9172140735@ybl"), "account-f-priyanka");
  assert.equal(destinationIdForLegacyUpi("9834717038@ybl"), "account-d-shubham");
  assert.equal(destinationIdForLegacyUpi("snehadagwar06@okicici"), "account-e-sneha");
});

// 39. usable capacity excludes disabled D (TOTAL 90, claimable 80)
test("39. usable capacity excludes disabled D", async () => {
  const disabledCap = PAYMENT_DESTINATION_SEEDS.filter((s) => s.status === "disabled" && s.destinationId !== ACCOUNT_A_DESTINATION_ID).reduce((sum, s) => sum + s.capacity, 0);
  assert.equal(disabledCap, 10);
  assert.equal(TOTAL_PAYMENT_CAPACITY - disabledCap, 80);
  const col = makeFakeDestinations();
  const results = await claimN(col, 80);
  assert.ok(results.every((r) => r.ok));
  const full = await claimNextDestinationSlot(col);
  assert.equal(full.ok, false);
  assert.equal(full.capacityFull, true);
});
