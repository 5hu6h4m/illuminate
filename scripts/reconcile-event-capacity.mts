/**
 * Reconcile event_capacity.committedCount with live registration ground truth.
 *
 * Ground truth (Phase 2 helper): verified OR submitted_for_verification OR
 * payment.destination exists — one registration counted once. Draft pendings
 * without a destination contribute zero.
 *
 * SAFETY (operational insurance, never a silent fixer):
 * - Default mode is a read-only dry run. Writes require --confirm plus a
 *   --reason (10–500 chars, mirrors the admin-delete policy).
 * - Never decrements/overwrites blindly: the plan is printed first and only
 *   the exact computed difference is applied.
 * - If ground truth exceeds the seat limit: STOP (overbooking needs human
 *   triage, never an automated counter bump).
 * - If the document is absent: do NOT create by default. Creation requires
 *   explicit --initialize (also with --confirm --reason).
 * - Every correction is recorded in admin_audit.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/reconcile-event-capacity.mts --dry-run
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/reconcile-event-capacity.mts --confirm --reason="..."
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/reconcile-event-capacity.mts --confirm --reason="..." --initialize
 */
import { closeMongoConnection, getDb, getEventCapacityCollection, isDbConfigured } from "@/lib/mongodb";
import { EVENT_CAPACITY_ID, computeCommittedGroundTruth } from "@/lib/event-capacity";
import { EVENT_VERIFIED_SEAT_LIMIT } from "@/lib/payment-destinations";
import { realRegistrationFilter } from "@/lib/registration-filters";

function parseArgs(argv: string[]) {
  let confirm = false;
  let initialize = false;
  let reason: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--confirm") confirm = true;
    else if (argv[i] === "--dry-run") confirm = false;
    else if (argv[i] === "--initialize") initialize = true;
    else if (argv[i] === "--reason" && i + 1 < argv.length) reason = argv[(i += 1)];
    else if (argv[i]?.startsWith("--reason=")) reason = argv[i].slice("--reason=".length);
  }
  return { confirm, initialize, reason };
}

async function run() {
  const { confirm, initialize, reason } = parseArgs(process.argv.slice(2));
  if (!isDbConfigured()) {
    console.error("[event-reconcile] MONGODB_URI is not configured.");
    process.exit(1);
  }
  if (confirm && (!reason || reason.trim().length < 10 || reason.trim().length > 500)) {
    console.error("[event-reconcile] REFUSED: --confirm requires --reason (10–500 characters) for the audit log.");
    process.exit(1);
  }

  const db = await getDb();
  await db.command({ ping: 1 });
  const now = new Date();
  const regs = db.collection("registrations");
  const allRegs = await regs.find({ ...realRegistrationFilter }).project({ payment: 1 }).toArray();
  const truth = computeCommittedGroundTruth(
    allRegs as Array<{ payment: { status: string; destination?: { destinationId?: string } | null } }>,
  );
  const doc = await (await getEventCapacityCollection()).findOne({ _id: EVENT_CAPACITY_ID });
  console.log(`[event-reconcile] live ground truth committed seats: ${truth}`);

  if (!doc) {
    if (!initialize) {
      console.error("[event-reconcile] REFUSED: event_capacity document is absent. Re-run with --initialize to create it explicitly (still requires --confirm --reason).");
      process.exit(1);
    }
    if (truth > EVENT_VERIFIED_SEAT_LIMIT) {
      console.error(`[event-reconcile] REFUSED: ground truth ${truth} exceeds seat limit ${EVENT_VERIFIED_SEAT_LIMIT}.`);
      process.exit(1);
    }
    console.log(`[event-reconcile] plan: CREATE event_capacity { seatLimit=${EVENT_VERIFIED_SEAT_LIMIT}, committedCount=${truth} }`);
    if (!confirm) {
      console.log("[event-reconcile] DRY RUN — no writes performed. Re-run with --confirm --reason=\"...\" --initialize to apply.");
      return;
    }
    await (await getEventCapacityCollection()).insertOne({ _id: EVENT_CAPACITY_ID, seatLimit: EVENT_VERIFIED_SEAT_LIMIT, committedCount: truth, updatedAt: now });
    await db.collection("admin_audit").insertOne({ type: "event_capacity_initialized", actor: "admin", at: now, metadata: { seatLimit: EVENT_VERIFIED_SEAT_LIMIT, committedCount: truth, reason: reason!.trim() } });
    console.log("[event-reconcile] APPLIED event_capacity initialization.");
    return;
  }

  if (truth > doc.seatLimit) {
    console.error(`[event-reconcile] REFUSED: ground truth ${truth} exceeds seat limit ${doc.seatLimit} — overbooking needs human triage.`);
    process.exit(1);
  }
  console.log(`[event-reconcile] stored: committedCount=${doc.committedCount} seatLimit=${doc.seatLimit}`);
  if (doc.committedCount === truth) {
    console.log("[event-reconcile] NO DRIFT — committedCount already equals ground truth.");
    return;
  }
  console.log(`[event-reconcile] plan: committedCount ${doc.committedCount} → ${truth} (delta=${truth - doc.committedCount})`);
  if (!confirm) {
    console.log("[event-reconcile] DRY RUN — no writes performed. Re-run with --confirm --reason=\"...\" to apply.");
    return;
  }
  await (await getEventCapacityCollection()).updateOne(
    { _id: EVENT_CAPACITY_ID, committedCount: doc.committedCount },
    { $set: { committedCount: truth, updatedAt: now } },
  );
  await db.collection("admin_audit").insertOne({ type: "event_capacity_reconciled", actor: "admin", at: now, metadata: { committedFrom: doc.committedCount, committedTo: truth, seatLimit: doc.seatLimit, reason: reason!.trim() } });
  console.log("[event-reconcile] APPLIED event_capacity reconciliation.");
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[event-reconcile] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
