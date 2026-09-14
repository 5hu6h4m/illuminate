import "server-only";

import { ObjectId, type WithId } from "mongodb";
import { TransactionReferenceSchema, type PublicStatus, type RegistrationV2 } from "@/lib/registration-v2";
import { buildUpiUri, detectImageType, hashParticipantAccessToken, isDevE2EPreviewEnabled, isValidParticipantAccessToken, MAX_PAYMENT_PROOF_BYTES, normalizeTransactionReference } from "@/lib/payment";
import { ensurePaymentIndexes, getPaymentProofBucket, getRegistrationsCollection } from "@/lib/mongodb";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";

export class PaymentFlowError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function registrationForParticipantToken(token: string): Promise<WithId<RegistrationV2> | null> {
  if (!isValidParticipantAccessToken(token)) return null;
  return (await getRegistrationsCollection()).findOne({ schemaVersion: 2, participantAccessTokenHash: hashParticipantAccessToken(token) });
}

export async function getPublicStatusForParticipantToken(token: string): Promise<PublicStatus | null> {
  const registration = await registrationForParticipantToken(token);
  if (!registration) return null;
  const snapshot = registration.payment.snapshot;
  const awaitingPayment = registration.payment.status === "payment_pending" || registration.payment.status === "rejected";
  return {
    publicId: registration.publicId,
    participantName: registration.participant.fullName,
    eventName: "Illuminate 2026",
    isTest: registration.isTest,
    expectedAmount: snapshot.expectedAmount,
    pricingTier: snapshot.pricingTier,
    currency: snapshot.currency,
    paymentStatus: registration.payment.status,
    submittedAt: registration.payment.submittedAt?.toISOString(),
    verifiedAt: registration.payment.verifiedAt?.toISOString(),
    rejectedAt: registration.payment.rejectedAt?.toISOString(),
    rejectionReason: registration.payment.publicRejectionReason,
    paymentInstructions: awaitingPayment ? { payeeName: snapshot.payeeName, upiId: snapshot.upiId, ...(snapshot.mode === "production" ? { upiUri: buildUpiUri(snapshot, registration.publicId) } : {}) } : undefined,
  };
}

export async function submitPaymentProofForParticipant(input: {
  token: string;
  transactionReference: unknown;
  proof: { bytes: Uint8Array; contentType: string };
}): Promise<RegistrationV2> {
  const registration = await registrationForParticipantToken(input.token);
  if (!registration) throw new PaymentFlowError("INVALID_STATUS_TOKEN", "Not found.");
  if (registration.isTest ? !isDevE2EPreviewEnabled() : registration.payment.snapshot.mode !== "production") {
    throw new PaymentFlowError("PAYMENT_NOT_AVAILABLE", "Payment proof submission is not available yet.");
  }
  if (registration.payment.status !== "payment_pending" && registration.payment.status !== "rejected") {
    throw new PaymentFlowError("INVALID_STATE_TRANSITION", "This registration cannot accept another proof.");
  }
  const parsedReference = TransactionReferenceSchema.safeParse(input.transactionReference);
  if (!parsedReference.success) throw new PaymentFlowError("INVALID_TRANSACTION_REFERENCE", "Enter a valid UPI Transaction / Reference ID.");
  if (!input.proof.bytes.length || input.proof.bytes.length > MAX_PAYMENT_PROOF_BYTES) {
    throw new PaymentFlowError("PROOF_TOO_LARGE", "Payment proof must be 4 MB or smaller.");
  }
  const actualType = detectImageType(input.proof.bytes);
  if (!actualType || input.proof.contentType !== actualType) {
    throw new PaymentFlowError("INVALID_PROOF_FILE", "Upload a genuine PNG, JPEG, or WebP image.");
  }
  const reference = normalizeTransactionReference(parsedReference.data);
  await ensurePaymentIndexes();
  const bucket = await getPaymentProofBucket();
  const uploaded = bucket.openUploadStream(`${registration.publicId}-${Date.now()}`, {
    metadata: { publicId: registration.publicId, size: input.proof.bytes.length, contentType: actualType },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      uploaded.on("error", reject);
      uploaded.on("finish", () => resolve());
      uploaded.end(Buffer.from(input.proof.bytes));
    });
    const now = new Date();
    const wasResubmission = registration.payment.status === "rejected";
    const result = await (await getRegistrationsCollection()).findOneAndUpdate(
      { _id: registration._id, schemaVersion: 2, "payment.status": registration.payment.status },
      {
        $set: {
          "payment.status": "submitted_for_verification",
          "payment.transactionReference": reference,
          "payment.currentProofId": uploaded.id.toString(),
          "payment.submittedAt": now,
          "payment.publicRejectionReason": undefined,
          "payment.privateAdminNote": undefined,
          updatedAt: now,
        },
        $push: {
          "payment.proofHistory": { fileId: uploaded.id.toString(), submittedAt: now, transactionReference: reference },
          audit: { type: wasResubmission ? "payment_proof_resubmitted" : "payment_proof_submitted", actor: "participant", at: now },
        },
      },
      { returnDocument: "after" },
    );
    if (!result) throw new PaymentFlowError("INVALID_STATE_TRANSITION", "This registration changed. Refresh the page and try again.");
    return result;
  } catch (error: unknown) {
    await bucket.delete(uploaded.id as ObjectId).catch(() => undefined);
    if ((error as { code?: number }).code === 11000) {
      throw new PaymentFlowError("TRANSACTION_REFERENCE_ALREADY_USED", "That transaction/reference ID has already been submitted.");
    }
    throw error;
  }
}

export async function rejectPaymentForReview(input: { publicId: string; publicReason: string; privateNote?: string }): Promise<RegistrationV2 | null> {
  const collection = await getRegistrationsCollection();
  const now = new Date();
  const filter = isDevE2EPreviewEnabled()
    ? { schemaVersion: 2 as const, publicId: input.publicId, "payment.status": "submitted_for_verification" }
    : { ...realRegistrationFilter, publicId: input.publicId, "payment.status": "submitted_for_verification" };
  return collection.findOneAndUpdate(filter, {
    $set: {
      "payment.status": "rejected",
      "payment.rejectedAt": now,
      "payment.publicRejectionReason": input.publicReason,
      "payment.privateAdminNote": input.privateNote,
      "payment.rejectedBy": "admin",
      updatedAt: now,
    },
    $push: { audit: { type: "payment_rejected", actor: "admin", at: now } },
  }, { returnDocument: "after", projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0 } });
}

export async function verifyPaymentForReview(input: { publicId: string; simulatedDevelopmentPayment: boolean }): Promise<RegistrationV2 | null> {
  const collection = await getRegistrationsCollection();
  const now = new Date();
  if (input.simulatedDevelopmentPayment) {
    if (!isDevE2EPreviewEnabled()) throw new PaymentFlowError("NOT_FOUND", "Not found.");
    return collection.findOneAndUpdate(
      { ...developmentTestRegistrationFilter, publicId: input.publicId, "payment.status": "submitted_for_verification" },
      {
        $set: { "payment.status": "verified", "payment.verifiedAt": now, "payment.verifiedBy": "development-preview", updatedAt: now },
        $push: { audit: { type: "payment_verified", actor: "admin", at: now, metadata: { developmentSimulation: true } } },
      },
      { returnDocument: "after", projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0 } },
    );
  }
  return collection.findOneAndUpdate(
    { ...realRegistrationFilter, publicId: input.publicId, "payment.status": "submitted_for_verification" },
    {
      $set: { "payment.status": "verified", "payment.verifiedAt": now, "payment.verifiedBy": "admin", updatedAt: now },
      $push: { audit: { type: "payment_verified", actor: "admin", at: now, metadata: { confirmedInRecipientAccount: true } } },
    },
    { returnDocument: "after", projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0 } },
  );
}
