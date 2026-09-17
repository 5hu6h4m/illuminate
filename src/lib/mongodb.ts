import "server-only";

import { GridFSBucket, MongoClient, type Collection, type Db } from "mongodb";
import type { RegistrationV2 } from "@/lib/registration-v2";

const uri = process.env.MONGODB_URI ?? "";
const dbName = process.env.MONGODB_DB_NAME ?? process.env.MONGODB_DB ?? "illuminate";

declare global {
  var __illuminateMongoClientPromise: Promise<MongoClient> | undefined;
  var __illuminateIndexesPromise: Promise<void> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;
function clientOptions() {
  return {
    // Burst-tuned for 100+ concurrent participants on serverless (Vercel):
    // each instance handles few requests, so keep per-instance pool modest to
    // avoid exhausting Atlas M0/M2 connection caps (500 max) when 100
    // requests fan out across instances. maxConnecting ramps fast for spikes.
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 20000,
    maxPoolSize: 15,
    minPoolSize: 1,
    maxIdleTimeMS: 30_000,
    maxConnecting: 5,
    retryWrites: true,
    retryReads: true,
  };
}
function getClientPromise(): Promise<MongoClient> {
  if (!uri) return Promise.reject(new Error("MONGODB_URI is not configured"));
  if (clientPromise) return clientPromise;
  if (process.env.NODE_ENV === "development") {
    global.__illuminateMongoClientPromise ??= new MongoClient(uri, clientOptions()).connect();
    clientPromise = global.__illuminateMongoClientPromise;
  } else clientPromise = new MongoClient(uri, clientOptions()).connect();
  // Avoid caching a rejected connection forever (serverless cold-start blips).
  clientPromise.catch(() => {
    clientPromise = undefined;
    if (process.env.NODE_ENV === "development") global.__illuminateMongoClientPromise = undefined;
  });
  return clientPromise;
}

export function isDbConfigured(): boolean { return Boolean(uri); }
export async function getDb(): Promise<Db> { return (await getClientPromise()).db(dbName); }
export async function getRegistrationsCollection(): Promise<Collection<RegistrationV2>> { return (await getDb()).collection<RegistrationV2>("registrations"); }
export async function getPaymentProofBucket(): Promise<GridFSBucket> { return new GridFSBucket(await getDb(), { bucketName: "payment_proofs" }); }

/** Idempotently creates schema-v2 indexes. Legacy documents never participate in these constraints. */
export async function ensurePaymentIndexes(): Promise<void> {
  if (global.__illuminateIndexesPromise) return global.__illuminateIndexesPromise;
  const task = (async () => {
    const db = await getDb();
    const registrations = db.collection<RegistrationV2>("registrations");
    const current = { schemaVersion: 2 } as const;
    // Early legacy versions used non-sparse root `id`/`email` unique indexes.
    // Schema-v2 records intentionally do not carry those fields, so MongoDB
    // treats every v2 document as the same null key. Replace only the exact
    // known legacy indexes with partial equivalents; never touch other indexes.
    const existingIndexes = await registrations.indexes();
    const replaceUnsafeLegacyIndex = async (name: "id_1" | "email_1", field: "id" | "email") => {
      const index = existingIndexes.find((candidate) => candidate.name === name);
      if (!index || !index.unique || index.sparse || index.partialFilterExpression || JSON.stringify(index.key) !== JSON.stringify({ [field]: 1 })) return;
      await registrations.dropIndex(name);
      await registrations.createIndex({ [field]: 1 }, {
        name: `legacy_${field}_unique`,
        unique: true,
        partialFilterExpression: { [field]: { $type: "string" } },
      });
    };
    await replaceUnsafeLegacyIndex("id_1", "id");
    await replaceUnsafeLegacyIndex("email_1", "email");
    // Defensive: any other unique index without a partial/sparse guard that
    // keys on a field v2 documents omit would collapse all participants into
    // one null key ("all users acting as the same entity"). Detect and warn
    // instead of silently failing every insert after the first.
    for (const candidate of existingIndexes) {
      if (!candidate.unique || candidate.sparse || candidate.partialFilterExpression) continue;
      if (typeof candidate.name === "string" && (candidate.name.startsWith("v2_") || candidate.name.startsWith("legacy_") || candidate.name === "_id_")) continue;
      const keys = Object.keys(candidate.key ?? {});
      // Heuristic: single-field unique indexes on legacy root fields are the
      // dangerous shape. Compound v2 indexes are always created with partial
      // filters above, so anything else unique + unguarded is suspect.
      if (keys.length === 1 && ["id", "email", "mobile", "phone", "publicId", "token"].includes(keys[0])) {
        console.error(`[registration_diagnostic] UNSAFE_LEGACY_INDEX_DETECTED ${String(candidate.name)} keys=${JSON.stringify(candidate.key)} — drop or convert to partial to unblock concurrent registrations.`);
      }
    }
    await Promise.all([
      registrations.createIndex({ publicId: 1 }, { name: "v2_public_id_unique", unique: true, partialFilterExpression: current }),
      registrations.createIndex({ eventKey: 1, "participant.normalizedEmail": 1 }, { name: "v2_event_email_unique", unique: true, partialFilterExpression: current }),
      registrations.createIndex({ eventKey: 1, "participant.normalizedPhone": 1 }, { name: "v2_event_phone_unique", unique: true, partialFilterExpression: current }),
      registrations.createIndex({ eventKey: 1, idempotencyKeyHash: 1 }, { name: "v2_idempotency_unique", unique: true, partialFilterExpression: current }),
      registrations.createIndex({ eventKey: 1, "payment.transactionReference": 1 }, { name: "v2_transaction_reference_unique", unique: true, partialFilterExpression: { schemaVersion: 2, "payment.transactionReference": { $exists: true } } }),
      registrations.createIndex({ "payment.status": 1, "payment.submittedAt": 1 }, { name: "v2_admin_queue", partialFilterExpression: current }),
      registrations.createIndex({ participantAccessTokenHash: 1 }, { name: "v2_access_token", unique: true, partialFilterExpression: current }),
      registrations.createIndex({ createdAt: -1 }, { name: "v2_created_at", partialFilterExpression: current }),
      db.collection("rate_limits").createIndex({ expiresAt: 1 }, { name: "rate_limit_expiry", expireAfterSeconds: 0 }),
      db.collection("rate_limits").createIndex({ key: 1 }, { name: "rate_limit_key", unique: true }),
      db.collection("admin_audit").createIndex({ at: -1 }, { name: "admin_audit_at" }),
      db.collection("admin_audit").createIndex({ type: 1, at: -1 }, { name: "admin_audit_type_at" }),
    ]);
  })();
  global.__illuminateIndexesPromise = task;
  // A transient index failure must not poison all later requests until redeploy.
  task.catch(() => {
    global.__illuminateIndexesPromise = undefined;
  });
  return task;
}
