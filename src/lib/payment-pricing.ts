export type RegistrationScheduleConfig = {
  openAt: string;
  earlyBirdEndAt: string;
  closeAt: string;
  earlyBirdAmount: number;
  regularAmount: number;
};

export type PricingTier = "early_bird" | "regular";

/**
 * Participant/admin display label for a stored pricing tier. Raw stored
 * values stay `early_bird` / `regular` (immutable snapshots); reopened
 * registrations (raw `regular`) read as "Late Registration". Pure function —
 * use this instead of duplicating tier strings across components.
 */
export type PricingTierDisplay = "Early Bird" | "Late Registration" | "Development preview";

export function displayPricingTier(tier: PricingTier | "development_preview"): PricingTierDisplay {
  if (tier === "early_bird") return "Early Bird";
  if (tier === "regular") return "Late Registration";
  return "Development preview";
}

export type ScheduledPricing = {
  registrationAvailable: boolean;
  tier: PricingTier | null;
  amount: number | null;
};

function parseScheduleInstant(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function resolveScheduledPricing(config: RegistrationScheduleConfig, at: Date): ScheduledPricing {
  const openAt = parseScheduleInstant(config.openAt);
  const earlyBirdEndAt = parseScheduleInstant(config.earlyBirdEndAt);
  const closeAt = parseScheduleInstant(config.closeAt);
  if (!openAt || !earlyBirdEndAt || !closeAt || !Number.isFinite(at.getTime()) || openAt >= earlyBirdEndAt || earlyBirdEndAt >= closeAt || !Number.isInteger(config.earlyBirdAmount) || !Number.isInteger(config.regularAmount) || config.earlyBirdAmount <= 0 || config.regularAmount <= 0) {
    throw new Error("Fixed registration schedule is invalid.");
  }
  if (at < openAt || at >= closeAt) {
    return { registrationAvailable: false, tier: null, amount: null };
  }
  const tier: PricingTier = at < earlyBirdEndAt ? "early_bird" : "regular";
  return {
    registrationAvailable: true,
    tier,
    amount: tier === "early_bird" ? config.earlyBirdAmount : config.regularAmount,
  };
}

export function sumVerifiedSnapshotRevenue(registrations: ReadonlyArray<{ isTest: boolean; payment: { status: string; snapshot: { expectedAmount: number | null } } }>): number {
  return registrations.reduce((total, registration) => (
    !registration.isTest && registration.payment.status === "verified"
      ? total + (registration.payment.snapshot.expectedAmount ?? 0)
      : total
  ), 0);
}
