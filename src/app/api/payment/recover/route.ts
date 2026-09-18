import { ParticipantLoginRequestSchema, ParticipantRecoveryRequestSchema, parseLoginIdentifier } from "@/lib/registration-v2";
import { ensurePaymentIndexes, getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { apiError, clientIp, sensitiveJson } from "@/lib/http";
import { generateParticipantAccessToken } from "@/lib/payment";
import { enforceRecoveryRateLimit } from "@/lib/rate-limit";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";
import { isDevE2EPreviewEnabled } from "@/lib/payment";

export const runtime = "nodejs";

/** Re-issue the holder's own private status link — the single success exit. */
function issueStatusLink(publicId: string) {
  const token = generateParticipantAccessToken(publicId)!;
  return sensitiveJson({ publicId, statusUrl: `/registration/status/${token}` });
}

/**
 * Participant login with either registered email OR phone alone.
 *
 * Accepts new `{ identifier, illuminateId? }` and legacy
 * `{ publicId, email?, phone? }` for backward compat.
 * - identifier=email → lookup by `participant.normalizedEmail`; if
 *   `illuminateId` present it must equal `registration.publicId`.
 * - identifier=phone → lookup by `participant.normalizedPhone`; same ID check.
 * - identifier=publicId → lookup by `publicId`, then require a contact
 *   (legacy email/phone, or `illuminateId` holding email/phone). ID-alone
 *   never succeeds.
 * Failures return generic 404 so the endpoint is not an enumeration oracle.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    console.error("[registration_diagnostic] RECOVERY_DB_NOT_CONFIGURED");
    return apiError(503, "RECOVERY_UNAVAILABLE", "Login is unavailable. Please try again later.");
  }
  const body = await request.json().catch(() => null);

  // Normalize new + legacy shapes to a single login intent.
  let identifierKind: "email" | "phone" | "publicId" | null = null;
  let identifierValue = "";
  let contactEmail: string | undefined;
  let contactPhone: string | undefined;
  let illuminateId: string | undefined;
  let lookupPublicId: string | undefined;

  // Branch note: the strict schemas accept only pure shapes, so the form's
  // real payloads (new `{identifier, illuminateId?}` keys PLUS legacy
  // `{publicId, email, phone}` keys) always land in the hybrid branch below.
  // The `newParsed` branch serves pure-shape API clients; the hybrid branch
  // is the hot path. All three converge on one lookup + issueStatusLink tail.
  const newParsed = ParticipantLoginRequestSchema.safeParse(body);
  const legacyParsed = ParticipantRecoveryRequestSchema.safeParse(body);

  if (newParsed.success) {
    const parsedIdentifier = parseLoginIdentifier(newParsed.data.identifier);
    if (parsedIdentifier.kind === "invalid") {
      return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
    }
    if (parsedIdentifier.kind === "email") {
      identifierKind = "email";
      identifierValue = parsedIdentifier.email;
      contactEmail = parsedIdentifier.email;
      illuminateId = newParsed.data.illuminateId;
    } else if (parsedIdentifier.kind === "phone") {
      identifierKind = "phone";
      identifierValue = parsedIdentifier.phone;
      contactPhone = parsedIdentifier.phone;
      illuminateId = newParsed.data.illuminateId;
    } else {
      // identifier is an Illuminate ID alone — never allow ID-alone to succeed.
      return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
    }
  } else if (legacyParsed.success) {
    // Backward compat: legacy { publicId, email?, phone? } converts to
    // contact-as-identifier plus publicId-as-illuminateId.
    illuminateId = legacyParsed.data.publicId;
    if (legacyParsed.data.email) {
      identifierKind = "email";
      identifierValue = legacyParsed.data.email;
      contactEmail = legacyParsed.data.email;
    } else if (legacyParsed.data.phone) {
      identifierKind = "phone";
      identifierValue = legacyParsed.data.phone;
      contactPhone = legacyParsed.data.phone;
    } else {
      return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
    }
  } else {
    // Hybrid: strict schemas reject mixed shapes (e.g. identifier=ID plus
    // legacy email/phone, or contact tucked into illuminateId). Handle the
    // ID-first case explicitly; never allow ID-alone.
    if (body && typeof body === "object") {
      const raw = body as Record<string, unknown>;
      const rawIdentifier = typeof raw.identifier === "string" ? raw.identifier : undefined;
      const rawIlluminateId = typeof raw.illuminateId === "string" ? raw.illuminateId : undefined;
      const rawEmail = typeof raw.email === "string" ? raw.email : undefined;
      const rawPhone = typeof raw.phone === "string" ? raw.phone : undefined;
      const rawPublicId = typeof raw.publicId === "string" ? raw.publicId : undefined;
      if (rawIdentifier !== undefined) {
        const parsedIdentifier = parseLoginIdentifier(rawIdentifier);
        if (parsedIdentifier.kind === "email" || parsedIdentifier.kind === "phone") {
          // Contact-first with extra legacy keys: accept if optional ID (from
          // illuminateId or legacy publicId) is absent or a valid ID.
          const candidateId = rawIlluminateId ?? rawPublicId;
          if (candidateId !== undefined) {
            const idCheck = ParticipantLoginRequestSchema.shape.illuminateId.safeParse(candidateId);
            if (!idCheck.success) {
              return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
            }
            illuminateId = idCheck.data;
          }
          if (parsedIdentifier.kind === "email") {
            identifierKind = "email";
            identifierValue = parsedIdentifier.email;
            contactEmail = parsedIdentifier.email;
          } else {
            identifierKind = "phone";
            identifierValue = parsedIdentifier.phone;
            contactPhone = parsedIdentifier.phone;
          }
        } else if (parsedIdentifier.kind === "publicId") {
          lookupPublicId = parsedIdentifier.publicId;
          identifierKind = "publicId";
          identifierValue = parsedIdentifier.publicId;
          // Second factor must come from legacy email/phone, or illuminateId
          // holding a contact.
          if (rawEmail !== undefined) {
            const emailContact = parseLoginIdentifier(rawEmail);
            if (emailContact.kind === "email") contactEmail = emailContact.email;
          }
          if (contactEmail === undefined && rawPhone !== undefined) {
            const phoneContact = parseLoginIdentifier(rawPhone);
            if (phoneContact.kind === "phone") contactPhone = phoneContact.phone;
          }
          if (contactEmail === undefined && contactPhone === undefined && rawIlluminateId !== undefined) {
            const idAsContact = parseLoginIdentifier(rawIlluminateId);
            if (idAsContact.kind === "email") contactEmail = idAsContact.email;
            else if (idAsContact.kind === "phone") contactPhone = idAsContact.phone;
          }
          if (contactEmail === undefined && contactPhone === undefined) {
            return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
          }
        } else {
          return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
        }
      } else {
        return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
      }
      if (identifierKind === null) {
        return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
      }
    } else {
      return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
    }
  }

  const ip = clientIp(request);
  try {
    const limit = await enforceRecoveryRateLimit({ ip, identity: identifierValue });
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

    if (identifierKind === "publicId" && lookupPublicId) {
      const publicId = lookupPublicId;
      const email = contactEmail;
      const phone = contactPhone;
      const registration = await collection.findOne(
        { ...scope, publicId },
        { projection: { publicId: 1, participant: 1 } },
      );
      const matches = Boolean(
        registration &&
        ((email && registration.participant.normalizedEmail === email) ||
          (phone && registration.participant.normalizedPhone === phone)),
      );
      if (!registration || !matches) return apiError(404, "LOGIN_NOT_FOUND", "No registration matches those details. Check your registered email or mobile number.");
      return issueStatusLink(registration.publicId);
    }

    if (contactEmail) {
      const registration = await collection.findOne(
        { ...scope, "participant.normalizedEmail": contactEmail },
        { projection: { publicId: 1, participant: 1 } },
      );
      if (!registration) return apiError(404, "LOGIN_NOT_FOUND", "No registration matches those details. Check your registered email or mobile number.");
      if (illuminateId && registration.publicId !== illuminateId) {
        return apiError(404, "LOGIN_NOT_FOUND", "No registration matches those details. Check your registered email or mobile number.");
      }
      return issueStatusLink(registration.publicId);
    }

    if (contactPhone) {
      const registration = await collection.findOne(
        { ...scope, "participant.normalizedPhone": contactPhone },
        { projection: { publicId: 1, participant: 1 } },
      );
      if (!registration) return apiError(404, "LOGIN_NOT_FOUND", "No registration matches those details. Check your registered email or mobile number.");
      if (illuminateId && registration.publicId !== illuminateId) {
        return apiError(404, "LOGIN_NOT_FOUND", "No registration matches those details. Check your registered email or mobile number.");
      }
      return issueStatusLink(registration.publicId);
    }

    return apiError(422, "INVALID_LOGIN_DETAILS", "Enter your registered email or mobile number.");
  } catch (error) {
    console.error("[registration_diagnostic] UNHANDLED_RECOVERY_ERROR", error);
    return apiError(503, "RECOVERY_UNAVAILABLE", "Login is unavailable. Please try again later.");
  }
}
