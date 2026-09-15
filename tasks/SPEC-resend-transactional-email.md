# Spec: Resend transactional email

## Objective

Send one notification after a payment proof is durably submitted and one after a real payment is durably verified, without allowing email delivery to alter payment truth.

## Contract

- Payment submission/verification commits to MongoDB first.
- A persisted notification record claims each stable event before a Resend attempt; Resend receives a matching idempotency key.
- TEST/development registrations use a dry-run adapter and never contact Resend.
- Failure records safe metadata and never rolls back `submitted_for_verification` or `verified`.
- Absolute status links derive only from configured `APP_BASE_URL` plus the existing secure token.

## Commands

- `npm run test:email`
- `npm run dev:test-payment-e2e`
- `npm run email:test` (explicit development-only live provider test)

## Boundaries

- Always: keep Resend server-only; use immutable snapshots; minimize email PII.
- Never: send proof files, admin notes, secrets, or TEST participant email; auto-verify payment.

## Success criteria

- Repeated transition/retry cannot produce duplicate application email events.
- Email copy differentiates proof submission from confirmed payment.
- Missing/failed provider configuration does not corrupt a payment state.
