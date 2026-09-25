import { displayPricingTier } from "@/lib/payment-pricing";

export type Status = "payment_pending" | "submitted_for_verification" | "verified" | "rejected";

export type AssignedDestination = {
  destinationId: string;
  internalLabel: string;
  payeeName: string;
  upiId: string;
  assignedAt?: string;
};

export type Row = {
  publicId: string;
  isTest: boolean;
  ecellMember?: boolean;
  participant: { fullName: string; email: string; phone: string };
  payment: {
    snapshot: { expectedAmount: number | null; payeeName?: string; upiId?: string; pricingTier?: string };
    destination?: AssignedDestination | null;
    /** V3 draft marker: true while the QR has not been generated yet. */
    pendingQRGeneration?: boolean;
    status: Status;
    transactionReference?: string;
    currentProofId?: string;
    submittedAt?: string;
    verifiedAt?: string;
    proofHistory?: Array<{ fileId: string; submittedAt?: string; transactionReference?: string; destination?: AssignedDestination | null }>;
  };
  emailNotifications?: {
    paymentSubmitted?: { status: string };
    paymentVerified?: { status: string };
  };
};

export type DestinationCapacity = {
  destinationId: string;
  internalLabel: string;
  payeeName: string;
  upiId: string;
  sequence: number;
  capacity: number;
  assignedCount: number;
  remaining: number;
  /** Eligible for future Generate QR assignment (excludes A/disabled/unapproved/exhausted). */
  claimable: boolean;
  status: "active" | "available" | "exhausted" | "disabled";
  ownerApproved: boolean;
  allowNewAssignments: boolean;
  activatedAt?: string | null;
  exhaustedAt?: string | null;
  disabledAt?: string | null;
};

export type CapacityOverview = {
  destinations: DestinationCapacity[];
  totalCapacity: number;
  assigned: number;
  remaining: number;
  /** Claimable by future Generate QR: eligible destinations only (excludes A/disabled/unapproved/exhausted). */
  claimableRemaining: number;
  accountAPendingCount: number;
  capacityFull: boolean;
  eventCapacity: {
    initialized: boolean;
    seatLimit: number;
    committedCount: number | null;
    remaining: number | null;
    reportingClaimedCount: number;
    verifiedCount: number;
    awaitingVerificationCount: number;
    qrIssuedPendingCount: number;
    draftWithoutQrCount: number;
  };
};

export type Dashboard = {
  rows: Row[];
  total: number;
  page: number;
  limit: number;
  realTotal: number;
  testRecords: number;
  metrics: Array<{ _id: Status; count: number; revenue: number }>;
};

export const statusText: Record<Status, string> = {
  payment_pending: "Payment pending",
  submitted_for_verification: "Awaiting verification",
  verified: "Verified",
  rejected: "Rejected",
};

export function destinationShortLabel(destinationId: string | null | undefined): string {
  if (destinationId === "account-b-shivam") return "Account B";
  if (destinationId === "account-c-bhushan") return "Account C";
  if (destinationId === "account-d-shubham") return "Account D";
  if (destinationId === "account-f-priyanka") return "Account F";
  if (destinationId === "account-e-sneha") return "Account E";
  if (destinationId === "account-a-yash") return "Account A (DISABLED)";
  return "Legacy";
}

/** Display-only registration type. Raw snapshots stay early_bird/regular. */
export function registrationTypeLabel(pricingTier: string | null | undefined): string {
  if (pricingTier === "early_bird" || pricingTier === "regular" || pricingTier === "development_preview") {
    return displayPricingTier(pricingTier);
  }
  return "—";
}

/**
 * Display-only payment stage. Draft (pending without destination) and
 * QR-issued pending are distinct V3 states; no stored status is added.
 */
export function paymentStageLabel(row: Pick<Row, "payment">): string {
  const status = row.payment.status;
  if (status === "payment_pending") {
    return row.payment.destination?.destinationId ? "Payment pending — QR generated" : "Draft — QR not generated";
  }
  if (status === "submitted_for_verification") return "Awaiting verification";
  if (status === "verified") return "Verified";
  return "Rejected";
}

/** Eligible for future Generate QR assignment (mirrors the server claim filter). */
export function isClaimableDestination(destination: Pick<DestinationCapacity, "status" | "ownerApproved" | "allowNewAssignments">): boolean {
  return (
    destination.ownerApproved === true &&
    destination.allowNewAssignments === true &&
    (destination.status === "active" || destination.status === "available")
  );
}

/** Admin payment-account cell: never "Legacy" for V3 drafts. */
export function paymentAccountLabel(row: Pick<Row, "payment">): string {
  const destinationId = row.payment.destination?.destinationId;
  if (destinationId) return destinationShortLabel(destinationId);
  if (row.payment.status === "payment_pending") return "Not assigned";
  return "Legacy";
}
