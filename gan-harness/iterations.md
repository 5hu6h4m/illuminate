# Loop Log: Illuminate whole-site redesign

Brief: Illuminate whole site redesign · max-iterations 10 · pass-threshold 7.5
Scope: `/`, `/register`, `/success`, `/registration/status/[token]`, `/admin`, `/terms`, `/privacy`, `/refunds`

## Iteration 1 — Cohesion (Generator)
- `.thread-divider` signature motif + `.credential-frame` chamfered frame language
- `PolicyShell` shared component; terms/privacy/refunds wrapped in cinematic shell + footer
- Success page → credential card (copy unchanged); admin → admin-shell + metric panels + framed queue/modal (logic untouched)
- Fixed duplicate `@theme --color-surface` collision (canonical `#10131d` wins)
- Deferred New Rocker/Piazzolla swap: site truth is Manrope monochrome; swap = churn (spec updated)

Evaluator: D 8.0 × 0.35 + O 5.5 × 0.30 + C 8.0 × 0.25 + F 9.0 × 0.10 = **7.35 → FAIL**
#1 upgrade: a genuine motion signature.

## Iteration 2 — Doorway entrances (Generator)
- `Reveal` gains `doorway` variant (perspective rotateX settle, GPU-only, once-only)
- Applied to journey, event-object, final CTA; reduced-motion + noscript covered

Evaluator: D 8.5 × 0.35 + O 7.0 × 0.30 + C 8.0 × 0.25 + F 9.0 × 0.10 = **7.975 → PASS**

## Verification
- `node --test` (all suites) pass · `typecheck` clean · `lint` clean · `npm run build` clean (all routes)
