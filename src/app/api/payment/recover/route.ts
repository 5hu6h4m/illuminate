import { ParticipantRecoveryRequestSchema } from "@/lib/registration-v2";
import { ensurePaymentIndexes, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { apiError, clientIp, sensitiveJson } from "@/lib/http";
import { generateParticipantAccessToken } from "@/lib/payment";
import { enforceRecoveryRateLimit } from "@/lib/rate-limit";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";
import { isDevE2EPreviewEnabled } from "@/lib/payment";

export const runtime = "nodejs";

/**
 * Participant login with Illuminate ID.
 *
 * Body: `{ publicId, email? , phone? }` — at least one contact field.
 * Both the ID and the contact must match the same record before the private
 * status URL is re-issued. Failures return a generic 404 so the endpoint is
 * not an enumeration oracle for IDs or emails.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    console.error("[registration_diagnostic] RECOVERY_DB_NOT_CONFIGURED");
    return apiError(503, "RECOVERY_UNAVAILABLE", "Login is unavailable. Please try again later.");
  }
  const parsed = ParticipantRecoveryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your Illuminate ID and registered email or mobile number.");
  const { publicId, email, phone } = parsed.data;
  const ip = clientIp(request);
  try {
    const limit = await enforceRecoveryRateLimit({ ip, publicId });
    if (!limit.ok) return apiError(429, "RATE_LIMITED", "Too many login attempts. Please try again shortly.", { retryAfterSeconds: limit.retryAfterSeconds });
    if (!generateParticipantAccessToken("ILL26-ABCDEF")) {
      console.error("[registration_diagnostic] RECOVERY_TOKEN_SECRET_MISSING");
      return apiError(503, "RECOVERY_UNAVAILABLE", "Login is unavailable. Please try again later.");
    }
    try {
      await ensurePaymentIndexes();
    } catch (error) {
      console.error("[registration_diagnostic] RECOVERY_INDEX_INIT_FAILED", error);
      return apiError(503, "RECOVERY_UNAVAILABLE", "Login is unavailable. Please try again later.");
    }
    const collection = await getRegistrationsCollection();
    const scope = isDevE2EPreviewEnabled() ? developmentTestRegistrationFilter : realRegistrationFilter;
    const registration = await collection.findOne(
      { ...scope, publicId },
      { projection: { publicId: 1, participant: 1 } },
    );
    const matches = Boolean(
      registration &&
      ((email && registration.participant.normalizedEmail === email) ||
        (phone && registration.participant.normalizedPhone === phone)),
    );
    if (!registration || !matches) return apiError(404, "LOGIN_NOT_FOUND", "No registration matches those details. Check your Illuminate ID and registered contact.");
    const token = generateParticipantAccessToken(registration.publicId)!;
    return sensitiveJson({ publicId: registration.publicId, statusUrl: `/registration/status/${token}` });
  } catch (error) {
    console.error("[registration_diagnostic] UNHANDLED_RECOVERY_ERROR", error);
    return apiError(503, "RECOVERY_UNAVAILABLE", "Login is unavailable. Please try again later.");
  }
}
