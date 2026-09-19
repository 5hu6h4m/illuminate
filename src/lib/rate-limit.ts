import "server-only";

import { createHash } from "crypto";
import { ensurePaymentIndexes, getDb } from "@/lib/mongodb";

/**
 * Rate-limit policy tuned for 500+ participants behind college / carrier NAT.
 *
 * A single public IP may legitimately represent an entire classroom, so the
 * shared-IP bucket must be a burst guard (high), never the per-participant
 * quota. Per-participant abuse is enforced with a second, identity-scoped
 * bucket (email / phone / token / publicId hash).
 */
export const REGISTRATION_CREATE_IP_LIMIT = 180;
export const REGISTRATION_CREATE_IP_WINDOW_MS = 10 * 60_000;
export const REGISTRATION_CREATE_IDENTITY_LIMIT = 5;
export const REGISTRATION_CREATE_IDENTITY_WINDOW_MS = 60 * 60_000;
export const RECOVERY_IP_LIMIT = 30;
export const RECOVERY_IP_WINDOW_MS = 15 * 60_000;
export const RECOVERY_IDENTITY_LIMIT = 8;
export const RECOVERY_IDENTITY_WINDOW_MS = 15 * 60_000;
export const ADMIN_DELETE_IP_LIMIT = 120;
export const ADMIN_DELETE_IP_WINDOW_MS = 15 * 60_000;
export const ADMIN_DELETE_IDENTITY_LIMIT = 5;
export const ADMIN_DELETE_IDENTITY_WINDOW_MS = 15 * 60_000;
export const ADMIN_ECELL_IP_LIMIT = 120;
export const ADMIN_ECELL_IP_WINDOW_MS = 15 * 60_000;
export const ADMIN_ECELL_IDENTITY_LIMIT = 10;
export const ADMIN_ECELL_IDENTITY_WINDOW_MS = 15 * 60_000;

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

/**
 * Dual-bucket creation guard: a generous shared-IP burst allowance plus a
 * strict per-identity quota. Returns `{ ok, retryAfterSeconds }` so callers
 * can emit `Retry-After` instead of collapsing into a generic 503.
 */
export async function enforceRegistrationCreationRateLimit(input: { ip: string; email: string; phone: string }): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const ipWindow = REGISTRATION_CREATE_IP_WINDOW_MS;
  const identityWindow = REGISTRATION_CREATE_IDENTITY_WINDOW_MS;
  // Unknown IPs (stripped proxy headers) must never share one tiny bucket
  // across all participants. Skip the IP bucket and rely on identity only.
  if (input.ip && input.ip !== "unknown") {
    const ipOk = await enforceRateLimit("pending-registration-ip", input.ip, REGISTRATION_CREATE_IP_LIMIT, ipWindow);
    if (!ipOk) return { ok: false, retryAfterSeconds: Math.ceil(ipWindow / 1000) };
  }
  // Enforce email + phone as two independent identity buckets using distinct scopes.
  // Run in parallel: under 100-concurrent burst this halves identity-check latency.
  const [emailAllowed, phoneAllowed] = await Promise.all([
    enforceRateLimit("pending-registration-per-email", `email:${input.email}`, REGISTRATION_CREATE_IDENTITY_LIMIT, identityWindow),
    enforceRateLimit("pending-registration-per-phone", `phone:${input.phone}`, REGISTRATION_CREATE_IDENTITY_LIMIT, identityWindow),
  ]);
  if (!emailAllowed || !phoneAllowed) return { ok: false, retryAfterSeconds: Math.ceil(identityWindow / 1000) };
  return { ok: true, retryAfterSeconds: 0 };
}

export async function enforceRecoveryRateLimit(input: { ip: string; identity?: string; publicId?: string }): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  if (input.ip && input.ip !== "unknown") {
    const ipOk = await enforceRateLimit("recovery-ip", input.ip, RECOVERY_IP_LIMIT, RECOVERY_IP_WINDOW_MS);
    if (!ipOk) return { ok: false, retryAfterSeconds: Math.ceil(RECOVERY_IP_WINDOW_MS / 1000) };
  }
  // Contact-based bucket: caller passes normalized identifier (email lowercased,
  // phone digits, or publicId uppercased). Backward compat: `publicId` alias.
  const rawIdentity = (input.identity ?? input.publicId ?? "").trim();
  if (!rawIdentity) return { ok: true, retryAfterSeconds: 0 };
  const normalizedIdentity = rawIdentity.toLowerCase();
  const idOk = await enforceRateLimit("recovery-per-id", `login:${normalizedIdentity}`, RECOVERY_IDENTITY_LIMIT, RECOVERY_IDENTITY_WINDOW_MS);
  if (!idOk) return { ok: false, retryAfterSeconds: Math.ceil(RECOVERY_IDENTITY_WINDOW_MS / 1000) };
  return { ok: true, retryAfterSeconds: 0 };
}

export async function enforceAdminDeleteRateLimit(input: { ip: string; publicId: string }): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  if (input.ip && input.ip !== "unknown") {
    const ipOk = await enforceRateLimit("admin-delete-ip", input.ip, ADMIN_DELETE_IP_LIMIT, ADMIN_DELETE_IP_WINDOW_MS);
    if (!ipOk) return { ok: false, retryAfterSeconds: Math.ceil(ADMIN_DELETE_IP_WINDOW_MS / 1000) };
  }
  const idOk = await enforceRateLimit("admin-delete-per-id", `publicId:${input.publicId.toUpperCase()}`, ADMIN_DELETE_IDENTITY_LIMIT, ADMIN_DELETE_IDENTITY_WINDOW_MS);
  if (!idOk) return { ok: false, retryAfterSeconds: Math.ceil(ADMIN_DELETE_IDENTITY_WINDOW_MS / 1000) };
  return { ok: true, retryAfterSeconds: 0 };
}

export async function enforceAdminEcellRateLimit(input: { ip: string; publicId: string }): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  if (input.ip && input.ip !== "unknown") {
    const ipOk = await enforceRateLimit("admin-ecell-ip", input.ip, ADMIN_ECELL_IP_LIMIT, ADMIN_ECELL_IP_WINDOW_MS);
    if (!ipOk) return { ok: false, retryAfterSeconds: Math.ceil(ADMIN_ECELL_IP_WINDOW_MS / 1000) };
  }
  const idOk = await enforceRateLimit("admin-ecell-per-id", `publicId:${input.publicId.toUpperCase()}`, ADMIN_ECELL_IDENTITY_LIMIT, ADMIN_ECELL_IDENTITY_WINDOW_MS);
  if (!idOk) return { ok: false, retryAfterSeconds: Math.ceil(ADMIN_ECELL_IDENTITY_WINDOW_MS / 1000) };
  return { ok: true, retryAfterSeconds: 0 };
}
