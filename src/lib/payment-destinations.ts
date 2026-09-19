import "server-only";

import type { Collection, Document, Filter, FindOneAndUpdateOptions } from "mongodb";

/**
 * STRICT 10-slot multi-UPI payment capacity system.
 *
 * Four approved destinations (B → C → D → E), 10 slots each, 40 total.
 * Account A is permanently disabled / legacy-only and must never be
 * assigned to a new registration.
 *
 * Slot consumption rule: a slot is consumed at ASSIGNMENT time (when a new
 * real production registration is created), not at admin verification time.
 * Slots are non-reusable by default — abandoned / never-paid slots stay
 * consumed. Only a failed DB write before commit may release its slot
 * (see releaseDestinationSlot), never a rejected / verified transition.
 */

export type DestinationStatus = "active" | "available" | "exhausted" | "disabled";

export type PaymentDestination = {
  destinationId: string;
  internalLabel: string;
  payeeName: string;
  upiId: string;
  sequence: number;
  capacity: number;
  assignedCount: number;
  status: DestinationStatus;
  ownerApproved: boolean;
  allowNewAssignments: boolean;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
  exhaustedAt?: Date;
  disabledAt?: Date;
};

export type PaymentDestinationSnapshot = {
  destinationId: string;
  internalLabel: string;
  payeeName: string;
  upiId: string;
  assignedAt: Date;
};

export const ACCOUNT_A_DESTINATION_ID = "account-a-yash";
export const APPROVED_DESTINATION_IDS_IN_SEQUENCE = [
  "account-b-shivam",
  "account-c-bhushan",
  "account-d-shubham",
  "account-e-sneha",
] as const;

export type ApprovedDestinationId = (typeof APPROVED_DESTINATION_IDS_IN_SEQUENCE)[number];

export const TOTAL_PAYMENT_CAPACITY = 40;
export const DESTINATION_SLOT_CAPACITY = 10;

export const PAYMENT_CAPACITY_FULL_CODE = "PAYMENT_CAPACITY_FULL";
export const PAYMENT_CAPACITY_FULL_MESSAGE = "Illuminate registration capacity is currently full.";

/** Canonical seed definitions. Counts are set by the seed script, never here. */
export const PAYMENT_DESTINATION_SEEDS: ReadonlyArray<{
  destinationId: string;
  internalLabel: string;
  payeeName: string;
  upiId: string;
  sequence: number;
  capacity: number;
  status: DestinationStatus;
  ownerApproved: boolean;
  allowNewAssignments: boolean;
}> = [
  {
    destinationId: "account-a-yash",
    internalLabel: "Yash Account / Account A / E-Cell Payment 1",
    payeeName: "Yash Patil (ECELL Team)",
    upiId: "yashpatil76317@okicici",
    sequence: 0,
    capacity: 0,
    status: "disabled",
    ownerApproved: false,
    allowNewAssignments: false,
  },
  {
    destinationId: "account-b-shivam",
    internalLabel: "Shivam Account / Account B / E-Cell Payment 2",
    payeeName: "Shivam Jadhav (ECELL Team)",
    upiId: "shivujadhav2006@okicici",
    sequence: 1,
    capacity: 10,
    status: "active",
    ownerApproved: true,
    allowNewAssignments: true,
  },
  {
    destinationId: "account-c-bhushan",
    internalLabel: "Bhushan Bhusare / Account C / E-Cell Payment 3",
    payeeName: "Bhushan Bhusare (ECELL Team)",
    upiId: "bbhusare73@oksbi",
    sequence: 2,
    capacity: 10,
    status: "available",
    ownerApproved: true,
    allowNewAssignments: true,
  },
  {
    destinationId: "account-d-shubham",
    internalLabel: "Shubham Account / Account D / E-Cell Payment 4",
    payeeName: "Shubham Jadhav (ECELL Team)",
    upiId: "9834717038@ybl",
    sequence: 3,
    capacity: 10,
    status: "available",
    ownerApproved: true,
    allowNewAssignments: true,
  },
  {
    destinationId: "account-e-sneha",
    internalLabel: "Sneha Dagwar / Account E / E-Cell Payment 5",
    payeeName: "Sneha Dagwar (ECELL Team)",
    upiId: "snehadagwar06@okicici",
    sequence: 4,
    capacity: 10,
    status: "available",
    ownerApproved: true,
    allowNewAssignments: true,
  },
];

/** Legacy snapshot UPI → destination mapping for audit/seed reconciliation. */
export const LEGACY_UPI_TO_DESTINATION_ID: Record<string, string> = {
  "yashpatil76317@okicici": "account-a-yash",
  "shivujadhav2006@okicici": "account-b-shivam",
  "bbhusare73@oksbi": "account-c-bhushan",
  "9834717038@ybl": "account-d-shubham",
  "snehadagwar06@okicici": "account-e-sneha",
};

export function destinationIdForLegacyUpi(upiId: string | null | undefined): string | null {
  if (!upiId) return null;
  return LEGACY_UPI_TO_DESTINATION_ID[upiId.trim()] ?? null;
}

export function isAccountADestination(destinationId: string | null | undefined): boolean {
  return destinationId === ACCOUNT_A_DESTINATION_ID;
}

/** Pure assignability predicate — mirrors the server-side claim filter. */
export function isAssignableDestination(doc: Pick<PaymentDestination, "status" | "ownerApproved" | "allowNewAssignments" | "assignedCount" | "capacity" | "destinationId">): boolean {
  if (doc.destinationId === ACCOUNT_A_DESTINATION_ID) return false;
  return (
    doc.ownerApproved === true &&
    doc.allowNewAssignments === true &&
    doc.status === "active" &&
    Number.isInteger(doc.assignedCount) &&
    Number.isInteger(doc.capacity) &&
    doc.assignedCount < doc.capacity
  );
}

export function buildDestinationSnapshot(doc: Pick<PaymentDestination, "destinationId" | "internalLabel" | "payeeName" | "upiId">, assignedAt: Date = new Date()): PaymentDestinationSnapshot {
  return {
    destinationId: doc.destinationId,
    internalLabel: doc.internalLabel,
    payeeName: doc.payeeName,
    upiId: doc.upiId,
    assignedAt,
  };
}

/** UPI URI builder bound to an assigned destination (price stays immutable). */
export function buildUpiUriFromDestination(
  destination: Pick<PaymentDestinationSnapshot, "payeeName" | "upiId">,
  expectedAmount: number | null,
  publicId: string,
): string {
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

// ---------------------------------------------------------------------------
// MongoDB atomic slot reservation
// ---------------------------------------------------------------------------

export type DestinationClaimSuccess = {
  ok: true;
  destination: PaymentDestination;
  snapshot: PaymentDestinationSnapshot;
  /** Assigned count AFTER this claim (1-based slot number). */
  slotNumber: number;
  exhausted: PaymentDestination | null;
  activated: PaymentDestination | null;
  capacityFull: false;
};

export type DestinationClaimFull = {
  ok: false;
  capacityFull: true;
  destination: null;
  snapshot: null;
};

export type DestinationClaimResult = DestinationClaimSuccess | DestinationClaimFull;

type DestinationCollectionLike = {
  find(filter: Filter<Document>): { sort(sort: Record<string, 1 | -1>): { toArray(): Promise<PaymentDestination[]> } };
  findOne(filter: Filter<Document>, options?: Record<string, unknown>): Promise<PaymentDestination | null>;
  findOneAndUpdate(filter: Filter<Document>, update: Document, options?: FindOneAndUpdateOptions & { session?: unknown }): Promise<PaymentDestination | null>;
  updateOne(filter: Filter<Document>, update: Document, options?: { session?: unknown }): Promise<{ modifiedCount: number }>;
};

function pickLowestSequenceWithCapacity(docs: PaymentDestination[]): PaymentDestination | null {
  const sorted = [...docs].sort((a, b) => a.sequence - b.sequence);
  for (const doc of sorted) {
    if (doc.destinationId === ACCOUNT_A_DESTINATION_ID) continue;
    if (!doc.ownerApproved || !doc.allowNewAssignments) continue;
    if (doc.status !== "active") continue;
    if (doc.assignedCount < doc.capacity) return doc;
  }
  return null;
}

/**
 * Atomically claim one payment slot.
 *
 * Correctness: NEVER read-then-increment. The increment is a single
 * conditional findOneAndUpdate ({ _id, status: active, assignedCount < capacity }
 * + $inc) so two concurrent callers cannot both win the last slot.
 * Callers must pass the real Mongo collection; tests pass a fake with the
 * same atomic semantics.
 */
export async function claimNextDestinationSlot(
  collection: Collection<PaymentDestination> | DestinationCollectionLike,
  options: { session?: unknown; now?: Date } = {},
): Promise<DestinationClaimResult> {
  const now = options.now ?? new Date();
  const sessionOpt = options.session ? { session: options.session as never } : {};
  const col = collection as DestinationCollectionLike;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const actives = await col
      .find({ status: "active", ownerApproved: true, allowNewAssignments: true })
      .sort({ sequence: 1 })
      .toArray();
    const candidate = pickLowestSequenceWithCapacity(actives);
    if (candidate) {
      const claimed = await col.findOneAndUpdate(
        // deno-lint-ignore no-explicit-any
        { _id: (candidate as unknown as { _id: unknown })._id, status: "active", assignedCount: { $lt: candidate.capacity } } as Filter<Document>,
        { $inc: { assignedCount: 1 }, $set: { updatedAt: now } },
        { returnDocument: "after", ...sessionOpt },
      );
      if (claimed) {
        const slotNumber = claimed.assignedCount;
        const snapshot = buildDestinationSnapshot(claimed, now);
        let exhausted: PaymentDestination | null = null;
        let activated: PaymentDestination | null = null;
        if (slotNumber >= claimed.capacity) {
          const ex = await col.findOneAndUpdate(
            { _id: (claimed as unknown as { _id: unknown })._id, status: "active" } as Filter<Document>,
            { $set: { status: "exhausted", allowNewAssignments: false, exhaustedAt: now, updatedAt: now } },
            { returnDocument: "after", ...sessionOpt },
          );
          exhausted = ex;
          activated = await activateNextAvailableDestination(col, claimed.sequence, now, options.session);
        }
        return { ok: true, destination: claimed, snapshot, slotNumber, exhausted, activated, capacityFull: false };
      }
      continue; // lost race — re-resolve
    }

    // No claimable active destination. Heal: exhaust stale full actives,
    // then activate the next approved available destination.
    const staleFull = actives.filter((d) => d.destinationId !== ACCOUNT_A_DESTINATION_ID && d.assignedCount >= d.capacity && d.status === "active");
    for (const stale of staleFull) {
      await col.findOneAndUpdate(
        { _id: (stale as unknown as { _id: unknown })._id, status: "active" } as Filter<Document>,
        { $set: { status: "exhausted", allowNewAssignments: false, exhaustedAt: now, updatedAt: now } },
        { returnDocument: "after", ...sessionOpt },
      );
    }
    if (staleFull.length > 0) continue; // re-resolve after healing

    const healed = await activateNextAvailableDestination(col, -1, now, options.session);
    if (healed) continue; // newly activated — retry claim
    // Activation race lost (another caller activated concurrently) or no
    // available destination left. Re-check for a freshly activated claimant
    // before declaring FULL so concurrent bursts never see a false FULL.
    const recheck = await col
      .find({ status: "active", ownerApproved: true, allowNewAssignments: true })
      .sort({ sequence: 1 })
      .toArray();
    if (pickLowestSequenceWithCapacity(recheck)) continue;
    return { ok: false, capacityFull: true, destination: null, snapshot: null };
  }
  return { ok: false, capacityFull: true, destination: null, snapshot: null };
}

export async function activateNextAvailableDestination(
  collection: Collection<PaymentDestination> | DestinationCollectionLike,
  afterSequence: number,
  now: Date = new Date(),
  session?: unknown,
): Promise<PaymentDestination | null> {
  const col = collection as DestinationCollectionLike;
  const sessionOpt = session ? { session: session as never } : {};
  const availables = await col
    .find({ status: "available", ownerApproved: true, allowNewAssignments: true })
    .sort({ sequence: 1 })
    .toArray();
  const sorted = [...availables].sort((a, b) => a.sequence - b.sequence);
  for (const next of sorted) {
    if (next.destinationId === ACCOUNT_A_DESTINATION_ID) continue;
    if (next.sequence <= afterSequence) continue;
    if (next.assignedCount >= next.capacity) {
      await col.findOneAndUpdate(
        { _id: (next as unknown as { _id: unknown })._id, status: "available" } as Filter<Document>,
        { $set: { status: "exhausted", allowNewAssignments: false, exhaustedAt: now, updatedAt: now } },
        { returnDocument: "after", ...sessionOpt },
      );
      continue;
    }
    const activated = await col.findOneAndUpdate(
      { _id: (next as unknown as { _id: unknown })._id, status: "available" } as Filter<Document>,
      { $set: { status: "active", activatedAt: now, updatedAt: now } },
      { returnDocument: "after", ...sessionOpt },
    );
    if (activated) return activated;
  }
  return null;
}

/**
 * Release a slot reserved by a registration write that FAILED before commit
 * (duplicate-key race, idempotent replay race, DB error). This is the ONLY
 * permitted automatic decrement — abandoned / unpaid / rejected slots are
 * never recycled. If the destination was marked exhausted by this leaked
 * claim, flip it back to active so the slot is not lost.
 */
export async function releaseDestinationSlot(
  collection: Collection<PaymentDestination> | DestinationCollectionLike,
  destinationId: string,
  options: { session?: unknown; now?: Date } = {},
): Promise<void> {
  if (!destinationId || destinationId === ACCOUNT_A_DESTINATION_ID) return;
  const col = collection as DestinationCollectionLike;
  const sessionOpt = options.session ? { session: options.session as never } : {};
  const now = options.now ?? new Date();
  const updated = await col.findOneAndUpdate(
    { destinationId, assignedCount: { $gt: 0 } },
    { $inc: { assignedCount: -1 }, $set: { updatedAt: now } },
    { returnDocument: "after", ...sessionOpt },
  );
  if (updated && updated.status === "exhausted" && updated.assignedCount < updated.capacity) {
    await col.updateOne(
      { destinationId, status: "exhausted" },
      { $set: { status: "active", allowNewAssignments: true, updatedAt: now }, $unset: { exhaustedAt: "" } },
      sessionOpt,
    );
  }
}
