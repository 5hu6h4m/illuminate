import { NextResponse } from "next/server";
import { generateRegId, type Registration } from "@/lib/registration";
import { CreateRegistrationSchema } from "@/lib/registration-schema";
import { getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";

type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

// --- Minimal brute-force guard for the passcode-only admin gate ---
// NOTE: in-memory only (resets on redeploy / per serverless instance).
// Behind multiple instances use a shared store (e.g. Upstash) instead.
const ADMIN_FAILS = new Map<string, { count: number; resetAt: number }>();
const ADMIN_MAX_FAILS = 10;
const ADMIN_WINDOW_MS = 15 * 60 * 1000;

function adminRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ADMIN_FAILS.get(ip);
  if (!entry) return false;
  if (now > entry.resetAt) {
    ADMIN_FAILS.delete(ip);
    return false;
  }
  return entry.count >= ADMIN_MAX_FAILS;
}

function recordAdminFail(ip: string): void {
  const now = Date.now();
  const entry = ADMIN_FAILS.get(ip);
  if (!entry || now > entry.resetAt) {
    ADMIN_FAILS.set(ip, { count: 1, resetAt: now + ADMIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearAdminFails(ip: string): void {
  ADMIN_FAILS.delete(ip);
}

const err = (status: number, code: string, message: string, details?: unknown) =>
  NextResponse.json<ApiError>({ error: { code, message, details } }, { status });

function sanitize(row: Record<string, unknown>): Registration {
  const { _id: _ignored, ...rest } = row;
  void _ignored;
  return rest as unknown as Registration;
}

// POST /api/registrations — create a registration (validated at boundary)
export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return err(503, "DB_NOT_CONFIGURED", "Database is not configured. Set MONGODB_URI.");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = CreateRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return err(422, "VALIDATION_ERROR", "Invalid registration data.", parsed.error.flatten());
  }

  try {
    const col = await getRegistrationsCollection();

    // Idempotency: same email re-submitting returns the existing record (409).
    const existing = await col.findOne({ email: parsed.data.email });
    if (existing) {
      return NextResponse.json(
        { error: { code: "DUPLICATE_EMAIL", message: "This email is already registered.", data: sanitize(existing) } },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const reg: Registration = {
        ...parsed.data,
        id: generateRegId(),
        createdAt: now,
      };
      try {
        await col.insertOne({ ...reg, _createdAt: new Date(now) });
        return NextResponse.json({ data: reg }, { status: 201 });
      } catch (e: unknown) {
        const code = (e as { code?: number })?.code;
        // 11000 = duplicate key (reg-id collision) → retry with a fresh id
        if (code === 11000 && attempt < 2) continue;
        if (code === 11000) {
          return err(409, "DUPLICATE", "Duplicate registration. Please retry.");
        }
        throw e;
      }
    }
    return err(500, "REG_ID_COLLISION", "Could not issue a registration ID. Please retry.");
  } catch (e) {
    console.error("[api/registrations POST]", e);
    return err(500, "SERVER_ERROR", "Could not save registration. Please try again.");
  }
}

// GET /api/registrations?id=ILL-... → single record (for success page)
// GET /api/registrations → full list, passcode-only admin gate (no email)
export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return err(503, "DB_NOT_CONFIGURED", "Database is not configured. Set MONGODB_URI.");
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  // Passcode-only gate (no email): dashboard sends it as ?key= or
  // `Authorization: Bearer <passcode>`. Never log the received value.
  const headerKey = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = url.searchParams.get("key") ?? headerKey;

  try {
    const col = await getRegistrationsCollection();

    if (id) {
      const found = await col.findOne({ id });
      if (!found) return err(404, "NOT_FOUND", "Registration not found.");
      return NextResponse.json({ data: sanitize(found) });
    }

    const expected = process.env.ADMIN_PASSCODE;
    if (!expected) {
      return err(503, "ADMIN_NOT_CONFIGURED", "Admin access is not configured on the server.");
    }
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (adminRateLimited(ip)) {
      return err(429, "RATE_LIMITED", "Too many attempts. Try again in 15 minutes.");
    }
    if (!key || key !== expected) {
      recordAdminFail(ip);
      return err(401, "UNAUTHORIZED", "Wrong passcode.");
    }
    clearAdminFails(ip);
    const rows = await col.find({}).sort({ _id: -1 }).limit(2000).toArray();
    return NextResponse.json({
      data: rows.map(sanitize),
      pagination: { totalItems: rows.length },
    });
  } catch (e) {
    console.error("[api/registrations GET]", e);
    return err(500, "SERVER_ERROR", "Could not fetch registrations.");
  }
}
