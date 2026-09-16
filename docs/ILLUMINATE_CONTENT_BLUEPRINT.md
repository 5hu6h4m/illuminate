# Illuminate Content Blueprint

This is the Phase 0 source-of-truth plan for future homepage work. It does not authorize UI changes by itself.

## Content boundaries

- `src/config/event.ts`: hard, mutable MET event facts only — registration state, pricing, deadline, schedule facts, eligibility, payment, support, and policy facts.
- `src/content/illuminate.ts`: official Illuminate knowledge, educational explanations, curriculum, conceptual journey, participant-value language, role definitions, and POC-aware structures.
- `src/content/student-examples.ts`: clearly marked editorial examples.
- `src/content/faq.ts`: categorized FAQ foundation with publication metadata.
- `src/content/content-types.ts`: the small source/publication model and default publishable selector.

Do not duplicate prices, deadline, UPI information, payee, support email, or schedule values in the content modules. Read those from `event.ts` when a future component needs them.

## Locked homepage flow

1. Hero
2. Entrepreneurship Explained
3. One Problem → Business Example
4. What You'll Learn
5. Workshop Journey
6. What You'll Leave With
7. Is This For Me?
8. Who Is Behind Illuminate?
9. Pricing + Event Details
10. FAQ + Final CTA

Speaker/facilitator is a small conditional insert only after confirmation.

## Locked implementation phases

1. Phase 0 — Content Foundation
2. Phase 1 — Hero + Entrepreneurship Explained
3. Phase 2 — Problem→Business + Learning Map
4. Phase 3 — Workshop Experience + Takeaways + “Is This For Me?”
5. Phase 4 — Trust + Pricing + Event Details + FAQ + Final CTA
6. Phase 5 — Whole-site UX/UI Polish

## Publication rules

`official_current` material can describe general Illuminate knowledge, but it cannot be presented as a confirmed MET-2026 benefit. Certificate and startup-kit structures therefore remain `conditional` with `eventSpecificConfirmation: "pending_poc"`.

`pending_poc` does not silently become public. The default selector returns only `publishable` content. A safe pending-status answer may be public when it says that details are awaiting confirmation; it must not invent the missing detail.

The canteen journey is an `editorial_explanation`, not a promise of an exact workshop activity. The workshop journey is `conceptual`, not a timetable.
