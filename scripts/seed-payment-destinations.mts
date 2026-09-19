/**
 * Idempotent seed for the STRICT 10-slot payment capacity system.
 *
 * Seeds exactly:
 *   A disabled (capacity 0)
 *   B active (capacity 10)
 *   C available (capacity 10)
 *   D available (capacity 10)
 *   E available (capacity 10)
 *
 * Counts are NEVER blindly reset to zero: existing production
 * registrations with payment.destination are audited and assignedCount is
 * raised to at least the observed count. Ambiguous legacy records
 * (Account A snapshot without destination) are reported, never overwritten.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local --import ./scripts/register-dev-ts-loader.mjs scripts/seed-payment-destinations.mts
 */
import { closeMongoConnection, getDb, getPaymentDestinationsCollection, isDbConfigured } from "@/lib/mongodb";
import { LEGACY_UPI_TO_DESTINATION_ID, PAYMENT_DESTINATION_SEEDS } from "@/lib/payment-destinations";
import { realRegistrationFilter } from "@/lib/registration-filters";

async function run() {
  if (!isDbConfigured()) {
    console.error("[seed] MONGODB_URI is not configured.");
    process.exit(1);
  }
  const db = await getDb();
  await db.command({ ping: 1 });
  const destinations = await getPaymentDestinationsCollection();
  await Promise.all([
    destinations.createIndex({ destinationId: 1 }, { name: "dest_id_unique", unique: true }),
    destinations.createIndex({ sequence: 1 }, { name: "dest_sequence", unique: true }),
    destinations.createIndex({ status: 1, sequence: 1 }, { name: "dest_status_sequence" }),
  ]);

  const registrations = db.collection("registrations");
  const existing = await registrations.find({ ...realRegistrationFilter }).project({ publicId: 1, payment: 1 }).toArray();

  const observedByDestination = new Map<string, number>();
  let legacyAccountACount = 0;
  let legacyUnknownCount = 0;
  const ambiguous: string[] = [];
  for (const reg of existing as Array<{ publicId: string; payment?: { destination?: { destinationId?: string }; snapshot?: { upiId?: string }; status?: string } }>) {
    const destId = reg.payment?.destination?.destinationId;
    if (destId) {
      observedByDestination.set(destId, (observedByDestination.get(destId) ?? 0) + 1);
      continue;
    }
    const upi = reg.payment?.snapshot?.upiId?.trim();
    const mapped = upi ? LEGACY_UPI_TO_DESTINATION_ID[upi] : null;
    if (mapped === "account-a-yash") {
      legacyAccountACount += 1;
      if (reg.payment?.status === "payment_pending") ambiguous.push(`${reg.publicId} (Account A pending — needs manual reassignment)`);
    } else if (mapped) {
      observedByDestination.set(mapped, (observedByDestination.get(mapped) ?? 0) + 1);
      ambiguous.push(`${reg.publicId} (legacy snapshot ${upi} → ${mapped}, no destination snapshot)`);
    } else {
      legacyUnknownCount += 1;
      ambiguous.push(`${reg.publicId} (unknown snapshot upi ${upi ?? "missing"})`);
    }
  }

  const now = new Date();
  for (const seed of PAYMENT_DESTINATION_SEEDS) {
    const current = await destinations.findOne({ destinationId: seed.destinationId });
    const observed = observedByDestination.get(seed.destinationId) ?? 0;
    if (!current) {
      await destinations.insertOne({
        ...seed,
        assignedCount: observed,
        createdAt: now,
        updatedAt: now,
        ...(seed.status === "active" ? { activatedAt: now } : {}),
        ...(seed.status === "disabled" ? { disabledAt: now } : {}),
      });
      console.log(`[seed] INSERT ${seed.destinationId} status=${seed.status} assignedCount=${observed}`);
      continue;
    }
    // Never blindly reset counts: raise to observed if production history exceeds stored count.
    const nextCount = Math.max(current.assignedCount ?? 0, observed);
    const update: Record<string, unknown> = { updatedAt: now };
    // Preserve operational status transitions (exhausted/disabled) — only
    // enforce the canonical initial status when the doc is still fresh (0 assigned, no timestamps).
    const isFresh = (current.assignedCount ?? 0) === 0 && !current.exhaustedAt && !current.disabledAt && !current.activatedAt;
    if (nextCount !== current.assignedCount) update.assignedCount = nextCount;
    if (isFresh) {
      update.status = seed.status;
      update.ownerApproved = seed.ownerApproved;
      update.allowNewAssignments = seed.allowNewAssignments;
      update.capacity = seed.capacity;
      update.payeeName = seed.payeeName;
      update.upiId = seed.upiId;
      update.internalLabel = seed.internalLabel;
      update.sequence = seed.sequence;
    } else {
      // Always refresh payee details (authoritative), never clobber status.
      update.payeeName = seed.payeeName;
      update.upiId = seed.upiId;
      update.internalLabel = seed.internalLabel;
    }
    // Auto-mark over-capacity docs exhausted (defensive; normal path marks on claim).
    if (nextCount >= (current.capacity ?? seed.capacity) && seed.destinationId !== "account-a-yash" && current.status === "active") {
      update.status = "exhausted";
      update.allowNewAssignments = false;
      update.exhaustedAt = now;
    }
    await destinations.updateOne({ destinationId: seed.destinationId }, { $set: update });
    console.log(`[seed] KEEP ${seed.destinationId} status=${isFresh ? seed.status : current.status} assignedCount=${nextCount} (observed=${observed})`);
  }

  // Ensure exactly one active destination when capacity remains (B → C → D → E).
  const all = await destinations.find({}).sort({ sequence: 1 }).toArray();
  const approved = all.filter((d) => d.destinationId !== "account-a-yash");
  const hasActive = approved.some((d) => d.status === "active" && d.assignedCount < d.capacity);
  const allFull = approved.every((d) => d.assignedCount >= d.capacity || d.status === "exhausted" || d.status === "disabled");
  if (!hasActive && !allFull) {
    const next = approved.filter((d) => d.status === "available" && d.ownerApproved && d.assignedCount < d.capacity).sort((a, b) => a.sequence - b.sequence)[0];
    if (next) {
      await destinations.updateOne({ destinationId: next.destinationId }, { $set: { status: "active", activatedAt: now, updatedAt: now } });
      console.log(`[seed] ACTIVATE ${next.destinationId} (no active destination found)`);
    }
  }

  console.log(`[seed] production registrations scanned: ${existing.length}`);
  console.log(`[seed] observed destination counts: ${JSON.stringify(Object.fromEntries(observedByDestination))}`);
  console.log(`[seed] legacy Account A records: ${legacyAccountACount} (historical preserved, never auto-migrated)`);
  console.log(`[seed] unknown legacy records: ${legacyUnknownCount}`);
  if (ambiguous.length) {
    console.log(`[seed] ambiguous legacy records (${ambiguous.length}):`);
    for (const line of ambiguous.slice(0, 50)) console.log(`[seed]   - ${line}`);
    if (ambiguous.length > 50) console.log(`[seed]   ... and ${ambiguous.length - 50} more`);
  }
  const final = await destinations.find({}).sort({ sequence: 1 }).toArray();
  console.log("[seed] final destinations:");
  for (const d of final) console.log(`[seed]   ${d.destinationId} seq=${d.sequence} status=${d.status} ${d.assignedCount}/${d.capacity} approved=${d.ownerApproved} allow=${d.allowNewAssignments}`);
}

void run()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error("[seed] FAILED", error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
