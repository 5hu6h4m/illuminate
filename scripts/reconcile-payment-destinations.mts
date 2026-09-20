/**
 * Reconcile `payment_destinations.assignedCount` with live registrations.
 *
 * Background: `assignedCount` is incremented at assignment time and (since
 * the delete-release fix) decremented on admin hard-delete. Counters that
 * leaked before that fix stay stale — the admin CapacityPanel then shows
 * phantom assignments and new registrations can hit a false
 * PAYMENT_CAPACITY_FULL. This script heals that drift safely.
 *
 * SAFETY (senior-security rules for a production counter reset):
 * - NEVER blindly zeroes. The proposed count for B/C/D/E is the number of
 *   live real registrations whose `payment.destination.destinationId`
 *   points at that account. Zero happens if and only if nothing live
 *   points there — which is exactly the "clear the assignment" outcome the
 *   operator wants when everything was deleted.
 * - Account A (disabled/legacy) is never touched.
 * - A proposed count below the live observed count is refused (would allow
 *   overbooking past 10 per UPI account).
 * - Default mode is a read-only dry run. Writes require `--confirm` plus a
 *   `--reason` (10–500 chars, mirrors the admin-delete policy) and are
 *   recorded in `admin_audit` as `payment_destinations_reconciled`.
 * - Status healing preserves operator `disabled` decisions; only
 *   active/available/exhausted rotate on the B → C → D → E chain.
 *
 * Usage:
 *   Dry run (read-only, safe to run anytime):
 *     node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/reconcile-payment-destinations.mts --dry-run
 *   Execute (records audit):
 *     node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/reconcile-payment-destinations.mts --confirm --reason="Reconcile after bulk admin deletes, slots leaked before delete-release fix"
 */
import { closeMongoConnection, getDb, getPaymentDestinationsCollection, isDbConfigured } from "@/lib/mongodb";
import { ACCOUNT_A_DESTINATION_ID, APPROVED_DESTINATION_IDS_IN_SEQUENCE } from "@/lib/payment-destinations";
import { realRegistrationFilter } from "@/lib/registration-filters";

const APPROVED = [...APPROVED_DESTINATION_IDS_IN_SEQUENCE];

type Args = { confirm: boolean; reason: string | null };

function parseArgs(argv: string[]): Args {
  let confirm = false;
  let reason: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--confirm") confirm = true;
    else if (argv[i] === "--dry-run") confirm = false;
    else if (argv[i] === "--reason" && i + 1 < argv.length) reason = argv[(i += 1)];
    else if (argv[i]?.startsWith("--reason=")) reason = argv[i].slice("--reason=".length);
  }
  return { confirm, reason };
}

async function run() {
  const { confirm, reason } = parseArgs(process.argv.slice(2));
  if (!isDbConfigured()) {
    console.error("[reconcile] MONGODB_URI is not configured.");
    process.exit(1);
  }
  if (confirm && (!reason || reason.trim().length < 10 || reason.trim().length > 500)) {
    console.error("[reconcile] REFUSED: --confirm requires --reason (10–500 characters) for the audit log.");
    process.exit(1);
  }

  const db = await getDb();
  await db.command({ ping: 1 });
  const destinations = await getPaymentDestinationsCollection();
  const registrations = db.collection("registrations");
  const now = new Date();

  // Live ground truth: real (non-test, non-development) registrations grouped
  // by their authoritative assigned destination. Legacy docs without
  // `payment.destination` never claimed a slot, so they contribute nothing —
  // counting them would inflate the counters again.
  const grouped = await registrations
    .aggregate<{ _id: string | null; count: number }>([
      { $match: realRegistrationFilter },
      { $group: { _id: "$payment.destination.destinationId", count: { $sum: 1 } } },
    ])
    .toArray();
  const observed = new Map<string, number>();
  let withoutDestination = 0;
  for (const row of grouped) {
    if (typeof row._id === "string" && row._id) observed.set(row._id, row.count);
    else withoutDestination += row.count;
  }

  const docs = await destinations.find({}).sort({ sequence: 1 }).toArray();
  const byId = new Map(docs.map((d) => [d.destinationId, d]));
  for (const id of APPROVED) {
    if (!byId.has(id)) {
      console.error(`[reconcile] REFUSED: approved destination ${id} is missing from the collection. Run the seed script first.`);
      process.exit(1);
    }
  }

  type Plan = {
    destinationId: string;
    stored: number;
    live: number;
    proposed: number;
    statusFrom: string;
    statusTo: string;
    allowFrom: boolean;
    allowTo: boolean;
    changed: boolean;
  };
  const plans: Plan[] = APPROVED.map((id) => {
    const doc = byId.get(id)!;
    const stored = doc.assignedCount ?? 0;
    const live = observed.get(id) ?? 0;
    // The counter must equal live rows: leaked slots (stored > live) come
    // down, under-counts (stored < live) come up. Zero iff nothing live.
    const proposed = live;
    let statusTo = doc.status;
    let allowTo = doc.allowNewAssignments;
    if (doc.status !== "disabled") {
      if (proposed >= doc.capacity) {
        statusTo = "exhausted";
        allowTo = false;
      } else if (doc.status === "exhausted") {
        // Deletes freed room on a previously full account — reopen it.
        statusTo = "active";
        allowTo = true;
      }
    }
    return {
      destinationId: id,
      stored,
      live,
      proposed,
      statusFrom: doc.status,
      statusTo,
      allowFrom: doc.allowNewAssignments,
      allowTo,
      changed: proposed !== stored || statusTo !== doc.status || allowTo !== doc.allowNewAssignments,
    };
  });

  // Steady-state invariant (mirrors the seed): when chargeable capacity
  // remains, exactly one non-disabled account with room is `active`
  // (lowest sequence); the rest with room are `available`.
  const roomPlans = plans.filter((p) => {
    const doc = byId.get(p.destinationId)!;
    return doc.status !== "disabled" && p.proposed < doc.capacity;
  });
  const activesWithRoom = roomPlans.filter((p) => p.statusTo === "active");
  if (roomPlans.length > 0 && activesWithRoom.length === 0) {
    const next = roomPlans.sort((a, b) => byId.get(a.destinationId)!.sequence - byId.get(b.destinationId)!.sequence)[0];
    next.statusTo = "active";
    next.allowTo = true;
    next.changed = next.changed || next.statusFrom !== "active";
  } else if (activesWithRoom.length > 1) {
    const sorted = activesWithRoom.sort((a, b) => byId.get(a.destinationId)!.sequence - byId.get(b.destinationId)!.sequence);
    for (const extra of sorted.slice(1)) {
      extra.statusTo = "available";
      extra.allowTo = true;
      extra.changed = extra.changed || extra.statusFrom !== "available";
    }
  }

  const foreignObserved = [...observed.entries()].filter(([id]) => id !== ACCOUNT_A_DESTINATION_ID && !APPROVED.includes(id as never));
  const accountAObserved = observed.get(ACCOUNT_A_DESTINATION_ID) ?? 0;

  console.log("[reconcile] live real registrations by destination:", JSON.stringify(Object.fromEntries(observed)));
  console.log(`[reconcile] live without assignable destination: ${withoutDestination} (legacy snapshots — never claimed slots, ignored)`);
  console.log(`[reconcile] live on disabled Account A: ${accountAObserved} (preserved, never auto-migrated)`);
  if (foreignObserved.length) console.log(`[reconcile] WARNING unknown destination ids observed: ${JSON.stringify(foreignObserved)} (left untouched)`);
  console.log("[reconcile] plan (stored → proposed, live = ground truth):");
  for (const p of plans) {
    console.log(
      `[reconcile]   ${p.destinationId}: count ${p.stored} → ${p.proposed} (live=${p.live}) status ${p.statusFrom} → ${p.statusTo} allow ${p.allowFrom} → ${p.allowTo}${p.changed ? "" : " (no change)"}`,
    );
  }
  const overCapacity = plans.filter((p) => p.proposed > (byId.get(p.destinationId)!.capacity ?? 0));
  if (overCapacity.length) {
    console.log(`[reconcile] WARNING over capacity: ${overCapacity.map((p) => `${p.destinationId} live=${p.live}`).join(", ")} — counters will record it and the account stays exhausted; investigate duplicates.`);
  }

  if (!confirm) {
    console.log("[reconcile] DRY RUN — no writes performed. Re-run with --confirm --reason=\"...\" to apply.");
    return;
  }

  for (const p of plans) {
    if (!p.changed) continue;
    const update: Record<string, unknown> = {
      assignedCount: p.proposed,
      status: p.statusTo,
      allowNewAssignments: p.allowTo,
      updatedAt: now,
    };
    if (p.statusTo === "exhausted" && p.statusFrom !== "exhausted") update.exhaustedAt = now;
    if (p.statusFrom === "exhausted" && p.statusTo !== "exhausted") update.exhaustedAt = null;
    if (p.statusTo === "active" && p.statusFrom !== "active") update.activatedAt = now;
    // Remove a null exhaustedAt instead of storing null (keeps docs clean).
    const { exhaustedAt, ...rest } = update;
    const setUpdate: Record<string, unknown> = { ...rest };
    if (exhaustedAt !== null) setUpdate.exhaustedAt = exhaustedAt;
    const ops: Record<string, unknown> = { $set: setUpdate };
    if (exhaustedAt === null) ops.$unset = { exhaustedAt: "" };
    await destinations.updateOne({ destinationId: p.destinationId }, ops as never);
    console.log(`[reconcile] APPLIED ${p.destinationId}: count=${p.proposed} status=${p.statusTo}`);
  }
  await db.collection("admin_audit").insertOne({
    type: "payment_destinations_reconciled",
    actor: "admin",
    at: now,
    metadata: {
      reason: reason!.trim(),
      mode: "reconcile_to_live",
      plan: JSON.stringify(plans.map((p) => ({ id: p.destinationId, stored: p.stored, live: p.live, proposed: p.proposed, statusFrom: p.statusFrom, statusTo: p.statusTo }))),
      liveWithoutDestination: withoutDestination,
      liveAccountA: accountAObserved,
    },
  });
  console.log("[reconcile] DONE — audit event payment_destinations_reconciled recorded.");
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[reconcile] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
