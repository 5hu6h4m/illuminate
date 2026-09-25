# Illuminate V3 — Production Rollout Runbook

Scope: the future Phase 5 rollout ONLY. Nothing in this document executes
anything. All migration/reconcile/verify scripts default to read-only dry
run; confirm mode additionally requires `--confirm --reason` (and
`--production` on `illuminate`).

## Crash-window operational risk (Phase 2 architecture)

Explicit Generate QR claims the payment-destination slot OUTSIDE the
seat+attach transaction (in-transaction snapshot reads livelock the
activation chain under burst — proven by the isolated integration suite)
and compensates the claim on every abort path. Consequences:

- If a process crashes AFTER the slot claim but BEFORE the transaction
  commits, `assignedCount` can temporarily exceed live registration ground
  truth for that account.
- This creates UNDER-availability (spurious FULL), NEVER overbooking: no
  seat is committed and no QR is attached without the transaction.
- Same-token losers release their unused slot synchronously; only a hard
  crash leaves residue.

Recovery (never automatic during participant requests):

1. `reconcile-payment-destinations --dry-run` → inspect the plan.
2. If the plan shows stored > live on exactly the crashed account,
   `reconcile-payment-destinations --confirm --reason="..."`.
3. `reconcile-event-capacity --dry-run` → expect NO DRIFT (seats never
   leak: they move only inside committed transactions).
4. `verify-v3-production-readiness` → expect RESULT PASS.

## Rollout order (future Phase 5)

1. Registrations remain manually CLOSED (`manualClose: true` — verified, never toggled here).
2. Merge/deploy V3 code (Phases 1–3).
3. Verify the site still shows CLOSED (landing + `/register` + status flows for existing holders).
4. Run a fresh production READ-ONLY precheck (census + destinations + `manualClose`).
5. Run `migrate-v3-production` DRY RUN; review every line against §8 expectations
   (B 10→20, C 10→20, D→DISABLED, Priyanka INSERT 10, Sneha seq4→5 cap20→30,
   configured 50→90, claimable 49, seats 90/120/30).
6. Review the dry-run output with a second operator.
7. Run the CONFIRMED migration (`--confirm --reason --production`); save the printed `backupPath`.
8. `reconcile-payment-destinations --dry-run` → expect NO DRIFT.
9. `reconcile-event-capacity --dry-run` → expect NO DRIFT.
10. `verify-v3-production-readiness` → expect RESULT PASS.
11. Smoke existing participant paths (status/QR/proof for a historical holder) and admin paths (queue, review, exports).
12. Only then reopen registrations (manual toggle — separate decision, separate audit).
13. Watch the first real draft; verify it consumes ZERO slots/seats.
14. Watch the first organic Generate QR; verify exactly one seat + one destination commitment.
15. Monitor the first ₹699 proof submission through verification.
16. Keep this runbook and the migration backup path linked in the release notes.

## Rollback window

Rollback (`rollback-v3-migration --confirm --reason --backup <path> [--production]`)
is permitted ONLY before reopen, while `manualClose` is still true, total
registrations are still 90, ground truth still equals the counter at 90, and
live destination counts are still B9/C10/D10/F0/E12. Any V3 traffic makes it
REFUSE. Never roll back after reopen.
