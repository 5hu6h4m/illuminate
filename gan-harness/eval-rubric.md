# Eval Rubric: GAN-Style Design Harness — DESIGN-ONLY

This rubric is for visual experimentation. Its threshold is not a production pass and can never produce production GO. It must never override security, payment integrity, registration/data integrity, content truth, accessibility blockers, reliability, or production QA.

Production correctness is evaluated in this order: security; payment integrity; registration/data integrity; content truth; accessibility and critical usability; reliability; visual quality. This harness applies only to the final item.

Evaluator asks: “would this win a design award?” — not “is it ready for production?” Weights sum to 1.0. Weighted score is on a 0–10 scale. Default design threshold: **7.5**.

| Criterion | Weight | 10 = | 0 = |
|---|---:|---|---|
| Design quality | 0.35 | Cohesive art direction and purposeful motion | Generic or inconsistent presentation |
| Originality | 0.30 | Memorable, appropriate visual direction | Template clone |
| Craft | 0.25 | Pixel precision and responsive polish | Broken layout or overflow |
| Functionality | 0.10 | Routes render for design review | Routes are unusable |

```text
weighted = 0.35*design + 0.30*originality + 0.25*craft + 0.10*functionality
design threshold met ⇔ weighted >= --pass-threshold (default 7.5)
```

Meeting this design threshold is insufficient for any deployment decision. Run `npm run qa:production` and `npm run launch:check` independently, and resolve every higher-priority issue first.

Copy must match `docs/CONTENT_TRUTH.md`; invented claims (IITB certificate, Top-30, travel, fixed seats) fail the design review regardless of visuals.
