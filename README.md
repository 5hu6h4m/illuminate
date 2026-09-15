# Illuminate 2026 — E-Cell MET

Production-ready Next.js event registration, direct UPI payment-proof verification, secure participant status links, and operational admin tools.

## Transactional email

Resend sends two transactional notifications only for real registrations:

- **Payment submitted** after proof and transaction reference are durably persisted as `submitted_for_verification`. It says verification is pending; it never claims money or seat confirmation.
- **Registration confirmed** after an authenticated admin durably transitions a real registration to `verified`.

Email is a post-transaction side effect. Provider failure is recorded safely and never rolls back payment proof submission or verification. Development TEST records use dry-run suppression and never contact Resend.

Required server-only production configuration: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, and `APP_BASE_URL`. Production delivery requires an organizer-controlled Resend-verified sending domain and HTTPS app URL.

## Commands

```bash
npm run lint
npm run typecheck
npm run build
npm run test:payment-policy
npm run dev:test-payment-e2e
npm run qa:production
npm run launch:check
```

`npm run email:test` is an explicit development-only live template test. It refuses production and requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_TEST_TO`; it uses only synthetic data and never reads or modifies registrations.

## Content and operations

Read [Content Truth](docs/CONTENT_TRUTH.md) before changing public copy. See [Admin Operations](docs/ADMIN_OPERATIONS.md), [Launch Checklist](docs/LAUNCH_CHECKLIST.md), and [Resend email design](docs/RESEND_TRANSACTIONAL_EMAIL.md).
