import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string, init: { retryAfterSeconds?: number } = {}) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (typeof init.retryAfterSeconds === "number" && Number.isFinite(init.retryAfterSeconds)) {
    headers["Retry-After"] = String(Math.max(1, Math.floor(init.retryAfterSeconds)));
  }
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export function sensitiveJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, private");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return NextResponse.json({ data }, { ...init, headers });
}

export function clientIp(request: Request): string {
  // 500+ participants often share 1-2 egress IPs (college / carrier NAT), so
  // the extracted IP must be the real client, never a proxy address. Prefer
  // platform-specific headers when present (Vercel, Cloudflare), then fall
  // back to the left-most *valid* X-Forwarded-For entry. Truncate to avoid
  // unbounded key growth in rate-limit buckets.
  const candidates: Array<string | null> = [
    request.headers.get("x-real-ip")?.trim() ?? null,
    request.headers.get("cf-connecting-ip")?.trim() ?? null,
    request.headers.get("x-vercel-forwarded-for")?.trim()?.split(",")[0]?.trim() ?? null,
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate === "unknown" || candidate.length > 64) continue;
    // Accept IPv4 / IPv6 / hostname-ish tokens; reject obvious proxy junk.
    if (/^[a-zA-Z0-9:._-]{3,64}$/.test(candidate)) return candidate.slice(0, 64);
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).find((part) => part && part !== "unknown");
  if (forwarded) return forwarded.slice(0, 64);
  return "unknown";
}

export function isSharedNetworkIp(ip: string): boolean {
  return !ip || ip === "unknown";
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
