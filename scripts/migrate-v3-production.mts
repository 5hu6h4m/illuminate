/**
 * V3 production migration: destinations + event capacity in ONE transaction.
 *
 * THIS SCRIPT DEFAULTS TO READ-ONLY DRY RUN. Writes require ALL of:
 *   --confirm --reason="<10-500 chars>" [--production when targeting illuminate]
 *
 * Orchestrates the exact migration (never rely on manual seed/expand/disable
 * sequencing):
 *   A stays 0/0 disabled · B 10→20 active · C 10→20 available ·
 *   D 10 stays, exhausted→disabled (history preserved) ·
 *   F Priyanka INSERT seq4 10 available · E seq4→5, 20→30 available ·
 *   event_capacity { seatLimit 120, committedCount = COMPUTED ground truth }.
 *
 * Ground truth is COMPUTED from live registrations immediately before the
 * write (verified OR submitted OR destination-backed, counted once) — never
 * a hardcoded 90. Expected current value is 90; anything else STOPS.
 *
 * Safety: strict pre-migration validation, JSON backup before writes,
 * single transaction (STOP when unavailable), idempotent re-run
 * (ALREADY MIGRATED — NO WRITES), post-commit verification.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/migrate-v3-production.mts [--dry-run]
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/migrate-v3-production.mts --confirm --reason="..." [--production]
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient, type Db } from "mongodb";
import { closeMongoConnection, getDb, getMongoClient, isDbConfigured } from "@/lib/mongodb";
import { ACCOUNT_A_DESTINATION_ID, EVENT_VERIFIED_SEAT_LIMIT, type PaymentDestination } from "@/lib/payment-destinations";
import { EVENT_CAPACITY_ID, computeCommittedGroundTruth, type EventCapacityDoc } from "@/lib/event-capacity";
import { realRegistrationFilter } from "@/lib/registration-filters";
import type { RegistrationV2 } from "@/lib/registration-v2";
import type { SiteSettings } from "@/lib/site-settings";

const F_ID = "account-f-priyanka";
const F_PAYEE = "Priyanka Ripote (Ecell Team)";
const F_UPI = "9172140735@ybl";
const F_LABEL = "Priyanka Ripote / Account F / E-Cell Payment";

type Target = {
  destinationId: string;
  sequence: number;
  capacity: number;
  status: "disabled" | "active" | "available";
  ownerApproved: boolean;
  allowNewAssignments: boolean;
  payeeName?: string;
  upiId?: string;
  internalLabel?: string;
};

const TARGETS: Target[] = [
  { destinationId: "account-a-yash", sequence: 0, capacity: 0, status: "disabled", ownerApproved: false, allowNewAssignments: false },
  { destinationId: "account-b-shivam", sequence: 1, capacity: 20, status: "active", ownerApproved: true, allowNewAssignments: true },
  { destinationId: "account-c-bhushan", sequence: 2, capacity: 20, status: "available", ownerApproved: true, allowNewAssignments: true },
  { destinationId: "account-d-shubham", sequence: 3, capacity: 10, status: "disabled", ownerApproved: true, allowNewAssignments: false },
  { destinationId: F_ID, sequence: 4, capacity: 10, status: "available", ownerApproved: true, allowNewAssignments: true, payeeName: F_PAYEE, upiId: F_UPI, internalLabel: F_LABEL },
  { destinationId: "account-e-sneha", sequence: 5, capacity: 30, status: "available", ownerApproved: true, allowNewAssignments: true },
];

const PRE_CAPS: Record<string, number> = {
  "account-a-yash": 0,
  "account-b-shivam": 10,
  "account-c-bhushan": 10,
  "account-d-shubham": 10,
  "account-e-sneha": 20,
};
const PRE_SEQ: Record<string, number> = {
  "account-a-yash": 0,
  "account-b-shivam": 1,
  "account-c-bhushan": 2,
  "account-d-shubham": 3,
  "account-e-sneha": 4,
};
const PRE_LIVE: Record<string, number> = {
  "account-a-yash": 0,
  "account-b-shivam": 9,
  "account-c-bhushan": 10,
  "account-d-shubham": 10,
  "account-e-sneha": 12,
};

function safeHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//, "https://").replace(/^mongodb:\/\//, "https://")).hostname;
  } catch {
    return "unparseable";
  }
}

function parseArgs(argv: string[]) {
  let confirm = false;
  let production = false;
  let reason: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--confirm") confirm = true;
    else if (argv[i] === "--production") production = true;
    else if (argv[i] === "--dry-run") confirm = false;
    else if (argv[i] === "--reason" && i + 1 < argv.length) reason = argv[(i += 1)];
    else if (argv[i]?.startsWith("--reason=")) reason = argv[i].slice("--reason=".length);
  }
  return { confirm, production, reason };
}

type Census = { total: number; verified: number; submitted: number; pending: number; rejected: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

async function readState(db: Db) {
  const regs = db.collection<RegistrationV2>("registrations");
  const dests = db.collection<PaymentDestination>("payment_destinations");
  const site = await db.collection<SiteSettings>("site_settings").findOne({ _id: "registration" });
  const [total, verified, submitted, pending, rejected] = await Promise.all([
    regs.countDocuments({ ...realRegistrationFilter }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "verified" }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "submitted_for_verification" }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "payment_pending" }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "rejected" }),
  ]);
  const census: Census = { total, verified, submitted, pending, rejected };
  const grouped = await regs
    .aggregate<{ _id: string | null; count: number }>([
      { $match: realRegistrationFilter },
      { $group: { _id: "$payment.destination.destinationId", count: { $sum: 1 } } },
    ])
    .toArray();
  const liveByDest = new Map<string, number>();
  let withoutDestination = 0;
  for (const row of grouped) {
    if (typeof row._id === "string" && row._id) liveByDest.set(row._id, row.count);
    else withoutDestination += row.count;
  }
  const allRegs = await regs
    .find({ ...realRegistrationFilter })
    .project({ payment: 1 })
    .toArray();
  const groundTruth = computeCommittedGroundTruth(
    allRegs as Array<{ payment: { status: string; destination?: { destinationId?: string } | null } }>,
  );
  const destDocs = await dests.find({}).sort({ sequence: 1 }).toArray();
  const byId = new Map(destDocs.map((d) => [d.destinationId, d as unknown as Doc]));
  const capacityDoc = await db.collection<EventCapacityDoc>("event_capacity").findOne({ _id: EVENT_CAPACITY_ID });
  return { site, census, liveByDest, withoutDestination, groundTruth, destDocs, byId, capacityDoc };
}

function checkStaticTargets(byId: Map<string, Doc>): string[] {
  const problems: string[] = [];
  for (const t of TARGETS) {
    const doc = byId.get(t.destinationId);
    if (!doc) {
      problems.push(`${t.destinationId} missing`);
      continue;
    }
    if (doc.sequence !== t.sequence) problems.push(`${t.destinationId} sequence ${doc.sequence} != ${t.sequence}`);
    if (doc.capacity !== t.capacity) problems.push(`${t.destinationId} capacity ${doc.capacity} != ${t.capacity}`);
    if (doc.status !== t.status) problems.push(`${t.destinationId} status ${doc.status} != ${t.status}`);
    if (doc.ownerApproved !== t.ownerApproved) problems.push(`${t.destinationId} ownerApproved mismatch`);
    if (doc.allowNewAssignments !== t.allowNewAssignments) problems.push(`${t.destinationId} allowNewAssignments mismatch`);
  }
  const f = byId.get(F_ID);
  if (f) {
    if (f.payeeName !== F_PAYEE) problems.push(`Priyanka payee mismatch`);
    if (f.upiId !== F_UPI) problems.push(`Priyanka UPI mismatch`);
    if ((f.assignedCount ?? 0) !== 0) problems.push(`Priyanka assignedCount ${f.assignedCount} != 0`);
  }
  return problems;
}

async function run() {
  const { confirm, production, reason } = parseArgs(process.argv.slice(2));
  if (!isDbConfigured()) {
    console.error("[migrate] MONGODB_URI is not configured.");
    process.exit(1);
  }
  if (confirm && (!reason || reason.trim().length < 10 || reason.trim().length > 500)) {
    console.error("[migrate] REFUSED: --confirm requires --reason (10-500 characters) for the audit log.");
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI ?? "";
  const db = await getDb();
  await db.command({ ping: 1 });
  const dbName = db.databaseName;
  const isProd = dbName === "illuminate";
  console.log(`[migrate] database name: ${dbName}`);
  console.log(`[migrate] cluster host: ${safeHost(uri)}`);
  if (confirm && isProd && !production) {
    console.error("[migrate] REFUSED: writes to production illuminate require explicit --production.");
    process.exit(1);
  }

  const fail = (message: string): never => {
    console.error(`[migrate] REFUSED: ${message}`);
    process.exit(1);
  };

  // ---------- strict pre-migration validation (read-only) ----------
  const s = await readState(db);
  const manualClose = (s.site as Doc | null)?.manualClose === true;
  if (!manualClose) fail(`manualClose is not true (site_settings registration missing or false).`);

  const c = s.census;
  if (c.total !== 90 || c.verified !== 90 || c.submitted !== 0 || c.pending !== 0 || c.rejected !== 0) {
    fail(`registration census mismatch: total=${c.total} verified=${c.verified} submitted=${c.submitted} pending=${c.pending} rejected=${c.rejected} (expected 90/90/0/0/0).`);
  }
  if (s.groundTruth !== 90) fail(`committed ground truth is ${s.groundTruth}, expected 90.`);
  if (s.groundTruth > EVENT_VERIFIED_SEAT_LIMIT) fail(`ground truth ${s.groundTruth} exceeds seat limit ${EVENT_VERIFIED_SEAT_LIMIT}. STOP HARD.`);

  // Idempotent re-run: exact target state + consistent counter → no writes.
  const staticProblems = checkStaticTargets(s.byId);
  if (s.capacityDoc) {
    const cap = s.capacityDoc as Doc;
    const consistent =
      staticProblems.length === 0 &&
      cap.seatLimit === EVENT_VERIFIED_SEAT_LIMIT &&
      cap.committedCount === s.groundTruth;
    if (consistent) {
      console.log(`[migrate] event_capacity: seatLimit=${cap.seatLimit} committed=${cap.committedCount} (ground truth ${s.groundTruth})`);
      console.log("[migrate] ALREADY MIGRATED — NO WRITES");
      return;
    }
    fail(`event_capacity present but inconsistent (seatLimit=${cap.seatLimit} committed=${cap.committedCount}, ground truth=${s.groundTruth}, staticProblems=${staticProblems.length}).`);
  }

  for (const id of ["account-a-yash", "account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"]) {
    const matches = s.destDocs.filter((d) => (d as Doc).destinationId === id).length;
    if (matches !== 1) fail(`destination ${id} exists ${matches}x (expected exactly once).`);
  }
  if (s.byId.has(F_ID)) fail(`Priyanka destination already exists (unexpected outside already-migrated state).`);
  for (const [id, expected] of Object.entries(PRE_LIVE)) {
    const live = s.liveByDest.get(id) ?? 0;
    if (live !== expected) fail(`live registration ground truth on ${id} is ${live}, expected ${expected} (unexpected production state).`);
    const stored = ((s.byId.get(id) as Doc)?.assignedCount ?? 0) as number;
    if (stored !== live) fail(`counter drift on ${id}: stored assignedCount=${stored} but live registrations=${live} — reconcile first, never silently.`);
  }
  const unknownDestIds = [...s.liveByDest.keys()].filter(
    (id) => id !== ACCOUNT_A_DESTINATION_ID && !["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"].includes(id),
  );
  if (unknownDestIds.length) fail(`unknown destination ids referenced by registrations: ${unknownDestIds.join(", ")}.`);
  for (const [id, capBefore] of Object.entries(PRE_CAPS)) {
    if ((s.byId.get(id) as Doc).capacity !== capBefore) fail(`${id} capacity is ${(s.byId.get(id) as Doc).capacity}, expected pre-migration ${capBefore}.`);
  }
  for (const [id, seqBefore] of Object.entries(PRE_SEQ)) {
    if ((s.byId.get(id) as Doc).sequence !== seqBefore) fail(`${id} sequence is ${(s.byId.get(id) as Doc).sequence}, expected pre-migration ${seqBefore}.`);
  }
  const priyankaUpi = await db.collection("payment_destinations").findOne({ upiId: F_UPI });
  if (priyankaUpi) fail(`Priyanka UPI ${F_UPI} already present on ${(priyankaUpi as Doc).destinationId}.`);

  // ---------- dry-run plan (zero writes) ----------
  const claimableAfter = { B: 20 - 9, C: 20 - 10, D: 0, F: 10 - 0, E: 30 - 12 };
  const claimableTotal = claimableAfter.B + claimableAfter.C + claimableAfter.D + claimableAfter.F + claimableAfter.E;
  console.log(`[migrate] registrations: ${c.total} (verified=${c.verified} submitted=${c.submitted} pending=${c.pending} rejected=${c.rejected})`);
  console.log(`[migrate] committed ground truth: ${s.groundTruth}`);
  console.log(`[migrate] manualClose: ${manualClose}`);
  console.log(`[migrate] event_capacity: ABSENT`);
  console.log(`[migrate] A: ${(s.byId.get("account-a-yash") as Doc).capacity} → 0 (stays disabled)`);
  console.log(`[migrate] B: ${(s.byId.get("account-b-shivam") as Doc).capacity} → 20 (normalize active)`);
  console.log(`[migrate] C: ${(s.byId.get("account-c-bhushan") as Doc).capacity} → 20 (normalize available)`);
  console.log(`[migrate] D: ${(s.byId.get("account-d-shubham") as Doc).status} → DISABLED (capacity/assigned untouched)`);
  console.log(`[migrate] Priyanka: ABSENT → INSERT 10 (seq 4, available)`);
  console.log(`[migrate] Sneha: sequence ${(s.byId.get("account-e-sneha") as Doc).sequence} → 5, capacity ${(s.byId.get("account-e-sneha") as Doc).capacity} → 30 (normalize available)`);
  console.log(`[migrate] configured capacity: before=50 after=90`);
  console.log(`[migrate] claimable remaining after: B=${claimableAfter.B} C=${claimableAfter.C} D=${claimableAfter.D} F=${claimableAfter.F} E=${claimableAfter.E} TOTAL=${claimableTotal}`);
  console.log(`[migrate] event seats: committed=${s.groundTruth} limit=${EVENT_VERIFIED_SEAT_LIMIT} remaining=${EVENT_VERIFIED_SEAT_LIMIT - s.groundTruth}`);
  if (!confirm) {
    console.log("[migrate] DRY RUN ONLY — ZERO WRITES");
    return;
  }

  // ---------- backup (counts + operational docs only; zero participant PII) ----------
  const now = new Date();
  const backup = {
    at: now.toISOString(),
    reason: reason!.trim(),
    databaseName: dbName,
    siteSettings: s.site,
    eventCapacity: s.capacityDoc,
    paymentDestinations: s.destDocs,
    census: s.census,
    groundTruth: s.groundTruth,
  };
  const backupPath = join(tmpdir(), `illuminate-v3-migration-${now.toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 1));
  console.log(`backupPath: ${backupPath}`);

  // ---------- transaction ----------
  const client: MongoClient = await getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // Re-check critical preconditions inside the transaction.
      const siteIn = await db.collection<SiteSettings>("site_settings").findOne({ _id: "registration" }, { session });
      if ((siteIn as Doc | null)?.manualClose !== true) throw new Error("PRECONDITION manualClose flipped inside transaction.");
      const totalIn = await db.collection("registrations").countDocuments({ ...realRegistrationFilter }, { session });
      if (totalIn !== 90) throw new Error(`PRECONDITION total changed inside transaction (${totalIn}).`);
      const fIn = await db.collection("payment_destinations").findOne({ destinationId: F_ID }, { session });
      if (fIn) throw new Error("PRECONDITION Priyanka appeared inside transaction.");
      const eIn = (await db.collection("payment_destinations").findOne({ destinationId: "account-e-sneha" }, { session })) as Doc;
      if (!eIn || eIn.sequence !== 4 || eIn.capacity !== 20) throw new Error("PRECONDITION Sneha changed inside transaction.");

      // 1. Sneha 4 → 5 FIRST (sequence is unique; F needs 4).
      const moved = await db.collection("payment_destinations").updateOne(
        { destinationId: "account-e-sneha", sequence: 4 },
        { $set: { sequence: 5, updatedAt: now } },
        { session },
      );
      if (moved.modifiedCount !== 1) throw new Error("PRECONDITION Sneha sequence move failed.");
      // 2. Insert Priyanka at 4.
      await db.collection("payment_destinations").insertOne(
        {
          destinationId: F_ID,
          internalLabel: F_LABEL,
          payeeName: F_PAYEE,
          upiId: F_UPI,
          sequence: 4,
          capacity: 10,
          assignedCount: 0,
          status: "available",
          ownerApproved: true,
          allowNewAssignments: true,
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
      // 3. B 10 → 20, normalize active.
      await db.collection("payment_destinations").updateOne(
        { destinationId: "account-b-shivam" },
        { $set: { capacity: 20, status: "active", allowNewAssignments: true, ownerApproved: true, updatedAt: now, activatedAt: now }, $unset: { exhaustedAt: "" } },
        { session },
      );
      // 4. C 10 → 20, normalize available.
      await db.collection("payment_destinations").updateOne(
        { destinationId: "account-c-bhushan" },
        { $set: { capacity: 20, status: "available", allowNewAssignments: true, ownerApproved: true, updatedAt: now }, $unset: { exhaustedAt: "" } },
        { session },
      );
      // 5. D: keep 10/10, disable for new assignments. History untouched.
      await db.collection("payment_destinations").updateOne(
        { destinationId: "account-d-shubham" },
        { $set: { status: "disabled", allowNewAssignments: false, disabledAt: now, updatedAt: now } },
        { session },
      );
      // 6. Sneha 20 → 30, normalize available.
      await db.collection("payment_destinations").updateOne(
        { destinationId: "account-e-sneha" },
        { $set: { capacity: 30, status: "available", allowNewAssignments: true, ownerApproved: true, updatedAt: now }, $unset: { exhaustedAt: "" } },
        { session },
      );
      // 7. A: verify only (no rewrite).
      const aIn = (await db.collection("payment_destinations").findOne({ destinationId: ACCOUNT_A_DESTINATION_ID }, { session })) as Doc;
      if (!aIn || aIn.status !== "disabled" || aIn.allowNewAssignments !== false || (aIn.capacity ?? 0) !== 0) {
        throw new Error("PRECONDITION Account A changed inside transaction.");
      }
      // 8. Event capacity from COMPUTED ground truth (recomputed in-txn).
      const truthRegs = await db.collection("registrations").find({ ...realRegistrationFilter }, { session }).project({ payment: 1 }).toArray();
      const truth = computeCommittedGroundTruth(
        truthRegs as Array<{ payment: { status: string; destination?: { destinationId?: string } | null } }>,
      );
      if (truth !== 90) throw new Error(`PRECONDITION ground truth changed inside transaction (${truth}).`);
      if (truth > EVENT_VERIFIED_SEAT_LIMIT) throw new Error(`PRECONDITION ground truth ${truth} exceeds seat limit.`);
      await db.collection<EventCapacityDoc>("event_capacity").insertOne(
        { _id: EVENT_CAPACITY_ID, seatLimit: EVENT_VERIFIED_SEAT_LIMIT, committedCount: truth, updatedAt: now },
        { session },
      );
      // 9. Audit (no PII).
      const auditAt = now;
      await db.collection("admin_audit").insertMany(
        [
          { type: "v3_payment_capacity_migrated", actor: "admin", at: auditAt, metadata: { reason: reason!.trim(), oldConfiguredCapacity: 50, newConfiguredCapacity: 90, oldSeatLimit: 90, newSeatLimit: EVENT_VERIFIED_SEAT_LIMIT, groundTruthCommitted: truth } },
          { type: "payment_destination_capacity_changed", actor: "admin", at: auditAt, metadata: { destinationId: "account-b-shivam", capacityFrom: 10, capacityTo: 20, ownerApproved: true, reason: reason!.trim() } },
          { type: "payment_destination_capacity_changed", actor: "admin", at: auditAt, metadata: { destinationId: "account-c-bhushan", capacityFrom: 10, capacityTo: 20, ownerApproved: true, reason: reason!.trim() } },
          { type: "payment_destination_capacity_changed", actor: "admin", at: auditAt, metadata: { destinationId: "account-e-sneha", capacityFrom: 20, capacityTo: 30, ownerApproved: true, reason: reason!.trim() } },
          { type: "payment_destination_disabled", actor: "admin", at: auditAt, metadata: { destinationId: "account-d-shubham", reason: reason!.trim() } },
          { type: "event_capacity_initialized", actor: "admin", at: auditAt, metadata: { seatLimit: EVENT_VERIFIED_SEAT_LIMIT, committedCount: truth, reason: reason!.trim() } },
        ],
        { session },
      );
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession().catch(() => undefined);
  }

  // ---------- post-commit verification (read-only) ----------
  const v = await readState(db);
  const errors: string[] = [];
  const expect = (label: string, actual: unknown, wanted: unknown) => {
    if (actual !== wanted) errors.push(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(wanted)}`);
    else console.log(`[verify] ${label}: ${JSON.stringify(actual)} OK`);
  };
  expect("manualClose", (v.site as Doc | null)?.manualClose, true);
  expect("registrations.total", v.census.total, 90);
  expect("registrations.verified", v.census.verified, 90);
  expect("registrations.submitted", v.census.submitted, 0);
  expect("registrations.pending", v.census.pending, 0);
  expect("registrations.rejected", v.census.rejected, 0);
  expect("event_capacity.seatLimit", (v.capacityDoc as Doc)?.seatLimit, EVENT_VERIFIED_SEAT_LIMIT);
  expect("event_capacity.committedCount", (v.capacityDoc as Doc)?.committedCount, 90);
  expect("groundTruth", v.groundTruth, 90);
  for (const t of TARGETS) {
    const doc = v.byId.get(t.destinationId) as Doc | undefined;
    if (!doc) {
      errors.push(`${t.destinationId} missing after migration`);
      continue;
    }
    expect(`${t.destinationId}.sequence`, doc.sequence, t.sequence);
    expect(`${t.destinationId}.capacity`, doc.capacity, t.capacity);
    expect(`${t.destinationId}.status`, doc.status, t.status);
    expect(`${t.destinationId}.allowNewAssignments`, doc.allowNewAssignments, t.allowNewAssignments);
  }
  expect("B.assignedCount", (v.byId.get("account-b-shivam") as Doc)?.assignedCount, 9);
  expect("C.assignedCount", (v.byId.get("account-c-bhushan") as Doc)?.assignedCount, 10);
  expect("D.assignedCount", (v.byId.get("account-d-shubham") as Doc)?.assignedCount, 10);
  expect("F.assignedCount", (v.byId.get(F_ID) as Doc)?.assignedCount, 0);
  expect("E.assignedCount", (v.byId.get("account-e-sneha") as Doc)?.assignedCount, 12);
  expect("F.payeeName", (v.byId.get(F_ID) as Doc)?.payeeName, F_PAYEE);
  expect("F.upiId", (v.byId.get(F_ID) as Doc)?.upiId, F_UPI);
  const claimable = (["account-b-shivam", "account-c-bhushan", "account-f-priyanka", "account-e-sneha"] as const).reduce(
    (sum, id) => sum + Math.max(0, ((v.byId.get(id) as Doc)?.capacity ?? 0) - ((v.byId.get(id) as Doc)?.assignedCount ?? 0)),
    0,
  );
  expect("claimableRemaining", claimable, 49);
  if (errors.length) {
    console.error(`[migrate] POST-COMMIT VERIFICATION FAILED (${errors.length}):`);
    for (const e of errors) console.error(`[migrate]   - ${e}`);
    process.exit(1);
  }
  console.log("[migrate] MIGRATION COMPLETE — post-commit verification passed");
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[migrate] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
