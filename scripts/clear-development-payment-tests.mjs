import { MongoClient, ObjectId } from "mongodb";

if (process.env.NODE_ENV === "production" || process.env.REGISTRATION_PREVIEW !== "1" || process.env.PAYMENT_UI_PREVIEW !== "1" || process.env.PAYMENT_E2E_PREVIEW !== "1") {
  throw new Error("This cleanup command requires all development preview flags and cannot run in production.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db(process.env.MONGODB_DB_NAME || process.env.MONGODB_DB || "illuminate");
  const registrations = db.collection("registrations");
  const records = await registrations.find({ schemaVersion: 2, isTest: true, environment: "development" }, { projection: { "payment.proofHistory.fileId": 1 } }).toArray();
  const ids = records.flatMap((record) => (record.payment?.proofHistory ?? []).map((proof) => proof.fileId).filter((id) => id && ObjectId.isValid(id)).map((id) => new ObjectId(id)));
  if (ids.length) {
    await db.collection("payment_proofs.chunks").deleteMany({ files_id: { $in: ids } });
    await db.collection("payment_proofs.files").deleteMany({ _id: { $in: ids } });
  }
  const result = await registrations.deleteMany({ schemaVersion: 2, isTest: true, environment: "development" });
  console.log(`Deleted ${result.deletedCount} development payment test registration(s) and ${ids.length} referenced proof file(s).`);
} finally { await client.close(); }
