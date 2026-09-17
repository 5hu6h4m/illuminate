# Illuminate Launch Checklist

## Done by development

- [x] Current-generation registration, private status links, manual verification, private GridFS proof storage, audit events, and protected exports.
- [x] Real/test record isolation and development payment lifecycle QA.
- [x] Canonical fixed-schedule payment snapshots: Early Bird ₹599 through 23 September 2026, then Regular ₹699 through 5 October 2026.
- [x] Confirmed recipient/payment configuration is centralised and QR/deep-link safe.
- [x] Published privacy, registration terms, refund information, and support links.
- [x] Production safety commands: `npm run qa:production` and `npm run launch:check`.

## Confirmed by organizers

- [x] Registration is open to everyone.
- [x] Registration is scheduled from 15 September through 5 October 2026; public deadline: 5 October 2026.
- [x] INR pricing: ₹599 Early Bird / ₹699 Regular.
- [x] Authorized recipient: Yash Patil, `yashpatil76317@okicici`.
- [x] Fees are non-refundable once payment has been verified.
- [x] Support: E-Cell MET Team, `met.iot.ecell@gmail.com`.

## Must be confirmed before full public launch

- [ ] Production admin password hash and session/participant secrets are configured in the deployment secret store.
- [ ] MongoDB/Atlas connectivity, indexes, backups, restore owner, request limit, HTTPS, and monitoring owner are confirmed.
- [ ] Real UPI QR scan: phone shows correct payee, UPI ID, snapshotted amount, note/reference, and expected deep link. Cancel before payment.
- [ ] Event date, time, venue, capacity, and any participant benefits are confirmed before publication.
- [ ] Data-retention policy owner and future retention schedule are confirmed.

## Minimal manual checks

1. Run `npm run launch:check` in the target production environment.
2. On the deployed site, scan a QR and inspect recipient, UPI ID, amount, note, and deep link without paying.
3. Check home, register, private status, and admin routes once on a desktop and a mobile browser.
4. Organizer confirms final public content and operational verification procedure.

## Transactional email launch requirement

- [ ] Resend sending domain is verified for `RESEND_FROM_EMAIL`; do not use Resend's testing sender for participant delivery.
- [ ] `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, and HTTPS `APP_BASE_URL` are configured in the production secret store.
- [ ] Run `npm run email:test` only in development with a synthetic recipient, then verify the production sender/domain separately.

## Stop / rollback triggers

Immediately close registration or deploy the previous release if payment instructions, recipient identity, admin access, proof privacy, or database persistence is suspect. Preserve audit records and proof files, inform the operations owner, rotate compromised secrets, and never mark unverified payments as confirmed.
