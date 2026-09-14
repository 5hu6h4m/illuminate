# Content Truth: Illuminate 2026

This file is mandatory reading before changing public copy. Never infer or invent event claims. Unknown information must remain pending.

## Confirmed

- Event identity: Illuminate 2026; host/organizer: E-Cell MET.
- Legitimate association wording: associated with the Illuminate initiative of E-Cell IIT Bombay.
- Registration is open to everyone.
- Registration deadline public date: 29 September 2026. The exact closing time is not confirmed.
- Pricing: Early Bird ₹599 for the first 120 hours from the configured production opening timestamp; Regular ₹699 at and after that cutoff.
- Direct UPI payment recipient: Yash Patil (`yashpatil76317@okicici`), INR. These facts are public payment instructions, not secrets.
- Support: E-Cell MET Team, `met.iot.ecell@gmail.com`.
- Policy facts: registration fees are non-refundable once payment has been verified; privacy and registration terms are published at `/privacy`, `/terms`, and `/refunds`.
- Truthful positioning: “IIT Bombay's entrepreneurship ecosystem, brought to your campus.”

## Still pending

- Confirmed event date, time, venue, duration, capacity, and exact registration closing time.
- Certificate issuer/wording, participant kit, campus visit, travel, E-Summit benefit, speakers, agenda, and participant selection criteria.
- Data-retention schedule and infrastructure backup confirmation.
- Manual real-device QR/payee/deep-link scan after production deployment.

## Prohibited unless later confirmed

- A guaranteed IIT Bombay campus visit, internship, placement, funding, mentorship, startup selection, or E-Summit entry.
- “IIT Bombay certificate”, “Startup Kit”, “Top 30”, free travel, fixed seat counts, or fake scarcity/urgency.
- Publishing the tentative date, time, or venue as final event facts.
- Calling submitted proof a successful payment or confirmed seat.

## Workflow

1. Update `src/config/event.ts` with the fact, value, and confirmation state.
2. Update this document and the relevant policy copy in the same change.
3. Render facts only when their state is `confirmed`.
4. If a fact becomes stale or disputed, change it to `pending` before publishing replacement copy.
