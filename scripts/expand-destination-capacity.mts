/**
 * Change a payment destination's capacity (e.g. owner-approved expansion).
 *
 * SAFETY:
 * - Only approved destinations (B/C/D/F/E) may change; Account A is refused.
 *   Disabled destinations (e.g. D) are refused: re-enable deliberately
 *   before changing capacity.
 * - Shrinking below the live observed registration count is refused (would
 *   hide paid seats and allow overbooking past the new cap).
 * - Expansion requires --owner-approved (the account owner's consent to
 *   carry more payments) plus --confirm and --reason (10–500 chars); every
 *   change is recorded in `admin_audit` as
 *   `payment_destination_capacity_changed`.
 * - A destination that gains room while exhausted reopens as `available`
 *   (or `active` when no other account with room is active), preserving the
 *   B → C → F → E activation chain (D skipped: disabled). Nothing else about the account changes.
 * - Default mode is a read-only dry run.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/expand-destination-capacity.mts --destination account-e-sneha --capacity 20 --dry-run
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/expand-destination-capacity.mts --destination account-e-sneha --capacity 20 --confirm --owner-approved --reason="..."
 */
import { closeMongoConnection, getDb, getPaymentDestinationsCollection, isDbConfigured } from "@/lib/mongodb";
import { ACCOUNT_A_DESTINATION_ID, APPROVED_DESTINATION_IDS_IN_SEQUENCE } from "@/lib/payment-destinations";
import { realRegistrationFilter } from "@/lib/registration-filters";

const APPROVED = [...APPROVED_DESTINATION_IDS_IN_SEQUENCE];

function argValue(argv: string[], name: string): string | null {
  const flag = `--${name}`;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && i + 1 < argv.length) return argv[i + 1];
    if (argv[i]?.startsWith(`${flag}=`)) return argv[i].slice(flag.length + 1);
  }
  return null;
}

async function run() {
  const argv = process.argv.slice(2);
  const confirm = argv.includes("--confirm");
  const ownerApproved = argv.includes("--owner-approved");
  const destinationId = argValue(argv, "destination");
  const capacityRaw = argValue(argv, "capacity");
  const reason = argValue(argv, "reason");
  const capacity = capacityRaw === null ? NaN : Number(capacityRaw);

  if (!isDbConfigured()) {
    console.error("[expand] MONGODB_URI is not configured.");
    process.exit(1);
  }
  if (!destinationId || !(APPROVED as readonly string[]).includes(destinationId) || destinationId === ACCOUNT_A_DESTINATION_ID) {
    console.error(`[expand] REFUSED: --destination must be one of ${APPROVED.join(", ")} (Account A is never expandable).`);
    process.exit(1);
  }
  if (!Number.isInteger(capacity) || capacity <= 0 || capacity > 100) {
    console.error("[expand] REFUSED: --capacity must be a positive integer (max 100).");
    process.exit(1);
  }
  if (confirm && !ownerApproved) {
    console.error("[expand] REFUSED: capacity expansion requires --owner-approved (account owner consent).");
    process.exit(1);
  }
  if (confirm && (!reason || reason.trim().length < 10 || reason.trim().length > 500)) {
    console.error("[expand] REFUSED: --confirm requires --reason (10–500 characters) for the audit log.");
    process.exit(1);
  }

  const db = await getDb();
  await db.command({ ping: 1 });
  const destinations = await getPaymentDestinationsCollection();
  const doc = await destinations.findOne({ destinationId });
  if (!doc) {
    console.error(`[expand] REFUSED: destination ${destinationId} not found. Run the seed script first.`);
    process.exit(1);
  }
  if (doc.status === "disabled") {
    console.error(`[expand] REFUSED: ${destinationId} is disabled. Re-enable deliberately before changing capacity.`);
    process.exit(1);
  }
  const live = await db.collection("registrations").countDocuments({
    ...realRegistrationFilter,
    "payment.destination.destinationId": destinationId,
  });
  if (capacity < live) {
    console.error(`[expand] REFUSED: proposed capacity ${capacity} is below ${live} live registrations on ${destinationId}.`);
    process.exit(1);
  }

  const now = new Date();
  console.log(`[expand] ${destinationId}: capacity ${doc.capacity} → ${capacity} (stored assigned=${doc.assignedCount}, live=${live}), status ${doc.status}`);
  console.log(`[expand] live registrations on ${destinationId}: ${live} (all keep their slots)`);

  if (!confirm) {
    console.log("[expand] DRY RUN — no writes performed. Re-run with --confirm --owner-approved --reason=\"...\" to apply.");
    return;
  }

  const othersActiveWithRoom = await destinations.findOne({
    destinationId: { $ne: destinationId },
    status: "active",
    ownerApproved: true,
    allowNewAssignments: true,
  });
  const finalStatus = doc.assignedCount < capacity ? (othersActiveWithRoom ? "available" : "active") : "exhausted";
  const setUpdate: Record<string, unknown> = {
    capacity,
    status: finalStatus,
    allowNewAssignments: finalStatus !== "exhausted",
    updatedAt: now,
  };
  if (finalStatus === "active" && doc.status !== "active") setUpdate.activatedAt = now;
  const ops: Record<string, unknown> = { $set: setUpdate };
  if (doc.status === "exhausted" && finalStatus !== "exhausted") ops.$unset = { exhaustedAt: "" };
  if (finalStatus === "exhausted" && doc.status !== "exhausted") setUpdate.exhaustedAt = now;
  await destinations.updateOne({ destinationId }, ops as never);
  await db.collection("admin_audit").insertOne({
    type: "payment_destination_capacity_changed",
    actor: "admin",
    at: now,
    metadata: {
      destinationId,
      capacityFrom: doc.capacity,
      capacityTo: capacity,
      assignedCount: doc.assignedCount,
      liveRegistrations: live,
      statusFrom: doc.status,
      statusTo: finalStatus,
      ownerApproved: true,
      reason: reason!.trim(),
    },
  });
  console.log(`[expand] APPLIED ${destinationId}: capacity=${capacity} status=${finalStatus} (${doc.assignedCount}/${capacity} assigned)`);
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[expand] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
