# Phase 4 — Payment, backend and administration

## Objective and safe activation

Phase 4 adds the direct-UPI evidence workflow without a payment gateway: details → server-created pending registration → UPI instructions → proof submitted for verification → manual staff decision. `isPaymentRegistrationAvailable()` remains the single payment activation gate. It requires an open registration, confirmed positive INR fee, confirmed recipient and confirmed UPI ID. Every money-flow route checks it; no UI setting can bypass it. The current event configuration is pending, so no real payment registration, payable URI, QR or proof submission is available.

## Current registration model

New documents have `schemaVersion: 2`, `eventKey`, non-sequential `publicId`, normalized minimal participant fields, an immutable `payment.snapshot`, payment state/timestamps, GridFS file references and an append-only audit array. A HMAC-authenticated participant token is represented only as a SHA-256 lookup hash; the raw token is not persisted. Existing records without schema version remain untouched and are not shown by the current-generation admin queue.

`payment.snapshot` has `expectedAmount`, INR `currency`, `payeeName`, `upiId` and `eventKey`. Future config changes do not change these terms for an existing registration.

## State machine

```
CREATE → payment_pending
payment_pending → submitted_for_verification
submitted_for_verification → verified | rejected
rejected → submitted_for_verification
verified → terminal
```

Conditional Mongo updates enforce transitions. A proof can never directly verify a registration; admin verification is possible only from `submitted_for_verification`.

## UPI and QR

One server-side builder creates `upi://pay` with `URLSearchParams` from the immutable snapshot: `pa`, `pn`, fixed two-decimal `am`, `cu=INR`, and registration reference note. The same URI drives the mobile deep link and the QR. The QR endpoint uses the `qrcode` package server-side with black modules, white background, four-module quiet zone, medium error correction and 720px output. Branding belongs around the QR card, never over its modules.

## Identifiers and duplicate controls

Public references have a readable `ILL26-` prefix plus six non-ambiguous random characters. They are support/display references only. Status/manage links use a 256-bit HMAC of the public reference under `PARTICIPANT_TOKEN_SECRET`; knowing a public reference is not enough to obtain a link or data.

The creation endpoint requires a client idempotency key; a unique current-schema `(eventKey, idempotencyKeyHash)` index returns the same secure URL after an interrupted retry. Unique partial indexes separately protect `(eventKey, normalized email)`, `(eventKey, normalized phone)`, public ID and normalized transaction reference. Safe conflict responses never include existing participant data.

## Proof handling

Proofs are private binary GridFS files in `payment_proofs`; registration documents store only a file ID and metadata history. PNG, JPEG and WebP are allowed after MIME and magic-byte checks; files are capped at 4 MB. SVG, PDF, HTML and data URLs are rejected. The participant selects a local preview before upload. The upload stream is deleted if the subsequent conditional registration update fails. Previous proof metadata is retained in `proofHistory`; retention of old binaries needs organizer policy before launch.

Proof routes require the HMAC participant token; admin proof routes require the signed HttpOnly admin session. Responses have no-store/private, no-referrer and nosniff headers.

## Admin authentication and workflow

`ADMIN_PASSWORD_HASH` is a salted scrypt value generated with `npm run admin:hash-password`. The server compares it with `timingSafeEqual`. Successful logins set an eight-hour HMAC-authenticated `HttpOnly`, `SameSite=Strict`, production-`Secure` cookie. No password is accepted through query strings, authorization headers, browser storage or client comparisons. Successful and failed logins are audited. Login, pending creation and proof submission use Mongo-backed time-window limits; the hashed limiter identifier supports multi-instance deployments.

The dashboard is current-schema only, supports server-side search/filter/pagination, lazy proof viewing and metrics. Revenue totals only `verified` snapshots. Verify requires a staff checkbox acknowledging confirmation in the authorized recipient account. Reject requires a participant-facing reason and optionally accepts a private note at the API boundary. Both append audit events.

## Export

`/api/admin/export` returns an admin-only verified-participant CSV with Name, Email and Phone Number for IIT Bombay. `?mode=internal` includes current operational payment columns. CSV cells are prefixed when they begin with `=`, `+`, `-` or `@` to prevent formula injection. Neither export includes proof bytes, session data, access tokens or database IDs.

## Indexes

Indexes are created idempotently through `ensurePaymentIndexes()` and failures are not swallowed: `v2_public_id_unique`, `v2_event_email_unique`, `v2_event_phone_unique`, `v2_idempotency_unique`, `v2_transaction_reference_unique`, `v2_admin_queue`, `v2_access_token`, `v2_created_at`, plus `rate_limit_key` and TTL `rate_limit_expiry`.

## Development preview and limitations

With `NODE_ENV` not production and `PAYMENT_UI_PREVIEW=1`, `/register` renders an unmistakable `DEV PREVIEW — NOT PAYABLE` card using `₹XXX`, `preview@upi`, and a real scan-safe QR that encodes only `ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY`. It never produces `upi://pay`, calls the registration endpoint, stores a proof or creates a record. It cannot collect money.

There is intentionally no lost-link recovery endpoint: email/phone/public-ID lookup would leak status without OTP/email infrastructure. There is no OCR, bank API, automatic proof interpretation or payment gateway. A screenshot/reference remains evidence, never bank confirmation.

## Development end-to-end payment mode

Local E2E simulation additionally requires `REGISTRATION_PREVIEW=1`, `PAYMENT_UI_PREVIEW=1`, and `PAYMENT_E2E_PREVIEW=1`, while `NODE_ENV` is not production. It reuses the real schema-v2 state machine, GridFS proof storage, participant token, audit history and admin queue. Only the snapshot differs: `environment: "development"`, `isTest: true`, `mode: "development_preview"`, `₹XXX`, `Preview Recipient`, `preview-not-payable`, and a QR payload of `ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY`.

Test records are visibly marked TEST, are excluded from real metrics/revenue and both exports, and require a separate simulated-verification acknowledgement. In production, all flags are ignored, test creation/proof/QR behavior is unavailable, and test records are excluded from the queue. `npm run dev:clear-payment-tests` uses `.env.local`, requires all three flags, refuses production, and deletes only `schemaVersion: 2`, `isTest: true`, `environment: "development"` records plus their referenced GridFS proof files.

## Phase 5 verification focus

Before launch, configure confirmed event facts and server secrets; exercise the end-to-end paths against a test MongoDB database; run a multi-instance rate-limit check; validate mobile UPI deep links and QR scanning; define payment-proof retention; and have organizers practice recipient-account verification/rejection.
