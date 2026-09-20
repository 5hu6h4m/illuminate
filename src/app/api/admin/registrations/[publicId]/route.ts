import { ObjectId } from "mongodb";
import { isAdminAuthenticated, verifyAdminPassword } from "@/lib/admin-auth";
import { AdminDeleteSchema, AdminEcellSchema, AdminRejectSchema, AdminVerifySchema } from "@/lib/registration-v2";
import { apiError, clientIp, isSameOrigin, sensitiveJson } from "@/lib/http";
import { getDb, getPaymentDestinationsCollection, getPaymentProofBucket, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { isDevE2EPreviewEnabled } from "@/lib/payment";
import { APPROVED_DESTINATION_IDS_IN_SEQUENCE, releaseDestinationSlot } from "@/lib/payment-destinations";
import { enforceAdminDeleteRateLimit, enforceAdminEcellRateLimit } from "@/lib/rate-limit";
import { PaymentFlowError, rejectPaymentForReview, setEcellMemberFlag, verifyPaymentForReview } from "@/lib/payment-flow-service";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  if (!isSameOrigin(request) || !await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  const { publicId } = await params;
  try {
    const body = await request.json();
    if (body?.action === "verify") {
      if (body?.developmentSimulationVerified === true) {
        if (!isDevE2EPreviewEnabled()) return apiError(404, "NOT_FOUND", "Not found.");
        const result = await verifyPaymentForReview({ publicId, simulatedDevelopmentPayment: true });
        if (!result) { console.warn("[admin-review] test verification transition conflict", publicId); return apiError(409, "INVALID_STATE_TRANSITION", "This registration changed since you opened it. Refresh the record."); }
        return sensitiveJson({ publicId: result.publicId, paymentStatus: result.payment.status, isTest: true });
      }
      const parsed = AdminVerifySchema.safeParse({ publicId, confirmedInRecipientAccount: body?.confirmedInRecipientAccount });
      if (!parsed.success) return apiError(422, "INVALID_REQUEST", "Confirm recipient-account verification before verifying payment.");
      const result = await verifyPaymentForReview({ publicId, simulatedDevelopmentPayment: false });
      if (!result) { console.warn("[admin-review] production verification transition conflict", publicId); return apiError(409, "INVALID_STATE_TRANSITION", "This registration changed since you opened it. Refresh the record."); }
      return sensitiveJson({ publicId: result.publicId, paymentStatus: result.payment.status, isTest: false });
    }
    if (body?.action === "reject") {
      const parsed = AdminRejectSchema.safeParse({ publicId, publicReason: body?.publicReason, privateNote: body?.privateNote });
      if (!parsed.success) return apiError(422, "INVALID_REQUEST", "A concise participant-facing rejection reason is required.");
      const result = await rejectPaymentForReview({ publicId, publicReason: parsed.data.publicReason, privateNote: parsed.data.privateNote });
      if (!result) { console.warn("[admin-review] rejection transition conflict", publicId); return apiError(409, "INVALID_STATE_TRANSITION", "This registration changed since you opened it. Refresh the record."); }
      return sensitiveJson({ publicId: result.publicId, paymentStatus: result.payment.status, isTest: result.isTest });
    }
    if (body?.action === "ecell") {
      const parsed = AdminEcellSchema.safeParse({ publicId, ecellMember: body?.ecellMember });
      if (!parsed.success) return apiError(422, "INVALID_REQUEST", "Invalid E-cell member flag.");
      try {
        const limit = await enforceAdminEcellRateLimit({ ip: clientIp(request), publicId: parsed.data.publicId });
        if (!limit.ok) return apiError(429, "RATE_LIMITED", "Too many E-cell updates. Please try again shortly.", { retryAfterSeconds: limit.retryAfterSeconds });
      } catch {
        return apiError(503, "SERVER_ERROR", "Could not update the E-cell flag.");
      }
      const result = await setEcellMemberFlag({ publicId: parsed.data.publicId, ecellMember: parsed.data.ecellMember });
      if (!result) return apiError(404, "NOT_FOUND", "Not found.");
      try {
        await (await getDb()).collection("admin_audit").insertOne({ type: "admin_ecell_flag_changed", actor: "admin", at: new Date(), metadata: { publicId: result.publicId, ecellMember: parsed.data.ecellMember, paymentStatus: result.payment.status, wasTest: result.isTest, expectedAmount: result.payment.snapshot?.expectedAmount ?? null } });
      } catch (auditError) {
        console.warn("[admin-review] ecell audit insert failed", publicId, auditError instanceof Error ? auditError.message : auditError);
      }
      return sensitiveJson({ publicId: result.publicId, ecellMember: result.ecellMember === true, paymentStatus: result.payment.status, isTest: result.isTest });
    }
    return apiError(422, "INVALID_REQUEST", "Invalid review action.");
  } catch (error) {
    if (error instanceof PaymentFlowError) return apiError(409, error.code, error.message);
    return apiError(503, "SERVER_ERROR", "Could not complete the review action.");
  }
}

/**
 * Permanently deletes one registration and its uploaded proofs.
 *
 * Hard-delete is allowed for any status (including verified real
 * registrations). The caller must re-enter the admin password and confirm
 * the public ID in the request body. Every deletion is recorded in
 * `admin_audit`, distinguishing verified deletions for financial audit.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  if (!isSameOrigin(request)) return apiError(403, "UNAUTHORIZED", "Unauthorized.");
  if (!await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  const { publicId } = await params;
  if (!/^ILL26-[A-Z0-9]{6}$/.test(publicId)) return apiError(404, "NOT_FOUND", "Not found.");
  if (!isDbConfigured()) return apiError(503, "ADMIN_DB_NOT_CONFIGURED", "Admin is unavailable: server database is not configured (code ADMIN-DB-CONFIG).");
  const ip = clientIp(request);
  try {
    const limit = await enforceAdminDeleteRateLimit({ ip, publicId });
    if (!limit.ok) return apiError(429, "RATE_LIMITED", "Too many delete attempts. Please try again shortly.", { retryAfterSeconds: limit.retryAfterSeconds });
  } catch {
    return apiError(503, "SERVER_ERROR", "Could not delete the registration.");
  }
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(422, "INVALID_REQUEST", "A valid confirmation payload with confirmPublicId, reason, and password is required.");
  }
  const parsed = AdminDeleteSchema.safeParse(rawBody);
  if (!parsed.success) return apiError(422, "INVALID_REQUEST", "A valid confirmPublicId, a deletion reason (10-500 characters), and the admin password are required.");
  if (parsed.data.confirmPublicId !== publicId) return apiError(422, "INVALID_REQUEST", "Confirmation ID does not match this registration.");
  // Same response as a missing/invalid session so the endpoint is not a
  // password-guessing oracle; attempts are additionally rate-limited per ID.
  if (!verifyAdminPassword(parsed.data.password)) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  try {
    const collection = await getRegistrationsCollection();
    const existing = await collection.findOne({ schemaVersion: 2, publicId });
    if (!existing) return apiError(404, "NOT_FOUND", "Not found.");
    const paymentStatus = existing.payment.status;
    const wasTest = existing.isTest;
    const proofIds = [...new Set([existing.payment.currentProofId, ...(existing.payment.proofHistory ?? []).map((entry) => entry.fileId)].filter((value): value is string => Boolean(value)))].filter(ObjectId.isValid);
    const removed = await collection.findOneAndDelete({ _id: existing._id, schemaVersion: 2, publicId });
    if (!removed) return apiError(409, "INVALID_STATE_TRANSITION", "This registration changed since you opened it. Refresh and try again.");
    if (proofIds.length) {
      try {
        const bucket = await getPaymentProofBucket();
        await Promise.all(proofIds.map((fileId) => bucket.delete(new ObjectId(fileId)).catch(() => undefined)));
      } catch { /* proof cleanup is best-effort; the record deletion above is authoritative */ }
    }
    const wasVerified = paymentStatus === "verified";
    // --- Capacity integrity: release the assigned payment-destination slot ---
    // `assignedCount` is the source of truth for CapacityPanel / FULL checks.
    // Without this, a deleted registration leaks its slot forever (false FULL,
    // stale per-account counts). Only real production records with an approved
    // destination (B→C→D→E) ever consumed a slot: test/dev-preview records
    // bypass destinations, Account A is legacy/disabled, and legacy docs
    // without `payment.destination` never claimed. The destinationId is
    // allowlisted before use, the decrement is atomic ($inc with $gt: 0 so
    // counts never go negative), and release is idempotent — only the single
    // winner of the atomic findOneAndDelete above reaches this path, so a
    // retried DELETE (now 404) never double-releases. Best-effort: the record
    // deletion above is authoritative; a destination failure is logged and
    // surfaced in audit but never rolls back the delete.
    const rawDestinationId = removed.payment?.destination?.destinationId;
    const assignedDestinationId =
      typeof rawDestinationId === "string" &&
      (APPROVED_DESTINATION_IDS_IN_SEQUENCE as readonly string[]).includes(rawDestinationId) &&
      removed.isTest !== true &&
      removed.environment !== "development"
        ? rawDestinationId
        : null;
    let destinationReleased = false;
    let destinationReleaseError: string | null = null;
    if (assignedDestinationId) {
      try {
        const destinations = await getPaymentDestinationsCollection();
        const before = await destinations.findOne(
          { destinationId: assignedDestinationId },
          { projection: { assignedCount: 1 } },
        );
        await releaseDestinationSlot(destinations, assignedDestinationId);
        // releaseDestinationSlot is a no-op when assignedCount is already 0;
        // only report a release when a slot was actually held.
        destinationReleased = (before?.assignedCount ?? 0) > 0;
      } catch (releaseError) {
        destinationReleaseError = releaseError instanceof Error ? releaseError.message : String(releaseError ?? "unknown");
        console.warn("[admin-review] destination slot release failed", publicId, assignedDestinationId, destinationReleaseError);
      }
    }
    try {
      const db = await getDb();
      await db.collection("admin_audit").insertOne({ type: wasVerified ? "admin_registration_deleted_verified" : "admin_registration_deleted", actor: "admin", at: new Date(), metadata: { publicId, wasTest, paymentStatus, expectedAmount: existing.payment.snapshot?.expectedAmount ?? null, ecellMember: existing.ecellMember === true, transactionReference: existing.payment.transactionReference ?? null, verifiedAt: existing.payment.verifiedAt ?? null, proofIds, reason: parsed.data.reason, destinationId: assignedDestinationId, destinationReleased, ...(destinationReleaseError ? { destinationReleaseError } : {}) } });
      if (destinationReleased && assignedDestinationId) {
        await db.collection("admin_audit").insertOne({ type: "payment_destination_released", actor: "system", at: new Date(), metadata: { destinationId: assignedDestinationId, publicId, paymentStatus, wasTest } }).catch(() => undefined);
      }
    } catch (auditError) {
      console.warn("[admin-review] deletion audit insert failed", publicId, auditError instanceof Error ? auditError.message : auditError);
    }
    return sensitiveJson({ publicId, deleted: true, wasTest, wasVerified, destinationId: assignedDestinationId, destinationReleased });
  } catch { return apiError(503, "SERVER_ERROR", "Could not delete the registration."); }
}
