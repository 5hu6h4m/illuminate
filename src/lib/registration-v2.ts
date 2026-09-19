import "server-only";

import { z } from "zod";
import { RegistrationDetailsSchema } from "@/lib/registration-details";
import type { PaymentSnapshot, PaymentStatus } from "@/lib/payment";
import {
  ILLUMINATE_ID_PATTERN_CI,
  NORMALIZED_PHONE_PATTERN,
  normalizeIlluminateId,
  normalizeLoginPhone,
} from "@/lib/login-identifier";
export { isIlluminateId, isLoginPhone, normalizeIlluminateId, normalizeLoginPhone } from "@/lib/login-identifier";

export const PendingRegistrationRequestSchema = z.object({
  details: RegistrationDetailsSchema,
}).strict();

export const TransactionReferenceSchema = z.string().trim().min(8, "Enter a valid UPI reference.").max(80, "Reference is too long.").regex(/^[A-Za-z0-9\s-]+$/, "Use letters, numbers, spaces, or hyphens only.");
export const AdminVerifySchema = z.object({ publicId: z.string().regex(/^ILL26-[A-Z0-9]{6}$/), confirmedInRecipientAccount: z.literal(true) }).strict();
export const AdminRejectSchema = z.object({ publicId: z.string().regex(/^ILL26-[A-Z0-9]{6}$/), publicReason: z.string().trim().min(3).max(300), privateNote: z.string().trim().max(1000).optional() }).strict();
export const AdminDeleteSchema = z.object({ confirmPublicId: z.string().regex(/^ILL26-[A-Z0-9]{6}$/), reason: z.string().trim().min(10).max(500), password: z.string().min(1).max(1024) }).strict();
export const AdminEcellSchema = z.object({ publicId: z.string().regex(/^ILL26-[A-Z0-9]{6}$/), ecellMember: z.boolean() }).strict();

const illuminateIdField = z.string().trim().toUpperCase().regex(/^ILL26-[A-Z0-9]{6}$/, "Enter your Illuminate ID (e.g. ILL26-ABCDEF).");
const recoveryEmailField = z.string().trim().toLowerCase().pipe(z.email("Enter the email you registered with.")).optional();
const recoveryPhoneField = z.string().trim().transform(normalizeLoginPhone).pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter the mobile number you registered with.")).optional();

/**
 * Participant login with either registered email OR phone alone.
 * Illuminate ID (`illuminateId`) is optional second factor: when present it
 * must match the same record, otherwise contact alone suffices. ID-alone
 * never succeeds — a contact is always required.
 */
export const ParticipantLoginRequestSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your registered email, mobile number, or Illuminate ID.").max(254, "That entry looks too long."),
  illuminateId: illuminateIdField.optional(),
}).strict();

export type ParticipantLoginRequest = z.infer<typeof ParticipantLoginRequestSchema>;

export type LoginIdentifierKind = "email" | "phone" | "publicId" | "invalid";

export type ParsedLoginIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string }
  | { kind: "publicId"; publicId: string }
  | { kind: "invalid" };

/**
 * Classify a raw login identifier as email, phone, or Illuminate ID.
 * - email: contains `@`, validated with zod email after trim + lowercase.
 * - publicId: matches ILL26-XXXXXX (case-insensitive), normalized to upper.
 * - else phone: strip non-digits, strip leading 91 for 12-digit, must match
 *   Indian mobile pattern (shared `normalizeLoginPhone` — same wall as
 *   registration, so login never rejects a number registration accepted).
 */
export function parseLoginIdentifier(value: unknown): ParsedLoginIdentifier {
  if (typeof value !== "string") return { kind: "invalid" };
  const trimmed = value.trim();
  if (trimmed.length < 3) return { kind: "invalid" };
  if (trimmed.includes("@")) {
    const normalizedEmail = trimmed.toLowerCase();
    const emailCheck = z.email().safeParse(normalizedEmail);
    if (!emailCheck.success) return { kind: "invalid" };
    return { kind: "email", email: normalizedEmail };
  }
  if (ILLUMINATE_ID_PATTERN_CI.test(trimmed)) {
    return { kind: "publicId", publicId: normalizeIlluminateId(trimmed) };
  }
  const digits = normalizeLoginPhone(trimmed);
  if (NORMALIZED_PHONE_PATTERN.test(digits)) return { kind: "phone", phone: digits };
  return { kind: "invalid" };
}

/**
 * @deprecated Use {@link ParticipantLoginRequestSchema} + {@link parseLoginIdentifier}.
 * Kept for backward compat: accepts legacy `{ publicId, email?, phone? }`
 * and callers convert it to login logic (contact as identifier, publicId as
 * optional `illuminateId`). Do not use for new code.
 *
 * Legacy rule: Illuminate ID plus the contact detail used at registration.
 * Both must match the same record before the private status link is
 * re-issued, so one field alone never discloses another participant's link.
 */
export const ParticipantRecoveryRequestSchema = z.object({
  publicId: illuminateIdField,
  email: recoveryEmailField,
  phone: recoveryPhoneField,
}).strict().refine((value) => Boolean(value.email || value.phone), { message: "Enter your registered email or mobile number.", path: ["email"] });

export type ParticipantRecoveryRequest = z.infer<typeof ParticipantRecoveryRequestSchema>;

export type AuditEventType = "registration_created" | "payment_proof_submitted" | "payment_proof_resubmitted" | "payment_verified" | "payment_rejected" | "ecell_flag_changed" | "payment_destination_assigned" | "payment_destination_reassigned";
export type AuditEvent = { type: AuditEventType; actor: "participant" | "admin" | "system"; at: Date; metadata?: Record<string, string | number | boolean> };

/**
 * Events recorded in the separate `admin_audit` collection (never pushed
 * into `RegistrationV2["audit"]` — that record is hard-deleted with the
 * registration, while the `admin_audit` snapshot survives it).
 */
export type AdminAuditEventType = "admin_login_success" | "admin_login_failed" | "admin_registration_deleted" | "admin_registration_deleted_verified" | "admin_ecell_flag_changed" | "payment_destination_exhausted" | "payment_destination_activated" | "payment_destination_disabled" | "payment_capacity_full" | "admin_payment_destination_reassigned";
export type AdminAuditEvent = { type: AdminAuditEventType; actor: "admin" | "system"; at: Date; metadata?: Record<string, string | number | boolean | string[] | null> };
export type TransactionalEmailStatus = "pending" | "sending" | "sent" | "failed" | "suppressed";
export type TransactionalEmailNotification = { status: TransactionalEmailStatus; eventKey: string; lastAttemptAt?: Date; sentAt?: Date; resendId?: string; errorCode?: string };

export type PaymentDestinationSnapshot = {
  destinationId: string;
  internalLabel: string;
  payeeName: string;
  upiId: string;
  assignedAt: Date;
};

export type RegistrationV2 = {
  schemaVersion: 2;
  eventKey: string;
  publicId: string;
  environment: "production" | "development";
  isTest: boolean;
  participantAccessTokenHash: string;
  participant: { fullName: string; email: string; normalizedEmail: string; phone: string; normalizedPhone: string; college?: string; branch?: string; year?: string };
  /**
   * Admin-only E-cell member flag. Display-only: when true and the immutable
   * `payment.snapshot.expectedAmount` is 599, the admin panel shows 699.
   * Never written by participants; never mutates the payment snapshot.
   * Absent on older documents — treat as false.
   */
  ecellMember?: boolean;
  payment: {
    snapshot: PaymentSnapshot;
    /** Authoritative assigned payment destination for NEW registrations. */
    destination?: PaymentDestinationSnapshot;
    status: PaymentStatus;
    transactionReference?: string;
    currentProofId?: string;
    proofHistory: Array<{ fileId: string; submittedAt: Date; transactionReference: string; destination?: { destinationId: string; internalLabel: string; payeeName: string; upiId: string } }>;
    submittedAt?: Date;
    verifiedAt?: Date;
    rejectedAt?: Date;
    publicRejectionReason?: string;
    privateAdminNote?: string;
    verifiedBy?: string;
    rejectedBy?: string;
  };
  emailNotifications?: { paymentSubmitted?: TransactionalEmailNotification; paymentVerified?: TransactionalEmailNotification };
  idempotencyKeyHash: string;
  audit: AuditEvent[];
  createdAt: Date;
  updatedAt: Date;
};

export type PublicStatus = {
  publicId: string;
  participantName: string;
  participantEmailMasked?: string;
  eventName: string;
  expectedAmount: number | null;
  pricingTier: "early_bird" | "regular" | "development_preview";
  currency: "INR";
  paymentStatus: PaymentStatus;
  submittedAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  isTest: boolean;
  submissionEmailStatus?: "sent" | "failed" | "suppressed" | "not_sent";
  verificationEmailStatus?: "sent" | "failed" | "suppressed" | "not_sent";
  /** Assigned destination identity (never the globally active account). */
  paymentDestination?: { destinationId: string; internalLabel: string; payeeName: string; upiId: string } | null;
  /** True when this legacy Account A pending record needs admin reassignment. */
  requiresReassignment?: boolean;
  paymentInstructions?: { payeeName: string; upiId: string; upiUri?: string };
};

export function isCurrentRegistration(value: unknown): value is RegistrationV2 {
  return Boolean(value && typeof value === "object" && (value as { schemaVersion?: unknown }).schemaVersion === 2);
}
