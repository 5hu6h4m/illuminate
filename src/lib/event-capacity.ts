import "server-only";

import type { Collection } from "mongodb";

import { EVENT_VERIFIED_SEAT_LIMIT } from "@/lib/payment-destinations";

/**
 * V3 atomic event-seat commitment counter.
 *
 * The reporting definition of claimed seats (verified +
 * submitted_for_verification) is not concurrency-safe enough for QR
 * issuance: a QR-issued participant may still be payment_pending but has
 * been given a payment account and may already have transferred money.
 * First-time QR issuance therefore claims one unit from this counter AND
 * one payment-destination slot inside a single transaction (see
 * generateFirstPaymentQR in payment-flow-service.ts).
 *
 * Fail-closed: if the document is absent or inconsistent (seatLimit missing,
 * invalid, or not equal to EVENT_VERIFIED_SEAT_LIMIT), QR issuance must
 * refuse with EVENT_CAPACITY_NOT_INITIALIZED instead of guessing.
 * Production initialization/reconciliation happens in a controlled migration
 * (counter = ground truth from live registrations); never auto-created here.
 */

export const EVENT_CAPACITY_COLLECTION = "event_capacity" as const;
/** Matches the registration snapshot eventKey (`illuminate-<edition>`). */
export const EVENT_CAPACITY_ID = "illuminate-2026" as const;

export const EVENT_CAPACITY_NOT_INITIALIZED_CODE = "EVENT_CAPACITY_NOT_INITIALIZED";
export const EVENT_CAPACITY_NOT_INITIALIZED_MESSAGE =
  "Event capacity is not initialized. QR generation is temporarily unavailable. Please retry in a minute; if it persists contact the organizer (code EVENT-CAP).";

export type EventCapacityDoc = {
  _id: string;
  seatLimit: number;
  committedCount: number;
  updatedAt: Date;
};

/** A registration holds a seat commitment when it is verified, submitted, or QR-issued. Counts once at most. */
export function hasSeatCommitment(payment: {
  status: string;
  destination?: { destinationId?: string } | null;
}): boolean {
  if (payment.status === "verified" || payment.status === "submitted_for_verification") return true;
  const destinationId = payment.destination?.destinationId;
  return typeof destinationId === "string" && destinationId.length > 0;
}

/**
 * READ-ONLY ground-truth counter for reconciliation: verified OR submitted
 * OR destination-backed real registrations, each counted at most once.
 * Draft pendings without a destination contribute zero.
 */
export function computeCommittedGroundTruth(
  registrations: ReadonlyArray<{ payment: { status: string; destination?: { destinationId?: string } | null } }>,
): number {
  let committed = 0;
  for (const registration of registrations) {
    if (hasSeatCommitment(registration.payment)) committed += 1;
  }
  return committed;
}

export function isUsableEventCapacityDoc(doc: EventCapacityDoc | null): doc is EventCapacityDoc {
  return (
    doc !== null &&
    doc._id === EVENT_CAPACITY_ID &&
    Number.isInteger(doc.seatLimit) &&
    doc.seatLimit === EVENT_VERIFIED_SEAT_LIMIT &&
    Number.isInteger(doc.committedCount) &&
    doc.committedCount >= 0 &&
    doc.committedCount <= doc.seatLimit
  );
}

export type EventSeatClaimSuccess = {
  ok: true;
  doc: EventCapacityDoc;
  /** Committed count AFTER this claim (1-based seat number). */
  seatNumber: number;
};

export type EventSeatClaimFull = {
  ok: false;
  reason: "full";
};

export type EventSeatClaimUninitialized = {
  ok: false;
  reason: "not_initialized";
};

export type EventSeatClaimResult = EventSeatClaimSuccess | EventSeatClaimFull | EventSeatClaimUninitialized;

/**
 * Atomically claim one event seat. NEVER read-then-increment: the increment
 * is a single conditional findOneAndUpdate (committedCount < seatLimit) so
 * concurrent callers cannot oversell the 120-seat target. Callers must run
 * this inside the QR-issuance transaction; a transaction abort rolls the
 * claim back, so no compensating release is needed on the failure path.
 */
export async function claimEventSeat(
  collection: Collection<EventCapacityDoc>,
  options: { session?: unknown; now?: Date } = {},
): Promise<EventSeatClaimResult> {
  const now = options.now ?? new Date();
  const sessionOpt = options.session ? { session: options.session as never } : {};
  const current = await collection.findOne({ _id: EVENT_CAPACITY_ID });
  if (!isUsableEventCapacityDoc(current)) return { ok: false, reason: "not_initialized" };
  const updated = await collection.findOneAndUpdate(
    { _id: EVENT_CAPACITY_ID, committedCount: { $lt: current.seatLimit } },
    { $inc: { committedCount: 1 }, $set: { updatedAt: now } },
    { returnDocument: "after", ...sessionOpt },
  );
  if (!updated) return { ok: false, reason: "full" };
  return { ok: true, doc: updated, seatNumber: updated.committedCount };
}

/**
 * Release exactly one event seat. Used ONLY by explicit admin hard-delete of
 * a registration that held a commitment (see hasSeatCommitment). The
 * conditional decrement never drives the counter below zero. There is no
 * timer/auto-expiry path — a QR-issued slot is never released by elapsed time.
 */
export async function releaseEventSeat(
  collection: Collection<EventCapacityDoc>,
  options: { session?: unknown; now?: Date } = {},
): Promise<{ released: boolean }> {
  const now = options.now ?? new Date();
  const sessionOpt = options.session ? { session: options.session as never } : {};
  const updated = await collection.findOneAndUpdate(
    { _id: EVENT_CAPACITY_ID, committedCount: { $gt: 0 } },
    { $inc: { committedCount: -1 }, $set: { updatedAt: now } },
    { returnDocument: "after", ...sessionOpt },
  );
  return { released: updated !== null };
}
