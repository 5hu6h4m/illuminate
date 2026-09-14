import "server-only";

/** Development-only visual preview; it never changes payment or API availability. */
export function isRegistrationPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.REGISTRATION_PREVIEW === "1" && process.env.PAYMENT_UI_PREVIEW === "1";
}
