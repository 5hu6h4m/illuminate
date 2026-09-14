export type ExistingPaymentStatus = "payment_pending" | "submitted_for_verification" | "verified" | "rejected";
export type RegistrationScope = "production" | "development_preview";

type RecordScope = { isTest: boolean; environment: "production" | "development" };
type ParticipantIdentity = { normalizedEmail: string; normalizedPhone: string };

export type ExistingIdentityDecision =
  | { kind: "resume_test" }
  | { kind: "safe_conflict"; code: string; message: string };

/** Test records are never considered an identity collision for a real registration, and vice versa. */
export function isInRegistrationScope(record: RecordScope, scope: RegistrationScope): boolean {
  return scope === "development_preview"
    ? record.isTest && record.environment === "development"
    : !record.isTest && record.environment !== "development";
}

/** Idempotency replays are valid only for the exact normalized participant identity. */
export function isIdempotentReplayForIdentity(existing: ParticipantIdentity, requested: ParticipantIdentity): boolean {
  return existing.normalizedEmail === requested.normalizedEmail && existing.normalizedPhone === requested.normalizedPhone;
}

/**
 * Identity fields are not credentials. Only the holder of the original high-
 * entropy idempotency key may receive a continuation URL in production.
 */
export function decideExistingIdentityDuplicate(status: ExistingPaymentStatus, scope: RegistrationScope): ExistingIdentityDecision {
  if (scope === "development_preview") return { kind: "resume_test" };

  switch (status) {
    case "payment_pending":
      return {
        kind: "safe_conflict",
        code: "REGISTRATION_ALREADY_STARTED",
        message: "A registration is already in progress for these details. Continue using your secure registration link, or contact the organizer if you no longer have it.",
      };
    case "rejected":
      return {
        kind: "safe_conflict",
        code: "REGISTRATION_REQUIRES_ACTION",
        message: "A registration needs action. Use your existing secure registration link to resubmit payment proof, or contact the organizer if you no longer have it.",
      };
    case "submitted_for_verification":
      return {
        kind: "safe_conflict",
        code: "PAYMENT_ALREADY_SUBMITTED",
        message: "Payment proof for this registration is already awaiting verification. Use your secure registration link for status, or contact the organizer if you no longer have it.",
      };
    case "verified":
      return {
        kind: "safe_conflict",
        code: "REGISTRATION_ALREADY_COMPLETED",
        message: "This registration is already complete. Use your secure registration link for status, or contact the organizer if you no longer have it.",
      };
  }
}
