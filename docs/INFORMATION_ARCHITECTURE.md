# Information Architecture

## Future landing page (Phase 2)

1. Hero: confirmed identity, one primary CTA and event status.
2. Credibility/association: precise, non-implying relationship wording.
3. Why Illuminate: confirmed workshop purpose only.
4. Workshop journey: confirmed format/agenda.
5. Value: outcomes supported by approved copy.
6. Confirmed participant benefits: omit pending items entirely.
7. Event details: schedule, venue, fee and eligibility from event config.
8. FAQ/policies: payment, refund, privacy and terms.
9. Organizer/support: verified contacts/social links.
10. Final CTA: only when registration is open.

## Registration (Phase 3)

1. Participant details: minimum contact and eligibility data.
2. Review + payment context: server-authoritative fee and explicit policies.
3. Payment proof + submission: reference ID, screenshot and `submitted_for_verification` state.

## Payment (Phase 4)

- Direct UPI only; custom branded QR created from a valid UPI URI.
- Display approved amount, payee, UPI ID and a copy/open-app affordance.
- Collect reference/UTR and screenshot; never auto-verify.
- Begin each submission in `submitted_for_verification`.

## Admin (Phase 4)

- Verification queue; verified and rejected/resubmission views.
- Search, filters, export and immutable audit trail.
- Authenticated staff roles; no passcode in query strings or browser persistence.
