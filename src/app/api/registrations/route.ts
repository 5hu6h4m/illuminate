import { NextResponse } from "next/server";
import { generateRegId, type Registration } from "@/lib/registration";
import { CreateRegistrationSchema } from "@/lib/registration-schema";
import { getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";

type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

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
// GET /api/registrations?key=ADMIN_PASSCODE → full list (for admin)
export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return err(503, "DB_NOT_CONFIGURED", "Database is not configured. Set MONGODB_URI.");
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const key = url.searchParams.get("key");

  try {
    const col = await getRegistrationsCollection();

    if (id) {
      const found = await col.findOne({ id });
      if (!found) return err(404, "NOT_FOUND", "Registration not found.");
      return NextResponse.json({ data: sanitize(found) });
    }

    const expected = process.env.ADMIN_PASSCODE ?? "met2026";
    if (key !== expected) {
      return err(401, "UNAUTHORIZED", "Valid admin key required.");
    }
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
