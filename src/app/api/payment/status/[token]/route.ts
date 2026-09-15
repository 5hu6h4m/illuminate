import { isValidParticipantAccessToken } from "@/lib/payment";
import { isDbConfigured } from "@/lib/mongodb";
import { apiError, clientIp, sensitiveJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPublicStatusForParticipantToken } from "@/lib/payment-flow-service";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    if (!(await enforceRateLimit("status-read", clientIp(request), 120, 10 * 60 * 1000))) {
      return apiError(429, "RATE_LIMITED", "Too many requests. Please retry shortly.");
    }
  } catch { /* fail-open for reads: continue to token check */ }
  if (!isDbConfigured() || !isValidParticipantAccessToken(token)) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
  try {
    const status = await getPublicStatusForParticipantToken(token);
    if (!status) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
    return sensitiveJson(status);
  } catch (cause) {
    // Distinguish infrastructure failure from unknown token: surfaced
    // message stays generic but status is 503 so clients don't cache as 404.
    console.error("status lookup failed", cause instanceof Error ? cause.message : cause);
    return apiError(503, "STATUS_UNAVAILABLE", "Status is temporarily unavailable.");
  }
}
