/**
 * Shared login-identifier primitives (client-safe: no `server-only`, no zod).
 *
 * Single source of truth for Illuminate ID shape and Indian-mobile
 * normalization. Both the server schema (`registration-v2.ts`) and the
 * login form (`ParticipantLogin.tsx`) build on these, so a format change
 * lands in one place.
 *
 * Note: the form keeps its own `detectIdentifierKind` heuristic on top of
 * these primitives on purpose — it classifies for hint specificity
 * (e.g. `@`-containing input is "email, but malformed"), while the server
 * `parseLoginIdentifier` is the strict source of truth.
 */

export const ILLUMINATE_ID_PATTERN = /^ILL26-[A-Z0-9]{6}$/;
export const ILLUMINATE_ID_PATTERN_CI = /^ILL26-[A-Z0-9]{6}$/i;
export const NORMALIZED_PHONE_PATTERN = /^[6-9]\d{9}$/;
export const ILLUMINATE_ID_EXAMPLE = "ILL26-ABCDEF";

/** Trim + uppercase — the canonical Illuminate ID form. */
export function normalizeIlluminateId(value: string): string {
  return value.trim().toUpperCase();
}

/** True when the value is a well-formed Illuminate ID (case-insensitive). */
export function isIlluminateId(value: string): boolean {
  return ILLUMINATE_ID_PATTERN.test(normalizeIlluminateId(value));
}

/**
 * Strip non-digits, then strip a leading `91` only when exactly 10 digits
 * remain — mirrors registration phone normalization so login never locks
 * out a number registration accepted.
 */
export function normalizeLoginPhone(value: string): string {
  return value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

/** True when the value normalizes to a valid 10-digit Indian mobile. */
export function isLoginPhone(value: string): boolean {
  return NORMALIZED_PHONE_PATTERN.test(normalizeLoginPhone(value.trim()));
}
