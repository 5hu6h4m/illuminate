# Illuminate 2026 — E-Cell MET

Next.js, TypeScript, Tailwind, MongoDB and Zod event platform.

## Before changing copy

Read [Content Truth](docs/CONTENT_TRUTH.md). Event facts are defined in `src/config/event.ts`; pending facts must never be made public.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Current phase

Phase 1 is active. Public registration is intentionally gated until organizers confirm the fee, schedule, eligibility and approved UPI recipient. Later work is documented in [Phase 1 Foundation](docs/PHASE_1_FOUNDATION.md) and [Information Architecture](docs/INFORMATION_ARCHITECTURE.md).

Routes: `/`, `/register`, `/success?id=`, `/admin` and `/api/registrations`.
