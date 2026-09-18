# Illuminate Admin Operations

## Sign in and sign out

Open `/admin`, sign in with the team password, and sign out when finished. The password is verified only on the server. Do not share it in chat, URLs, screenshots, browser storage, or spreadsheets. Repeated failed attempts are rate-limited.

## Payment states

- **Payment pending** — a registration exists, but no proof has been submitted.
- **Awaiting verification** — a screenshot and reference were received. This is evidence, not confirmation.
- **Rejected / action required** — the participant must use their private link to provide new evidence.
- **Verified** — only after checking the authorized recipient account, reference, expected snapshot amount, and participant evidence.
- **TEST** — development simulation only; never real money, revenue, participant count, or export data.

## Verify a real payment

1. Search by registration reference, participant detail, or transaction/reference.
2. Inspect the private proof only as supporting evidence.
3. Independently find the payment in the authorized recipient account: Yash Patil / `yashpatil76317@okicici`.
4. Compare the account result against the immutable registration snapshot, including tier and expected amount.
5. Tick the confirmation that the recipient account was checked, then choose **Verify payment**.

Do not verify based on a screenshot alone. The application has no bank or UPI settlement integration. Early Bird snapshots issued through 23 September 2026 expect ₹599; Regular snapshots issued from 24 September through 5 October 2026 expect ₹699. Never recalculate an older registration from the price currently displayed on the landing page.

## Reject and request resubmission

Provide a short participant-facing reason, for example “Screenshot unclear — please upload a clearer proof.” A private note is internal only and never appears on the participant status page. The participant can submit a replacement proof/reference through their existing private status link.

## Delete a registration

Verified, rejected, and submitted registrations are deletable. Deletion is hard and permanent — it cannot be undone.

1. Export the IITB + internal CSVs first and keep them with the event records.
2. Open the record and scroll to the danger zone.
3. For verified / submitted / rejected real registrations, tick the export confirmation checkbox (TEST and still-pending records skip this step).
4. Type the full `ILL26-XXXXXX` reference to confirm.
5. Enter a deletion reason (10–500 characters) — it is stored in the audit log.
6. Re-enter the admin password.
7. Choose confirm to permanently delete.

Deletion destroys the registration, its uploaded proofs, and its `audit[]` history. A snapshot copy (reference, test flag, payment state, expected amount, transaction reference, reason) is kept in the `admin_audit` log as `admin_registration_deleted_verified` (was verified) or `admin_registration_deleted`. Verified revenue and exports drop accordingly, and the email/phone/transaction reference are freed for reuse. The non-refundable policy still applies commercially — deletion is an operational removal, not a refund.

## Exports

- **IITB CSV**: verified real participants only — name, email, phone number.
- **Internal CSV**: real current-generation payment fields, including pricing tier and expected snapshot amount.

Exports require admin authentication. Test records, proof files, participant tokens, credentials, and MongoDB IDs are excluded. Formula-like CSV values are escaped.

## Transactional email status

The record review view shows safe notification status for submission and verification email: sent, failed, suppressed, or not sent. A failed email never reverses a proof submission or payment verification. Ask participants to keep their secure status link; do not send arbitrary custom messages from the dashboard. TEST notification status is `suppressed` and never represents delivery.

## Lost private status link

Participants can self-serve at `/login` with their registered email or mobile number alone — Illuminate ID is optional and only speeds up lookup (if supplied it must match the same record). ID-alone never re-issues a link; a contact is always required. Login failures return a generic “no match” message and are rate-limited per IP + per contact/ID. Otherwise ask the participant to contact E-Cell MET Team at `met.iot.ecell@gmail.com`, then follow an organizer-approved identity-verification process.

## Database issue or incident

If MongoDB is unavailable, do not say that registration, proof submission, or verification succeeded. The system fails closed. Restore database connectivity, inspect the queue/audit history, and ask affected participants to retry through their private link. Do not create a local spreadsheet payment workflow.

MongoDB and its GridFS `payment_proofs` bucket are the source of truth. Deployment owners must confirm backups, restore access, retention, and a restore drill. Use `npm run dev:clear-payment-tests` only against an intended development database with all preview flags enabled; it refuses production.
