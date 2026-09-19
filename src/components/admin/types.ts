export type Status = "payment_pending" | "submitted_for_verification" | "verified" | "rejected";

export type Row = {
  publicId: string;
  isTest: boolean;
  ecellMember?: boolean;
  participant: { fullName: string; email: string; phone: string };
  payment: {
    snapshot: { expectedAmount: number | null };
    status: Status;
    transactionReference?: string;
    currentProofId?: string;
    submittedAt?: string;
    verifiedAt?: string;
  };
  emailNotifications?: {
    paymentSubmitted?: { status: string };
    paymentVerified?: { status: string };
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
