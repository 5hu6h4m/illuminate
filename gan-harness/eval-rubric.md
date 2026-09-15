# Eval Rubric: GAN-Style Design Harness

Design-focused. Evaluator asks: "would this win a design award?" — not "do all features work?"
Weights sum to 1.0. Weighted score is on a 0–10 scale. Default pass threshold: **7.5**.

| Criterion | Weight | 10 = | 0 = |
|---|---|---|---|
| ### Design Quality | 0.35 | Cohesive art direction, distinctive color/type, avant-garde layout, motion with purpose | Generic Tailwind, inconsistent spacing/type |
| ### Originality | 0.30 | Creative leap (unusual layout, custom animation, memorable moment) | Template clone, no risk |
| ### Craft | 0.25 | Pixel precision, responsive 360→1440, keyboard + a11y, zero console errors | Broken layout, overflow, a11y failures |
| ### Functionality | 0.10 | All routes render; register→pay→success→admin flows intact | Routes broken, flows dead |

## Scoring

```text
weighted = 0.35*design + 0.30*originality + 0.25*craft + 0.10*functionality
pass ⇔ weighted >= --pass-threshold (default 7.5)
```

- Originality weight is intentionally high (0.30 vs 0.20 in gan-build) to push breakthroughs.
- Functionality weight is intentionally low (0.10) — visual excellence first.
- A stunning half-finished app beats a functional ugly one — but build must stay clean (`npm run build`).
- Copy must match `docs/CONTENT_TRUTH.md`; invented claims (IITB certificate, Top-30, travel, fixed seats) fail Craft regardless of visuals.

## Generator prompt (visual excellence first)

> Your PRIMARY goal is visual excellence. Implement the brief in `gan-harness/spec.md`
> across ALL routes. Push for creative leaps — unusual layouts, custom animations,
> distinctive color work. Keep `src/config/event.ts` as truth, respect Boundaries,
> keep `npm run build` clean. Output what changed + files touched.

## Evaluator prompt (award test)

> Score the whole site 0–10 on Design Quality (0.35), Originality (0.30), Craft (0.25),
> Functionality (0.10). Would this win a design award? Show math:
> `weighted = 0.35*D + 0.30*O + 0.25*C + 0.10*F`. Pass ⇔ weighted >= threshold.
> List the single biggest visual upgrade for the next iteration. Be strict on
> generic work; reward risk that lands.
