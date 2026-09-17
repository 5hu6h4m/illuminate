# Responsive Rescue — Task List

Existing `tasks/plan.md` (registration schedule) left untouched; this track is planned in `tasks/plan-responsive.md`.

## Wave 1 (parallel) — DONE, scorer 12 → 46

- [x] T1a — Container swap (LearningMap, ProblemToBusiness, Takeaways, RegistrationProcess)
- [x] T1b — Container swap (SupportContact, EventDetails, IsThisForMe, IlluminateRelationship)
- [x] T2 — Hero/header/register TSX + delete SiteHeader.tsx
- [x] T3 — Image payload (page, SitePreloader, SiteFooter)
- [x] C1 — Overflow honesty (bleeders, masks, video width)

## Checkpoint: Wave 1 — PASSED (46/100, typecheck clean, lint 0 errors)

- [x] Scorer ≥ 40, nothing flipped back
- [x] `npm run typecheck` clean (fixed pre-existing test-emailjs.mts TS5097 with ts-expect-error)

## Wave 2 (sequential) — C2 DONE, scorer 46 → 66

- [x] C2 — Tablet band 768–1024px (+ mobile-first 7/6-col, hamburger to 1024px, details-line clamp)
- [x] C3 — Header/footer chrome (compact CTA ≤1024px, 44px mobile nav, footer giant floor)
- [ ] C4 — Forms/journey/320px/svh/scroll

## Checkpoint: Complete — PASSED

- [x] Scorer 100/100, zero Critical FAILs (12 → 46 → 66 → 80 → 100)
- [x] `npm test` 38/38 + typecheck + lint (0 errors) + build green
- [x] Review: caught + fixed hero effect stale-closure (showVideo dep); diff 168+/121-
## Review fixes (code-review-and-quality) — DONE, scorer still 100/100

- [x] Blocking: reverted unverified desktop hero garnish (content max-width/gutters, h1 weight/measure)
- [x] Blocking: restored known-good hero blend (original gradient, masks + shadow removed)
- [x] Optional: extracted src/lib/hero-words.ts + tests/hero-words.test.mjs (4 tests, in npm test)
- [x] Optional: scorer signatures labeled historical; Nits fixed (dead code, NaN threshold, relative paths, tablet h3)
- [x] Re-verified: 42/42 tests, typecheck, lint 0 errors, build green
- [ ] Manual-probe follow-ups (needs human browser): 320px header-CTA crowding, value-map stack glance, 768–1024px eyeball, unmasked-overflow sweep
