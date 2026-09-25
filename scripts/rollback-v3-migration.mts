/**
 * Roll back the V3 capacity migration — BEFORE REOPEN ONLY.
 *
 * Permitted ONLY when ALL hold:
 *   - site_settings.manualClose === true (registrations still closed)
 *   - total real registrations unchanged vs the migration backup census
 *   - event_capacity.committedCount still equals live ground truth
 *     (no new QR commitments since migration)
 *   - live destination-backed counts still B9 / C10 / D10 / F0 / E12
 *     (F0 proves no QR was ever issued to Priyanka)
 *
 * If ANY V3 traffic occurred: REFUSE ROLLBACK (exit 1), never destructive.
 *
 * Restores (never touches registration rows):
 *   delete Priyanka · E seq5→4 cap30→20 · B cap20→10 · C cap20→10 ·
 *   B/C/D/E operational status fields from the migration backup (do not
 *   guess) · remove event_capacity when it did not exist before.
 *
 * Requires: --confirm --reason="<10-500 chars>" --backup="<migration backup path>"
 * plus --production when targeting illuminate. Single transaction; STOP when
 * transactions are unavailable.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/rollback-v3-migration.mts --dry-run --backup /tmp/xxx.json
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/rollback-v3-migration.mts --confirm --reason="..." --backup /tmp/xxx.json [--production]
 */
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { closeMongoConnection, getDb, getMongoClient, isDbConfigured } from "@/lib/mongodb";
import { EVENT_CAPACITY_ID, computeCommittedGroundTruth, type EventCapacityDoc } from "@/lib/event-capacity";
import { realRegistrationFilter } from "@/lib/registration-filters";
import type { RegistrationV2 } from "@/lib/registration-v2";
import type { SiteSettings } from "@/lib/site-settings";
import type { PaymentDestination } from "@/lib/payment-destinations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

const F_ID = "account-f-priyanka";
const EXPECTED_LIVE: Record<string, number> = {
  "account-b-shivam": 9,
  "account-c-bhushan": 10,
  "account-d-shubham": 10,
  [F_ID]: 0,
  "account-e-sneha": 12,
};

function safeHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//, "https://").replace(/^mongodb:\/\//, "https://")).hostname;
  } catch {
    return "unparseable";
  }
}

function argValue(argv: string[], name: string): string | null {
  const flag = `--${name}`;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && i + 1 < argv.length) return argv[i + 1];
    if (argv[i]?.startsWith(`${flag}=`)) return argv[i].slice(flag.length + 1);
  }
  return null;
}

async function run() {
  const argv = process.argv.slice(2);
  const confirm = argv.includes("--confirm");
  const production = argv.includes("--production");
  const reason = argValue(argv, "reason");
  const backupPath = argValue(argv, "backup");
  const fail = (message: string): never => {
    console.error(`[rollback] REFUSED: ${message}`);
    process.exit(1);
  };
  if (!isDbConfigured()) {
    console.error("[rollback] MONGODB_URI is not configured.");
    process.exit(1);
  }
  if (confirm && (!reason || reason.trim().length < 10 || reason.trim().length > 500)) {
    fail("--confirm requires --reason (10–500 characters) for the audit log.");
  }
  if (confirm && !backupPath) fail("--confirm requires --backup <migration backup path> (pre-migration state is restored from backup, never guessed).");
  let backup: Doc | null = null;
  if (backupPath) {
    try {
      backup = JSON.parse(readFileSync(backupPath, "utf8")) as Doc;
    } catch {
      fail(`cannot read backup file ${backupPath}.`);
    }
    if (!Array.isArray(backup?.paymentDestinations)) fail("backup file lacks paymentDestinations.");
  }

  const uri = process.env.MONGODB_URI ?? "";
  const db = await getDb();
  await db.command({ ping: 1 });
  const dbName = db.databaseName;
  const isProd = dbName === "illuminate";
  console.log(`[rollback] database name: ${dbName}`);
  console.log(`[rollback] cluster host: ${safeHost(uri)}`);
  if (confirm && isProd && !production) fail("writes to production illuminate require explicit --production.");

  const regs = db.collection<RegistrationV2>("registrations");
  const dests = db.collection<PaymentDestination>("payment_destinations");

  // ---------- rollback preconditions (read-only) ----------
  const site = await db.collection<SiteSettings>("site_settings").findOne({ _id: "registration" });
  if (site?.manualClose !== true) fail("manualClose is not true (registrations must stay closed for rollback).");
  const total = await regs.countDocuments({ ...realRegistrationFilter });
  const backupTotal = backup?.census?.total as number | undefined;
  if (typeof backupTotal === "number" && total !== backupTotal) {
    fail(`total real registrations changed since migration (now=${total}, backup=${backupTotal}) — V3 traffic occurred.`);
  }
  const allRegs = await regs.find({ ...realRegistrationFilter }).project({ payment: 1 }).toArray();
  const truth = computeCommittedGroundTruth(
    allRegs as Array<{ payment: { status: string; destination?: { destinationId?: string } | null } }>,
  );
  const cap = await db.collection<EventCapacityDoc>("event_capacity").findOne({ _id: EVENT_CAPACITY_ID });
  if (!cap) fail("event_capacity is absent (nothing migrated to roll back).");
  const capDoc: Doc = cap as Doc;
  if (capDoc.committedCount !== truth) fail(`event counter diverged from ground truth (committed=${capDoc.committedCount}, truth=${truth}).`);
  if (capDoc.committedCount !== 90 || truth !== 90) {
    fail(`event committedCount/ground truth is ${capDoc.committedCount}/${truth}, expected 90/90 — V3 traffic occurred.`);
  }
  const grouped = await regs
    .aggregate<{ _id: string | null; count: number }>([
      { $match: realRegistrationFilter },
      { $group: { _id: "$payment.destination.destinationId", count: { $sum: 1 } } },
    ])
    .toArray();
  const live = new Map<string, number>();
  for (const row of grouped) if (typeof row._id === "string" && row._id) live.set(row._id, row.count);
  for (const [id, want] of Object.entries(EXPECTED_LIVE)) {
    if ((live.get(id) ?? 0) !== want) fail(`live count on ${id} is ${live.get(id) ?? 0}, expected ${want} — V3 traffic occurred.`);
  }
  const fRefs = (live.get(F_ID) ?? 0) > 0;
  if (fRefs) fail("registrations reference Priyanka — V3 traffic occurred.");
  const fDoc = await dests.findOne({ destinationId: F_ID });
  if (!fDoc) fail("Priyanka destination missing (nothing migrated to roll back).");
  const fAssigned: number = fDoc?.assignedCount ?? -1;
  if (fAssigned !== 0) fail(`Priyanka assignedCount is ${fAssigned}, expected 0 — V3 traffic occurred.`);

  const backupById = new Map<string, Doc>((backup?.paymentDestinations as Doc[]).map((d) => [d.destinationId as string, d]));
  for (const id of ["account-a-yash", "account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"]) {
    if (!backupById.has(id)) fail(`backup lacks pre-migration state for ${id}.`);
  }
  const hadEventCapacityBefore = backup?.eventCapacity != null;

  console.log(`[rollback] preconditions hold: closed, total=${total}, truth=${truth}, committed=${capDoc.committedCount}, F unused.`);
  console.log(`[rollback] plan: delete Priyanka · E seq5→4 cap30→20 · B cap→10 · C cap→10 · restore B/C/D/E status fields from backup · ${hadEventCapacityBefore ? "keep event_capacity" : "remove event_capacity"}.`);
  console.log(`[rollback] backup pre-migration statuses: ${["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"].map((id) => `${id}=${backupById.get(id)?.status}`).join(", ")}`);
  if (!confirm) {
    console.log("[rollback] DRY RUN ONLY — ZERO WRITES");
    return;
  }

  // ---------- transaction ----------
  const client: MongoClient = await getMongoClient();
  const session = client.startSession();
  const now = new Date();
  try {
    await session.withTransaction(async () => {
      const liveTotal = await regs.countDocuments({ ...realRegistrationFilter }, { session });
      if (liveTotal !== total) throw new Error(`PRECONDITION total changed inside transaction (${liveTotal}).`);
      const fCheck = (await dests.findOne({ destinationId: F_ID }, { session })) as Doc | null;
      if (!fCheck || (fCheck.assignedCount ?? 0) !== 0) throw new Error("PRECONDITION Priyanka changed inside transaction.");
      await dests.deleteOne({ destinationId: F_ID, assignedCount: 0 }, { session });
      for (const id of ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"] as const) {
        const pre = backupById.get(id)!;
        const restore: Doc = {
          capacity: pre.capacity,
          sequence: pre.sequence,
          status: pre.status,
          ownerApproved: pre.ownerApproved,
          allowNewAssignments: pre.allowNewAssignments,
          updatedAt: now,
        };
        for (const ts of ["activatedAt", "exhaustedAt", "disabledAt"] as const) {
          if (pre[ts] !== undefined && pre[ts] !== null) restore[ts] = pre[ts];
        }
        await dests.updateOne({ destinationId: id }, { $set: restore } as never, { session });
      }
      // Absent pre-migration timestamps must stay absent (not empty strings).
      for (const id of ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"] as const) {
        const pre = backupById.get(id)!;
        const unset: Doc = {};
        for (const ts of ["activatedAt", "exhaustedAt", "disabledAt"] as const) {
          if (pre[ts] === undefined || pre[ts] === null) unset[ts] = "";
        }
        if (Object.keys(unset).length) await dests.updateOne({ destinationId: id }, { $unset: unset } as never, { session });
      }
      if (!hadEventCapacityBefore) {
        await db.collection<EventCapacityDoc>("event_capacity").deleteOne({ _id: EVENT_CAPACITY_ID }, { session });
      }
      await db.collection("admin_audit").insertOne(
        { type: "v3_migration_rolled_back", actor: "admin", at: now, metadata: { reason: reason!.trim(), restoredFromBackup: true } },
        { session },
      );
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession().catch(() => undefined);
  }

  // ---------- post-rollback verification ----------
  const errors: string[] = [];
  const afterF = await dests.findOne({ destinationId: F_ID });
  if (afterF) errors.push("Priyanka still present after rollback");
  for (const id of ["account-b-shivam", "account-c-bhushan", "account-d-shubham", "account-e-sneha"] as const) {
    const pre = backupById.get(id)!;
    const cur = (await dests.findOne({ destinationId: id })) as Doc | null;
    for (const k of ["capacity", "sequence", "status", "ownerApproved", "allowNewAssignments"] as const) {
      if (cur?.[k] !== pre[k]) errors.push(`${id}.${k}: got ${JSON.stringify(cur?.[k])}, want backup ${JSON.stringify(pre[k])}`);
    }
  }
  const capAfter = await db.collection<EventCapacityDoc>("event_capacity").findOne({ _id: EVENT_CAPACITY_ID });
  if (!hadEventCapacityBefore && capAfter) errors.push("event_capacity still present after rollback");
  const truthAfterRegs = await regs.find({ ...realRegistrationFilter }).project({ publicId: 1 }).toArray();
  if (truthAfterRegs.length !== total) errors.push(`registration count changed during rollback (${truthAfterRegs.length} vs ${total})`);
  if (errors.length) {
    console.error(`[rollback] POST-ROLLBACK VERIFICATION FAILED (${errors.length}):`);
    for (const e of errors) console.error(`[rollback]   - ${e}`);
    process.exit(1);
  }
  console.log("[rollback] ROLLBACK COMPLETE — pre-migration state restored, verification passed");
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[rollback] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
