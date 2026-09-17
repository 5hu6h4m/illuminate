import { ObjectId } from "mongodb";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminRejectSchema, AdminVerifySchema } from "@/lib/registration-v2";
import { apiError, isSameOrigin, sensitiveJson } from "@/lib/http";
import { getDb, getPaymentProofBucket, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { isDevE2EPreviewEnabled } from "@/lib/payment";
import { PaymentFlowError, rejectPaymentForReview, verifyPaymentForReview } from "@/lib/payment-flow-service";

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
    return apiError(422, "INVALID_REQUEST", "Invalid review action.");
  } catch (error) {
    if (error instanceof PaymentFlowError) return apiError(409, error.code, error.message);
    return apiError(503, "SERVER_ERROR", "Could not complete the review action.");
  }
}

/**
 * Permanently deletes one registration and its uploaded proofs.
 *
 * Safety policy: TEST registrations are always deletable. Real registrations
 * are deletable only while no payment has been submitted yet
 * (`payment_pending`); submitted, verified, or rejected payments are
 * preserved for financial audit. Every deletion is recorded in `admin_audit`.
 */
export async function DELETE(_: Request, { params }: { params: Promise<{ publicId: string }> }) {
  if (!isSameOrigin(_)) return apiError(403, "UNAUTHORIZED", "Unauthorized.");
  if (!await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  const { publicId } = await params;
  if (!/^ILL26-[A-Z0-9]{6}$/.test(publicId)) return apiError(404, "NOT_FOUND", "Not found.");
  if (!isDbConfigured()) return apiError(503, "ADMIN_UNAVAILABLE", "Admin is unavailable.");
  try {
    const collection = await getRegistrationsCollection();
    const existing = await collection.findOne({ schemaVersion: 2, publicId });
    if (!existing) return apiError(404, "NOT_FOUND", "Not found.");
    if (!existing.isTest && existing.payment.status !== "payment_pending") {
      return apiError(409, "DELETE_NOT_ALLOWED", "Only TEST registrations and registrations with no payment submitted can be deleted. Submitted, verified, or rejected payments are preserved for audit.");
    }
    const proofIds = [...new Set([existing.payment.currentProofId, ...existing.payment.proofHistory.map((entry) => entry.fileId)].filter((value): value is string => Boolean(value)))].filter(ObjectId.isValid);
    if (proofIds.length) {
      try {
        const bucket = await getPaymentProofBucket();
        await Promise.all(proofIds.map((fileId) => bucket.delete(new ObjectId(fileId)).catch(() => undefined)));
      } catch { /* proof cleanup is best-effort; the record deletion below is authoritative */ }
    }
    const removed = await collection.deleteOne({ _id: existing._id, schemaVersion: 2 });
    if (removed.deletedCount !== 1) return apiError(409, "INVALID_STATE_TRANSITION", "This registration changed since you opened it. Refresh and try again.");
    try {
      await (await getDb()).collection("admin_audit").insertOne({ type: "admin_registration_deleted", actor: "admin", at: new Date(), metadata: { publicId, wasTest: existing.isTest, paymentStatus: existing.payment.status } });
    } catch (auditError) {
      console.warn("[admin-review] deletion audit insert failed", publicId, auditError instanceof Error ? auditError.message : auditError);
    }
    return sensitiveJson({ publicId, deleted: true, wasTest: existing.isTest });
  } catch { return apiError(503, "SERVER_ERROR", "Could not delete the registration."); }
}
