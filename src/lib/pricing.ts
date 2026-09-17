import "server-only";

import { event } from "@/config/event";
import { getConfirmedPaymentSnapshot } from "@/lib/payment";

export const PRICING = {
  currency: "₹",
  confirmation: event.fee.confirmation,
  earlyBird: event.fee.pricing.earlyBirdAmount,
  regular: event.fee.pricing.regularAmount,
} as const;

export function currentPrice(at: Date = new Date()): number {
  const snapshot = getConfirmedPaymentSnapshot(at);
  if (!snapshot || snapshot.expectedAmount === null) throw new Error("Production pricing is not activated.");
  return snapshot.expectedAmount;
}

export function formatINR(n: number): string { return `${PRICING.currency}${n.toLocaleString("en-IN")}`; }
