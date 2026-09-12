# Spec: Illuminate 2026 — MET × E-Cell IIT Bombay

## Objective
6-hour interactive entrepreneurship workshop registration site. User flow:
Landing (₹999→₹699 Early Bird) → 4-step form → ₹699 payment → Confirmed + Reg ID + WhatsApp + Email.
Admin: dashboard + participant table + CSV/Excel export for IITB submission.

Success: mobile-first airy page, 4 steps completable, early-bird auto-flips 20 Sept 2026 23:59 IST,
Reg ID `ILL-MET-2026-XXXXX`, export matches IITB columns.

## Tech Stack
Next.js 15 App Router + TypeScript + Tailwind CSS, Supabase-ready (localStorage draft in v1),
Razorpay-ready (placeholder checkout in v1, manual UTR fallback), Resend-ready (mailto/.ics in v1).
Fonts: New Rocker (display) + Piazzolla (body) to mirror ecell.in/illuminate dark theme.

## Commands
Dev: npm run dev
Build: npm run build
Lint: npx tsc --noEmit
Test: npm test (when added)

## Project Structure
src/app/ → page.tsx (landing), register/, success/, admin/
src/components/ → Hero, BenefitCards, EarlyBirdBand, MultiStepForm, Admin
src/lib/ → pricing.ts, validation.ts, reg-id.ts, export.ts
public/images/ → user-supplied assets
tasks/ → plan.md, todo.md

## Code Style
Example:
```tsx
export function BenefitCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <h3 className="mt-4 font-display text-xl">{title}</h3>
      <p className="mt-2 leading-relaxed text-white/65">{text}</p>
    </article>
  );
}
```
Airy rule: max-w-6xl, py-24 md:py-32, gap-6 md:gap-8, one idea per viewport. No congested grids.

## Testing Strategy
tsc + next build per slice. Manual checks at 360/768/1024/1440 + keyboard tab-through.
e2e later via Playwright.

## Boundaries
- Always: Zod-validate at boundaries, +91 phone regex, idempotency on payment create, Top-30 disclaimer everywhere.
- Ask first: schema change, new dep, price/deadline change.
- Never: Aadhaar/PAN/address/bank/income/passwords, commit secrets, delete agent config (.agents/.opencode/AGENTS.md).

## Success Criteria
- [ ] Landing renders airy, no console errors
- [ ] Register 4 steps validate + draft persists
- [ ] Pay placeholder → success with Reg ID
- [ ] Admin table + CSV export works
- [ ] `npm run build` clean
- [ ] Pushed to https://github.com/5hu6h4m/illuminate.git main

## Open Questions
- Razorpay keys vs manual UPI for v1? (default: placeholder + manual UTR)
- Event date/venue/reporting time/WhatsApp link? (placeholder, user to fill)
