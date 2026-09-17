# Content Truth: Illuminate 2026

This file is mandatory reading before changing public copy. Never infer or invent event claims. Unknown information must remain pending.

## Confirmed

- Event identity: Illuminate 2026; host/organizer: E-Cell MET.
- Legitimate association wording: associated with the Illuminate initiative of E-Cell IIT Bombay.
- Registration is open to everyone.
- Registration schedule: opens `2026-09-15T00:00:00+05:30`, Early Bird ends `2026-09-24T00:00:00+05:30`, and new registration closes `2026-10-06T00:00:00+05:30`.
- Registration deadline public date: 5 October 2026. This is not the workshop event date.
- Pricing: server-only fixed-schedule resolution maps Early Bird to ₹599 through 23 September 2026 and Regular to ₹699 from 24 September through 5 October 2026. The client cannot select or override the tier.
- Direct UPI payment recipient: Yash Patil (`yashpatil76317@okicici`), INR. These facts are public payment instructions, not secrets.
- Support: E-Cell MET Team, `met.iot.ecell@gmail.com`.
- Policy facts: registration fees are non-refundable once payment has been verified; privacy and registration terms are published at `/privacy`, `/terms`, and `/refunds`.
- Truthful positioning: “IIT Bombay's entrepreneurship ecosystem, brought to your campus.”

## Content source and publication model

Public copy has two gates: its source and its publication state. The typed source lives in `src/content/content-types.ts`; Phase 0 content modules use it rather than duplicating mutable event facts.

- `official_current`: supported by current general Illuminate material; this does **not** make it MET-2026-specific.
- `met_confirmed`: confirmed for this MET event.
- `editorial_explanation`: a neutral educational explanation or illustrative example, never a workshop promise.
- `pending_poc`: waiting for point-of-contact confirmation.
- `historical_only`: retained for internal context and never public current-event copy.

Only `publishable` items are returned by the default public selector. `conditional`, `pending`, and `internal_only` items need an explicit confirmation/publication decision.

## Still pending

- Confirmed event date, time, venue, duration, and capacity.
- Certificate issuer/wording, participant kit, campus visit, travel, E-Summit benefit, speakers, agenda, and participant selection criteria.
- Data-retention schedule and infrastructure backup confirmation.
- Manual real-device QR/payee/deep-link scan after production deployment.

## Prohibited unless later confirmed

- A guaranteed IIT Bombay campus visit, internship, placement, funding, mentorship, startup selection, or E-Summit entry.
- “IIT Bombay certificate”, “Startup Kit”, “Top 30”, free travel, fixed seat counts, or fake scarcity/urgency.
- Publishing the tentative date, time, or venue as final event facts.
- Calling submitted proof a successful payment or confirmed seat.
- Guaranteed Eureka advantage, founder interaction, industry experts, IIT Bombay professors or student trainers.
- Specific speaker identity, credentials, affiliation, session timetable, workshop duration, capacity, kit contents, or certificate issuer/design.

## HISTORICAL_REFERENCE_2025 — internal only

An older 2025 brochure mentioned a 6-hour workshop, preferred 11 AM–6 PM timing, ₹799 fee, a 70-participant minimum, training, certification, startup kit, Business Model Canvas material, seasoned entrepreneurs/professionals, host-college responsibilities, 50% advance payment, collective college-side payment, kit preparation after advance payment, and possible speaker details 2–3 days before the workshop.

**Do not publish any of these as 2026 facts without POC confirmation.** They are historical context, not current event configuration.

## Workflow

1. Update `src/config/event.ts` with the fact, value, and confirmation state.
2. Update this document and the relevant policy copy in the same change.
3. Render facts only when their state is `confirmed`.
4. If a fact becomes stale or disputed, change it to `pending` before publishing replacement copy.
