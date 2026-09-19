import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { apiError, isSameOrigin, sensitiveJson } from "@/lib/http";
import { getDb, getPaymentDestinationsCollection, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { ACCOUNT_A_DESTINATION_ID, TOTAL_PAYMENT_CAPACITY } from "@/lib/payment-destinations";
import { realRegistrationFilter } from "@/lib/registration-filters";

export const runtime = "nodejs";

const DisableSchema = z.object({ action: z.literal("disable"), destinationId: z.string().min(1).max(64) }).strict();
const ReassignSchema = z.object({
  action: z.literal("reassign"),
  fromDestinationId: z.string().min(1).max(64),
  toDestinationId: z.string().min(1).max(64),
  confirm: z.literal(true),
  dryRun: z.boolean().optional(),
  // Explicit opt-in to split a larger eligible set across available target
  // capacity: moves min(eligible, remaining) oldest-first, never more.
  partial: z.boolean().optional(),
}).strict();

async function capacityOverview() {
  const destinations = await (await getPaymentDestinationsCollection()).find({}).sort({ sequence: 1 }).toArray();
  const approved = destinations.filter((d) => d.destinationId !== ACCOUNT_A_DESTINATION_ID);
  const assigned = approved.reduce((sum, d) => sum + (d.assignedCount ?? 0), 0);
  const registrations = await getRegistrationsCollection();
  const accountAPendingCount = await registrations.countDocuments({
    ...realRegistrationFilter,
    "payment.status": "payment_pending",
    $or: [
      { "payment.destination.destinationId": ACCOUNT_A_DESTINATION_ID },
      { "payment.destination.destinationId": { $exists: false }, "payment.snapshot.upiId": "yashpatil76317@okicici" },
    ],
  });
  return {
    destinations: destinations.map((d) => ({
      destinationId: d.destinationId,
      internalLabel: d.internalLabel,
      payeeName: d.payeeName,
      upiId: d.upiId,
      sequence: d.sequence,
      capacity: d.capacity,
      assignedCount: d.assignedCount,
      remaining: Math.max(0, (d.capacity ?? 0) - (d.assignedCount ?? 0)),
      status: d.status,
      ownerApproved: d.ownerApproved,
      allowNewAssignments: d.allowNewAssignments,
      activatedAt: d.activatedAt ?? null,
      exhaustedAt: d.exhaustedAt ?? null,
      disabledAt: d.disabledAt ?? null,
    })),
    totalCapacity: TOTAL_PAYMENT_CAPACITY,
    assigned,
    remaining: Math.max(0, TOTAL_PAYMENT_CAPACITY - assigned),
    accountAPendingCount,
    capacityFull: assigned >= TOTAL_PAYMENT_CAPACITY,
  };
}

export async function GET() {
  if (!await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  if (!isDbConfigured()) return apiError(503, "ADMIN_DB_NOT_CONFIGURED", "Admin is unavailable: server database is not configured (code ADMIN-DB-CONFIG).");
  try {
    return sensitiveJson(await capacityOverview());
  } catch { return apiError(503, "ADMIN_REQUEST_FAILED", "Admin is temporarily unavailable (server issue). Retry in a minute (code ADMIN-SERVER)."); }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request) || !await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  if (!isDbConfigured()) return apiError(503, "ADMIN_DB_NOT_CONFIGURED", "Admin is unavailable: server database is not configured (code ADMIN-DB-CONFIG).");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(422, "INVALID_REQUEST", "Invalid request."); }

  const disableParsed = DisableSchema.safeParse(body);
  if (disableParsed.success) {
    const { destinationId } = disableParsed.data;
    if (destinationId === ACCOUNT_A_DESTINATION_ID) return apiError(422, "INVALID_REQUEST", "Account A is already disabled / legacy.");
    try {
      const destinations = await getPaymentDestinationsCollection();
      const target = await destinations.findOne({ destinationId });
      if (!target) return apiError(404, "NOT_FOUND", "Not found.");
      if (target.status === "exhausted") return apiError(409, "INVALID_STATE_TRANSITION", "Exhausted destinations cannot be disabled.");
      if (target.status === "disabled") return sensitiveJson({ ...(await capacityOverview()), notice: "Already disabled." });
      const now = new Date();
      const wasActive = target.status === "active";
      await destinations.updateOne({ destinationId }, { $set: { status: "disabled", allowNewAssignments: false, disabledAt: now, updatedAt: now } });
      let activatedId: string | null = null;
      if (wasActive) {
        const next = await destinations.find({ status: "available", ownerApproved: true, allowNewAssignments: true }).sort({ sequence: 1 }).toArray();
        const candidate = next.filter((d) => d.destinationId !== ACCOUNT_A_DESTINATION_ID && d.sequence > target.sequence && d.assignedCount < d.capacity)[0];
        if (candidate) {
          const res = await destinations.updateOne({ destinationId: candidate.destinationId, status: "available" }, { $set: { status: "active", activatedAt: now, updatedAt: now } });
          if (res.modifiedCount) activatedId = candidate.destinationId;
        }
      }
      try {
        await (await getDb()).collection("admin_audit").insertOne({ type: "payment_destination_disabled", actor: "admin", at: now, metadata: { destinationId, wasActive, activatedDestinationId: activatedId } });
      } catch { /* best-effort */ }
      return sensitiveJson({ ...(await capacityOverview()), notice: `Disabled ${destinationId}.${activatedId ? ` Activated ${activatedId}.` : ""}` });
    } catch { return apiError(503, "SERVER_ERROR", "Could not disable the destination."); }
  }

  const reassignParsed = ReassignSchema.safeParse(body);
  if (reassignParsed.success) {
    const { fromDestinationId, toDestinationId, dryRun, partial } = reassignParsed.data;
    if (fromDestinationId === toDestinationId) return apiError(422, "INVALID_REQUEST", "Select two different destinations.");
    if (toDestinationId === ACCOUNT_A_DESTINATION_ID) return apiError(422, "INVALID_REQUEST", "Cannot reassign to the disabled legacy account.");
    try {
      const destinations = await getPaymentDestinationsCollection();
      const registrations = await getRegistrationsCollection();
      const target = await destinations.findOne({ destinationId: toDestinationId });
      if (!target) return apiError(404, "NOT_FOUND", "Target destination not found.");
      if (target.status === "exhausted" || target.status === "disabled" || !target.ownerApproved || !target.allowNewAssignments) {
        return apiError(409, "TARGET_NOT_ASSIGNABLE", "Target destination is not accepting reassignments.");
      }
      const remaining = Math.max(0, target.capacity - target.assignedCount);
      // Only payment_pending may be bulk-reassigned — never submitted / verified / rejected.
      const sourceMatch = fromDestinationId === ACCOUNT_A_DESTINATION_ID
        ? {
            $or: [
              { "payment.destination.destinationId": ACCOUNT_A_DESTINATION_ID },
              { "payment.destination.destinationId": { $exists: false }, "payment.snapshot.upiId": "yashpatil76317@okicici" },
            ],
          }
        : { "payment.destination.destinationId": fromDestinationId };
      const fromFilter = { ...realRegistrationFilter, "payment.status": "payment_pending", ...sourceMatch };
      const eligibleCount = await registrations.countDocuments(fromFilter);
      if (eligibleCount === 0) return sensitiveJson({ eligibleCount: 0, movedCount: 0, willMove: 0, willRemain: 0, remaining, notice: "No eligible payment_pending registrations found for this source." });
      // moveCount = min(eligible, remaining), but never execute merely
      // because the calculation exists: without explicit partial opt-in a
      // larger eligible set is still rejected outright (no silent overflow).
      const willMove = Math.min(eligibleCount, remaining);
      const willRemain = eligibleCount - willMove;
      if (eligibleCount > remaining && partial !== true) {
        return apiError(409, "TARGET_CAPACITY_INSUFFICIENT", `Target destination has only ${remaining} remaining slot${remaining === 1 ? "" : "s"}.`);
      }
      if (dryRun) {
        if (eligibleCount > remaining) {
          return sensitiveJson({ eligibleCount, movedCount: 0, willMove, willRemain, remaining, notice: `${toDestinationId} has capacity for ${willMove} of ${eligibleCount} eligible unpaid registrations. Oldest unpaid registrations will be reassigned first. ${willRemain} will remain on ${fromDestinationId}.` });
        }
        return sensitiveJson({ eligibleCount, movedCount: 0, willMove: eligibleCount, willRemain: 0, remaining, notice: `${eligibleCount} registration(s) can be moved. Confirm to execute.` });
      }
      const moveCount = eligibleCount > remaining ? willMove : eligibleCount;
      if (moveCount <= 0) {
        return apiError(409, "TARGET_CAPACITY_INSUFFICIENT", `Target destination has only ${remaining} remaining slot${remaining === 1 ? "" : "s"}.`);
      }
      const now = new Date();
      const toSnapshot = { destinationId: target.destinationId, internalLabel: target.internalLabel, payeeName: target.payeeName, upiId: target.upiId };
      // Reserve target slots FIRST with a conditional atomic increment so a
      // concurrent registration burst can never push the target past 10.
      const reserved = await destinations.findOneAndUpdate(
        { destinationId: toDestinationId, assignedCount: { $lte: target.capacity - moveCount } },
        { $inc: { assignedCount: moveCount }, $set: { updatedAt: now } },
        { returnDocument: "after" },
      );
      if (!reserved) {
        return apiError(409, "TARGET_CAPACITY_RACE", "Target capacity changed during reassignment. Refresh capacity and verify counts before retrying.");
      }
      // Deterministic selection: oldest pending first (createdAt ascending,
      // _id ascending tie-break). Never randomly choose users.
      const selected = await registrations.find(fromFilter, { projection: { _id: 1 } }).sort({ createdAt: 1, _id: 1 }).limit(moveCount).toArray();
      let moved = 0;
      // Move one-by-one so records that changed state during the operation
      // cannot slip through: each update re-asserts schemaVersion,
      // payment_pending, AND the source destination match.
      for (const doc of selected) {
        const updated = await registrations.findOneAndUpdate(
          { _id: doc._id, schemaVersion: 2, "payment.status": "payment_pending", ...sourceMatch },
          {
            $set: {
              "payment.destination": { ...toSnapshot, assignedAt: now },
              "payment.snapshot.payeeName": target.payeeName,
              "payment.snapshot.upiId": target.upiId,
              updatedAt: now,
            },
            $push: { audit: { type: "payment_destination_reassigned", actor: "admin", at: now, metadata: { fromDestinationId, toDestinationId, reason: "legacy_blocked_destination", selectionPolicy: "oldest_pending_first" } } },
          },
          { returnDocument: "after" },
        );
        if (updated) moved += 1;
      }
      // Target capacity is consumed only for records actually moved; source
      // slots are never recycled. Refund any reservation left unused by a
      // concurrent state-change race — no phantom slot consumption.
      const unused = moveCount - moved;
      if (unused > 0) {
        await destinations.updateOne({ destinationId: toDestinationId }, { $inc: { assignedCount: -unused }, $set: { updatedAt: now } });
      }
      if (moved > 0) {
        const afterTarget = await destinations.findOne({ destinationId: toDestinationId });
        // Auto-exhaust + activate next if the target just filled.
        let exhausted = false;
        let activatedId: string | null = null;
        if (afterTarget && afterTarget.assignedCount >= afterTarget.capacity) {
          await destinations.updateOne({ destinationId: toDestinationId, status: { $in: ["active", "available"] } }, { $set: { status: "exhausted", allowNewAssignments: false, exhaustedAt: now, updatedAt: now } });
          exhausted = true;
          const next = await destinations.find({ status: "available", ownerApproved: true, allowNewAssignments: true }).sort({ sequence: 1 }).toArray();
          const candidate = next.filter((d) => d.destinationId !== ACCOUNT_A_DESTINATION_ID && d.sequence > afterTarget.sequence && d.assignedCount < d.capacity)[0];
          if (candidate) {
            const res = await destinations.updateOne({ destinationId: candidate.destinationId, status: "available" }, { $set: { status: "active", activatedAt: now, updatedAt: now } });
            if (res.modifiedCount) activatedId = candidate.destinationId;
          }
        }
        try {
          await (await getDb()).collection("admin_audit").insertMany([
            { type: "admin_payment_destination_reassigned", actor: "admin", at: now, metadata: { fromDestinationId, toDestinationId, requestedEligibleCount: eligibleCount, targetRemainingBefore: remaining, movedCount: moved, remainingEligibleCount: eligibleCount - moved } },
            ...(exhausted ? [{ type: "payment_destination_exhausted", actor: "system" as const, at: now, metadata: { destinationId: toDestinationId } }] : []),
            ...(activatedId ? [{ type: "payment_destination_activated", actor: "system" as const, at: now, metadata: { destinationId: activatedId } }] : []),
          ]);
        } catch { /* best-effort */ }
      } else {
        try {
          await (await getDb()).collection("admin_audit").insertOne({ type: "admin_payment_destination_reassigned", actor: "admin", at: now, metadata: { fromDestinationId, toDestinationId, requestedEligibleCount: eligibleCount, targetRemainingBefore: remaining, movedCount: 0, remainingEligibleCount: eligibleCount } });
        } catch { /* best-effort */ }
      }
      return sensitiveJson({ ...(await capacityOverview()), eligibleCount, movedCount: moved, willMove, willRemain: eligibleCount - moved, notice: `Reassigned ${moved} of ${eligibleCount} eligible unpaid registration(s) from ${fromDestinationId} to ${toDestinationId}. Oldest unpaid registrations were reassigned first. ${eligibleCount - moved} remain on ${fromDestinationId}.` });
    } catch { return apiError(503, "SERVER_ERROR", "Could not complete reassignment."); }
  }

  return apiError(422, "INVALID_REQUEST", "Invalid admin destination action.");
}
