import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { apiError, isSameOrigin, sensitiveJson } from "@/lib/http";
import { isDbConfigured } from "@/lib/mongodb";
import { getRegistrationManualClose, setRegistrationManualClose } from "@/lib/site-settings";

export const runtime = "nodejs";

const ToggleSchema = z.object({ closed: z.boolean() }).strict();

export async function GET() {
  if (!await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  if (!isDbConfigured()) return apiError(503, "ADMIN_DB_NOT_CONFIGURED", "Admin is unavailable: server database is not configured (code ADMIN-DB-CONFIG).");
  try {
    const state = await getRegistrationManualClose();
    return sensitiveJson({ manualClose: state.manualClose, updatedAt: state.updatedAt?.toISOString() ?? null });
  } catch { return apiError(503, "ADMIN_REQUEST_FAILED", "Admin is temporarily unavailable (server issue). Retry in a minute (code ADMIN-SERVER)."); }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request) || !await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  if (!isDbConfigured()) return apiError(503, "ADMIN_DB_NOT_CONFIGURED", "Admin is unavailable: server database is not configured (code ADMIN-DB-CONFIG).");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(422, "INVALID_REQUEST", "Invalid request."); }
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) return apiError(422, "INVALID_REQUEST", "Invalid request.");
  try {
    const state = await setRegistrationManualClose(parsed.data.closed, "admin");
    return sensitiveJson({
      manualClose: state.manualClose,
      updatedAt: state.updatedAt.toISOString(),
      notice: state.manualClose ? "Registrations are now CLOSED. Landing page shows Closed popup." : "Registrations are now OPEN (date window applies).",
    });
  } catch { return apiError(503, "SERVER_ERROR", "Could not save the registration setting."); }
}
