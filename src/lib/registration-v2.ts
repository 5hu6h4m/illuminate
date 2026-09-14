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

export type AuditEventType = "registration_created" | "payment_proof_submitted" | "payment_proof_resubmitted" | "payment_verified" | "payment_rejected" | "admin_login_success" | "admin_login_failed";
export type AuditEvent = { type: AuditEventType; actor: "participant" | "admin" | "system"; at: Date; metadata?: Record<string, string | number | boolean> };

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
  idempotencyKeyHash: string;
  audit: AuditEvent[];
  createdAt: Date;
  updatedAt: Date;
};

export type PublicStatus = {
  publicId: string;
  participantName: string;
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
  paymentInstructions?: { payeeName: string; upiId: string; upiUri?: string };
};

export function isCurrentRegistration(value: unknown): value is RegistrationV2 {
  return Boolean(value && typeof value === "object" && (value as { schemaVersion?: unknown }).schemaVersion === 2);
}
