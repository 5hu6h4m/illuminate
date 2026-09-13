import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "";
const dbName = process.env.MONGODB_DB ?? "illuminate";

if (!uri && process.env.NODE_ENV === "production") {
  console.warn("[mongodb] MONGODB_URI is not set — API routes will return 503.");
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(new Error("MONGODB_URI is not configured"));
  }
  if (clientPromise) return clientPromise;
  if (process.env.NODE_ENV === "development") {
    if (!global.__mongoClientPromise) {
      const client = new MongoClient(uri);
      global.__mongoClientPromise = client.connect();
    }
    clientPromise = global.__mongoClientPromise;
  } else {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

export async function getRegistrationsCollection() {
  const db = await getDb();
  const col = db.collection("registrations");
  // Best-effort indexes; safe to call on every request.
  try {
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ email: 1 }, { unique: true });
    await col.createIndex({ createdAt: -1 });
  } catch {
    /* index build races are harmless */
  }
  return col;
}

export function isDbConfigured(): boolean {
  return Boolean(uri);
}
