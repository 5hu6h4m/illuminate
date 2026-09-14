import { NextResponse, type NextRequest } from "next/server";

/** Restrict cache/referrer behavior only on private participant and staff HTML paths. */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path.startsWith("/registration/status/") || path === "/admin") {
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
  }
  return response;
}

export const config = { matcher: ["/registration/status/:path*", "/admin"] };
