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
  accountAPendingCount: number;
  capacityFull: boolean;
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
  if (destinationId === "account-e-sneha") return "Account E";
  if (destinationId === "account-a-yash") return "Account A (DISABLED)";
  return "Legacy";
}
