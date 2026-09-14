import "server-only";

import { createHash } from "crypto";
import { ensurePaymentIndexes, getDb } from "@/lib/mongodb";

export async function enforceRateLimit(scope: string, identity: string, maximum: number, windowMs: number): Promise<boolean> {
  await ensurePaymentIndexes();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const key = `${scope}:${createHash("sha256").update(identity).digest("hex")}`;
  const collection = (await getDb()).collection("rate_limits");
  // Reset only an expired counter. Extending `expiresAt` on every request
  // would make a short fixed window behave like an unbounded rolling lockout.
  await collection.updateOne({ key, expiresAt: { $lte: now } }, { $set: { count: 0, expiresAt, createdAt: now } });
  const result = await collection.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { key, expiresAt, createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  return (result?.count as number | undefined ?? maximum + 1) <= maximum;
}
