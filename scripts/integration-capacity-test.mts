/**
 * PRE-COMMIT real-MongoDB integration test — ISOLATED database only (V3).
 *
 * Uses the Atlas connection but ONLY the dedicated database
 * `illuminate_capacity_test`. Refuses to run against `illuminate` or any
 * configured production database name. Prints only the database name and
 * cluster host — never MONGODB_URI, credentials, or tokens.
 *
 * Exercises the REAL V3 Generate-QR commitment path from
 * src/lib/payment-flow-service.ts (generateFirstPaymentQR) plus the real
 * event-capacity and destination slot primitives, all inside real MongoDB
 * transactions on the isolated namespace:
 *   draft creation moves no counters → explicit Generate claims exactly one
 *   event seat + one destination slot + attaches, idempotently per token,
 *   with D skipped and Priyanka before Sneha, failing closed at seat 120.
 *
 * Run:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/integration-capacity-test.mts
 */
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { MongoClient, ObjectId } from "mongodb";
import {
  ACCOUNT_A_DESTINATION_ID,
  releaseDestinationSlot,
  type PaymentDestination,
} from "@/lib/payment-destinations";
import {
  EVENT_CAPACITY_ID,
  computeCommittedGroundTruth,
  hasSeatCommitment,
  releaseEventSeat,
  type EventCapacityDoc,
} from "@/lib/event-capacity";
import { generateParticipantAccessToken, hashParticipantAccessToken } from "@/lib/payment";
import { generateFirstPaymentQR } from "@/lib/payment-flow-service";
import type { RegistrationV2 } from "@/lib/registration-v2";

const TEST_DB: string = "illuminate_capacity_test";
const EVENT_KEY = "illuminate-2026";

function safeHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//, "https://").replace(/^mongodb:\/\//, "https://")).hostname;
  } catch {
    return "unparseable";
  }
}

function destSeed(now: Date): PaymentDestination[] {
  return [
    { destinationId: "account-a-yash", internalLabel: "Yash Account / Account A / E-Cell Payment 1", payeeName: "Yash Patil (ECELL Team)", upiId: "yashpatil76317@okicici", sequence: 0, capacity: 0, assignedCount: 0, status: "disabled", ownerApproved: false, allowNewAssignments: false, createdAt: now, updatedAt: now, disabledAt: now },
    { destinationId: "account-b-shivam", internalLabel: "Shivam Account / Account B / E-Cell Payment 2", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici", sequence: 1, capacity: 20, assignedCount: 0, status: "active", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now, activatedAt: now },
    { destinationId: "account-c-bhushan", internalLabel: "Bhushan Bhusare / Account C / E-Cell Payment 3", payeeName: "Bhushan Bhusare (ECELL Team)", upiId: "bbhusare73@oksbi", sequence: 2, capacity: 20, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now },
    { destinationId: "account-d-shubham", internalLabel: "Shubham Account / Account D / E-Cell Payment 4", payeeName: "Shubham Jadhav (ECELL Team)", upiId: "9834717038@ybl", sequence: 3, capacity: 10, assignedCount: 0, status: "disabled", ownerApproved: true, allowNewAssignments: false, createdAt: now, updatedAt: now, disabledAt: now },
    { destinationId: "account-f-priyanka", internalLabel: "Priyanka Ripote / Account F / E-Cell Payment", payeeName: "Priyanka Ripote (Ecell Team)", upiId: "9172140735@ybl", sequence: 4, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now },
    { destinationId: "account-e-sneha", internalLabel: "Sneha Dagwar / Account E / E-Cell Payment 5", payeeName: "Sneha Dagwar (ECELL Team)", upiId: "snehadagwar06@okicici", sequence: 5, capacity: 30, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, createdAt: now, updatedAt: now },
  ];
}

function prodSnapshot() {
  return {
    expectedAmount: 699,
    currency: "INR" as const,
    payeeName: "Yash Patil",
    upiId: "yashpatil76317@okicici",
    eventKey: EVENT_KEY,
    mode: "production" as const,
    pricingTier: "regular" as const,
    registrationAvailable: true,
    calculatedAt: new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function draftDoc(publicId: string, i: number): { doc: any; token: string } {
  const token = generateParticipantAccessToken(publicId);
  if (!token) throw new Error("PARTICIPANT_TOKEN_SECRET is not configured (set it in .env.local; value never printed).");
  const phone = `98765${String(10000 + i)}`;
  return {
    token,
    doc: {
      _id: new ObjectId(),
      schemaVersion: 2,
      eventKey: EVENT_KEY,
      publicId,
      environment: "production",
      isTest: false,
      participantAccessTokenHash: hashParticipantAccessToken(token),
      participant: { fullName: `V3 Test ${i}`, email: `v3.test.${i}@example.invalid`, normalizedEmail: `v3.test.${i}@example.invalid`, phone, normalizedPhone: phone },
      payment: { snapshot: prodSnapshot(), pendingQRGeneration: true, status: "payment_pending", proofHistory: [] },
      idempotencyKeyHash: createHash("sha256").update(`v3-idempotency-${i}-pad-to-16-chars`).digest("hex"),
      audit: [{ type: "registration_created", actor: "participant", at: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
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
    // Transactions require a replica set; V3 QR commitment fails closed
    // without them, so the suite refuses a standalone topology loudly.
    try {
      const hello = await client.db(TEST_DB).command({ hello: 1 }) as { setName?: string };
      assert.ok(hello.setName, "transactions require a replica set (no setName reported)");
      console.log("[integration] replica set: OK");
    } catch (error) {
      throw new Error(`REFUSED: replica set required for transaction tests (${error instanceof Error ? error.message : error})`);
    }
    const db = client.db(TEST_DB);
    const dests = db.collection<PaymentDestination>("payment_destinations");
    const regs = db.collection<RegistrationV2>("registrations");
    const cap = db.collection<EventCapacityDoc>("event_capacity");
    const store = { registrations: regs, destinations: dests, eventCapacity: cap };
    const runTransaction = async <T,>(fn: (session: unknown) => Promise<T>): Promise<T> => {
      const session = client.startSession();
      try {
        return await session.withTransaction(() => fn(session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally {
        await session.endSession().catch(() => undefined);
      }
    };
    const availability = { manuallyClosed: false, snapshot: prodSnapshot() };
    async function mustDest(id: string) {
      const doc = await dests.findOne({ destinationId: id });
      assert.ok(doc, `test destination ${id} exists`);
      return doc;
    }
    async function committedCount(): Promise<number> {
      return (await cap.findOne({ _id: EVENT_CAPACITY_ID }))?.committedCount as number;
    }
    async function reset() {
      await dests.deleteMany({});
      await regs.deleteMany({});
      await cap.deleteMany({});
      await dests.insertMany(destSeed(new Date()));
      await cap.insertOne({ _id: EVENT_CAPACITY_ID, seatLimit: 120, committedCount: 0, updatedAt: new Date() });
    }

    // ---- 1. DRAFT CREATION MOVES NO COUNTERS ----
    await reset();
    console.log("[integration] topology: B20 active, C20, D10 disabled, F10 seq4, E30 seq5, seats 120");
    const d0 = draftDoc("ILL26-V3D001", 1);
    await regs.insertOne(d0.doc);
    assert.equal(await committedCount(), 0, "draft consumes no seat");
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 0, "draft consumes no slot");
    const stored0 = await regs.findOne({ publicId: "ILL26-V3D001" });
    assert.equal(stored0?.payment.destination, undefined, "draft has no destination");
    assert.equal(stored0?.payment.pendingQRGeneration, true, "draft marker set");
    console.log("[integration] draft: 0 seats, 0 slots, no destination");

    // ---- 2. FIRST GENERATE: 1 SEAT + 1 SLOT + ATTACH ----
    const first = await generateFirstPaymentQR({ token: d0.token, store, runTransaction, availability });
    assert.equal(first.idempotent, false);
    assert.equal(first.destination.destinationId, "account-b-shivam");
    assert.equal(first.seatNumber, 1);
    assert.equal(first.slotNumber, 1);
    assert.ok(first.qrClaimedAt instanceof Date);
    assert.equal(await committedCount(), 1);
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 1);
    const stored1 = await regs.findOne({ publicId: "ILL26-V3D001" });
    assert.equal(stored1?.payment.destination?.destinationId, "account-b-shivam");
    assert.ok(stored1?.payment.qrClaimedAt instanceof Date);
    assert.equal(stored1?.payment.pendingQRGeneration, undefined, "marker cleared on issue");
    assert.ok((stored1?.audit as Array<{ type: string }>).some((e) => e.type === "payment_destination_assigned"));
    assert.ok((stored1?.audit as Array<{ type: string }>).some((e) => e.type === "event_seat_committed"));
    console.log("[integration] first Generate: seat 1, B slot 1, attached + audited");

    // ---- 3. SAME-TOKEN 20x CONCURRENT: EXACTLY ONE COMMITMENT ----
    const burst = await Promise.all(Array.from({ length: 20 }, () => generateFirstPaymentQR({ token: d0.token, store, runTransaction, availability })));
    assert.ok(burst.every((r) => r.idempotent && r.destination.destinationId === "account-b-shivam"));
    assert.equal(await committedCount(), 1, "no second seat on replay burst");
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 1, "no second slot on replay burst");
    console.log("[integration] same-token x20: 1 seat, 1 slot, same destination");

    // ---- 4. SEQUENTIAL SPILL B20 → C20 → F10 → E, D SKIPPED ----
    await reset();
    const order: string[] = [];
    for (let i = 0; i < 41; i += 1) {
      const d = draftDoc(`ILL26-V3S${String(i).padStart(3, "0")}`, 100 + i);
      await regs.insertOne(d.doc);
      order.push((await generateFirstPaymentQR({ token: d.token, store, runTransaction, availability })).destination.destinationId);
    }
    assert.deepEqual(order.slice(0, 20), Array(20).fill("account-b-shivam"), "first 20 → B");
    assert.deepEqual(order.slice(20, 40), Array(20).fill("account-c-bhushan"), "next 20 → C");
    assert.equal(order[40], "account-f-priyanka", "41st → Priyanka (D skipped)");
    assert.equal((await mustDest("account-d-shubham")).assignedCount, 0, "D receives zero");
    assert.equal((await mustDest("account-e-sneha")).assignedCount, 0, "E untouched until F fills");
    assert.equal(await committedCount(), 41);
    console.log("[integration] spill: B20 → C20 → F (D 0, E 0), seats 41");

    // ---- 5. 100 DIFFERENT DRAFTS CONCURRENTLY: CAPS NEVER EXCEEDED ----
    await reset();
    const batch = [];
    for (let i = 0; i < 100; i += 1) {
      const d = draftDoc(`ILL26-V3C${String(i).padStart(3, "0")}`, 200 + i);
      await regs.insertOne(d.doc);
      batch.push(d.token);
    }
    const settled = await Promise.allSettled(batch.map((token) => generateFirstPaymentQR({ token, store, runTransaction, availability })));
    const ok = settled.filter((r) => r.status === "fulfilled");
    const failed = settled.filter((r) => r.status === "rejected");
    // Usable capacity is 80 (B20+C20+F10+E30; D disabled) < 100.
    assert.equal(ok.length, 80, "exactly 80 QR commitments from 100 drafts");
    assert.equal(failed.length, 20, "20 see capacity FULL");
    assert.ok(failed.every((r) => r.status === "rejected" && (r.reason as { code?: string }).code === "PAYMENT_CAPACITY_FULL"));
    assert.equal(await committedCount(), 80, "event seats never exceed commitments");
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 20);
    assert.equal((await mustDest("account-c-bhushan")).assignedCount, 20);
    assert.equal((await mustDest("account-f-priyanka")).assignedCount, 10);
    assert.equal((await mustDest("account-e-sneha")).assignedCount, 30);
    assert.equal((await mustDest("account-d-shubham")).assignedCount, 0, "D skipped under burst");
    console.log("[integration] x100 burst: 80 committed (B20/C20/F10/E30), D 0, 20 FULL");

    // ---- 6. FINAL SEAT RACE: 119 → EXACTLY ONE SEAT #120 ----
    await reset();
    await cap.updateOne({ _id: EVENT_CAPACITY_ID }, { $set: { committedCount: 119 } });
    const racers = [];
    for (let i = 0; i < 20; i += 1) {
      const d = draftDoc(`ILL26-V3R${String(i).padStart(3, "0")}`, 300 + i);
      await regs.insertOne(d.doc);
      racers.push(d.token);
    }
    const raced = await Promise.allSettled(racers.map((token) => generateFirstPaymentQR({ token, store, runTransaction, availability })));
    const won = raced.filter((r) => r.status === "fulfilled");
    const lost = raced.filter((r) => r.status === "rejected");
    assert.equal(won.length, 1, "exactly one seat #120");
    assert.equal(lost.length, 19);
    assert.ok(lost.every((r) => r.status === "rejected" && (r.reason as { code?: string }).code === "EVENT_REGISTRATION_FULL"));
    assert.equal(await committedCount(), 120);
    const totalSlots = ["account-b-shivam", "account-c-bhushan", "account-f-priyanka", "account-e-sneha"]
      .reduce(async (sumP, id) => (await sumP) + ((await mustDest(id)).assignedCount as number), Promise.resolve(0));
    assert.equal(await totalSlots, 1, "only one payment slot consumed in the seat race");
    console.log("[integration] seat race 119→120: 1 winner, 19 FULL, slots +1");

    // ---- 7. UNINITIALIZED CAPACITY FAILS CLOSED ----
    await reset();
    await cap.deleteMany({});
    const u = draftDoc("ILL26-V3U001", 400);
    await regs.insertOne(u.doc);
    await assert.rejects(
      generateFirstPaymentQR({ token: u.token, store, runTransaction, availability }),
      (error: unknown) => (error as { code?: string }).code === "EVENT_CAPACITY_NOT_INITIALIZED",
    );
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 0, "no slot consumed when uninitialized");
    assert.equal(await regs.countDocuments({ "payment.destination": { $exists: true } }), 0, "no destination attached when uninitialized");
    console.log("[integration] uninitialized: fail-closed, 0 slots, 0 attaches");

    // ---- 8. DELETE-RELEASE SYMMETRY (mirrors admin hard-delete semantics) ----
    await reset();
    const keep = draftDoc("ILL26-V3K001", 500);
    await regs.insertOne(keep.doc);
    const held = draftDoc("ILL26-V3K002", 501);
    await regs.insertOne(held.doc);
    await generateFirstPaymentQR({ token: held.token, store, runTransaction, availability });
    // Draft delete: held nothing → release nothing.
    const removedDraft = await regs.findOneAndDelete({ publicId: "ILL26-V3K001" });
    assert.ok(removedDraft);
    assert.equal(hasSeatCommitment({ status: removedDraft.payment.status, destination: removedDraft.payment.destination }), false);
    assert.equal(await committedCount(), 1, "draft delete releases no seat");
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 1, "draft delete releases no slot");
    // QR-issued delete: releases exactly one seat + one slot, never below 0.
    const removedHeld = await regs.findOneAndDelete({ publicId: "ILL26-V3K002" });
    assert.ok(removedHeld);
    assert.equal(hasSeatCommitment({ status: removedHeld.payment.status, destination: removedHeld.payment.destination }), true);
    const heldDestId = removedHeld.payment.destination?.destinationId;
    assert.ok(heldDestId, "issued row carries a destination");
    await releaseDestinationSlot(dests, heldDestId);
    await releaseEventSeat(cap);
    assert.equal(await committedCount(), 0);
    assert.equal((await mustDest("account-b-shivam")).assignedCount, 0);
    assert.equal((await releaseEventSeat(cap)).released, false, "release never underflows");
    console.log("[integration] delete symmetry: draft 0/0, issued -1/-1, floor 0");

    // ---- 9. GROUND TRUTH: 49 LEGACY + 41 BACKED = 90 ----
    assert.equal(
      computeCommittedGroundTruth([
        ...Array.from({ length: 49 }, () => ({ payment: { status: "verified", destination: null } })),
        ...Array.from({ length: 9 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-b-shivam" } } })),
        ...Array.from({ length: 10 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-c-bhushan" } } })),
        ...Array.from({ length: 10 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-d-shubham" } } })),
        ...Array.from({ length: 12 }, () => ({ payment: { status: "verified", destination: { destinationId: "account-e-sneha" } } })),
      ]),
      90,
    );
    assert.notEqual(ACCOUNT_A_DESTINATION_ID, "account-f-priyanka", "sanity: A untouched by V3");
    console.log("[integration] ground truth: 49 legacy + 41 backed = 90");

    console.log("[integration] ALL V3 REAL-MONGO ASSERTIONS PASSED");
  } finally {
    // ---- CLEANUP: drop ONLY the isolated test database ----
    try {
      try {
        await client.db(TEST_DB).dropDatabase();
        console.log(`[integration] cleanup: ${TEST_DB} dropped`);
      } catch {
        await client.db(TEST_DB).collection("payment_destinations").deleteMany({});
        await client.db(TEST_DB).collection("registrations").deleteMany({});
        await client.db(TEST_DB).collection("event_capacity").deleteMany({});
        console.log("[integration] cleanup: dropDatabase denied by role; test collections cleared instead");
      }
      const left = (await client.db(TEST_DB).collection("payment_destinations").countDocuments())
        + (await client.db(TEST_DB).collection("registrations").countDocuments())
        + (await client.db(TEST_DB).collection("event_capacity").countDocuments());
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
