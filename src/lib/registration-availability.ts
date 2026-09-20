import "server-only";

import { getConfirmedPaymentSnapshot, type PaymentSnapshot } from "@/lib/payment";
import { isRegistrationManuallyClosed } from "@/lib/site-settings";

export type EffectiveRegistrationAvailability = {
  available: boolean;
  manuallyClosed: boolean;
  snapshot: PaymentSnapshot | null;
};

/**
 * Effective registration gate. Admin manual close wins over everything:
 * when true the landing page shows "Registration Closed" and creation APIs
 * reject with REGISTRATION_CLOSED, even inside the scheduled window.
 * When false, the existing date + payment-config logic governs.
 */
export async function getEffectiveRegistrationAvailability(at: Date = new Date()): Promise<EffectiveRegistrationAvailability> {
  if (await isRegistrationManuallyClosed()) {
    return { available: false, manuallyClosed: true, snapshot: null };
  }
  const snapshot = getConfirmedPaymentSnapshot(at);
  return { available: Boolean(snapshot), manuallyClosed: false, snapshot };
}
