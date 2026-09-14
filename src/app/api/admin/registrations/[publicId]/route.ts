import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminRejectSchema, AdminVerifySchema } from "@/lib/registration-v2";
import { apiError, isSameOrigin, sensitiveJson } from "@/lib/http";
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
      const parsed = AdminVerifySchema.safeParse({ ...body, publicId });
      if (!parsed.success) return apiError(422, "INVALID_REQUEST", "Confirm recipient-account verification before verifying payment.");
      const result = await verifyPaymentForReview({ publicId, simulatedDevelopmentPayment: false });
      if (!result) { console.warn("[admin-review] production verification transition conflict", publicId); return apiError(409, "INVALID_STATE_TRANSITION", "This registration changed since you opened it. Refresh the record."); }
      return sensitiveJson({ publicId: result.publicId, paymentStatus: result.payment.status, isTest: false });
    }
    if (body?.action === "reject") {
      const parsed = AdminRejectSchema.safeParse({ ...body, publicId });
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
