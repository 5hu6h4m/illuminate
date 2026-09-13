# Implementation Plan: Illuminate 2026

## Overview
Airy Next.js site mirroring ecell.in/illuminate dark theme. Vertical slices: foundation → landing → registration+payment → admin/export → push.

## Architecture Decisions
- Next.js App Router + Tailwind, no DB in v1 (localStorage + in-memory admin demo, Supabase-ready types).
- Single pricing source `src/lib/pricing.ts` for early-bird flip.
- Reg ID generator `ILL-MET-2026-XXXXX` client-side demo, server-ready.
- Keep `.agents/.opencode/AGENTS.md` — scaffold around them.

## Task List
### Phase 1: Foundation
- [x] Spec + plan written
- [ ] Scaffold Next.js + theme tokens + layout

### Checkpoint: Foundation
- [ ] `npm run dev` renders, `npx tsc --noEmit` clean

### Phase 2: Marketing (airy)
- [ ] Hero + badges + Early Bird band + Benefits + steps + footer

### Checkpoint: Marketing
- [ ] 360/768/1440 airy, keyboard OK

### Phase 3: Registration + payment + success
- [x] 4-step form + payment placeholder + success + .ics
(MongoDB Atlas live, Reg ID `ILL-MET-2026-XXXXX` server-issued, verified e2e)

### Phase 4: Admin + export
- [x] Admin metrics + table + CSV export
(Passcode-only gate `ECELL2026ERA`, no email; server-verified + rate-limited, verified e2e)

### Checkpoint: Complete
- [x] `npm run build` clean
- [ ] pushed to GitHub main

## Risks and Mitigations
| Risk | Impact | Mitigation |
| Top-30 travel over-promise | High | `*selection criteria` on every mention + consent |
| Gateway delay | Med | Placeholder + manual UTR now, Razorpay later |
| Congested UI | Med | Airy constraint: py-24/32, max-w-6xl, 3-col max |
| Wipe agent config | High | Scaffold around .agents/.opencode, never delete |

## Open Questions
- Event date/venue/WhatsApp link values?
- Gateway keys available?
