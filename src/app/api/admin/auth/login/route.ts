import { cookies } from "next/headers";
import { z } from "zod";
import { adminCookieName, adminCookieOptions, createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { apiError, clientIp, isSameOrigin, sensitiveJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDb, isDbConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";
const Body = z.object({ password: z.string().min(1).max(1024) }).strict();
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "UNAUTHORIZED", "Unauthorized.");
  // Pre-auth responses stay generic so unauthenticated callers cannot
  // fingerprint server configuration; specifics go to server logs only.
  if (!isDbConfigured()) {
    console.error("[admin-login] ADMIN_DB_NOT_CONFIGURED");
    return apiError(503, "ADMIN_UNAVAILABLE", "Admin is temporarily unavailable. Retry in a minute.");
  }
  try {
    const ip = clientIp(request);
    if (!await enforceRateLimit("admin-login", ip, 8, 15 * 60_000)) return apiError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
    const parsed = Body.safeParse(await request.json());
    const accepted = parsed.success && verifyAdminPassword(parsed.data.password);
    await (await getDb()).collection("admin_audit").insertOne({ type: accepted ? "admin_login_success" : "admin_login_failed", actor: "admin", at: new Date(), metadata: { ipHashPresent: Boolean(ip && ip !== "unknown") } });
    if (!accepted) return apiError(401, "UNAUTHORIZED", "Invalid credentials.");
    const session = createAdminSession();
    if (!session) {
      console.error("[admin-login] ADMIN_AUTH_NOT_CONFIGURED");
      return apiError(503, "ADMIN_UNAVAILABLE", "Admin is temporarily unavailable. Retry in a minute.");
    }
    (await cookies()).set(adminCookieName(), session, adminCookieOptions());
    return sensitiveJson({ authenticated: true });
  } catch {
    console.error("[admin-login] ADMIN_REQUEST_FAILED");
    return apiError(503, "ADMIN_UNAVAILABLE", "Admin is temporarily unavailable. Retry in a minute.");
  }
}
