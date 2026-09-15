---
description: GAN-style whole-website design loop (Generator + Evaluator, no planner)
---

Parse `brief` (required), `--max-iterations N` (default 10), `--pass-threshold N` (default 7.5) via `node scripts/gan-design.mjs`. The brief IS the spec (`gan-harness/spec.md`). No planner. Loop Generator (visual excellence first: stunning half-finished beats functional ugly, push creative leaps) → Evaluator (`gan-harness/eval-rubric.md`: Design 0.35 / Originality 0.30 / Craft 0.25 / Functionality 0.10, pass ⇔ weighted >= threshold, "would this win a design award?") across ALL routes until pass or max iterations. Respect `docs/CONTENT_TRUTH.md` and `src/config/event.ts`; keep `npm run build` clean.
