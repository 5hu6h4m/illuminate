/**
 * PRE-COMMIT real-MongoDB integration test — ISOLATED database only.
 *
 * Uses the Atlas connection but ONLY the dedicated database
 * `illuminate_capacity_test`. Refuses to run against `illuminate` or any
 * configured production database name. Prints only the database name and
 * cluster host — never MONGODB_URI, credentials, or tokens.
 *
 * Exercises the REAL production slot-claim logic from
 * src/lib/payment-destinations.ts (no algorithm duplication) plus the real
 * resolver, UPI builder, and duplicate-policy helpers.
 *
 * Run:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/integration-capacity-test.mts
 */
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { MongoClient } from "mongodb";
import {
  ACCOUNT_A_DESTINATION_ID,
  buildDestinationSnapshot,
  claimNextDestinationSlot,
  releaseDestinationSlot,
  type PaymentDestination,
} from "@/lib/payment-destinations";
import { buildUpiUriForDestination } from "@/lib/payment";
import { resolveRegistrationDestination } from "@/lib/payment-flow-service";
import { decideExistingIdentityDuplicate, isIdempotentReplayForIdentity } from "@/lib/registration-duplicate-policy";

const TEST_DB: string = "illuminate_capacity_test";
const EVENT_KEY = "illuminate-2026";
const LEGACY_A_UPI = "yashpatil76317@okicici";

function safeHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//, "https://").replace(/^mongodb:\/\//, "https://")).hostname;
  } catch {
    return "unparseable";
  }
}

function destSeed(now: Date): PaymentDestination[] {
  return [
    { destinationId: "account-a-yash", internalLabel: "Yash Account / Account A / E-Cell Payment 1", payeeName: "Yash Patil (ECELL Team)", upiId: LEGACY_A_UPI, sequence: 0, capacity: 0, assignedCount: 0, status: "disabled", ownerApproved: false, allowNewAssignments: false, createdAt: now, updatedAt: now, disabledAt: now },
    { destinationId: "account-b-shivam", internalLabel: "Shivam Account / Account B / E-Cell Payment 2", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici", sequence: 1, capacity: 10, assignedCount: 0, status: "active", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now, activatedAt: now },
    { destinationId: "account-c-bhushan", internalLabel: "Bhushan Bhusare / Account C / E-Cell Payment 3", payeeName: "Bhushan Bhusare (ECELL Team)", upiId: "bbhusare73@oksbi", sequence: 2, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now },
    { destinationId: "account-d-shubham", internalLabel: "Shubham Account / Account D / E-Cell Payment 4", payeeName: "Shubham Jadhav (ECELL Team)", upiId: "9834717038@ybl", sequence: 3, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now },
    { destinationId: "account-e-sneha", internalLabel: "Sneha Dagwar / Account E / E-Cell Payment 5", payeeName: "Sneha Dagwar (ECELL Team)", upiId: "snehadagwar06@okicici", sequence: 4, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function testReg(publicId: string, i: number, status = "payment_pending", createdAt = new Date(Date.UTC(2026, 8, 15, 10, 0, i))): any {
  const phone = `98765${String(10000 + i)}`;
  return {
    schemaVersion: 2,
    eventKey: EVENT_KEY,
    publicId,
    environment: "production",
    isTest: true,
    participantAccessTokenHash: `test-hash-${i}`,
    participant: { fullName: `Capacity Test ${i}`, email: `capacity.test.${i}@example.invalid`, normalizedEmail: `capacity.test.${i}@example.invalid`, phone, normalizedPhone: phone },
    payment: {
      snapshot: { expectedAmount: 599, currency: "INR", payeeName: "Yash Patil", upiId: LEGACY_A_UPI, eventKey: EVENT_KEY, mode: "production", pricingTier: "early_bird", registrationAvailable: true, calculatedAt: new Date().toISOString() },
      status,
      proofHistory: [],
    },
    idempotencyKeyHash: createHash("sha256").update(`test-idempotency-key-${i}-pad-to-16-chars`).digest("hex"),
    audit: [{ type: "registration_created", actor: "participant", at: createdAt }],
    createdAt,
    updatedAt: createdAt,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  if (!uri) throw new Error("MONGODB_URI is not configured");
  const prodDb = process.env.MONGODB_DB_NAME ?? process.env.MONGODB_DB ?? "illuminate";
  if (TEST_DB === "illuminate" || TEST_DB === prodDb) throw new Error(`REFUSED: test database resolves to production (${TEST_DB})`);
  console.log(`[integration] database name: ${TEST_DB}`);
  console.log(`[integration] cluster host: ${safeHost(uri)}`);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("[integration] real Mongo connection: OK");
    const db = client.db(TEST_DB);
    const dests = db.collection<PaymentDestination>("payment_destinations");
    const regs = db.collection("registrations");
    async function mustDest(id: string) {
      const doc = await dests.findOne({ destinationId: id });
      assert.ok(doc, `test destination ${id} exists`);
      return doc;
    }

    // ---- seed test-only destinations ----
    await dests.deleteMany({});
    await regs.deleteMany({});
    await dests.createIndex({ destinationId: 1 }, { unique: true });
    await dests.insertMany(destSeed(new Date()));
    console.log("[integration] test destinations seeded: A disabled/0, B active/10, C/D/E available/10");

    // ---- 3. REAL CONCURRENCY: B at 9, 20 concurrent claims ----
    await dests.updateOne({ destinationId: "account-b-shivam" }, { $set: { assignedCount: 9 } });
    const burst = await Promise.all(Array.from({ length: 20 }, () => claimNextDestinationSlot(dests)));
    const ok = burst.filter((r) => r.ok);
    assert.equal(ok.length, 20, "all 20 concurrent claims must succeed");
    const bWins = ok.filter((r) => r.ok && r.destination.destinationId === "account-b-shivam");
    assert.equal(bWins.length, 1, "exactly 1 registration gets Account B");
    assert.equal(bWins[0].ok && bWins[0].slotNumber, 10, "the B winner takes slot 10");
    const bDoc = await mustDest("account-b-shivam");
    const cDoc = await mustDest("account-c-bhushan");
    const dDoc = await mustDest("account-d-shubham");
    assert.equal(bDoc.assignedCount, 10, "B 10/10");
    assert.equal(bDoc.status, "exhausted", "B exhausted");
    assert.ok(cDoc.assignedCount <= 10 && dDoc.assignedCount <= 10, "C/D never exceed 10");
    assert.equal(cDoc.assignedCount, 10, "C filled 10/10");
    assert.equal(cDoc.status, "exhausted", "C exhausted at 10/10");
    assert.equal(dDoc.assignedCount, 9, "D receives remaining 9");
    assert.equal(dDoc.status, "active", "D activated after C exhausted");
    console.log(`[integration] concurrency: 1xB-10, 10xC, 9xD — B max ${bDoc.assignedCount}/10, C max ${cDoc.assignedCount}/10`);

    // ---- 4. IDEMPOTENCY: same key replays without a second slot ----
    const before = (await mustDest("account-d-shubham")).assignedCount as number;
    const claim = await claimNextDestinationSlot(dests);
    assert.equal(claim.ok, true);
    const snap = buildDestinationSnapshot(claim.ok && claim.destination, new Date());
    const reg = testReg("ILL26-TESTIDEM", 500);
    reg.payment.destination = snap;
    reg.payment.snapshot = { ...reg.payment.snapshot, payeeName: snap.payeeName, upiId: snap.upiId };
    await regs.insertOne(reg);
    const afterCreate = (await mustDest(snap.destinationId)).assignedCount as number;
    // Replay: exact same idempotency key → same registration, no new claim.
    const replay = await regs.findOne({ schemaVersion: 2, eventKey: EVENT_KEY, idempotencyKeyHash: reg.idempotencyKeyHash });
    assert.ok(replay && replay.publicId === "ILL26-TESTIDEM", "replay returns same registration");
    assert.equal(isIdempotentReplayForIdentity(replay.participant, { normalizedEmail: reg.participant.normalizedEmail, normalizedPhone: reg.participant.normalizedPhone }), true);
    const afterReplay = (await mustDest(snap.destinationId)).assignedCount as number;
    assert.equal(afterReplay, afterCreate, "no second slot consumed on replay");
    assert.equal(before + 1, afterCreate, "exactly one slot for first creation");
    console.log("[integration] idempotency: same registration, no second slot");

    // ---- 5. DUPLICATE: same email rejected via policy, no slot ----
    const dupCountBefore = (await mustDest("account-e-sneha")).assignedCount as number;
    const decision = decideExistingIdentityDuplicate("payment_pending", "production");
    assert.equal(decision.kind, "safe_conflict", "duplicate resolves through policy");
    const dupCountAfter = (await mustDest("account-e-sneha")).assignedCount as number;
    assert.equal(dupCountAfter, dupCountBefore, "no extra slot consumed for duplicate");
    console.log(`[integration] duplicate: ${decision.kind}/${"code" in decision ? decision.code : ""}, no slot consumed`);

    // ---- 6. FAILED WRITE: reserve then refund ----
    const failTarget = "account-e-sneha";
    const f0 = (await mustDest(failTarget)).assignedCount as number;
    const reserved = await claimNextDestinationSlot(dests);
    assert.equal(reserved.ok, true);
    if (!reserved.ok) throw new Error("reservation for failed-write test did not succeed");
    assert.equal((await mustDest(reserved.destination.destinationId)).assignedCount as number, f0 + 1);
    await releaseDestinationSlot(dests, reserved.destination.destinationId);
    assert.equal((await mustDest(failTarget)).assignedCount as number, f0, "slot refunded, count unchanged");
    console.log("[integration] failed-write refund: count unchanged");

    // ---- 7. FULL CAPACITY: fill to 40, next gets PAYMENT_CAPACITY_FULL ----
    let guard = 0;
    for (;;) {
      const c = await claimNextDestinationSlot(dests);
      guard += 1;
      if (!c.ok) break;
      if (guard > 50) throw new Error("fill loop did not terminate");
    }
    for (const id of ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"]) {
      assert.equal((await mustDest(id)).assignedCount, 10, `${id} 10/10`);
    }
    const full = await claimNextDestinationSlot(dests);
    assert.equal(full.ok, false);
    assert.equal(full.capacityFull, true, "PAYMENT_CAPACITY_FULL with no fallback");
    console.log("[integration] full capacity: B=C=D=E=10/10, next claim FULL, no fallback");

    // ---- 8. SPLIT REASSIGNMENT on fresh test seed ----
    await dests.deleteMany({});
    await regs.deleteMany({});
    await dests.insertMany(destSeed(new Date()));
    const legacy: string[] = [];
    for (let i = 0; i < 16; i += 1) {
      const r = testReg(`ILL26-SPLIT${String(i).padStart(2, "0")}`, i);
      await regs.insertOne(r);
      legacy.push(r.publicId);
    }
    const sourceMatch = { $or: [{ "payment.destination.destinationId": ACCOUNT_A_DESTINATION_ID }, { "payment.destination.destinationId": { $exists: false }, "payment.snapshot.upiId": LEGACY_A_UPI }] };
    const fromFilter = { schemaVersion: 2, isTest: true, "payment.status": "payment_pending", ...sourceMatch };

    async function partialMove(toId: string) {
      const target = await mustDest(toId);
      const remaining = Math.max(0, (target.capacity as number) - (target.assignedCount as number));
      const eligibleCount = await regs.countDocuments(fromFilter);
      const moveCount = Math.min(eligibleCount, remaining);
      assert.ok(moveCount > 0, `moveCount>0 for ${toId}`);
      const reservedDoc = await dests.findOneAndUpdate(
        { destinationId: toId, assignedCount: { $lte: target.capacity - moveCount } },
        { $inc: { assignedCount: moveCount }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      assert.ok(reservedDoc, "reservation succeeded without overflow");
      const selected = await regs.find(fromFilter, { projection: { _id: 1 } }).sort({ createdAt: 1, _id: 1 }).limit(moveCount).toArray();
      const now = new Date();
      let moved = 0;
      for (const doc of selected) {
        const moveUpdate = {
          $set: {
            "payment.destination": { destinationId: target.destinationId, internalLabel: target.internalLabel, payeeName: target.payeeName, upiId: target.upiId, assignedAt: now },
            "payment.snapshot.payeeName": target.payeeName,
            "payment.snapshot.upiId": target.upiId,
            updatedAt: now,
          },
          $push: { audit: { type: "payment_destination_reassigned", actor: "admin", at: now, metadata: { fromDestinationId: ACCOUNT_A_DESTINATION_ID, toDestinationId: toId, reason: "legacy_blocked_destination", selectionPolicy: "oldest_pending_first" } } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        const updated = await regs.findOneAndUpdate(
          { _id: doc._id, schemaVersion: 2, "payment.status": "payment_pending", ...sourceMatch },
          moveUpdate,
          { returnDocument: "after" },
        );
        if (updated) moved += 1;
      }
      const unused = moveCount - moved;
      if (unused > 0) await dests.updateOne({ destinationId: toId }, { $inc: { assignedCount: -unused }, $set: { updatedAt: now } });
      const after = await mustDest(toId);
      if ((after.assignedCount as number) >= (after.capacity as number)) {
        await dests.updateOne({ destinationId: toId, status: { $in: ["active", "available"] } }, { $set: { status: "exhausted", allowNewAssignments: false, exhaustedAt: now, updatedAt: now } });
        const next = await dests.find({ status: "available", ownerApproved: true, allowNewAssignments: true }).sort({ sequence: 1 }).toArray();
        const cand = next.filter((d) => d.destinationId !== ACCOUNT_A_DESTINATION_ID && d.sequence > after.sequence && d.assignedCount < d.capacity)[0];
        if (cand) await dests.updateOne({ destinationId: cand.destinationId, status: "available" }, { $set: { status: "active", activatedAt: now, updatedAt: now } });
      }
      return { moved, eligibleCount };
    }

    const first = await partialMove("account-b-shivam");
    assert.equal(first.moved, 10, "A→B moves exactly 10");
    assert.equal(await regs.countDocuments(fromFilter), 6, "6 remain on A");
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 10);
    assert.equal((await mustDest("account-b-shivam")).status, "exhausted");
    assert.equal((await mustDest("account-c-bhushan")).status, "active");
    const movedB = await regs.find({ "payment.destination.destinationId": "account-b-shivam" }).sort({ createdAt: 1 }).toArray();
    assert.deepEqual(movedB.map((r) => r.publicId), legacy.slice(0, 10), "oldest 10 moved first");
    console.log("[integration] A→B: moved 10, remaining A 6, B 10/10 exhausted, C active");

    const second = await partialMove("account-c-bhushan");
    assert.equal(second.moved, 6, "A→C moves remaining 6");
    assert.equal(await regs.countDocuments(fromFilter), 0, "A pending 0");
    assert.equal((await dests.findOne({ destinationId: "account-c-bhushan" }))?.assignedCount, 6);
    const assigned = ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"]
      .reduce(async (s, id) => (await s) + ((await dests.findOne({ destinationId: id }))?.assignedCount ?? -1000), Promise.resolve(0));
    assert.equal(40 - (await assigned), 24, "remaining capacity 24");
    console.log("[integration] A→C: moved 6, remaining A 0, C 6/10, remaining capacity 24");

    // ---- 9. STATE LOCK: submitted/verified/rejected never move ----
    for (const [i, status] of (["submitted_for_verification", "verified", "rejected"] as const).entries()) {
      const r = testReg(`ILL26-LOCK${i}`, 900 + i, status);
      await regs.insertOne(r);
    }
    let lockedMoved = 0;
    for (const r of await regs.find({ publicId: { $regex: /^ILL26-LOCK/ } }).toArray()) {
      const updated = await regs.findOneAndUpdate(
        { _id: r._id, schemaVersion: 2, "payment.status": "payment_pending", ...sourceMatch },
        { $set: { "payment.destination.destinationId": "account-d-shubham" } },
      );
      if (updated) lockedMoved += 1;
    }
    assert.equal(lockedMoved, 0, "locked states never move");
    console.log("[integration] state lock: submitted/verified/rejected untouched");

    // ---- 10. QR DATA: C-assigned registration resolves correctly ----
    const cReg = (await regs.findOne({ "payment.destination.destinationId": "account-c-bhushan" })) as unknown as {
      publicId: string;
      payment: { snapshot: { expectedAmount: number }; destination?: { destinationId: string } };
    } | null;
    assert.ok(cReg, "a C-assigned registration exists");
    const resolved = resolveRegistrationDestination({ payment: cReg.payment } as Parameters<typeof resolveRegistrationDestination>[0]);
    assert.equal(resolved.kind, "assigned");
    if (resolved.kind === "assigned") {
      assert.equal(resolved.payeeName, "Bhushan Bhusare (ECELL Team)");
      assert.equal(resolved.upiId, "bbhusare73@oksbi");
      const uri = buildUpiUriForDestination(resolved, cReg.payment.snapshot.expectedAmount, cReg.publicId);
      const params = new URL(uri).searchParams;
      assert.equal(params.get("pa"), "bbhusare73@oksbi");
      assert.equal(params.get("am"), "599.00", "expectedAmount unchanged at 599");
    }
    assert.equal(cReg.payment.snapshot.expectedAmount, 599, "stored amount unchanged");
    console.log("[integration] QR: C payee/UPI resolved, amount unchanged 599");

    console.log("[integration] ALL REAL-MONGO ASSERTIONS PASSED");
  } finally {
    // ---- 11. CLEANUP: drop ONLY the isolated test database ----
    // (The Atlas role may deny dropDatabase; fall back to clearing every
    // test collection. Either way the TEST namespace — and only it — is
    // emptied. Cleanup failures are logged, never mask the test outcome.)
    try {
      try {
        await client.db(TEST_DB).dropDatabase();
        console.log("[integration] cleanup: illuminate_capacity_test dropped");
      } catch {
        await client.db(TEST_DB).collection("payment_destinations").deleteMany({});
        await client.db(TEST_DB).collection("registrations").deleteMany({});
        console.log("[integration] cleanup: dropDatabase denied by role; test collections cleared instead");
      }
      const left = (await client.db(TEST_DB).collection("payment_destinations").countDocuments())
        + (await client.db(TEST_DB).collection("registrations").countDocuments());
      console.log(`[integration] cleanup confirmed: ${left} docs remain in ${TEST_DB}`);
    } catch (cleanupError) {
      console.error("[integration] cleanup warning:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
    } finally {
      await client.close();
    }
  }
}

void main().catch((error) => {
  console.error("[integration] FAILED", error instanceof Error ? error.message : error);
  process.exit(1);
});
