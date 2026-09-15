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
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    maxPoolSize: 10,
    retryWrites: true,
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
    ]);
  })();
  global.__illuminateIndexesPromise = task;
  // A transient index failure must not poison all later requests until redeploy.
  task.catch(() => {
    global.__illuminateIndexesPromise = undefined;
  });
  return task;
}
