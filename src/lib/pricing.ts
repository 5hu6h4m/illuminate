export const PRICING = {
  mrp: 999,
  earlyBird: 699,
  currency: "₹",
  // IST deadline
  earlyBirdEndsAtIST: "20 September 2026, 11:59 PM IST",
  earlyBirdDeadline: new Date("2026-09-20T23:59:59+05:30"),
} as const;

export function isEarlyBirdActive(now = new Date()): boolean {
  return now.getTime() <= PRICING.earlyBirdDeadline.getTime();
}

export function currentPrice(now = new Date()): number {
  return isEarlyBirdActive(now) ? PRICING.earlyBird : PRICING.mrp;
}

export function savings(): number {
  return PRICING.mrp - PRICING.earlyBird;
}

export function formatINR(n: number): string {
  return `${PRICING.currency}${n.toLocaleString("en-IN")}`;
}
