export type ProductionPricingConfig = {
  registrationOpenAt: string;
  earlyBirdDurationHours: number;
  earlyBirdAmount: number;
  regularAmount: number;
};

export type PricingTier = "early_bird" | "regular";

export type CalculatedPricing = {
  tier: PricingTier;
  amount: number;
  calculatedAt: string;
  registrationOpenAt: string;
  earlyBirdEndsAt: string;
};

export function calculateProductionPricing(config: ProductionPricingConfig, at: Date = new Date()): CalculatedPricing {
  const openedAt = new Date(config.registrationOpenAt);
  if (!Number.isFinite(openedAt.getTime()) || !Number.isInteger(config.earlyBirdDurationHours) || config.earlyBirdDurationHours <= 0 || config.earlyBirdAmount <= 0 || config.regularAmount <= 0) {
    throw new Error("Production pricing configuration is invalid.");
  }
  const earlyBirdEndsAt = new Date(openedAt.getTime() + config.earlyBirdDurationHours * 60 * 60 * 1000);
  const tier: PricingTier = at.getTime() < earlyBirdEndsAt.getTime() ? "early_bird" : "regular";
  return {
    tier,
    amount: tier === "early_bird" ? config.earlyBirdAmount : config.regularAmount,
    calculatedAt: at.toISOString(),
    registrationOpenAt: openedAt.toISOString(),
    earlyBirdEndsAt: earlyBirdEndsAt.toISOString(),
  };
}

export function sumVerifiedSnapshotRevenue(registrations: ReadonlyArray<{ isTest: boolean; payment: { status: string; snapshot: { expectedAmount: number | null } } }>): number {
  return registrations.reduce((total, registration) => (
    !registration.isTest && registration.payment.status === "verified"
      ? total + (registration.payment.snapshot.expectedAmount ?? 0)
      : total
  ), 0);
}
