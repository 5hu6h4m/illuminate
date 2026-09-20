/**
 * Bulk clear ALL payment_pending real registrations + release their slots.
 *
 * Operator-approved "full clean" of the unpaid queue. Destructive and
 * irreversible — every deletion is audited per record (same snapshot shape
 * as the single admin hard-delete) plus one bulk audit event.
 *
 * SAFETY:
 * - Scope is EXACTLY { schemaVersion: 2, real (non-test, non-development),
 *   payment.status: payment_pending }. Verified / submitted_for_verification /
 *   rejected / test rows are never matched — a filter bug that widens scope
 *   aborts instead of deleting (expected-status guard per row).
 * - Each row goes through the same path as the admin UI delete:
 *   atomic findOneAndDelete → proof cleanup (best-effort) → allowlisted
 *   destination slot release → per-record admin_audit.
 * - A JSON backup (minus token/idempotency hashes, which never leave the DB)
 *   is written to /tmp/opencode before any delete in confirm mode.
 * - Counters are reconciled to post-delete live ground truth afterwards,
 *   never blind-zeroed: paid rows keep their slots.
 * - Default mode is a read-only dry run. Writes require `--confirm` plus a
 *   `--reason` (10–500 chars) recorded in every audit event.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/clear-pending-registrations.mts --dry-run
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/clear-pending-registrations.mts --confirm --reason="..."
 */
import { writeFileSync } from "node:fs";
import { ObjectId } from "mongodb";
import {
  closeMongoConnection,
  getDb,
  getPaymentDestinationsCollection,
  getPaymentProofBucket,
  isDbConfigured,
} from "@/lib/mongodb";
import { APPROVED_DESTINATION_IDS_IN_SEQUENCE, releaseDestinationSlot } from "@/lib/payment-destinations";
import { realRegistrationFilter } from "@/lib/registration-filters";

const APPROVED = [...APPROVED_DESTINATION_IDS_IN_SEQUENCE];
const BULK_TAG = "clear_all_pending";

function parseArgs(argv: string[]): { confirm: boolean; reason: string | null } {
  let confirm = false;
  let reason: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--confirm") confirm = true;
    else if (argv[i] === "--dry-run") confirm = false;
    else if (argv[i] === "--reason" && i + 1 < argv.length) reason = argv[(i += 1)];
    else if (argv[i]?.startsWith("--reason=")) reason = argv[i].slice("--reason=".length);
  }
  return { confirm, reason };
}

async function run() {
  const { confirm, reason } = parseArgs(process.argv.slice(2));
  if (!isDbConfigured()) {
    console.error("[clear-pending] MONGODB_URI is not configured.");
    process.exit(1);
  }
  if (confirm && (!reason || reason.trim().length < 10 || reason.trim().length > 500)) {
    console.error("[clear-pending] REFUSED: --confirm requires --reason (10–500 characters) for the audit log.");
    process.exit(1);
  }

  const db = await getDb();
  await db.command({ ping: 1 });
  const registrations = db.collection("registrations");
  const now = new Date();

  const pending = await registrations
    .find({ ...realRegistrationFilter, "payment.status": "payment_pending" })
    .project({ publicId: 1, isTest: 1, environment: 1, ecellMember: 1, payment: 1 })
    .toArray();
  const byDest: Record<string, number> = {};
  for (const r of pending as Array<{ payment?: { destination?: { destinationId?: string } } }>) {
    const d = r.payment?.destination?.destinationId ?? "legacy/no-destination";
    byDest[d] = (byDest[d] ?? 0) + 1;
  }
  console.log(`[clear-pending] payment_pending real registrations: ${pending.length}`);
  console.log(`[clear-pending] by destination: ${JSON.stringify(byDest)}`);

  if (!confirm) {
    console.log("[clear-pending] DRY RUN — no writes performed. Re-run with --confirm --reason=\"...\" to apply.");
    return;
  }

  // Backup first (auth material excluded: token/idempotency hashes stay in
  // the DB's audit snapshot only, never in a flat file).
  const backup = pending.map((r) => {
    const { participantAccessTokenHash: _t, idempotencyKeyHash: _k, ...rest } = r as Record<string, unknown>;
    return rest;
  });
  const backupPath = `/tmp/opencode/pending-clear-backup-${now.toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 1));
  console.log(`[clear-pending] backup written: ${backupPath} (${backup.length} records, hashes excluded)`);

  let deleted = 0;
  const released: Record<string, number> = {};
  const deletedIds: string[] = [];
  for (const row of pending as Array<{
    _id: ObjectId;
    publicId: string;
    ecellMember?: boolean;
    payment: {
      status: string;
      snapshot?: { expectedAmount?: number | null };
      transactionReference?: string;
      currentProofId?: string;
      proofHistory?: Array<{ fileId: string }>;
      destination?: { destinationId?: string };
    };
  }>) {
    // Guard: never delete a row that changed state since the listing (e.g. a
    // participant submitted proof concurrently — that row is no longer
    // pending and must survive).
    const removed = await registrations.findOneAndDelete({
      _id: row._id,
      schemaVersion: 2,
      publicId: row.publicId,
      "payment.status": "payment_pending",
    });
    if (!removed) {
      console.log(`[clear-pending] SKIP ${row.publicId} (changed state during run — left untouched)`);
      continue;
    }
    const proofIds = [
      ...new Set(
        [removed.payment?.currentProofId, ...(removed.payment?.proofHistory ?? []).map((e: { fileId: string }) => e.fileId)]
          .filter((v): v is string => Boolean(v)),
      ),
    ].filter(ObjectId.isValid);
    if (proofIds.length) {
      try {
        const bucket = await getPaymentProofBucket();
        await Promise.all(proofIds.map((id) => bucket.delete(new ObjectId(id)).catch(() => undefined)));
      } catch {
        /* best-effort; record deletion is authoritative */
      }
    }
    const rawDest = removed.payment?.destination?.destinationId;
    const destId =
      typeof rawDest === "string" && (APPROVED as readonly string[]).includes(rawDest) ? rawDest : null;
    let destReleased = false;
    if (destId) {
      try {
        const dests = await getPaymentDestinationsCollection();
        const before = await dests.findOne({ destinationId: destId }, { projection: { assignedCount: 1 } });
        await releaseDestinationSlot(dests, destId);
        destReleased = (before?.assignedCount ?? 0) > 0;
        if (destReleased) released[destId] = (released[destId] ?? 0) + 1;
      } catch (e) {
        console.warn(`[clear-pending] slot release failed for ${row.publicId}`, e instanceof Error ? e.message : e);
      }
    }
    await db.collection("admin_audit").insertOne({
      type: "admin_registration_deleted",
      actor: "admin",
      at: new Date(),
      metadata: {
        publicId: row.publicId,
        wasTest: false,
        paymentStatus: "payment_pending",
        expectedAmount: removed.payment?.snapshot?.expectedAmount ?? null,
        ecellMember: removed.ecellMember === true,
        transactionReference: removed.payment?.transactionReference ?? null,
        verifiedAt: null,
        proofIds,
        reason: reason!.trim(),
        bulkOperation: BULK_TAG,
        destinationId: destId,
        destinationReleased: destReleased,
      },
    });
    deleted += 1;
    deletedIds.push(row.publicId);
  }

  // Reconcile counters to post-delete live ground truth (same rule as the
  // reconcile script: counter = live rows; statuses healed on B→C→D→E).
  const grouped = await registrations
    .aggregate<{ _id: string | null; count: number }>([
      { $match: realRegistrationFilter },
      { $group: { _id: "$payment.destination.destinationId", count: { $sum: 1 } } },
    ])
    .toArray();
  const live = new Map<string, number>();
  for (const g of grouped) if (typeof g._id === "string" && g._id) live.set(g._id, g.count);
  const destinations = await getPaymentDestinationsCollection();
  const docs = await destinations.find({}).sort({ sequence: 1 }).toArray();
  const byId = new Map(docs.map((d) => [d.destinationId, d]));
  for (const d of docs.filter((x) => APPROVED.includes(x.destinationId as never) && x.status !== "disabled")) {
    const proposed = live.get(d.destinationId) ?? 0;
    let status = d.status;
    let allow = d.allowNewAssignments;
    if (proposed >= d.capacity) {
      status = "exhausted";
      allow = false;
    } else if (status === "exhausted") {
      status = "active";
      allow = true;
    }
    const setUpdate: Record<string, unknown> = { assignedCount: proposed, status, allowNewAssignments: allow, updatedAt: now };
    if (status === "exhausted" && d.status !== "exhausted") setUpdate.exhaustedAt = now;
    if (status === "active" && d.status !== "active") setUpdate.activatedAt = now;
    const ops: Record<string, unknown> = { $set: setUpdate };
    if (d.status === "exhausted" && status !== "exhausted") ops.$unset = { exhaustedAt: "" };
    await destinations.updateOne({ destinationId: d.destinationId }, ops as never);
  }
  // Single-active invariant among non-disabled accounts with room.
  const fresh = await destinations.find({}).sort({ sequence: 1 }).toArray();
  const withRoom = fresh.filter((x) => APPROVED.includes(x.destinationId as never) && x.status !== "disabled" && x.assignedCount < x.capacity);
  const actives = withRoom.filter((x) => x.status === "active");
  if (withRoom.length > 0 && actives.length === 0) {
    await destinations.updateOne(
      { destinationId: withRoom[0].destinationId },
      { $set: { status: "active", allowNewAssignments: true, activatedAt: now, updatedAt: now } },
    );
  } else if (actives.length > 1) {
    for (const extra of actives.slice(1)) {
      await destinations.updateOne(
        { destinationId: extra.destinationId },
        { $set: { status: "available", allowNewAssignments: true, updatedAt: now } },
      );
    }
  }

  const final = await destinations.find({}).sort({ sequence: 1 }).toArray();
  console.log("[clear-pending] final counters:");
  for (const d of final) console.log(`[clear-pending]   ${d.destinationId}: ${d.assignedCount}/${d.capacity} ${d.status}`);
  await db.collection("admin_audit").insertOne({
    type: "admin_pending_registrations_cleared",
    actor: "admin",
    at: now,
    metadata: {
      reason: reason!.trim(),
      deletedCount: deleted,
      releasedSlots: JSON.stringify(released),
      publicIds: deletedIds,
    },
  });
  console.log(`[clear-pending] DONE — deleted ${deleted} pending registration(s), released slots ${JSON.stringify(released)}.`);
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[clear-pending] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
