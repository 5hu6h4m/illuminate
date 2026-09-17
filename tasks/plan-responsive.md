# Implementation Plan: Responsive Rescue (20 → 75+)

## Overview

Fix all 19 failing responsiveness checks (static score 12/100, grade F) across the Illuminate landing, registration, and chrome. Work is split into TSX-track (parallel-safe, distinct files) and CSS-track (sequential — everything lives in `src/app/globals.css`). The scorer `scripts/evaluate-responsiveness.mjs` is the test harness: RED now, GREEN per slice. No commits (not requested).

## Architecture Decisions

- **Harness-first (TDD):** scorer updated before any fix; each slice must flip its check(s) FAIL→PASS and never flip another back.
- **One-writer rule for `globals.css`:** never two agents editing it in the same wave. TSX agents may run parallel to exactly one CSS agent.
- **Contracts (defined here so parallel waves integrate):**
  - Tablet band shape: `@media (min-width: 768px) and (max-width: 1024px)` — exact shape, the scorer regex requires it.
  - Mobile-nav CTA class: `landing-mobile-cta` (markup in Wave 1, styled in Wave 2).
  - Summary skip-link: `<a class="registration-summary-link" href="#registration-summary">` + `id="registration-summary"` on the aside.
  - Video gate: `window.matchMedia("(min-width: 901px)")` + `saveData` guard; hero fallback 6000ms → 1000ms.
  - Container swap: `<div className="container">` → `<Container>` with `@/components/ui/Container` import; keep child classNames.
  - `unoptimized` removed from all `/images/*` usages; the dev QR (`preview-qr`) keeps it — nobody touches that file.
- **Overflow honesty before unmasking:** bleeders constrained first, masks removed in the same slice (C1), never separately.

## Task List

### Wave 1 (parallel — distinct files only)
- [ ] T1a: Container swap — LearningMap, ProblemToBusiness, Takeaways, RegistrationProcess
- [ ] T1b: Container swap — SupportContact, EventDetails, IsThisForMe, IlluminateRelationship
- [ ] T2: Hero/header/register TSX — video gate + 1s fallback, mobile-CTA class, summary anchor, delete SiteHeader.tsx, register-page logos
- [ ] T3: Image payload — drop `unoptimized` on /images/*, lazy below-fold (page, SitePreloader, SiteFooter only)
- [ ] C1: Overflow honesty — constrain bleeders, remove both masks, video width floor → min()

### Checkpoint: Wave 1
- [ ] Scorer ≥ 40, no check flipped back to FAIL
- [ ] `npm run typecheck` clean (TSX wave)

### Wave 2 (sequential — one CSS writer at a time)
- [ ] C2: Tablet band — 768–1024px rules for every multi-col grid
- [ ] C3: Header/footer chrome — compact CTA, 44px mobile nav, footer giant + brands
- [ ] C4: Forms/journey/320px — progress, consent, journey, FAQ, facts, value-map, svh, scroll offsets

### Checkpoint: Complete
- [ ] Scorer ≥ 75 with zero Critical FAILs (target: 100)
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `next build` all green
- [ ] Manual-probe notes recorded for 320/768/1024/1440 (no browser MCP available)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Unmasking reveals real horizontal scroll | High | C1 constrains bleeders atomically; bleeder check guards regression |
| Two agents editing globals.css | High | One-writer rule; sequential Wave 2 |
| No browser to verify rendering | Med | Conservative edits; record manual probes as follow-up; build+types+scorer gate every slice |
| Video gate changes hero LCP look on mobile | Low | Gradients already behind video; content untouched |

## Open Questions

- None blocking. Visual sign-off at 320/768/1024/1440 needs a human with a browser (recorded as follow-up).
