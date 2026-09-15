# Spec: Illuminate 2026 — Whole-Site Award-Winning Redesign

> The brief IS the spec. No planner. Generator + Evaluator loop only.

## Brief

Redesign the entire Illuminate 2026 website (Next.js + Tailwind, dark cinematic theme)
to award-winning visual standard across ALL routes:

- `/` (landing: CinematicHero, association lockup, about, journey, value, IITB panel, details, FAQ, support, final CTA)
- `/register` (4-step form + payment)
- `/success` (confirmation + Reg ID `ILL-MET-2026-XXXXX` + WhatsApp + .ics)
- `/admin` (dashboard + participant table + CSV export)
- `/terms`, `/privacy`, `/refunds`, `/registration`

PRIMARY goal is visual excellence. A stunning half-finished app beats a functional
ugly one. Push for creative leaps — unusual layouts, custom animations,
distinctive color work — in the spirit of Anthropic's frontend design experiments
(e.g. 3D Dutch art museum with CSS perspective and doorway navigation).

Must keep: Manrope monochrome cinematic system (#050505/#fafafa, violet #8b5cf6 accent,
ignition-thread motif, chamfered credential frames). NOTE (loop decision, iter 1):
the older project spec named New Rocker + Piazzolla, but the shipped site has since
unified on Manrope — a font swap now would be churn, not a creative leap. Do not
reintroduce New Rocker/Piazzolla without human approval.

## Tech Stack

Next.js 16.3.5 App Router + TypeScript + Tailwind CSS v4 + MongoDB + Zod.
Fonts: New Rocker + Piazzolla. Icons: lucide-react.

## Commands

```bash
npm run dev        # Dev server
npm run build      # Production build (must stay clean)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
node --test tests/gan-design.test.mjs  # Harness unit tests
node scripts/gan-design.mjs "<brief>" [--max-iterations N] [--pass-threshold N]
```

## Project Structure

```text
gan-harness/            → This harness (spec.md IS the brief, eval-rubric.md)
scripts/gan-design.mjs  → CLI runner: parses brief / --max-iterations / --pass-threshold
src/app/                → page.tsx (/), register/, success/, admin/, terms/, privacy/, refunds/
src/components/landing/ → CinematicHero, IgnitionThread, WorkshopJourney, Faq, etc.
src/config/event.ts     → Single source of truth for event facts
tests/gan-design.test.mjs → Parser + rubric weight tests
```

## Code Style

Airy, cinematic, dark. One idea per viewport. Example:

```tsx
<section className="landing-section py-24 md:py-32">
  <div className="mx-auto max-w-6xl px-6">
    <p className="text-eyebrow">Eyebrow</p>
    <h2 className="text-section-title">Distinctive, not generic.</h2>
  </div>
</section>
```

## Testing Strategy

- `node --test` for harness parser + rubric math (unit, fast).
- `npm run typecheck` + `npm run lint` per iteration.
- `npm run build` before declaring pass.
- Manual: 360/768/1024/1440 + keyboard tab-through + zero console errors.

## Boundaries

- Always: read `docs/CONTENT_TRUTH.md` before changing copy; Zod-validate at boundaries; render `pending` facts as "To be announced".
- Ask first: schema change, new dependency, price/deadline change, event date/venue copy.
- Never: promise IITB campus visit / certificate wording / Top-30 / travel / E-Summit unless `confirmed` in `event.ts`; commit secrets; delete `.agents/` or `.opencode/` config; collect Aadhaar/PAN/address/bank/income/passwords.

## Success Criteria

- [ ] Weighted score >= `--pass-threshold` (default 7.5) on design rubric.
- [ ] All routes render with zero console errors, build clean.
- [ ] Copy matches `docs/CONTENT_TRUTH.md` (no invented claims).
- [ ] Airy constraint holds; keyboard + responsive OK.

## Open Questions

- Event date/venue/time final values? (default: "To be announced")
- Gateway keys vs manual UPI for redesign? (default: keep manual UTR + UPI `yashpatil76317@okicici`)
