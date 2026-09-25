import "server-only";

import { ObjectId, type Collection, type WithId } from "mongodb";
import { TransactionReferenceSchema, type PaymentDestinationSnapshot, type PublicStatus, type RegistrationV2 } from "@/lib/registration-v2";
import { buildUpiUri, buildUpiUriForDestination, detectImageType, hashParticipantAccessToken, isDevE2EPreviewEnabled, isValidParticipantAccessToken, MAX_PAYMENT_PROOF_BYTES, normalizeTransactionReference, type PaymentSnapshot } from "@/lib/payment";
import { ACCOUNT_A_DESTINATION_ID, buildDestinationSnapshot, claimNextDestinationSlot, destinationIdForLegacyUpi, EVENT_REGISTRATION_FULL_CODE, EVENT_REGISTRATION_FULL_MESSAGE, PAYMENT_CAPACITY_FULL_CODE, PAYMENT_CAPACITY_FULL_MESSAGE, releaseDestinationSlot, type PaymentDestination } from "@/lib/payment-destinations";
import { claimEventSeat, EVENT_CAPACITY_NOT_INITIALIZED_CODE, EVENT_CAPACITY_NOT_INITIALIZED_MESSAGE, type EventCapacityDoc } from "@/lib/event-capacity";
import { ensurePaymentIndexes, getPaymentProofBucket, getRegistrationsCollection } from "@/lib/mongodb";
import { developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";
import { dispatchTransactionalEmail } from "@/lib/email/transactional-email";

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

export type ResolvedDestination =
  | { kind: "assigned"; destinationId: string; internalLabel: string; payeeName: string; upiId: string }
  | { kind: "draft" }
  | { kind: "legacy"; destinationId: string | null; payeeName: string; upiId: string }
  | { kind: "blocked_account_a_pending" }
  | { kind: "none" };

/**
 * Resolver priority:
 * 1. payment.destination (authoritative for QR-issued registrations)
 * 2. V3 draft: payment_pending without a destination, created as a draft
 *    (pendingQRGeneration marker) — eligible for explicit Generate QR.
 * 3. legacy payment.snapshot payeeName/upiId (pre-V3 rows keep their exact
 *    prior behavior: the marker distinguishes drafts from legacy rows, so
 *    legacy Account A payment_pending records stay blocked).
 * BUT legacy Account A payment_pending records never expose the blocked QR.
 */
export function resolveRegistrationDestination(registration: Pick<RegistrationV2, "payment">): ResolvedDestination {
  const assigned = registration.payment.destination;
  if (assigned?.destinationId && assigned.payeeName && assigned.upiId) {
    return { kind: "assigned", destinationId: assigned.destinationId, internalLabel: assigned.internalLabel, payeeName: assigned.payeeName, upiId: assigned.upiId };
  }
  if (registration.payment.status === "payment_pending" && registration.payment.pendingQRGeneration === true) {
    return { kind: "draft" };
  }
  const snapshot = registration.payment.snapshot;
  const payeeName = snapshot.payeeName?.trim();
  const upiId = snapshot.upiId?.trim();
  if (!payeeName || !upiId) return { kind: "none" };
  const legacyId = destinationIdForLegacyUpi(upiId);
  const isAccountA = legacyId === ACCOUNT_A_DESTINATION_ID || upiId === "yashpatil76317@okicici";
  if (isAccountA && registration.payment.status === "payment_pending") {
    return { kind: "blocked_account_a_pending" };
  }
  return { kind: "legacy", destinationId: legacyId, payeeName, upiId };
}

export function isAccountAPendingBlocked(registration: Pick<RegistrationV2, "payment">): boolean {
  return resolveRegistrationDestination(registration).kind === "blocked_account_a_pending";
}

export async function getPublicStatusForParticipantToken(token: string): Promise<PublicStatus | null> {
  const registration = await registrationForParticipantToken(token);
  if (!registration) return null;
  const snapshot = registration.payment.snapshot;
  const awaitingPayment = registration.payment.status === "payment_pending" || registration.payment.status === "rejected";
  const [emailLocal = "", emailDomain = ""] = registration.participant.email.split("@");
  const participantEmailMasked = emailDomain ? `${emailLocal.slice(0, 2)}${"•".repeat(Math.max(1, emailLocal.length - 2))}@${emailDomain}` : undefined;
  const resolved = resolveRegistrationDestination(registration);
  const blocked = resolved.kind === "blocked_account_a_pending";
  const hasPaymentDestination = registration.payment.destination?.destinationId ? true : resolved.kind === "assigned";
  const destination =
    resolved.kind === "assigned"
      ? { destinationId: resolved.destinationId, internalLabel: resolved.internalLabel, payeeName: resolved.payeeName, upiId: resolved.upiId }
      : resolved.kind === "legacy"
        ? { destinationId: resolved.destinationId ?? "legacy-unknown", internalLabel: "Legacy", payeeName: resolved.payeeName, upiId: resolved.upiId }
        : null;
  let paymentInstructions: PublicStatus["paymentInstructions"];
  if (awaitingPayment && !blocked && destination) {
    if (snapshot.mode === "production" && snapshot.expectedAmount !== null) {
      const upiUri = resolved.kind === "assigned"
        ? buildUpiUriForDestination(destination, snapshot.expectedAmount, registration.publicId)
        : buildUpiUri(snapshot, registration.publicId);
      paymentInstructions = { payeeName: destination.payeeName, upiId: destination.upiId, upiUri };
    } else if (resolved.kind === "assigned") {
      paymentInstructions = { payeeName: destination.payeeName, upiId: destination.upiId };
    } else {
      paymentInstructions = { payeeName: snapshot.payeeName, upiId: snapshot.upiId, ...(snapshot.mode === "production" ? { upiUri: buildUpiUri(snapshot, registration.publicId) } : {}) };
    }
  }
  return {
    publicId: registration.publicId,
    participantName: registration.participant.fullName,
    participantEmailMasked,
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
    submissionEmailStatus: registration.emailNotifications?.paymentSubmitted?.status === "sent" || registration.emailNotifications?.paymentSubmitted?.status === "failed" || registration.emailNotifications?.paymentSubmitted?.status === "suppressed" ? registration.emailNotifications.paymentSubmitted.status : "not_sent",
    verificationEmailStatus: registration.emailNotifications?.paymentVerified?.status === "sent" || registration.emailNotifications?.paymentVerified?.status === "failed" || registration.emailNotifications?.paymentVerified?.status === "suppressed" ? registration.emailNotifications.paymentVerified.status : "not_sent",
    paymentDestination: destination,
    requiresReassignment: blocked,
    hasPaymentDestination,
    qrClaimedAt: registration.payment.qrClaimedAt?.toISOString(),
    canGeneratePaymentQr: awaitingPayment && !blocked && !hasPaymentDestination,
    paymentInstructions,
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
  if (isAccountAPendingBlocked(registration)) {
    throw new PaymentFlowError("PAYMENT_REASSIGNMENT_REQUIRED", "This registration needs to be reassigned to an approved payment account before payment. Please contact the organizer.");
  }
  // No orphan proofs: a QR must have been explicitly generated (destination
  // attached) before any proof bytes reach GridFS. Verified/submitted
  // history is unaffected — this gate only runs for pending/rejected states.
  if (!registration.payment.destination?.destinationId) {
    throw new PaymentFlowError("PAYMENT_QR_REQUIRED", "Generate your payment QR before submitting payment proof.");
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
    const submissionVersion = registration.payment.proofHistory.length + 1;
    const emailEventKey = `illuminate-payment-submitted-${registration.publicId}-${submissionVersion}`;
    const resolved = resolveRegistrationDestination(registration);
    const proofDestination =
      resolved.kind === "assigned"
        ? { destinationId: resolved.destinationId, internalLabel: resolved.internalLabel, payeeName: resolved.payeeName, upiId: resolved.upiId }
        : resolved.kind === "legacy"
          ? { destinationId: resolved.destinationId ?? "legacy-unknown", internalLabel: "Legacy", payeeName: resolved.payeeName, upiId: resolved.upiId }
          : undefined;
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
          "emailNotifications.paymentSubmitted": { status: "pending", eventKey: emailEventKey },
          updatedAt: now,
        },
        $push: {
          // deno-lint-ignore no-explicit-any
          "payment.proofHistory": { fileId: uploaded.id.toString(), submittedAt: now, transactionReference: reference, ...(proofDestination ? { destination: proofDestination } : {}) } as unknown as Record<string, unknown>,
          audit: { type: wasResubmission ? "payment_proof_resubmitted" : "payment_proof_submitted", actor: "participant", at: now },
        },
      },
      { returnDocument: "after" },
    );
    if (!result) throw new PaymentFlowError("INVALID_STATE_TRANSITION", "This registration changed. Refresh the page and try again.");
    await dispatchTransactionalEmail("paymentSubmitted", result).catch(() => undefined);
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
  // Rejected payments NEVER free the destination slot and NEVER switch
  // destination. Resubmission stays against the same assigned destination.
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
    const result = await collection.findOneAndUpdate(
      { ...developmentTestRegistrationFilter, publicId: input.publicId, "payment.status": "submitted_for_verification" },
      {
        $set: { "payment.status": "verified", "payment.verifiedAt": now, "payment.verifiedBy": "development-preview", "emailNotifications.paymentVerified": { status: "pending", eventKey: `illuminate-registration-verified-${input.publicId}-1` }, updatedAt: now },
        $push: { audit: { type: "payment_verified", actor: "admin", at: now, metadata: { developmentSimulation: true } } },
      },
      { returnDocument: "after", projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0 } },
    );
    if (result) await dispatchTransactionalEmail("paymentVerified", result).catch(() => undefined);
    return result;
  }
  const result = await collection.findOneAndUpdate(
    { ...realRegistrationFilter, publicId: input.publicId, "payment.status": "submitted_for_verification" },
    {
      $set: { "payment.status": "verified", "payment.verifiedAt": now, "payment.verifiedBy": "admin", "emailNotifications.paymentVerified": { status: "pending", eventKey: `illuminate-registration-verified-${input.publicId}-1` }, updatedAt: now },
      $push: { audit: { type: "payment_verified", actor: "admin", at: now, metadata: { confirmedInRecipientAccount: true } } },
    },
    { returnDocument: "after", projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0 } },
  );
  if (result) await dispatchTransactionalEmail("paymentVerified", result).catch(() => undefined);
  return result;
}

/**
 * Admin-only E-cell member flag toggle. Display-only: never mutates
 * `payment.snapshot`. Only real (non-test) registrations may be flagged.
 * Idempotent — returns the current record unchanged when the flag already
 * matches. No emails are sent on this path.
 */
export async function setEcellMemberFlag(input: { publicId: string; ecellMember: boolean }): Promise<RegistrationV2 | null> {
  const collection = await getRegistrationsCollection();
  const existing = await collection.findOne(
    { ...realRegistrationFilter, publicId: input.publicId },
    { projection: { ecellMember: 1, payment: 1, isTest: 1, publicId: 1 } },
  );
  if (!existing) return null;
  const before = existing.ecellMember === true;
  if (before === input.ecellMember) {
    return (await collection.findOne(
      { ...realRegistrationFilter, publicId: input.publicId },
      { projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0 } },
    )) as RegistrationV2 | null;
  }
  const now = new Date();
  return collection.findOneAndUpdate(
    { ...realRegistrationFilter, publicId: input.publicId },
    {
      $set: { ecellMember: input.ecellMember, updatedAt: now },
      $push: { audit: { type: "ecell_flag_changed", actor: "admin", at: now, metadata: { before, after: input.ecellMember } } },
    },
    { returnDocument: "after", projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0 } },
  );
}

/** Internal sentinel: the conditional attach lost a same-token race. Never surfaces to callers. */
const QR_ATTACH_CONFLICT = "QR_ATTACH_CONFLICT";

export type GenerateQRStore = {
  registrations: Collection<RegistrationV2>;
  destinations: Collection<PaymentDestination>;
  eventCapacity: Collection<EventCapacityDoc>;
};

export type GenerateQRAvailability = {
  /** Admin manual close state at request time. */
  manuallyClosed: boolean;
  /** Current schedule snapshot (null when date-closed). */
  snapshot: PaymentSnapshot | null;
};

export type GenerateQRResult = {
  registration: RegistrationV2;
  destination: PaymentDestinationSnapshot;
  /** Seat number after claim; null for idempotent replays (number unknown, unchanged). */
  seatNumber: number | null;
  /** Slot number after claim; null for idempotent replays. */
  slotNumber: number | null;
  qrClaimedAt: Date | null;
  idempotent: boolean;
  exhaustedDestinationId: string | null;
  activatedDestinationId: string | null;
};

/**
 * Explicit first-time QR issuance: exactly one event-seat commitment AND one
 * payment-destination slot AND the registration attach. Strictly idempotent
 * per token: once payment.destination exists, every later call returns it
 * with zero increments (refresh, retry, two tabs, concurrent POSTs).
 *
 * Concurrency structure (burst-proven):
 * - STEP 1 — destination slot is claimed OUTSIDE the transaction with a
 *   real-time single conditional write. The activation chain (exhaust →
 *   activate next) relies on current reads; inside snapshot-isolated
 *   transactions those reads go stale under burst and spuriously report FULL.
 * - STEP 2 — seat claim + conditional attach run INSIDE one transaction
 *   (single conditional writes: committedCount < seatLimit, destination
 *   $exists false). A transaction abort rolls the seat claim back, so seats
 *   never leak; the outside slot is released by compensation on every abort
 *   path below (idempotent early-return, seat FULL, attach conflict).
 * Residual crash-window leaks (process death between the steps) are healed
 * by counter reconciliation (counter = live rows), never by timers.
 *
 * Fail-closed: transactions are REQUIRED for STEP 2. No read-then-write
 * fallback exists here — if the driver cannot run transactions, callers must
 * surface 503. Availability (manual/date close) gates FIRST issuance only;
 * already-issued QRs return idempotently regardless of close state.
 */
export async function generateFirstPaymentQR(input: {
  token: string;
  store: GenerateQRStore;
  runTransaction: <T>(fn: (session: unknown) => Promise<T>) => Promise<T>;
  availability: GenerateQRAvailability;
  now?: Date;
}): Promise<GenerateQRResult> {
  const now = input.now ?? new Date();
  if (!isValidParticipantAccessToken(input.token)) throw new PaymentFlowError("INVALID_STATUS_TOKEN", "Not found.");
  const registration = await input.store.registrations.findOne({
    schemaVersion: 2,
    participantAccessTokenHash: hashParticipantAccessToken(input.token),
  });
  if (!registration) throw new PaymentFlowError("INVALID_STATUS_TOKEN", "Not found.");
  if (registration.isTest ? !isDevE2EPreviewEnabled() : registration.payment.snapshot.mode !== "production") {
    throw new PaymentFlowError("PAYMENT_NOT_AVAILABLE", "Payment QR generation is not available yet.");
  }
  const existing = registration.payment.destination;
  if (existing?.destinationId) {
    return {
      registration,
      destination: { ...existing, assignedAt: existing.assignedAt ?? now },
      seatNumber: null,
      slotNumber: null,
      qrClaimedAt: registration.payment.qrClaimedAt ?? null,
      idempotent: true,
      exhaustedDestinationId: null,
      activatedDestinationId: null,
    };
  }
  if (registration.payment.status !== "payment_pending" && registration.payment.status !== "rejected") {
    throw new PaymentFlowError("INVALID_STATE_TRANSITION", "This registration cannot generate a payment QR.");
  }
  if (isAccountAPendingBlocked(registration)) {
    throw new PaymentFlowError("PAYMENT_REASSIGNMENT_REQUIRED", "This registration needs to be reassigned to an approved payment account before payment. Please contact the organizer.");
  }
  if (input.availability.manuallyClosed) {
    throw new PaymentFlowError("REGISTRATION_CLOSED", "Registrations are closed. If you already registered, log in with your email or mobile to open your status.");
  }
  if (!input.availability.snapshot) {
    throw new PaymentFlowError("PAYMENT_NOT_AVAILABLE", "Payment QR generation is not available yet.");
  }
  // STEP 1 — destination slot, OUTSIDE the transaction (burst-correct
  // real-time conditional write; see the function contract above).
  const slot = await claimNextDestinationSlot(input.store.destinations, { now });
  if (!slot.ok) {
    throw new PaymentFlowError(PAYMENT_CAPACITY_FULL_CODE, PAYMENT_CAPACITY_FULL_MESSAGE);
  }
  let slotCommitted = false;
  try {
    // STEP 2 — seat + attach, INSIDE one transaction.
    const committed = await input.runTransaction(async (session) => {
      const current = await input.store.registrations.findOne(
        { _id: registration._id, schemaVersion: 2 },
        { session: session as never },
      );
      if (!current) throw new PaymentFlowError("INVALID_STATUS_TOKEN", "Not found.");
      const currentDestination = current.payment.destination;
      if (currentDestination?.destinationId) {
        // Lost a same-token race: the winner's destination is authoritative.
        // Our STEP 1 slot is unused and released by the finally below.
        return {
          registration: current,
          destination: { ...currentDestination, assignedAt: currentDestination.assignedAt ?? now },
          seatNumber: null,
          slotNumber: null,
          qrClaimedAt: current.payment.qrClaimedAt ?? null,
          idempotent: true,
          exhaustedDestinationId: null,
          activatedDestinationId: null,
        };
      }
      if (current.payment.status !== "payment_pending" && current.payment.status !== "rejected") {
        throw new PaymentFlowError("INVALID_STATE_TRANSITION", "This registration cannot generate a payment QR.");
      }
      const seat = await claimEventSeat(input.store.eventCapacity, { session, now });
      if (!seat.ok) {
        // Transaction abort rolls nothing back yet (no writes committed);
        // our STEP 1 slot is released by the finally below.
        throw new PaymentFlowError(
          seat.reason === "not_initialized" ? EVENT_CAPACITY_NOT_INITIALIZED_CODE : EVENT_REGISTRATION_FULL_CODE,
          seat.reason === "not_initialized" ? EVENT_CAPACITY_NOT_INITIALIZED_MESSAGE : EVENT_REGISTRATION_FULL_MESSAGE,
        );
      }
      const snapshot = buildDestinationSnapshot(slot.destination, now);
      const attached = await input.store.registrations.findOneAndUpdate(
        {
          _id: current._id,
          schemaVersion: 2,
          "payment.status": current.payment.status,
          "payment.destination": { $exists: false },
        },
        {
          $set: { "payment.destination": snapshot, "payment.qrClaimedAt": now, updatedAt: now },
          $unset: { "payment.pendingQRGeneration": "" },
          $push: {
            audit: {
              $each: [
                { type: "payment_destination_assigned", actor: "participant", at: now, metadata: { destinationId: slot.destination.destinationId, sequence: slot.destination.sequence, capacity: slot.destination.capacity } },
                { type: "event_seat_committed", actor: "participant", at: now, metadata: { seatNumber: seat.seatNumber, seatLimit: seat.doc.seatLimit } },
              ],
            },
          },
        },
        { session: session as never, returnDocument: "after" },
      );
      if (!attached) throw new PaymentFlowError(QR_ATTACH_CONFLICT, "QR commitment race; retry.");
      return {
        registration: attached,
        destination: snapshot,
        seatNumber: seat.seatNumber,
        slotNumber: slot.slotNumber,
        qrClaimedAt: now,
        idempotent: false,
        exhaustedDestinationId: slot.exhausted?.destinationId ?? null,
        activatedDestinationId: slot.activated?.destinationId ?? null,
      };
    });
    slotCommitted = !committed.idempotent;
    return committed;
  } catch (error) {
    if (error instanceof PaymentFlowError && error.code === QR_ATTACH_CONFLICT) {
      // Transaction aborted: the seat claim rolled back and our STEP 1 slot
      // is released by the finally below. Re-read: the race winner's
      // destination is now authoritative.
      const reread = await input.store.registrations.findOne({ _id: registration._id, schemaVersion: 2 });
      const winner = reread?.payment.destination;
      if (winner?.destinationId) {
        return {
          registration: reread as RegistrationV2,
          destination: { ...winner, assignedAt: winner.assignedAt ?? now },
          seatNumber: null,
          slotNumber: null,
          qrClaimedAt: reread?.payment.qrClaimedAt ?? null,
          idempotent: true,
          exhaustedDestinationId: null,
          activatedDestinationId: null,
        };
      }
      throw new PaymentFlowError("INVALID_STATE_TRANSITION", "This registration changed. Refresh and try again.");
    }
    throw error;
  } finally {
    if (!slotCommitted) {
      // Compensate the unused STEP 1 claim (idempotent early-return, seat
      // FULL, attach conflict, or any other abort). Never throws: a missed
      // release is healed by counter reconciliation, never by timers.
      await releaseDestinationSlot(input.store.destinations, slot.destination.destinationId).catch(() => undefined);
    }
  }
}
