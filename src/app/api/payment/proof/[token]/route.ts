import { ObjectId } from "mongodb";
import { Readable } from "stream";
import { isDevE2EPreviewEnabled, isValidParticipantAccessToken } from "@/lib/payment";
import { getDb, getPaymentProofBucket, isDbConfigured } from "@/lib/mongodb";
import { apiError, sensitiveJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { PaymentFlowError, registrationForParticipantToken, submitPaymentProofForParticipant } from "@/lib/payment-flow-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured() || !isValidParticipantAccessToken(token)) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
  try {
    if (!await enforceRateLimit("proof-submit", token, 8, 15 * 60_000)) return apiError(429, "RATE_LIMITED", "Too many attempts. Please try again shortly.");
    const registration = await registrationForParticipantToken(token);
    if (!registration) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
    if (registration.isTest ? !isDevE2EPreviewEnabled() : registration.payment.snapshot.mode !== "production") return apiError(503, "PAYMENT_NOT_AVAILABLE", "Payment proof submission is not available yet.");
    const form = await request.formData();
    const referenceInput = form.get("transactionReference");
    const proof = form.get("proof");
    if (!(proof instanceof File)) return apiError(422, "INVALID_PROOF_FILE", "Select a PNG, JPEG, or WebP payment screenshot.");
    const bytes = new Uint8Array(await proof.arrayBuffer());
    try {
      await submitPaymentProofForParticipant({ token, transactionReference: referenceInput, proof: { bytes, contentType: proof.type } });
      return sensitiveJson({ publicId: registration.publicId, paymentStatus: "submitted_for_verification" });
    } catch (error: unknown) {
      if (error instanceof PaymentFlowError) {
        const status = error.code === "INVALID_STATUS_TOKEN" ? 404 : error.code === "PAYMENT_NOT_AVAILABLE" ? 503 : error.code === "PROOF_TOO_LARGE" ? 413 : error.code === "INVALID_TRANSACTION_REFERENCE" || error.code === "INVALID_PROOF_FILE" ? 422 : 409;
        return apiError(status, error.code, error.message);
      }
      throw error;
    }
  } catch { return apiError(503, "SERVER_ERROR", "Could not submit payment proof. No confirmation was recorded; please retry."); }
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured() || !isValidParticipantAccessToken(token)) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
  try {
    const registration = await registrationForParticipantToken(token);
    const fileId = registration?.payment.currentProofId;
    if (!registration || !fileId || !ObjectId.isValid(fileId)) return apiError(404, "NOT_FOUND", "Not found.");
    const files = (await getDb()).collection("payment_proofs.files");
    const file = await files.findOne({ _id: new ObjectId(fileId) });
    if (!file) return apiError(404, "NOT_FOUND", "Not found.");
    const stream = (await getPaymentProofBucket()).openDownloadStream(new ObjectId(fileId));
    return new Response(Readable.toWeb(stream) as ReadableStream, { headers: { "Content-Type": String((file.metadata as { contentType?: string } | undefined)?.contentType || "application/octet-stream"), "Content-Disposition": "inline", "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
  } catch { return apiError(404, "NOT_FOUND", "Not found."); }
}
