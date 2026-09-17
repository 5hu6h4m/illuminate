import { createHash } from "crypto";
import type { Filter } from "mongodb";
import { PendingRegistrationRequestSchema, type RegistrationV2 } from "@/lib/registration-v2";
import { ensurePaymentIndexes, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { apiError, clientIp, sensitiveJson } from "@/lib/http";
import { generateParticipantAccessToken, generatePublicRegistrationId, getConfirmedPaymentSnapshot, getDevelopmentPreviewSnapshot, hashParticipantAccessToken } from "@/lib/payment";
import { enforceRateLimit, enforceRegistrationCreationRateLimit, REGISTRATION_CREATE_IP_LIMIT, REGISTRATION_CREATE_IP_WINDOW_MS } from "@/lib/rate-limit";
import { decideExistingIdentityDuplicate, isIdempotentReplayForIdentity } from "@/lib/registration-duplicate-policy";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // An explicitly enabled non-production E2E run always uses the isolated,
  // non-payable snapshot. This must win even if a developer temporarily has
  // confirmed payment facts in a local configuration.
  const developmentSnapshot = getDevelopmentPreviewSnapshot();
  const snapshot = developmentSnapshot ?? getConfirmedPaymentSnapshot();
  if (!snapshot) {
    console.error("[registration_diagnostic] PAYMENT_SNAPSHOT_UNAVAILABLE");
    return apiError(503, "PAYMENT_NOT_AVAILABLE", "Payment registration is not available yet.");
  }
  if (!isDbConfigured()) {
    console.error("[registration_diagnostic] REGISTRATION_DB_NOT_CONFIGURED");
    return apiError(503, "REGISTRATION_DB_NOT_CONFIGURED", "Registration is unavailable: server database is not configured. Please contact the organizer (code DB-CONFIG).");
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) return apiError(400, "INVALID_IDEMPOTENCY_KEY", "Please retry from the registration form.");
  try {
    const ip = clientIp(request);
    // Shared-IP burst guard runs before parsing so a flooded NAT gateway is
    // shed early. Per-identity quotas run after parsing (see below) so 500+
    // classmates behind one egress IP are never treated as one entity.
    if (ip !== "unknown" && !await enforceRateLimit("pending-registration-ip", ip, REGISTRATION_CREATE_IP_LIMIT, REGISTRATION_CREATE_IP_WINDOW_MS)) {
      console.warn("[registration_diagnostic] REGISTRATION_RATE_LIMITED ip_burst");
      return apiError(429, "RATE_LIMITED", "Too many registration attempts from this network. Please wait a minute and try again.", { retryAfterSeconds: Math.ceil(REGISTRATION_CREATE_IP_WINDOW_MS / 1000) });
    }
    const parsed = PendingRegistrationRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, "INVALID_DETAILS", "Please review your registration details.");
    const identityLimit = await enforceRegistrationCreationRateLimit({ ip: "unknown", email: parsed.data.details.email, phone: parsed.data.details.phone });
    if (!identityLimit.ok) {
      console.warn("[registration_diagnostic] REGISTRATION_RATE_LIMITED identity_quota");
      return apiError(429, "RATE_LIMITED", "Too many attempts for these contact details. Please try again later.", { retryAfterSeconds: identityLimit.retryAfterSeconds });
    }

    const tokenSecretCheck = generateParticipantAccessToken("ILL26-ABCDEF");
    if (!tokenSecretCheck) {
      console.error("[registration_diagnostic] PARTICIPANT_TOKEN_SECRET_MISSING");
      return apiError(503, "REGISTRATION_AUTH_NOT_CONFIGURED", "Registration is unavailable: server sign-in secret is missing. Please contact the organizer (code AUTH-CONFIG).");
    }

    try {
      await ensurePaymentIndexes();
    } catch (error) {
      console.error("[registration_diagnostic] REGISTRATION_INDEX_INIT_FAILED", error);
      return apiError(503, "REGISTRATION_INDEX_INIT_FAILED", "Registration is temporarily unavailable (database setup failed). Please retry in a minute; if it persists contact the organizer (code DB-INDEX).");
    }

    let collection;
    try {
      collection = await getRegistrationsCollection();
    } catch (error) {
      console.error("[registration_diagnostic] REGISTRATION_DB_CONNECTION_FAILED", error);
      return apiError(503, "REGISTRATION_DB_CONNECTION_FAILED", "Registration is temporarily unavailable (cannot reach database). Please retry in a minute (code DB-CONN).");
    }

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
        if ((error as { code?: number }).code !== 11000) {
          console.error("[registration_diagnostic] REGISTRATION_INSERT_FAILED", error);
          throw error;
        }
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
        if (attempt === 3) return apiError(503, "REGISTRATION_WRITE_FAILED", "Could not create your registration (code DB-WRITE). Please retry.");
      }
    }
    return apiError(500, "SERVER_ERROR", "Could not create your registration. Please retry.");
  } catch (error) {
    console.error("[registration_diagnostic] UNHANDLED_REGISTRATION_ERROR", error);
    return apiError(503, "REGISTRATION_UNAVAILABLE", "Registration is temporarily unavailable (high demand or server issue). Your details are still on this form — please retry in a minute. If you already have an Illuminate ID, log in instead. (code SERVER)");
  }
}
