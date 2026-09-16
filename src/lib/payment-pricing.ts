export type ManualPricingConfig = {
  tier: PricingTier;
  earlyBirdAmount: number;
  regularAmount: number;
};

export type PricingTier = "early_bird" | "regular";

export type ResolvedPricing = {
  tier: PricingTier;
  amount: number;
};

export function resolveManualPricing(config: ManualPricingConfig): ResolvedPricing {
  if ((config.tier !== "early_bird" && config.tier !== "regular") || config.earlyBirdAmount <= 0 || config.regularAmount <= 0) {
    throw new Error("Manual pricing configuration is invalid.");
  }
  return {
    tier: config.tier,
    amount: config.tier === "early_bird" ? config.earlyBirdAmount : config.regularAmount,
  };
}

export function sumVerifiedSnapshotRevenue(registrations: ReadonlyArray<{ isTest: boolean; payment: { status: string; snapshot: { expectedAmount: number | null } } }>): number {
  return registrations.reduce((total, registration) => (
    !registration.isTest && registration.payment.status === "verified"
      ? total + (registration.payment.snapshot.expectedAmount ?? 0)
      : total
  ), 0);
}
