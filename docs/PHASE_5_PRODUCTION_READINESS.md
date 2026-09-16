# Phase 5 — Production Readiness

Status legend: **PASS** = verified in code or an executed check; **PENDING CONFIGURATION** = requires an organizer or deployment fact; **BLOCKER** = prevents launch.

## Current decision

**TECHNICAL + REGISTRATION GO — ADMIN/DEPLOYMENT CHECKS PENDING.** Registration and direct UPI payment facts are confirmed centrally. The target production environment must still contain a valid admin password hash and secrets, and the deployment/manual checks below must pass. Event logistics remain deliberately unpublished.

## A. Event Content

- **PASS** Illuminate 2026, E-Cell MET, and the approved association wording are the only organizational claims.
- **PASS** Registration is open to everyone when the organizer enables it. No public automatic closing date/time is claimed.
- **PENDING CONFIGURATION** Event date, time, venue, capacity, and unconfirmed benefits remain unpublished.

## B. Registration and Payment

- **PASS** Server-side creation validates details, uses idempotency, duplicate protection, MongoDB persistence, and immutable payment snapshots.
- **PENDING CONFIGURATION** Server-only `REGISTRATION_OPEN` controls new registration availability and `REGISTRATION_PRICE_TIER` selects either ₹599 Early Bird or ₹699 Regular. Client values cannot select price or tier, and missing or invalid controls keep production payment registration unavailable.
- **PASS** Canonical INR direct UPI recipient: Yash Patil / `yashpatil76317@okicici`. Display, QR, deep link, and snapshot use the same trusted source.
- **PASS** Payment proof is evidence only. Manual account verification remains required before a real seat is confirmed.
- **PENDING CONFIGURATION** No approved expiry policy exists for abandoned payment-pending registrations. Do not invent one.
- **PENDING DEPLOYMENT** Complete a real-device QR recipient/amount/note/deep-link check after deployment; cancel before payment.

## C. Participant, Admin, Security and Privacy

- **PASS** Status/manage access requires a high-entropy hashed participant token; public registration references do not authenticate access.
- **PASS** GridFS proof files are private, authenticated, no-store, nosniff, and validated as PNG/JPEG/WebP up to 4 MB.
- **PASS** Admin authentication uses scrypt, timing-safe comparison, signed HttpOnly sessions, strict SameSite, secure production cookies, origin checks, and Mongo-backed rate limiting.
- **PASS** Real/test metrics and exports are isolated. Revenue uses only stored amounts of real verified registrations.
- **PASS** Privacy, registration terms, refund information, and support are published. Fees are non-refundable once verified.
- **PENDING CONFIGURATION** Data retention duration, deployment backups, monitoring ownership, HTTPS confirmation, request-size compatibility, and operational recovery ownership need deployment confirmation.

## D. Accessibility, Responsive UX and SEO

- **PASS** QR is not the only payment method; text amount, payee, UPI ID, copy action, and UPI deep link remain available.
- **PASS** Forms and admin actions retain labels, live errors, keyboard controls, focus behavior, and mobile-safe wrapping.
- **PASS** Public metadata exists; admin/private status routes are noindex and private responses are no-store.
- **PENDING DEPLOYMENT** Smoke-test the deployed site on one desktop and one real mobile device; manually assess screen-reader/keyboard paths and production performance.

## Transactional email readiness

- **PASS** Payment-submitted and registration-confirmed notifications are persisted side effects after their respective database transitions. They never alter payment truth on provider failure.
- **PASS** TEST records are dry-run suppressed and standard E2E asserts no Resend call is made.
- **PENDING CONFIGURATION** Configure a Resend-verified sending domain, server-only Resend variables, and an HTTPS `APP_BASE_URL` before relying on participant email delivery.

## E. Required launch actions

1. Configure `MONGODB_URI`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `PARTICIPANT_TOKEN_SECRET`, `REGISTRATION_OPEN`, and `REGISTRATION_PRICE_TIER` in the production secret store.
2. Run `npm run qa:production` and `npm run launch:check` with deployment-equivalent configuration.
3. Confirm hosting supports Node route handlers, MongoDB/GridFS, at least 4 MB multipart uploads, HTTPS, and backups.
4. Scan the real QR on a phone, inspect recipient, amount, note and deep link, then cancel before payment.
5. Publish event date, time, and venue only after organizer confirmation.

## Commands

- `npm run qa:production` — static checks plus launch check, and E2E only when explicit non-production preview flags are enabled.
- `npm run launch:check` — non-destructive environment/config/database/index/payment checks; never enables payment or changes data.
- `npm run dev:test-payment-e2e` — development-only synthetic Mongo/GridFS lifecycle QA; refuses production and cleans only its own data.
- `npm run dev:clear-payment-tests` — development-only cleanup of explicitly marked test records; refuses production.

## Production acceptance hierarchy

Production correctness is evaluated in this order: (1) security, (2) payment integrity, (3) registration/data integrity, (4) content truth, (5) accessibility and critical usability, (6) reliability, then (7) visual quality. Design tooling may improve visual quality only; it cannot waive items 1–6 or produce production GO.
