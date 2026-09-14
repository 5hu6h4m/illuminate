# Payment Architecture Notes

## Current risks

- Price logic previously mixed ₹599 and ₹699 plus a dated early-bird deadline.
- The legacy form contains a placeholder UPI ID and base64 screenshot handling.
- Screenshots are stored inline with the registration record, increasing MongoDB size and PII exposure.
- The UTR rule assumes exactly 12 alphanumeric characters; providers can differ.
- There is no transaction-reference uniqueness constraint or audit history.
- The UI can fall back to browser storage when the database is unavailable, which is unsuitable for payments.
- Rejection currently maps to generic `pending`, losing reason and resubmission context.

## Phase 1 safeguard

Registration is gated in both UI and API while the fee and payee/UPI ID are pending. The ₹599 value remains a non-public working configuration value.

## Phase 4 target

No Razorpay, Stripe or other gateway. Use direct UPI, a custom branded QR generated from an approved URI, approved payee/amount, copy/open-app support, server-side object storage for screenshots, reference-ID uniqueness, manual verification and auditable state transitions. Initial status must be `submitted_for_verification`, never `verified`.

Phase 4 is implemented in `PHASE_4_PAYMENT_BACKEND_ADMIN.md`. The old inline/base64 path and public status lookup are retired for new registrations.
