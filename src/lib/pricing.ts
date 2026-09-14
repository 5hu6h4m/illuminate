import { event } from "@/config/event";
import { calculateProductionPricing } from "@/lib/payment-pricing";

export const PRICING = {
  currency: "₹",
  confirmation: event.fee.confirmation,
  earlyBird: event.fee.pricing.earlyBirdAmount,
  regular: event.fee.pricing.regularAmount,
  earlyBirdDurationHours: event.fee.pricing.earlyBirdDurationHours,
} as const;

export function currentPrice(at: Date = new Date()): number {
  return calculateProductionPricing({
    registrationOpenAt: event.registration.registrationOpenAt,
    earlyBirdDurationHours: event.fee.pricing.earlyBirdDurationHours,
    earlyBirdAmount: event.fee.pricing.earlyBirdAmount,
    regularAmount: event.fee.pricing.regularAmount,
  }, at).amount;
}

export function formatINR(n: number): string { return `${PRICING.currency}${n.toLocaleString("en-IN")}`; }
