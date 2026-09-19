import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { event, isPaymentRegistrationAvailable } from "@/config/event";
import { resolveScheduledPricing, type PricingTier } from "@/lib/payment-pricing";

export const CURRENT_SCHEMA_VERSION = 2 as const;
export const PAYMENT_STATUSES = ["payment_pending", "submitted_for_verification", "verified", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentSnapshot = {
  expectedAmount: number | null;
  currency: "INR";
  payeeName: string;
  upiId: string;
  eventKey: string;
  mode: "production" | "development_preview";
  pricingTier: PricingTier | "development_preview";
  registrationAvailable: boolean;
  calculatedAt: string;
};

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  payment_pending: ["submitted_for_verification"],
  submitted_for_verification: ["verified", "rejected"],
  rejected: ["submitted_for_verification"],
  verified: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/**
 * LEGACY ONLY — Account A fallback for historical compatibility.
 * NEVER use for new payment assignment. New registrations must receive
 * their destination exclusively from the `payment_destinations` collection
 * (B → C → D → E). See `src/lib/payment-destinations.ts`.
 */
export const LEGACY_ACCOUNT_A_PAYEE = "Yash Patil";
export const LEGACY_ACCOUNT_A_UPI = "yashpatil76317@okicici";

export function getConfirmedPaymentSnapshot(at: Date = new Date()): PaymentSnapshot | null {
  if (!isPaymentRegistrationAvailable()) return null;
  const payeeName = (event.payment.recipient.value as string | null)?.trim();
  const upiId = (event.payment.upiId.value as string | null)?.trim();
  if (!payeeName || !upiId || event.fee.currency !== "INR") return null;
  const pricing = resolveScheduledPricing({ openAt: event.registration.openAt, earlyBirdEndAt: event.registration.earlyBirdEndAt, closeAt: event.registration.closeAt, earlyBirdAmount: event.fee.pricing.earlyBirdAmount, regularAmount: event.fee.pricing.regularAmount }, at);
  if (!pricing.registrationAvailable || pricing.tier === null || pricing.amount === null) return null;
  return {
    expectedAmount: pricing.amount,
    currency: "INR",
    payeeName,
    upiId,
    eventKey: `illuminate-${event.identity.edition}`,
    mode: "production",
    pricingTier: pricing.tier,
    registrationAvailable: pricing.registrationAvailable,
    calculatedAt: new Date().toISOString(),
  };
}

export function isDevE2EPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.REGISTRATION_PREVIEW === "1" &&
    process.env.PAYMENT_UI_PREVIEW === "1" &&
    process.env.PAYMENT_E2E_PREVIEW === "1";
}

export function getDevelopmentPreviewSnapshot(): PaymentSnapshot | null {
  if (!isDevE2EPreviewEnabled()) return null;
  // Versioned only to isolate current TEST records from an earlier preview schema.
  return { expectedAmount: null, currency: "INR", payeeName: "Preview Recipient", upiId: "preview-not-payable", eventKey: "illuminate-development-preview-v2", mode: "development_preview", pricingTier: "development_preview", registrationAvailable: false, calculatedAt: new Date().toISOString() };
}

export function buildUpiUri(snapshot: PaymentSnapshot, publicId: string): string {
  if (snapshot.mode !== "production" || snapshot.expectedAmount === null) throw new Error("Preview payment snapshots cannot create UPI URIs.");
  const parameters = new URLSearchParams({
    pa: snapshot.upiId,
    pn: snapshot.payeeName,
    am: snapshot.expectedAmount.toFixed(2),
    cu: snapshot.currency,
    tn: publicId,
  });
  return `upi://pay?${parameters.toString()}`;
}

/**
 * Destination-bound UPI URI. The price comes from the immutable
 * payment.snapshot.expectedAmount; payee comes from the assigned
 * payment.destination. Never mix with the globally active account.
 */
export function buildUpiUriForDestination(destination: { payeeName: string; upiId: string }, expectedAmount: number | null, publicId: string): string {
  if (expectedAmount === null || !Number.isFinite(expectedAmount)) throw new Error("Preview payment snapshots cannot create UPI URIs.");
  const parameters = new URLSearchParams({
    pa: destination.upiId,
    pn: destination.payeeName,
    am: expectedAmount.toFixed(2),
    cu: "INR",
    tn: publicId,
  });
  return `upi://pay?${parameters.toString()}`;
}

/** IDs omit 0/O/1/I/L to remain readable over phone calls. */
const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomReadable(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("");
}

export function generatePublicRegistrationId(): string {
  return `ILL26-${randomReadable(6)}`;
}

function participantTokenSecret(): string | null { return process.env.PARTICIPANT_TOKEN_SECRET?.trim() || null; }
export function generateParticipantAccessToken(publicId: string): string | null {
  const secret = participantTokenSecret();
  if (!secret) return null;
  const signature = createHmac("sha256", secret).update(publicId).digest("base64url");
  return `${publicId}.${signature}`;
}

export function isValidParticipantAccessToken(token: string): boolean {
  const publicId = token.split(".")[0];
  const expected = publicId ? generateParticipantAccessToken(publicId) : null;
  return Boolean(expected && expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token)));
}

export function hashParticipantAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeTransactionReference(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function isDevPaymentPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.REGISTRATION_PREVIEW === "1" && process.env.PAYMENT_UI_PREVIEW === "1";
}

export const MAX_PAYMENT_PROOF_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_PAYMENT_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function detectImageType(bytes: Uint8Array): (typeof ACCEPTED_PAYMENT_PROOF_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
