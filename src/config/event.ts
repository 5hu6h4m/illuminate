/**
 * The single public source of truth for event facts. A pending or unavailable
 * fact must not be promoted into public marketing copy.
 */
export type ConfirmationState = "confirmed" | "pending" | "unavailable";

export type EventFact<T> = {
  value: T;
  confirmation: ConfirmationState;
};

export const event = {
  identity: {
    name: "Illuminate",
    edition: "2026",
    shortDescription: "An entrepreneurship workshop experience by E-Cell MET.",
  },
  format: { value: "Offline workshop", confirmation: "confirmed" as const },
  organizer: { name: "E-Cell MET", confirmation: "confirmed" },
  association: {
    label: "Associated with the Illuminate initiative of E-Cell IIT Bombay",
    confirmation: "confirmed",
  },
  schedule: {
    date: { value: null, confirmation: "pending" },
    time: { value: null, confirmation: "pending" },
    venue: { value: null, confirmation: "pending" },
    duration: { value: null, confirmation: "pending" },
  },
  registration: {
    openAt: "2026-09-15T00:00:00+05:30",
    earlyBirdEndAt: "2026-09-24T00:00:00+05:30",
    closeAt: "2026-10-06T00:00:00+05:30",
    deadline: { value: "5 October 2026", confirmation: "confirmed" },
    capacity: { value: null, confirmation: "pending" },
    eligibility: { value: "Open to everyone", confirmation: "confirmed" },
  },
  fee: { currency: "INR", confirmation: "confirmed" as const, pricing: { earlyBirdAmount: 599, regularAmount: 699 } },
  benefits: {
    certificate: { value: null, confirmation: "pending" },
    participantKit: { value: null, confirmation: "pending" },
    campusVisit: { value: null, confirmation: "pending" },
    travel: { value: null, confirmation: "pending" },
    eSummit: { value: null, confirmation: "pending" },
  },
  payment: {
    // LEGACY ONLY — Account A (Yash Patil / yashpatil76317@okicici) is
    // permanently disabled and must NEVER be used for new payment
    // assignment. New registrations receive B → C → D → E destinations
    // exclusively from the `payment_destinations` collection.
    // These fields remain only for historical snapshot compatibility.
    recipient: { value: "Yash Patil", confirmation: "confirmed" },
    upiId: { value: "yashpatil76317@okicici", confirmation: "confirmed" },
    refundPolicy: { value: "Registration fees are non-refundable once payment has been verified.", confirmation: "confirmed" },
  },
  contacts: {
    organizer: { value: "E-Cell MET Team", confirmation: "confirmed" },
    support: { value: "met.iot.ecell@gmail.com", confirmation: "confirmed" },
    socialLinks: { value: [], confirmation: "pending" },
  },
  policies: {
    privacy: { value: "Privacy policy available", confirmation: "confirmed" },
    terms: { value: "Terms available", confirmation: "confirmed" },
  },
} as const;

export const isConfirmed = (fact: { confirmation: ConfirmationState }) => fact.confirmation === "confirmed";
export const isConfirmedText = (fact: { value: string | null; confirmation: ConfirmationState }) =>
  isConfirmed(fact) && Boolean(fact.value?.trim());
export const isPaymentRegistrationAvailable = () =>
  isConfirmed(event.fee) &&
  event.fee.pricing.earlyBirdAmount > 0 &&
  event.fee.pricing.regularAmount > 0 &&
  isConfirmedText(event.payment.upiId) &&
  isConfirmedText(event.payment.recipient);
