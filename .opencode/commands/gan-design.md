---
description: DESIGN-ONLY GAN-style whole-website exploration loop
---

This command is for design experimentation only. It is not a production-readiness authority and must never override security, payment correctness, registration/data integrity, content truth, accessibility blockers, reliability, or production QA. A design score can never produce production GO.

Parse `brief` (required), `--max-iterations N` (default 10), and `--pass-threshold N` (default 7.5) via `node scripts/gan-design.mjs`. The brief is saved to `gan-harness/spec.md`. The Generator/Evaluator loop uses `gan-harness/eval-rubric.md` solely to improve visual quality. Respect `docs/CONTENT_TRUTH.md` and `src/config/event.ts`; keep `npm run build` clean. Production acceptance remains governed by `npm run qa:production`, `npm run launch:check`, and the hierarchy in `docs/PHASE_5_PRODUCTION_READINESS.md`.
