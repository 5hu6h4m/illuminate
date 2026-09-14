import { createHash } from "crypto";
import type { Filter } from "mongodb";
import { PendingRegistrationRequestSchema, type RegistrationV2 } from "@/lib/registration-v2";
import { ensurePaymentIndexes, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { apiError, clientIp, sensitiveJson } from "@/lib/http";
import { generateParticipantAccessToken, generatePublicRegistrationId, getConfirmedPaymentSnapshot, getDevelopmentPreviewSnapshot, hashParticipantAccessToken } from "@/lib/payment";
import { enforceRateLimit } from "@/lib/rate-limit";
import { decideExistingIdentityDuplicate, isIdempotentReplayForIdentity } from "@/lib/registration-duplicate-policy";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // An explicitly enabled non-production E2E run always uses the isolated,
  // non-payable snapshot. This must win even if a developer temporarily has
  // confirmed payment facts in a local configuration.
  const developmentSnapshot = getDevelopmentPreviewSnapshot();
  const snapshot = developmentSnapshot ?? getConfirmedPaymentSnapshot();
  if (!snapshot) return apiError(503, "PAYMENT_NOT_AVAILABLE", "Payment registration is not available yet.");
  if (!isDbConfigured()) return apiError(503, "REGISTRATION_UNAVAILABLE", "Registration is unavailable. Please try again later.");
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) return apiError(400, "INVALID_IDEMPOTENCY_KEY", "Please retry from the registration form.");
  try {
    if (!await enforceRateLimit("pending-registration", clientIp(request), 12, 15 * 60_000)) return apiError(429, "RATE_LIMITED", "Too many attempts. Please try again shortly.");
    const parsed = PendingRegistrationRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, "INVALID_DETAILS", "Please review your registration details.");
    const tokenSecretCheck = generateParticipantAccessToken("ILL26-ABCDEF");
    if (!tokenSecretCheck) return apiError(503, "REGISTRATION_UNAVAILABLE", "Registration is unavailable. Please try again later.");
    await ensurePaymentIndexes();
    const collection = await getRegistrationsCollection();
    const idempotencyKeyHash = createHash("sha256").update(idempotencyKey).digest("hex");
    const details = parsed.data.details;
    const existingRequest = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
    if (existingRequest) {
      // The idempotency key is a high-entropy, client-held capability. Do not
      // let an accidental reuse with different details become a token lookup.
      if (!isIdempotentReplayForIdentity(existingRequest.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
        return apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
      }
      const token = generateParticipantAccessToken(existingRequest.publicId)!;
      return sensitiveJson({ publicId: existingRequest.publicId, statusUrl: `/registration/status/${token}`, created: false });
    }
    const duplicateFilter: Filter<RegistrationV2> = snapshot.mode === "development_preview"
      ? { ...developmentTestRegistrationFilter, eventKey: snapshot.eventKey }
      : { ...realRegistrationFilter, eventKey: snapshot.eventKey };
    const findIdentityDuplicate = () => collection.findOne(
      { ...duplicateFilter, $or: [{ "participant.normalizedEmail": details.email }, { "participant.normalizedPhone": details.phone }] },
      { projection: { _id: 1, publicId: 1, isTest: 1, environment: 1, "payment.status": 1 } },
    );
    const respondToIdentityDuplicate = (duplicate: RegistrationV2) => {
      const decision = decideExistingIdentityDuplicate(duplicate.payment.status, snapshot.mode);
      if (decision.kind === "resume_test") {
        const token = generateParticipantAccessToken(duplicate.publicId)!;
        return sensitiveJson({ publicId: duplicate.publicId, statusUrl: `/registration/status/${token}`, created: false, resumedTest: true });
      }
      return apiError(409, decision.code, decision.message);
    };
    const duplicate = await findIdentityDuplicate();
    if (duplicate) return respondToIdentityDuplicate(duplicate);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const publicId = generatePublicRegistrationId();
      const token = generateParticipantAccessToken(publicId)!;
      const now = new Date();
      const registration: RegistrationV2 = {
        schemaVersion: 2,
        eventKey: snapshot.eventKey,
        publicId,
        environment: snapshot.mode === "development_preview" ? "development" : "production",
        isTest: snapshot.mode === "development_preview",
        participantAccessTokenHash: hashParticipantAccessToken(token),
        participant: { fullName: details.fullName, email: details.email, normalizedEmail: details.email, phone: details.phone, normalizedPhone: details.phone, ...(details.college ? { college: details.college } : {}), ...(details.branch ? { branch: details.branch } : {}), ...(details.year ? { year: details.year } : {}) },
        payment: { snapshot, status: "payment_pending", proofHistory: [] },
        idempotencyKeyHash,
        audit: [{ type: "registration_created", actor: "participant", at: now }],
        createdAt: now,
        updatedAt: now,
      };
      try {
        await collection.insertOne(registration);
        return sensitiveJson({ publicId, statusUrl: `/registration/status/${token}`, created: true }, { status: 201 });
      } catch (error: unknown) {
        if ((error as { code?: number }).code !== 11000) throw error;
        const replay = await collection.findOne({ schemaVersion: 2, eventKey: snapshot.eventKey, idempotencyKeyHash });
        if (replay) {
          if (!isIdempotentReplayForIdentity(replay.participant, { normalizedEmail: details.email, normalizedPhone: details.phone })) {
            return apiError(409, "IDEMPOTENCY_KEY_REUSED", "Please refresh the registration form and try again.");
          }
          return sensitiveJson({ publicId: replay.publicId, statusUrl: `/registration/status/${generateParticipantAccessToken(replay.publicId)!}`, created: false });
        }
        // A concurrent request may have won the unique email/phone index after
        // our first lookup. Resolve its state through the same safe policy.
        const concurrentDuplicate = await findIdentityDuplicate();
        if (concurrentDuplicate) return respondToIdentityDuplicate(concurrentDuplicate);
        if (attempt === 3) return apiError(503, "REGISTRATION_UNAVAILABLE", "Could not create your registration. Please retry.");
      }
    }
    return apiError(500, "SERVER_ERROR", "Could not create your registration. Please retry.");
  } catch {
    return apiError(503, "REGISTRATION_UNAVAILABLE", "Registration is unavailable. Please try again later.");
  }
}
