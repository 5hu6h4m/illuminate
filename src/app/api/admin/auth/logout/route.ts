import { cookies } from "next/headers";
import { adminCookieName, adminCookieOptions, isAdminAuthenticated } from "@/lib/admin-auth";
import { apiError, isSameOrigin, sensitiveJson } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request) || !await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  (await cookies()).set(adminCookieName(), "", { ...adminCookieOptions(), maxAge: 0 });
  return sensitiveJson({ loggedOut: true });
}
