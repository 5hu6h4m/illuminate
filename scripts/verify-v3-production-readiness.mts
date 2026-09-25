/**
 * V3 production readiness verifier — READ-ONLY ONLY.
 *
 * Checks code constants, manual close, event capacity, census, destination
 * identities/capacities/counters, D-disabled, Priyanka exactness, Sneha
 * sequence, single-active (B), claimable math, unknown destinations, pending
 * shape, and historical snapshot integrity. Performs ZERO writes.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/verify-v3-production-readiness.mts
 */
import { closeMongoConnection, getDb, isDbConfigured } from "@/lib/mongodb";
import {
  ACCOUNT_A_DESTINATION_ID,
  APPROVED_DESTINATION_IDS_IN_SEQUENCE,
  EVENT_VERIFIED_SEAT_LIMIT,
  TOTAL_PAYMENT_CAPACITY,
} from "@/lib/payment-destinations";
import { EVENT_CAPACITY_ID, computeCommittedGroundTruth, type EventCapacityDoc } from "@/lib/event-capacity";
import { realRegistrationFilter } from "@/lib/registration-filters";
import type { SiteSettings } from "@/lib/site-settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

async function run() {
  if (!isDbConfigured()) {
    console.error("[verify] MONGODB_URI is not configured.");
    process.exit(1);
  }
  const db = await getDb();
  await db.command({ ping: 1 });
  const failures: string[] = [];
  const pass = (label: string, cond: boolean, detail = "") => {
    if (cond) console.log(`[verify] PASS ${label}${detail ? ` (${detail})` : ""}`);
    else {
      console.error(`[verify] FAIL ${label}${detail ? ` (${detail})` : ""}`);
      failures.push(label);
    }
  };

  // Code constants.
  pass("code seat limit 120", EVENT_VERIFIED_SEAT_LIMIT === 120, String(EVENT_VERIFIED_SEAT_LIMIT));
  pass("code total derived 90", TOTAL_PAYMENT_CAPACITY === 90, String(TOTAL_PAYMENT_CAPACITY));
  pass(
    "code approval order B/C/D/F/E",
    JSON.stringify([...APPROVED_DESTINATION_IDS_IN_SEQUENCE]) ===
      JSON.stringify(["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-f-priyanka", "account-e-sneha"]),
  );

  // Manual close.
  const site = await db.collection<SiteSettings>("site_settings").findOne({ _id: "registration" });
  pass("manualClose true", site?.manualClose === true, String(site?.manualClose));

  // Census.
  const regs = db.collection("registrations");
  const [total, verified, submitted, pending, rejected] = await Promise.all([
    regs.countDocuments({ ...realRegistrationFilter }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "verified" }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "submitted_for_verification" }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "payment_pending" }),
    regs.countDocuments({ ...realRegistrationFilter, "payment.status": "rejected" }),
  ]);
  pass("census total 90", total === 90, String(total));
  pass("census verified 90", verified === 90, String(verified));
  pass("census submitted 0", submitted === 0, String(submitted));
  pass("census pending 0", pending === 0, String(pending));
  pass("census rejected 0", rejected === 0, String(rejected));

  // Event capacity.
  const cap = await db.collection<EventCapacityDoc>("event_capacity").findOne({ _id: EVENT_CAPACITY_ID });
  pass("event_capacity initialized", cap !== null);
  pass("event_capacity seatLimit 120", cap?.seatLimit === 120, String(cap?.seatLimit));
  const allRegs = await regs.find({ ...realRegistrationFilter }).project({ payment: 1 }).toArray();
  const truth = computeCommittedGroundTruth(
    allRegs as Array<{ payment: { status: string; destination?: { destinationId?: string } | null } }>,
  );
  pass("ground truth 90", truth === 90, String(truth));
  pass("committedCount == ground truth", cap?.committedCount === truth, `${cap?.committedCount} vs ${truth}`);
  pass("committedCount <= 120", typeof cap?.committedCount === "number" && cap.committedCount <= 120, String(cap?.committedCount));

  // Destinations.
  const dests = await db.collection("payment_destinations").find({}).sort({ sequence: 1 }).toArray();
  const byId = new Map(dests.map((d) => [(d as Doc).destinationId as string, d as Doc]));
  for (const id of ["account-a-yash", "account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-f-priyanka", "account-e-sneha"]) {
    pass(`destination present ${id}`, byId.has(id));
  }
  const expectDoc = (id: string, want: Record<string, unknown>) => {
    const doc = byId.get(id);
    for (const [k, v] of Object.entries(want)) pass(`${id}.${k}=${JSON.stringify(v)}`, doc?.[k] === v, JSON.stringify(doc?.[k]));
  };
  expectDoc("account-a-yash", { sequence: 0, capacity: 0, assignedCount: 0, status: "disabled", allowNewAssignments: false });
  expectDoc("account-b-shivam", { sequence: 1, capacity: 20, assignedCount: 9, status: "active", ownerApproved: true, allowNewAssignments: true });
  expectDoc("account-c-bhushan", { sequence: 2, capacity: 20, assignedCount: 10, status: "available", ownerApproved: true, allowNewAssignments: true });
  expectDoc("account-d-shubham", { sequence: 3, capacity: 10, assignedCount: 10, status: "disabled", ownerApproved: true, allowNewAssignments: false });
  expectDoc("account-f-priyanka", { sequence: 4, capacity: 10, assignedCount: 0, status: "available", ownerApproved: true, allowNewAssignments: true, payeeName: "Priyanka Ripote (Ecell Team)", upiId: "9172140735@ybl" });
  expectDoc("account-e-sneha", { sequence: 5, capacity: 30, assignedCount: 12, status: "available", ownerApproved: true, allowNewAssignments: true });

  // Counters vs live ground truth.
  const grouped = await regs
    .aggregate<{ _id: string | null; count: number }>([
      { $match: realRegistrationFilter },
      { $group: { _id: "$payment.destination.destinationId", count: { $sum: 1 } } },
    ])
    .toArray();
  const live = new Map<string, number>();
  for (const row of grouped) if (typeof row._id === "string" && row._id) live.set(row._id, row.count);
  for (const [id, want] of [["account-b-shivam", 9], ["account-c-bhushan", 10], ["account-d-shubham", 10], ["account-e-sneha", 12]] as const) {
    pass(`counter/live match ${id}`, (byId.get(id)?.assignedCount ?? -1) === want && (live.get(id) ?? -1) === want, `stored=${byId.get(id)?.assignedCount} live=${live.get(id)}`);
  }
  pass("A has zero destination-backed rows", (live.get(ACCOUNT_A_DESTINATION_ID) ?? 0) === 0);
  const known = new Set([...APPROVED_DESTINATION_IDS_IN_SEQUENCE, ACCOUNT_A_DESTINATION_ID]);
  pass("no unknown payment destinations", [...live.keys()].every((id) => known.has(id)), JSON.stringify([...live.keys()]));

  // Exactly one active future destination, and it is B.
  const actives = dests.filter((d) => (d as Doc).status === "active" && (d as Doc).destinationId !== ACCOUNT_A_DESTINATION_ID);
  pass("exactly one active destination", actives.length === 1, JSON.stringify(actives.map((d) => (d as Doc).destinationId)));
  pass("active destination is B", (actives[0] as Doc | undefined)?.destinationId === "account-b-shivam");

  // Claimable math.
  const claimable = (["account-b-shivam", "account-c-bhushan", "account-f-priyanka", "account-e-sneha"] as const).reduce(
    (sum, id) => sum + Math.max(0, ((byId.get(id)?.capacity ?? 0) as number) - ((byId.get(id)?.assignedCount ?? 0) as number)),
    0,
  );
  pass("claimableRemaining 49", claimable === 49, String(claimable));
  pass("configured capacity 90", TOTAL_PAYMENT_CAPACITY === 90);

  // Pending shape + historical snapshot integrity (pre-reopen: zero pendings, all 599/early_bird).
  const pendings = await regs.find({ ...realRegistrationFilter, "payment.status": "payment_pending" }).project({ payment: 1 }).toArray();
  pass(
    "no unexpected pending rows",
    (pendings as Doc[]).every((r) => r.payment?.destination?.destinationId || r.payment?.pendingQRGeneration === true),
    `${pendings.length} pending`,
  );
  const nonHistorical = await regs.countDocuments({
    ...realRegistrationFilter,
    "payment.status": "verified",
    $or: [{ "payment.snapshot.expectedAmount": { $ne: 599 } }, { "payment.snapshot.pricingTier": { $ne: "early_bird" } }],
  });
  pass("historical 599/early_bird snapshots unchanged", nonHistorical === 0, String(nonHistorical));

  if (failures.length) {
    console.error(`[verify] RESULT FAIL (${failures.length}): ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("[verify] RESULT PASS — production ready for reopen decision");
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[verify] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
