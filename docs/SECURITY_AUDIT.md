# Security Audit

## P0 — addressed in Phase 1

- Public `GET /api/registrations?id=…` returned every registration field, including contact data, student ID, emergency contact, UTR and screenshot, for a guessable identifier. It now projects only `id`, `paymentStatus` and `createdAt`.
- Duplicate-email responses returned an existing complete participant record. They now return only a conflict message.
- A placeholder UPI destination and unconfirmed fee could collect payment proof. UI and API now gate registration.

## P1 — Phase 4 required

- Admin access is a shared passcode, accepts a query-string key, uses direct equality and has an in-memory per-instance rate limit.
- Registration IDs are low-entropy/random-range identifiers and support enumeration risk.
- Screenshot data URLs are stored with PII and served through the admin response; no retention, access control or malware validation exists.
- No distributed rate limiting for public submissions or admin access.
- Admin exports expose more personal data than the current purpose has justified.

## P2

- Client localStorage has PII and a browser-only registration fallback.
- The API returns detailed Zod validation errors and logs server errors; production error/observability policy is absent.
- MongoDB indexes are created lazily on request rather than through controlled deployment migration.

## P3

- No documented CSP, security headers, data retention/deletion procedure or privacy policy.
- Decorative client components add hydration/runtime cost.

Do not treat this audit as a completed security hardening programme; Phase 4 owns auth, storage, rate limits, audit records and data governance.
