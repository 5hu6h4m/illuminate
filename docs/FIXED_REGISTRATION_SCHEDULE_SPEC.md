# Fixed Registration Schedule

## Objective

Replace environment-controlled registration availability and tier selection with one server-side event schedule. New registrations open at `2026-09-15T00:00:00+05:30`, use Early Bird until `2026-09-24T00:00:00+05:30`, then use Regular until `2026-10-06T00:00:00+05:30`.

## Commands

`npm run test:payment-policy`, `npm run test:content`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run launch:check`.

## Structure and Style

`src/config/event.ts` owns schedule facts and price amounts. `src/lib/payment-pricing.ts` resolves a supplied instant to an available tier and amount. `src/lib/payment.ts` creates immutable server snapshots. Tests belong in `tests/` and use injected instants.

## Testing Strategy

Exercise each exact boundary, assert no registration-control environment variable is read, retain immutable snapshot coverage, and test the public date copy separately from the pending event date.

## Boundaries

- Always: preserve server authority, existing participant access, and payment snapshots.
- Ask first: unrelated payment, email, database, or dependency changes.
- Never: derive schedule state in the browser, use machine time in deterministic tests, or deploy.

## Success Criteria

- `openAt <= now < earlyBirdEndAt` resolves ₹599.
- `earlyBirdEndAt <= now < closeAt` resolves ₹699.
- Other instants have no new-registration snapshot.
- No registration-control environment variable is required.
