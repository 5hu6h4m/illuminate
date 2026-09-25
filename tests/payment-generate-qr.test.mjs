import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Injected capability: participant tokens need a signing secret at call time.
process.env.PARTICIPANT_TOKEN_SECRET ??= "phase2-unit-test-secret-0123456789abcdef";

const {
  generateFirstPaymentQR,
  resolveRegistrationDestination,
} = await import("../src/lib/payment-flow-service.ts");
const {
  generateParticipantAccessToken,
  hashParticipantAccessToken,
} = await import("../src/lib/payment.ts");
const {
  computeCommittedGroundTruth,
  hasSeatCommitment,
  releaseEventSeat,
  EVENT_CAPACITY_ID,
} = await import("../src/lib/event-capacity.ts");
const { displayPricingTier } = await import("../src/lib/payment-pricing.ts");

// ---------------------------------------------------------------------------
// Minimal in-memory Mongo fakes (single-threaded; real races live in the
// isolated real-Mongo integration test).
// ---------------------------------------------------------------------------
function getPath(doc, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], doc);
}
function setPath(doc, path, value) {
  const keys = path.split(".");
  let target = doc;
  for (let i = 0; i < keys.length - 1; i += 1) target = target[keys[i]];
  target[keys[keys.length - 1]] = value;
}
function unsetPath(doc, path) {
  const keys = path.split(".");
  let target = doc;
  for (let i = 0; i < keys.length - 1; i += 1) target = target[keys[i]];
  delete target[keys[keys.length - 1]];
}
function matches(doc, filter) {
  for (const [key, cond] of Object.entries(filter ?? {})) {
    const value = getPath(doc, key);
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ("$lt" in cond && !(value < cond.$lt)) return false;
      if ("$gt" in cond && !(value > cond.$gt)) return false;
      if ("$lte" in cond && !(value <= cond.$lte)) return false;
      if ("$gte" in cond && !(value >= cond.$gte)) return false;
      if ("$in" in cond && !cond.$in.includes(value)) return false;
      if ("$exists" in cond && (cond.$exists ? value === undefined : value !== undefined)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}
function applyUpdate(stored, update) {
  if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) setPath(stored, k, (getPath(stored, k) ?? 0) + v);
  if (update.$set) for (const [k, v] of Object.entries(update.$set)) setPath(stored, k, structuredClone(v));
  if (update.$unset) for (const k of Object.keys(update.$unset)) unsetPath(stored, k);
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      const arr = getPath(stored, k);
      if (v !== null && typeof v === "object" && "$each" in v) arr.push(...structuredClone(v.$each));
      else arr.push(structuredClone(v));
    }
  }
}
function makeCollection(seedDocs = []) {
  const docs = new Map(seedDocs.map((d) => [d._id, structuredClone(d)]));
  return {
    _docs: docs,
    get(id) { return docs.get(id) ?? [...docs.values()].find((d) => d.destinationId === id); },
    async insertOne(doc) { docs.set(doc._id, structuredClone(doc)); return { insertedId: doc._id }; },
    async findOne(filter) {
      for (const d of docs.values()) if (matches(d, filter)) return structuredClone(d);
      return null;
    },
    async findOneAndUpdate(filter, update) {
      for (const d of docs.values()) {
        if (matches(d, filter)) {
          const stored = docs.get(d._id);
          applyUpdate(stored, update);
          return structuredClone(stored);
        }
      }
      return null;
    },
    find(filter) {
      return {
        sort(spec) {
          return {
            toArray: async () => {
              const rows = [...docs.values()].filter((d) => matches(d, filter));
              const [[sortKey, dir]] = Object.entries(spec);
              rows.sort((a, b) => (getPath(a, sortKey) - getPath(b, sortKey)) * (dir === 1 ? 1 : -1));
              return rows.map((d) => structuredClone(d));
            },
          };
        },
      };
    },
  };
}

const DEST_SEED = [
  { _id: "id-a", destinationId: "account-a-yash", internalLabel: "A", payeeName: "Yash", upiId: "yashpatil76317@okicici", sequence: 0, capacity: 0, assignedCount: 0, status: "disabled", ownerApproved: false, allowNewAssignments: false },
  { _id: "id-b", destinationId: "account-b-shivam", internalLabel: "B", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici", sequence: 1, capacity: 2, assignedCount: 0, status: "active", ownerApproved: true, allowNewAssignments: true },
  { _id: "id-c", destinationId: "account-c-bhushan", internalLabel: "C", payeeName: "Bhushan Bhusare (ECELL Team)", upiId: "bbhusare73@oksbi", sequence: 2, capacity: 2, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true },
  { _id: "id-d", destinationId: "account-d-shubham", internalLabel: "D", payeeName: "Shubham Jadhav (ECELL Team)", upiId: "9834717038@ybl", sequence: 3, capacity: 2, assignedCount: 0, status: "disabled", ownerApproved: true, allowNewAssignments: false },
  { _id: "id-f", destinationId: "account-f-priyanka", internalLabel: "F", payeeName: "Priyanka Ripote (Ecell Team)", upiId: "9172140735@ybl", sequence: 4, capacity: 1, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true },
  { _id: "id-e", destinationId: "account-e-sneha", internalLabel: "E", payeeName: "Sneha Dagwar (ECELL Team)", upiId: "snehadagwar06@okicici", sequence: 5, capacity: 2, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true },
];

function prodSnapshot() {
  return {
    expectedAmount: 699,
    currency: "INR",
    payeeName: "Yash Patil",
    upiId: "yashpatil76317@okicici",
    eventKey: "illuminate-2026",
    mode: "production",
    pricingTier: "regular",
    registrationAvailable: true,
    calculatedAt: new Date().toISOString(),
  };
}

function draftReg(overrides = {}) {
  const publicId = overrides.publicId ?? `ILL26-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X")}`;
  const token = generateParticipantAccessToken(publicId);
  return {
    reg: {
      _id: overrides._id ?? `r-${publicId}`,
      schemaVersion: 2,
      eventKey: "illuminate-2026",
      publicId,
      environment: "production",
      isTest: false,
      participantAccessTokenHash: hashParticipantAccessToken(token),
      participant: { fullName: "Test User", email: `${publicId}@example.invalid`, normalizedEmail: `${publicId}@example.invalid`, phone: "9876543210", normalizedPhone: "9876543210" },
      payment: { snapshot: prodSnapshot(), pendingQRGeneration: true, status: "payment_pending", proofHistory: [] },
      idempotencyKeyHash: `idem-${publicId}`,
      audit: [{ type: "registration_created", actor: "participant", at: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides.patch,
    },
    token,
  };
}

function harness() {
  const regs = makeCollection();
  const dests = makeCollection(DEST_SEED);
  const cap = makeCollection([{ _id: EVENT_CAPACITY_ID, seatLimit: 120, committedCount: 0, updatedAt: new Date() }]);
  const store = { registrations: regs, destinations: dests, eventCapacity: cap };
  const runTransaction = (fn) => fn({});
  const availability = { manuallyClosed: false, snapshot: prodSnapshot() };
  return { regs, dests, cap, store, runTransaction, availability };
}

// A. Draft shape -------------------------------------------------------------
test("A. draft resolves as draft with no destination, no instructions state", () => {
  const { reg } = draftReg({ publicId: "ILL26-DRAFT1" });
  assert.equal(reg.payment.status, "payment_pending");
  assert.equal(reg.payment.destination, undefined);
  assert.deepEqual(reg.payment.proofHistory, []);
  assert.equal(resolveRegistrationDestination(reg).kind, "draft");
});

// B. Status model ------------------------------------------------------------
test("B. generate endpoint exposes destination + instructions contract", () => {
  const route = readFileSync(new URL("../src/app/api/payment/qr/[token]/route.ts", import.meta.url), "utf8");
  assert.match(route, /generateFirstPaymentQR/);
  assert.match(route, /runTransaction/);
  assert.match(route, /paymentDestination/);
  assert.match(route, /paymentInstructions/);
  assert.match(route, /expectedAmount/);
  assert.match(route, /pricingTier/);
  assert.match(route, /qrClaimedAt/);
  assert.match(route, /idempotent/);
  assert.match(route, /buildUpiUriForDestination/);
  assert.doesNotMatch(route, /_id/);
});

// C. First Generate claims exactly one seat + one slot ------------------------
test("C. first Generate claims exactly 1 seat + 1 slot and attaches", async () => {
  const h = harness();
  const { reg, token } = draftReg({ publicId: "ILL26-FIRST1" });
  await h.regs.insertOne(reg);
  const before = (await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount;
  const result = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
  assert.equal(result.idempotent, false);
  assert.equal(result.destination.destinationId, "account-b-shivam");
  assert.equal(result.seatNumber, before + 1);
  assert.equal(result.slotNumber, 1);
  assert.ok(result.qrClaimedAt instanceof Date);
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, before + 1);
  assert.equal(h.dests.get("account-b-shivam").assignedCount, 1);
  const stored = await h.regs.findOne({ _id: reg._id });
  assert.equal(stored.payment.destination.destinationId, "account-b-shivam");
  assert.ok(stored.payment.qrClaimedAt instanceof Date);
  assert.equal(stored.payment.pendingQRGeneration, undefined);
  assert.ok(stored.audit.some((e) => e.type === "payment_destination_assigned"));
  assert.ok(stored.audit.some((e) => e.type === "event_seat_committed"));
});

// C2. Second POST returns same destination with zero increments --------------
test("C2. second Generate returns same destination with zero increments", async () => {
  const h = harness();
  const { reg, token } = draftReg({ publicId: "ILL26-TWICE1" });
  await h.regs.insertOne(reg);
  const first = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
  const seatAfterFirst = (await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount;
  const slotAfterFirst = h.dests.get(first.destination.destinationId).assignedCount;
  for (let i = 0; i < 20; i += 1) {
    const replay = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
    assert.equal(replay.idempotent, true);
    assert.equal(replay.destination.destinationId, first.destination.destinationId);
  }
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, seatAfterFirst);
  assert.equal(h.dests.get(first.destination.destinationId).assignedCount, slotAfterFirst);
});

// E. Different drafts fill B→C→F→E, D stays empty ------------------------------
test("E. different drafts spill B→C→F→E with D skipped", async () => {
  const h = harness();
  const got = [];
  for (let i = 0; i < 7; i += 1) {
    const { reg, token } = draftReg({ publicId: `ILL26-SPIL${i}` });
    await h.regs.insertOne(reg);
    got.push((await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability })).destination.destinationId);
  }
  assert.deepEqual(got, [
    "account-b-shivam", "account-b-shivam",
    "account-c-bhushan", "account-c-bhushan",
    "account-f-priyanka",
    "account-e-sneha", "account-e-sneha",
  ]);
  assert.equal(h.dests.get("account-d-shubham").assignedCount, 0);
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, 7);
  // 8th draft: everything usable is full → PAYMENT_CAPACITY_FULL.
  const { reg, token } = draftReg({ publicId: "ILL26-SPILX" });
  await h.regs.insertOne(reg);
  await assert.rejects(
    generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability }),
    (error) => error.code === "PAYMENT_CAPACITY_FULL",
  );
});

// F. Seat-full wins at the atomic counter --------------------------------------
test("F. seat counter at 119 admits exactly one more, then FULL", async () => {
  const h = harness();
  await h.cap.findOneAndUpdate({ _id: EVENT_CAPACITY_ID }, { $set: { committedCount: 119 } });
  const { reg, token } = draftReg({ publicId: "ILL26-SEAT119" });
  await h.regs.insertOne(reg);
  const winner = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
  assert.equal(winner.seatNumber, 120);
  const { reg: reg2, token: token2 } = draftReg({ publicId: "ILL26-SEAT120" });
  await h.regs.insertOne(reg2);
  await assert.rejects(
    generateFirstPaymentQR({ token: token2, store: h.store, runTransaction: h.runTransaction, availability: h.availability }),
    (error) => error.code === "EVENT_REGISTRATION_FULL",
  );
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, 120);
  // Loser's destination slot untouched.
  assert.equal(h.dests.get(winner.destination.destinationId).assignedCount, 1);
});

// Fail-closed when uninitialized ------------------------------------------------
test("uninitialized event capacity fails closed without consuming a slot", async () => {
  const h = harness();
  h.cap._docs.clear();
  const { reg, token } = draftReg({ publicId: "ILL26-NOINIT" });
  await h.regs.insertOne(reg);
  await assert.rejects(
    generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability }),
    (error) => error.code === "EVENT_CAPACITY_NOT_INITIALIZED",
  );
  assert.equal(h.dests.get("account-b-shivam").assignedCount, 0);
  const stored = await h.regs.findOne({ _id: reg._id });
  assert.equal(stored.payment.destination, undefined);
});

// H. Manual close blocks first issuance, not idempotent reads ------------------
test("H. manual close blocks first Generate but not issued reads", async () => {
  const h = harness();
  const { reg, token } = draftReg({ publicId: "ILL26-CLOSED1" });
  await h.regs.insertOne(reg);
  const closed = { manuallyClosed: true, snapshot: prodSnapshot() };
  await assert.rejects(
    generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: closed }),
    (error) => error.code === "REGISTRATION_CLOSED",
  );
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, 0);
  // Issue first while open, then close: idempotent return still works.
  const ok = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
  assert.equal(ok.idempotent, false);
  const reread = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: closed });
  assert.equal(reread.idempotent, true);
  assert.equal(reread.destination.destinationId, ok.destination.destinationId);
});

// H2. Date-closed (no snapshot) blocks first issuance ---------------------------
test("H2. date-closed snapshot blocks first Generate", async () => {
  const h = harness();
  const { reg, token } = draftReg({ publicId: "ILL26-DATECLOSED" });
  await h.regs.insertOne(reg);
  await assert.rejects(
    generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: { manuallyClosed: false, snapshot: null } }),
    (error) => error.code === "PAYMENT_NOT_AVAILABLE",
  );
});

// I. Proof guard requires destination before GridFS --------------------------------
test("I. proof submission requires an issued QR", () => {
  const src = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
  const start = src.indexOf("export async function submitPaymentProofForParticipant");
  const end = src.indexOf("\nexport ", start + 1);
  const block = src.slice(start, end === -1 ? undefined : end);
  assert.match(block, /PAYMENT_QR_REQUIRED/);
  assert.ok(block.indexOf("PAYMENT_QR_REQUIRED") < block.indexOf("getPaymentProofBucket"));
});

// J. Commitment predicate + release floor -----------------------------------------
test("J. hasSeatCommitment matrix and release floor", async () => {
  assert.equal(hasSeatCommitment({ status: "verified", destination: null }), true);
  assert.equal(hasSeatCommitment({ status: "submitted_for_verification", destination: null }), true);
  assert.equal(hasSeatCommitment({ status: "payment_pending", destination: { destinationId: "account-b-shivam" } }), true);
  assert.equal(hasSeatCommitment({ status: "rejected", destination: { destinationId: "account-b-shivam" } }), true);
  assert.equal(hasSeatCommitment({ status: "payment_pending", destination: null }), false);
  assert.equal(hasSeatCommitment({ status: "payment_pending" }), false);
  const h = harness();
  assert.equal((await releaseEventSeat(h.store.eventCapacity)).released, false);
  await h.cap.findOneAndUpdate({ _id: EVENT_CAPACITY_ID }, { $set: { committedCount: 2 } });
  assert.equal((await releaseEventSeat(h.store.eventCapacity)).released, true);
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, 1);
  // Delete-route symmetry: drafts release nothing, issued rows release both.
  const adminDelete = readFileSync(new URL("../src/app/api/admin/registrations/[publicId]/route.ts", import.meta.url), "utf8");
  assert.match(adminDelete, /hasSeatCommitment/);
  assert.match(adminDelete, /releaseEventSeat/);
  assert.match(adminDelete, /seatReleased/);
  const clearPending = readFileSync(new URL("../scripts/clear-pending-registrations.mts", import.meta.url), "utf8");
  assert.match(clearPending, /releaseEventSeat/);
});

// K. Rejected keeps destination; rejected-without-destination can claim ------------
test("K. rejected retains destination, resubmit needs no new seat", async () => {
  const h = harness();
  const { reg, token } = draftReg({ publicId: "ILL26-REJKEEP" });
  await h.regs.insertOne(reg);
  const first = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
  await h.regs.findOneAndUpdate({ _id: reg._id }, { $set: { "payment.status": "rejected" } });
  const again = await generateFirstPaymentQR({ token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
  assert.equal(again.idempotent, true);
  assert.equal(again.destination.destinationId, first.destination.destinationId);
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, 1);
  assert.equal(h.dests.get(first.destination.destinationId).assignedCount, 1);
  // Rejected draft without destination may claim through the re-pay path.
  const typo = draftReg({ publicId: "ILL26-REJNEW" });
  await h.regs.insertOne({ ...typo.reg, payment: { ...typo.reg.payment, status: "rejected" } });
  const fresh = await generateFirstPaymentQR({ token: typo.token, store: h.store, runTransaction: h.runTransaction, availability: h.availability });
  assert.equal(fresh.idempotent, false);
  assert.equal((await h.cap.findOne({ _id: EVENT_CAPACITY_ID })).committedCount, 2);
});

// L+M. Ground truth: 49 legacy + 41 backed = 90, deduped ------------------------------
test("L+M. ground truth counts 49 legacy + 41 backed as 90, drafts zero", () => {
  const legacy = Array.from({ length: 49 }, () => ({ payment: { status: "verified", destination: null } }));
  const backed = [
    ...Array.from({ length: 9 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-b-shivam" } } })),
    ...Array.from({ length: 10 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-c-bhushan" } } })),
    ...Array.from({ length: 10 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-d-shubham" } } })),
    ...Array.from({ length: 12 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-e-sneha" } } })),
  ];
  assert.equal(computeCommittedGroundTruth([...legacy, ...backed]), 90);
  // Dedupe: one registration counts once even with both signals.
  assert.equal(computeCommittedGroundTruth([{ payment: { status: "verified", destination: { destinationId: "account-b-shivam" } } }]), 1);
  assert.equal(computeCommittedGroundTruth([{ payment: { status: "submitted_for_verification", destination: { destinationId: "account-c-bhushan" } } }]), 1);
  assert.equal(computeCommittedGroundTruth([{ payment: { status: "payment_pending", destination: { destinationId: "account-b-shivam" } } }]), 1);
  assert.equal(computeCommittedGroundTruth([{ payment: { status: "rejected", destination: { destinationId: "account-b-shivam" } } }]), 1);
  assert.equal(computeCommittedGroundTruth([{ payment: { status: "payment_pending", destination: null } }]), 0);
  assert.equal(computeCommittedGroundTruth([{ payment: { status: "rejected", destination: null } }]), 0);
});

// L2. Historical rows keep resolving ---------------------------------------------------
test("L2. historical B/C/D/E + legacy-A-blocked behavior preserved", () => {
  for (const [id, upi] of [
    ["account-b-shivam", "shivujadhav2006@okicici"],
    ["account-c-bhushan", "bbhusare73@oksbi"],
    ["account-d-shubham", "9834717038@ybl"],
    ["account-e-sneha", "snehadagwar06@okicici"],
  ]) {
    const resolved = resolveRegistrationDestination({
      payment: {
        status: "verified",
        snapshot: prodSnapshot(),
        destination: { destinationId: id, internalLabel: id, payeeName: id, upiId: upi, assignedAt: new Date() },
        proofHistory: [],
      },
    });
    assert.equal(resolved.kind, "assigned");
  }
  // Legacy Account A pending (no draft marker) stays blocked.
  assert.equal(
    resolveRegistrationDestination({
      payment: { status: "payment_pending", snapshot: prodSnapshot(), proofHistory: [] },
    }).kind,
    "blocked_account_a_pending",
  );
});

// N. Tier display helper -----------------------------------------------------------
test("N. raw regular displays Late Registration, raw preserved", () => {
  assert.equal(displayPricingTier("regular"), "Late Registration");
  assert.equal(displayPricingTier("early_bird"), "Early Bird");
  const client = readFileSync(new URL("../src/components/registration/PaymentStatusClient.tsx", import.meta.url), "utf8");
  assert.match(client, /displayPricingTier/);
  assert.doesNotMatch(client, /tierLabel/);
});

// QR GET stays pure read ---------------------------------------------------------------
test("QR image endpoint never claims, drafts get explicit error", () => {
  const qr = readFileSync(new URL("../src/app/api/payment/status/[token]/qr/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(qr, /claimNextDestinationSlot/);
  assert.doesNotMatch(qr, /claimEventSeat/);
  assert.match(qr, /PAYMENT_QR_NOT_GENERATED/);
});
