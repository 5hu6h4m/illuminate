import "server-only";

import { z } from "zod";
import { RegistrationDetailsSchema } from "@/lib/registration-details";
import type { PaymentSnapshot, PaymentStatus } from "@/lib/payment";

export const PendingRegistrationRequestSchema = z.object({
  details: RegistrationDetailsSchema,
}).strict();

export const TransactionReferenceSchema = z.string().trim().min(8, "Enter a valid UPI reference.").max(80, "Reference is too long.").regex(/^[A-Za-z0-9\s-]+$/, "Use letters, numbers, spaces, or hyphens only.");
export const AdminVerifySchema = z.object({ publicId: z.string().regex(/^ILL26-[A-Z0-9]{6}$/), confirmedInRecipientAccount: z.literal(true) }).strict();
export const AdminRejectSchema = z.object({ publicId: z.string().regex(/^ILL26-[A-Z0-9]{6}$/), publicReason: z.string().trim().min(3).max(300), privateNote: z.string().trim().max(1000).optional() }).strict();
export const AdminDeleteSchema = z.object({ confirmPublicId: z.string().regex(/^ILL26-[A-Z0-9]{6}$/), reason: z.string().trim().min(10).max(500), password: z.string().min(1).max(1024) }).strict();

const illuminateIdField = z.string().trim().toUpperCase().regex(/^ILL26-[A-Z0-9]{6}$/, "Enter your Illuminate ID (e.g. ILL26-ABCDEF).");
const recoveryEmailField = z.string().trim().toLowerCase().pipe(z.email("Enter the email you registered with.")).optional();
const recoveryPhoneField = z.string().trim().transform((value) => value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "")).pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter the mobile number you registered with.")).optional();

/**
 * Participant login: Illuminate ID (publicId) plus the contact detail used
 * at registration. Both must match the same record before the private
 * status link is re-issued, so one field alone never discloses another
 * participant's link.
 */
export const ParticipantRecoveryRequestSchema = z.object({
  publicId: illuminateIdField,
  email: recoveryEmailField,
  phone: recoveryPhoneField,
}).strict().refine((value) => Boolean(value.email || value.phone), { message: "Enter your registered email or mobile number.", path: ["email"] });

export type ParticipantRecoveryRequest = z.infer<typeof ParticipantRecoveryRequestSchema>;

export type AuditEventType = "registration_created" | "payment_proof_submitted" | "payment_proof_resubmitted" | "payment_verified" | "payment_rejected";
export type AuditEvent = { type: AuditEventType; actor: "participant" | "admin" | "system"; at: Date; metadata?: Record<string, string | number | boolean> };

/**
 * Events recorded in the separate `admin_audit` collection (never pushed
 * into `RegistrationV2["audit"]` — that record is hard-deleted with the
 * registration, while the `admin_audit` snapshot survives it).
 */
export type AdminAuditEventType = "admin_login_success" | "admin_login_failed" | "admin_registration_deleted" | "admin_registration_deleted_verified";
export type AdminAuditEvent = { type: AdminAuditEventType; actor: "admin"; at: Date; metadata?: Record<string, string | number | boolean | string[] | null> };
export type TransactionalEmailStatus = "pending" | "sending" | "sent" | "failed" | "suppressed";
export type TransactionalEmailNotification = { status: TransactionalEmailStatus; eventKey: string; lastAttemptAt?: Date; sentAt?: Date; resendId?: string; errorCode?: string };

export type RegistrationV2 = {
  schemaVersion: 2;
  eventKey: string;
  publicId: string;
  environment: "production" | "development";
  isTest: boolean;
  participantAccessTokenHash: string;
  participant: { fullName: string; email: string; normalizedEmail: string; phone: string; normalizedPhone: string; college?: string; branch?: string; year?: string };
  payment: {
    snapshot: PaymentSnapshot;
    status: PaymentStatus;
    transactionReference?: string;
    currentProofId?: string;
    proofHistory: Array<{ fileId: string; submittedAt: Date; transactionReference: string }>;
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
  paymentInstructions?: { payeeName: string; upiId: string; upiUri?: string };
};

export function isCurrentRegistration(value: unknown): value is RegistrationV2 {
  return Boolean(value && typeof value === "object" && (value as { schemaVersion?: unknown }).schemaVersion === 2);
}
