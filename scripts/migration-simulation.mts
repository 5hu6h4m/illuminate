/**
 * Isolated V3 migration simulation — NEVER production.
 *
 * Seeds a production-like fixture into `illuminate_migration_test` only
 * (refuses illuminate/prod names), then drives the REAL migration,
 * verifier, reconcilers, and rollback scripts as child processes:
 *   dry-run zero writes → confirm migration → ground truth → claimable →
 *   reconciles NO DRIFT → verifier PASS → idempotent re-run → rollback →
 *   migrate again → V3 traffic → rollback REFUSAL → refusal matrix →
 *   sequence-abort mechanism → registration integrity.
 * Prints only the database name and cluster host — never URIs or PII.
 * Fixture data is synthetic (example.invalid).
 *
 * Run:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/migration-simulation.mts
 */
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { execFileSync } from "node:child_process";
import { MongoClient, ObjectId } from "mongodb";
import { computeCommittedGroundTruth } from "@/lib/event-capacity";
import { generateParticipantAccessToken, hashParticipantAccessToken } from "@/lib/payment";
import { generateFirstPaymentQR } from "@/lib/payment-flow-service";
import { realRegistrationFilter } from "@/lib/registration-filters";
import type { EventCapacityDoc } from "@/lib/event-capacity";
import type { PaymentDestination } from "@/lib/payment-destinations";
import type { RegistrationV2 } from "@/lib/registration-v2";
import type { SiteSettings } from "@/lib/site-settings";

const TEST_DB: string = "illuminate_migration_test";
const REASON = "isolated migration simulation (synthetic fixture, never production)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

function safeHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//, "https://").replace(/^mongodb:\/\//, "https://")).hostname;
  } catch {
    return "unparseable";
  }
}

function prodSnapshot(payeeName: string, upiId: string) {
  return {
    expectedAmount: 599,
    currency: "INR" as const,
    payeeName,
    upiId,
    eventKey: "illuminate-2026",
    mode: "production" as const,
    pricingTier: "early_bird" as const,
    registrationAvailable: true,
    calculatedAt: new Date("2026-09-20T00:00:00.000Z").toISOString(),
  };
}

function verifiedReg(publicId: string, i: number, dest?: { destinationId: string; internalLabel: string; payeeName: string; upiId: string }) {
  const snapshot = dest ? prodSnapshot(dest.payeeName, dest.upiId) : prodSnapshot("Yash Patil", "yashpatil76317@okicici");
  return {
    _id: new ObjectId(),
    schemaVersion: 2 as const,
    eventKey: "illuminate-2026",
    publicId,
    environment: "production" as const,
    isTest: false as const,
    participantAccessTokenHash: `hash-${i}`,
    participant: { fullName: `Sim User ${i}`, email: `sim.user.${i}@example.invalid`, normalizedEmail: `sim.user.${i}@example.invalid`, phone: `90000${String(10000 + i)}`, normalizedPhone: `90000${String(10000 + i)}` },
    payment: {
      snapshot,
      ...(dest ? { destination: { ...dest, assignedAt: new Date("2026-09-20T00:00:00.000Z") } } : {}),
      status: "verified" as const,
      proofHistory: [] as RegistrationV2["payment"]["proofHistory"],
      verifiedAt: new Date("2026-09-20T00:00:00.000Z"),
      verifiedBy: "admin",
    },
    idempotencyKeyHash: createHash("sha256").update(`sim-idem-${i}-pad-to-16-chars`).digest("hex"),
    audit: [{ type: "registration_created" as const, actor: "participant" as const, at: new Date("2026-09-19T00:00:00.000Z") }],
    createdAt: new Date("2026-09-19T00:00:00.000Z"),
    updatedAt: new Date("2026-09-20T00:00:00.000Z"),
  };
}

function destDoc(destinationId: string, internalLabel: string, payeeName: string, upiId: string, sequence: number, capacity: number, assignedCount: number, status: PaymentDestination["status"], ownerApproved: boolean, allowNew: boolean) {
  const now = new Date("2026-09-20T00:00:00.000Z");
  return { destinationId, internalLabel, payeeName, upiId, sequence, capacity, assignedCount, status, ownerApproved, allowNewAssignments: allowNew, createdAt: now, updatedAt: now };
}

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  if (!uri) throw new Error("MONGODB_URI is not configured");
  const prodDb = process.env.MONGODB_DB_NAME ?? process.env.MONGODB_DB ?? "illuminate";
  if (TEST_DB === "illuminate" || TEST_DB === prodDb) throw new Error(`REFUSED: test database resolves to production (${TEST_DB})`);
  console.log(`[sim] database name: ${TEST_DB}`);
  console.log(`[sim] cluster host: ${safeHost(uri)}`);

  const runScript = (script: string, args: string[]): { code: number; out: string } => {
    try {
      const out = execFileSync(
        "node",
        ["--env-file-if-exists=.env.local", "--import", "./scripts/register-dev-ts-loader.mjs", script, ...args],
        { cwd: process.cwd(), env: { ...process.env, MONGODB_DB_NAME: TEST_DB }, stdio: ["ignore", "pipe", "pipe"], timeout: 120000 },
      ).toString();
      return { code: 0, out };
    } catch (error: unknown) {
      const e = error as { status?: number; stdout?: Buffer; stderr?: Buffer };
      return { code: e.status ?? 1, out: `${(e.stdout ?? "").toString()}\n${(e.stderr ?? "").toString()}` };
    }
  };

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(TEST_DB);
    const regs = db.collection<RegistrationV2>("registrations");
    const dests = db.collection<PaymentDestination>("payment_destinations");

    async function seedFixture() {
      await dests.deleteMany({});
      await regs.deleteMany({});
      await db.collection("event_capacity").deleteMany({});
      await db.collection<SiteSettings>("site_settings").deleteMany({});
      await db.collection("admin_audit").deleteMany({});
      const now = new Date("2026-09-20T00:00:00.000Z");
      await dests.insertMany([
        destDoc("account-a-yash", "Yash", "Yash Patil (ECELL Team)", "yashpatil76317@okicici", 0, 0, 0, "disabled", false, false),
        destDoc("account-b-shivam", "B", "Shivam Jadhav (ECELL Team)", "shivujadhav2006@okicici", 1, 10, 9, "active", true, true),
        destDoc("account-c-bhushan", "C", "Bhushan Bhusare (ECELL Team)", "bbhusare73@oksbi", 2, 10, 10, "exhausted", true, false),
        destDoc("account-d-shubham", "D", "Shubham Jadhav (ECELL Team)", "9834717038@ybl", 3, 10, 10, "exhausted", true, false),
        destDoc("account-e-sneha", "E", "Sneha Dagwar (ECELL Team)", "snehadagwar06@okicici", 4, 20, 12, "active", true, true),
      ]);
      const list: Doc[] = [];
      for (let i = 0; i < 49; i += 1) list.push(verifiedReg(`ILL26-LG${String(i).padStart(4, "0")}`, i));
      const backed: Array<[string, number, { destinationId: string; internalLabel: string; payeeName: string; upiId: string }]> = [
        ["account-b-shivam", 9, { destinationId: "account-b-shivam", internalLabel: "B", payeeName: "Shivam Jadhav (ECELL Team)", upiId: "shivujadhav2006@okicici" }],
        ["account-c-bhushan", 10, { destinationId: "account-c-bhushan", internalLabel: "C", payeeName: "Bhushan Bhusare (ECELL Team)", upiId: "bbhusare73@oksbi" }],
        ["account-d-shubham", 10, { destinationId: "account-d-shubham", internalLabel: "D", payeeName: "Shubham Jadhav (ECELL Team)", upiId: "9834717038@ybl" }],
        ["account-e-sneha", 12, { destinationId: "account-e-sneha", internalLabel: "E", payeeName: "Sneha Dagwar (ECELL Team)", upiId: "snehadagwar06@okicici" }],
      ];
      let n = 49;
      for (const [, count, dest] of backed) {
        for (let k = 0; k < count; k += 1, n += 1) list.push(verifiedReg(`ILL26-BK${String(n).padStart(4, "0")}`, n, dest));
      }
      await regs.insertMany(list as unknown as RegistrationV2[]);
      await db.collection<SiteSettings>("site_settings").insertOne({ _id: "registration", manualClose: true, updatedAt: now, updatedBy: "test" });
      assert.equal(list.length, 90);
    }

    async function destState() {
      return (await dests.find({}).sort({ sequence: 1 }).toArray()).map((d) => {
        const doc = d as Doc;
        return `${doc.destinationId}:seq${doc.sequence}:${doc.assignedCount}/${doc.capacity}:${doc.status}`;
      }).join("|");
    }
    async function regsHash() {
      const rows = await regs.find({ ...realRegistrationFilter }).sort({ publicId: 1 }).toArray();
      return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    }
    async function groundTruth() {
      const rows = await regs.find({ ...realRegistrationFilter }).project({ payment: 1 }).toArray();
      return computeCommittedGroundTruth(rows as Array<{ payment: { status: string; destination?: { destinationId?: string } | null } }>);
    }

    await seedFixture();
    const regsHash0 = await regsHash();
    console.log("[sim] fixture: 90 verified (49 legacy + 9B/10C/10D/12E), dests A0 B9/10 C10/10 D10/10 E12/20, closed, no event_capacity");

    // A. dry-run: zero writes.
    const destBefore = await destState();
    const auditBefore = await db.collection("admin_audit").countDocuments({});
    const dry = runScript("scripts/migrate-v3-production.mts", ["--dry-run"]);
    assert.equal(dry.code, 0, `dry-run exit 0:\n${dry.out}`);
    for (const marker of ["DRY RUN ONLY — ZERO WRITES", "committed ground truth:\n90", "manualClose:\ntrue", "B:\n10 → 20", "Sneha:\nsequence 4 → 5", "TOTAL=49", "remaining=30"]) {
      assert.ok(dry.out.replace(/\s+/g, " ").includes(marker.replace(/\s+/g, " ").replace(":\n", ": ")), `dry-run shows ${marker}`);
    }
    assert.equal(await destState(), destBefore, "dry-run changed destinations");
    assert.equal(await regsHash(), regsHash0, "dry-run changed registrations");
    assert.equal(await db.collection("admin_audit").countDocuments({}), auditBefore, "dry-run wrote audit");
    assert.equal(await db.collection("event_capacity").countDocuments({}), 0, "dry-run created no counter");
    console.log("[sim] A dry-run: markers shown, ZERO writes verified");

    // B. confirmed migration.
    const mig = runScript("scripts/migrate-v3-production.mts", ["--confirm", `--reason=${REASON}`]);
    assert.equal(mig.code, 0, `migration exit 0:\n${mig.out}`);
    assert.ok(mig.out.includes("MIGRATION COMPLETE"), "migration completes");
    const backupMatch = mig.out.match(/backupPath: (\S+)/);
    assert.ok(backupMatch, "migration prints machine-readable backupPath");
    const backupPath = backupMatch[1];
    const after = new Map((await dests.find({}).toArray()).map((d) => [(d as Doc).destinationId, d as Doc]));
    assert.equal((after.get("account-b-shivam") as Doc).capacity, 20);
    assert.equal((after.get("account-b-shivam") as Doc).status, "active");
    assert.equal((after.get("account-c-bhushan") as Doc).capacity, 20);
    assert.equal((after.get("account-c-bhushan") as Doc).status, "available");
    assert.equal((after.get("account-d-shubham") as Doc).status, "disabled");
    assert.equal((after.get("account-d-shubham") as Doc).allowNewAssignments, false);
    assert.equal((after.get("account-d-shubham") as Doc).assignedCount, 10);
    assert.equal((after.get("account-f-priyanka") as Doc).capacity, 10);
    assert.equal((after.get("account-f-priyanka") as Doc).sequence, 4);
    assert.equal((after.get("account-f-priyanka") as Doc).payeeName, "Priyanka Ripote (Ecell Team)");
    assert.equal((after.get("account-f-priyanka") as Doc).upiId, "9172140735@ybl");
    assert.equal((after.get("account-e-sneha") as Doc).sequence, 5);
    assert.equal((after.get("account-e-sneha") as Doc).capacity, 30);
    assert.equal((after.get("account-e-sneha") as Doc).status, "available");
    const capDoc = (await db.collection<EventCapacityDoc>("event_capacity").findOne({ _id: "illuminate-2026" })) as Doc;
    assert.equal(capDoc.seatLimit, 120);
    assert.equal(capDoc.committedCount, 90);
    assert.ok((await db.collection("admin_audit").countDocuments({ type: "v3_payment_capacity_migrated" })) >= 1, "migration audit recorded");
    assert.equal(await regsHash(), regsHash0, "migration changed ZERO registration documents");
    console.log("[sim] B confirmed migration: exact target, counter 90/120, zero reg writes");

    // C+D. ground truth + claimable.
    assert.equal(await groundTruth(), 90);
    const claimable = ["account-b-shivam", "account-c-bhushan", "account-f-priyanka", "account-e-sneha"].reduce(
      async (sumP, id) => (await sumP) + Math.max(0, ((await dests.findOne({ destinationId: id })) as Doc).capacity - ((await dests.findOne({ destinationId: id })) as Doc).assignedCount),
      Promise.resolve(0),
    );
    assert.equal(await claimable, 49);
    console.log("[sim] C+D ground truth 90, claimable 49");

    // E. destination reconcile dry-run: NO DRIFT.
    const rec = runScript("scripts/reconcile-payment-destinations.mts", ["--dry-run"]);
    assert.equal(rec.code, 0, `reconcile exit 0:\n${rec.out}`);
    for (const id of ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-f-priyanka", "account-e-sneha"]) {
      const line = rec.out.split("\n").find((l) => l.includes(`${id}: count`));
      assert.ok(line?.includes("(no change)"), `reconcile no drift on ${id}: ${line ?? rec.out.slice(0, 2000)}`);
    }
    console.log("[sim] E destination reconcile: NO DRIFT");

    // F. event reconcile dry-run: NO DRIFT.
    const erec = runScript("scripts/reconcile-event-capacity.mts", ["--dry-run"]);
    assert.equal(erec.code, 0, `event reconcile exit 0:\n${erec.out}`);
    assert.ok(erec.out.includes("NO DRIFT"), "event reconcile reports NO DRIFT");
    console.log("[sim] F event reconcile: NO DRIFT");

    // G. verifier PASS.
    const ver = runScript("scripts/verify-v3-production-readiness.mts", []);
    assert.equal(ver.code, 0, `verifier exit 0:\n${ver.out}`);
    assert.ok(ver.out.includes("RESULT PASS"), "verifier RESULT PASS");
    console.log("[sim] G verifier: PASS");

    // H. second confirm: ALREADY MIGRATED, zero writes.
    const regsHashB = await regsHash();
    const destStateB = await destState();
    const again = runScript("scripts/migrate-v3-production.mts", ["--confirm", `--reason=${REASON}`]);
    assert.equal(again.code, 0, `second run exit 0:\n${again.out}`);
    assert.ok(again.out.includes("ALREADY MIGRATED — NO WRITES"), "idempotent second run");
    assert.equal(await regsHash(), regsHashB, "second run changed no registrations");
    assert.equal(await destState(), destStateB, "second run changed no destinations");
    console.log("[sim] H second run: ALREADY MIGRATED, ZERO writes");

    // I. rollback before traffic: exact restoration.
    const rb = runScript("scripts/rollback-v3-migration.mts", ["--confirm", `--reason=${REASON}`, `--backup=${backupPath}`]);
    assert.equal(rb.code, 0, `rollback exit 0:\n${rb.out}`);
    assert.ok(rb.out.includes("ROLLBACK COMPLETE"), "rollback completes");
    assert.equal(await destState(), destBefore, "rollback restores exact destination fixture");
    assert.equal(await db.collection("event_capacity").countDocuments({}), 0, "rollback removes counter");
    assert.equal(await regsHash(), regsHash0, "rollback changes zero registrations");
    console.log("[sim] I rollback: exact fixture restored");

    // J. migrate again: PASS.
    const mig2 = runScript("scripts/migrate-v3-production.mts", ["--confirm", `--reason=${REASON}`]);
    assert.equal(mig2.code, 0, `re-migration exit 0:\n${mig2.out}`);
    assert.ok(mig2.out.includes("MIGRATION COMPLETE"), "re-migration completes");
    console.log("[sim] J migrate again: PASS");

    // K. one V3 QR, then rollback MUST REFUSE.
    const token = generateParticipantAccessToken("ILL26-TRAFFIC");
    if (!token) throw new Error("PARTICIPANT_TOKEN_SECRET missing for traffic simulation.");
    const tokenHash = hashParticipantAccessToken(token);
    await regs.insertOne({
      _id: new ObjectId(),
      schemaVersion: 2,
      eventKey: "illuminate-2026",
      publicId: "ILL26-TRAFFIC",
      environment: "production" as const,
      isTest: false,
      participantAccessTokenHash: tokenHash,
      participant: { fullName: "Traffic Sim", email: "traffic.sim@example.invalid", normalizedEmail: "traffic.sim@example.invalid", phone: "9111100000", normalizedPhone: "9111100000" },
      payment: { snapshot: prodSnapshot("Yash Patil", "yashpatil76317@okicici"), pendingQRGeneration: true, status: "payment_pending" as const, proofHistory: [] },
      idempotencyKeyHash: createHash("sha256").update("traffic-idem-pad-16-chars").digest("hex"),
      audit: [{ type: "registration_created" as const, actor: "participant" as const, at: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const store = { registrations: regs, destinations: dests, eventCapacity: db.collection<EventCapacityDoc>("event_capacity") };
    const runTransaction = async <T,>(fn: (session: unknown) => Promise<T>): Promise<T> => {
      const session = client.startSession();
      try {
        return await session.withTransaction(() => fn(session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally {
        await session.endSession().catch(() => undefined);
      }
    };
    const snap = {
      expectedAmount: 699, currency: "INR" as const, payeeName: "Y", upiId: "y@upi", eventKey: "illuminate-2026",
      mode: "production" as const, pricingTier: "regular" as const, registrationAvailable: true, calculatedAt: new Date().toISOString(),
    };
    const issued = await generateFirstPaymentQR({ token, store, runTransaction, availability: { manuallyClosed: false, snapshot: snap } });
    assert.equal(issued.idempotent, false);
    const rbTraffic = runScript("scripts/rollback-v3-migration.mts", ["--confirm", `--reason=${REASON}`, `--backup=${backupPath}`]);
    assert.notEqual(rbTraffic.code, 0, "rollback after traffic must refuse");
    assert.ok(rbTraffic.out.includes("V3 traffic occurred"), "refusal names V3 traffic");
    assert.ok((await dests.findOne({ destinationId: "account-f-priyanka" })) !== null, "refused rollback changed nothing");
    console.log("[sim] K traffic then rollback: REFUSED, state intact");

    // Refusal matrix (each on a restored clean fixture state is unnecessary:
    // all refusals are read-only dry-runs against controlled mutations).
    async function expectRefused(label: string, mutate: () => Promise<void>, restore: () => Promise<void>, marker: string) {
      await mutate();
      const r = runScript("scripts/migrate-v3-production.mts", ["--dry-run"]);
      assert.notEqual(r.code, 0, `${label}: must refuse`);
      assert.ok(r.out.includes(marker), `${label}: names cause (${marker})`);
      await restore();
      console.log(`[sim] refusal matrix: ${label} OK`);
    }
    await dests.deleteMany({});
    await regs.deleteMany({});
    await db.collection("event_capacity").deleteMany({});
    await db.collection("site_settings").deleteMany({});
    await seedFixture();
    await expectRefused(
      "manualClose false",
      async () => { await db.collection<SiteSettings>("site_settings").updateOne({ _id: "registration" }, { $set: { manualClose: false } }); },
      async () => { await db.collection<SiteSettings>("site_settings").updateOne({ _id: "registration" }, { $set: { manualClose: true } }); },
      "manualClose",
    );
    await expectRefused(
      "wrong total",
      async () => { await regs.insertOne(verifiedReg("ILL26-EXTRA0001", 9001)); },
      async () => { await regs.deleteOne({ publicId: "ILL26-EXTRA0001" }); },
      "census mismatch",
    );
    await expectRefused(
      "pending exists",
      async () => { await regs.updateOne({ publicId: "ILL26-LG0000" }, { $set: { "payment.status": "payment_pending" } }); },
      async () => { await regs.updateOne({ publicId: "ILL26-LG0000" }, { $set: { "payment.status": "verified" } }); },
      "census mismatch",
    );
    await expectRefused(
      "counter drift",
      async () => { await dests.updateOne({ destinationId: "account-b-shivam" }, { $set: { assignedCount: 5 } }); },
      async () => { await dests.updateOne({ destinationId: "account-b-shivam" }, { $set: { assignedCount: 9 } }); },
      "counter drift",
    );
    await expectRefused(
      "unknown destination",
      async () => { await regs.updateOne({ publicId: "ILL26-LG0001" }, { $set: { "payment.destination": { destinationId: "account-x-nope", internalLabel: "X", payeeName: "X", upiId: "x@upi", assignedAt: new Date() } } }); },
      async () => { await regs.updateOne({ publicId: "ILL26-LG0001" }, { $unset: { "payment.destination": "" } }); },
      "unknown destination",
    );
    await expectRefused(
      "Priyanka already exists",
      async () => { await dests.insertOne(destDoc("account-f-priyanka", "F", "X", "x@upi", 4, 10, 0, "available", true, true)); },
      async () => { await dests.deleteOne({ destinationId: "account-f-priyanka" }); },
      "Priyanka",
    );
    await expectRefused(
      "partial state (E already moved)",
      async () => { await dests.updateOne({ destinationId: "account-e-sneha" }, { $set: { sequence: 5 } }); },
      async () => { await dests.updateOne({ destinationId: "account-e-sneha" }, { $set: { sequence: 4 } }); },
      "sequence",
    );

    // T. transaction abort restores E sequence when a later write fails.
    // (Runs on the reseeded pre-migration fixture, where E sits at 4.)
    {
      const eDoc = (await dests.findOne({ destinationId: "account-e-sneha" })) as Doc;
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          await dests.updateOne({ destinationId: "account-e-sneha" }, { $set: { sequence: 99 } }, { session });
          await dests.insertOne({ _id: eDoc._id, destinationId: "account-e-sneha-dup" } as never, { session });
        });
        assert.fail("duplicate-_id insert must abort the transaction");
      } catch {
        // Expected abort (duplicate key); fall through to verification.
      } finally {
        await session.endSession().catch(() => undefined);
      }
      assert.equal(((await dests.findOne({ destinationId: "account-e-sneha" })) as Doc).sequence, 4, "aborted sequence move rolls back");
      console.log("[sim] T abort mechanism: E sequence restored on failed insert");
    }

    console.log("[sim] SIMULATION ALL ASSERTIONS PASSED");
  } finally {
    try {
      try {
        await client.db(TEST_DB).dropDatabase();
        console.log(`[sim] cleanup: ${TEST_DB} dropped`);
      } catch {
        await client.db(TEST_DB).collection("payment_destinations").deleteMany({});
        await client.db(TEST_DB).collection("registrations").deleteMany({});
        await client.db(TEST_DB).collection("event_capacity").deleteMany({});
        await client.db(TEST_DB).collection("site_settings").deleteMany({});
        await client.db(TEST_DB).collection("admin_audit").deleteMany({});
        console.log("[sim] cleanup: dropDatabase denied by role; test collections cleared instead");
      }
      const left = (await client.db(TEST_DB).collection("payment_destinations").countDocuments())
        + (await client.db(TEST_DB).collection("registrations").countDocuments())
        + (await client.db(TEST_DB).collection("event_capacity").countDocuments());
      console.log(`[sim] cleanup confirmed: ${left} docs remain in ${TEST_DB}`);
    } catch (cleanupError) {
      console.error("[sim] cleanup warning:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
    } finally {
      await client.close();
    }
  }
}

void main().catch((error) => {
  console.error("[sim] FAILED", error instanceof Error ? error.message : error);
  process.exit(1);
});
