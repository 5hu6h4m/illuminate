# Resend transactional email

## Events

- `paymentSubmitted` is queued only after payment proof, reference, audit event, and `submitted_for_verification` state are persisted.
- `paymentVerified` is queued only after an authenticated real-registration verify transition is persisted.
- Rejection deliberately sends no email in this release. It is a recommended future enhancement.

Each notification stores a safe state (`pending`, `sending`, `sent`, `failed`, or `suppressed`) and stable event key. Resend receives that same idempotency key. Provider failure never rolls back registration/payment state.

## Safety

TEST/development records are marked `suppressed`; standard E2E never calls Resend. Emails contain only the participant's relevant status, immutable snapshot amount/tier, public registration reference, transaction reference where applicable, and secure status link. They never contain proofs, private notes, storage IDs, database IDs, or hashes.

`APP_BASE_URL` is the trusted source for absolute status links. In production it must be HTTPS; request Host headers are never used to construct email links.

## Configuration and testing

Set server-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, and `APP_BASE_URL`. Use `npm run email:test` only in development with `RESEND_TEST_TO`; it sends both templates using synthetic data and refuses production.

Resend's testing sender has recipient/delivery limits. Real participant delivery requires an organizer-controlled, Resend-verified sending domain. Do not use `onboarding@resend.dev` as the production sender.
