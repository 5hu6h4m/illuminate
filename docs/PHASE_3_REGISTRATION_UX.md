# Phase 3 Registration UX

## Three-step experience

1. **Your details** — name, email and phone by default.
2. **Review & confirm** — participant review, a single accuracy/registration-communication acknowledgement, and only confirmed event facts.
3. **Payment handoff** — a typed presentation boundary for Phase 4; no payment instructions, references, files, persistence, or verification are implemented here.

## Collection rules

`src/config/registration.ts` owns operational field collection. It defaults to collecting only full name, email address and phone number. College, branch and year are opt-in settings, each with its own required state. A fixed college can be configured only when organizers have confirmed that operational rule.

Removed from the participant flow: WhatsApp, gender, student ID, division, interests, startup idea, attendance history, travel/campus questions, emergency contacts, accessibility collection, legacy multi-consent wall, UTR and screenshot upload.

## Validation and state

`src/lib/registration-details.ts` contains the shared Zod details contract. Email is trimmed/lowercased; Indian phone input accepts a user-friendly +91/spaced form and normalizes to a deterministic ten-digit value for future matching. Wizard state is in memory only. It deliberately does not save drafts or registrations to localStorage, so refresh starts a fresh draft.

## Availability and preview

Public `/register` renders the unavailable state until `isPaymentRegistrationAvailable()` passes the existing Phase 1 configuration gate. In development, `/register` shows a clearly labelled local visual preview only when explicitly enabled:

```powershell
npm run dev
```

Set `PAYMENT_UI_PREVIEW=1`; the preview is non-payable and never changes server payment availability.

The preview requires a non-production environment, never changes API/payment availability, and never submits or stores participant data.

## Phase 4 handoff

Phase 4 should consume the normalized `RegistrationDetails` shape, replace the legacy API schema with a minimal server-side participant/pending-payment contract, and provide the payment component behind `PaymentHandoff`. It must add the approved UPI recipient/amount/QR, reference and file handling, server persistence, duplicate protection, `submitted_for_verification`, and staff verification. It must not restore client-side local fallbacks.
