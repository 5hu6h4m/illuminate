import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "illuminate_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
function secret(): string | null { return process.env.ADMIN_SESSION_SECRET?.trim() || null; }

export function verifyAdminPassword(password: string): boolean {
  const configured = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!configured) return false;
  const [kind, salt, encodedHash] = configured.split(/[$:]/);
  if (kind !== "scrypt" || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function sign(payload: string): string { return createHmac("sha256", secret()!).update(payload).digest("base64url"); }
export function createAdminSession(): string | null {
  if (!secret()) return null;
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS, nonce: randomBytes(16).toString("base64url") })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function verifyAdminSession(value: string | undefined): boolean {
  if (!value || !secret()) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { return (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number }).exp! > Math.floor(Date.now() / 1000); } catch { return false; }
}
export async function isAdminAuthenticated(): Promise<boolean> { return verifyAdminSession((await cookies()).get(COOKIE)?.value); }
export function adminCookieOptions() { return { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS }; }
export function adminCookieName(): string { return COOKIE; }
