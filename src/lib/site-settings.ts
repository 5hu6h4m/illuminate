import "server-only";

import { getDb, isDbConfigured } from "@/lib/mongodb";

export const SITE_SETTINGS_ID = "registration" as const;

export type SiteSettings = {
  _id: typeof SITE_SETTINGS_ID;
  manualClose: boolean;
  updatedAt: Date;
  updatedBy: string;
};

/**
 * Single-document site settings store. Only `manualClose` is used today:
 * when true, new registrations are force-closed by admin override even
 * inside the scheduled date window. Login / status / proof flows are
 * never gated by this flag.
 */
export async function isRegistrationManuallyClosed(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const db = await getDb();
    const doc = await db
      .collection<SiteSettings>("site_settings")
      .findOne({ _id: SITE_SETTINGS_ID }, { projection: { manualClose: 1 } });
    return doc?.manualClose === true;
  } catch {
    // Fail open to date-based logic: a transient DB blip must not
    // flip the landing page to closed on its own.
    return false;
  }
}

export async function getRegistrationManualClose(): Promise<{ manualClose: boolean; updatedAt: Date | null }> {
  if (!isDbConfigured()) return { manualClose: false, updatedAt: null };
  try {
    const db = await getDb();
    const doc = await db.collection<SiteSettings>("site_settings").findOne({ _id: SITE_SETTINGS_ID });
    return { manualClose: doc?.manualClose === true, updatedAt: doc?.updatedAt ?? null };
  } catch {
    return { manualClose: false, updatedAt: null };
  }
}

export async function setRegistrationManualClose(
  closed: boolean,
  actor = "admin",
): Promise<{ manualClose: boolean; updatedAt: Date }> {
  const db = await getDb();
  const now = new Date();
  await db.collection<SiteSettings>("site_settings").updateOne(
    { _id: SITE_SETTINGS_ID },
    { $set: { manualClose: closed, updatedAt: now, updatedBy: actor } },
    { upsert: true },
  );
  try {
    await db
      .collection("admin_audit")
      .insertOne({ type: "registration_toggle", actor, at: now, metadata: { closed } });
  } catch {
    // Audit is best-effort; the toggle already committed.
  }
  return { manualClose: closed, updatedAt: now };
}
