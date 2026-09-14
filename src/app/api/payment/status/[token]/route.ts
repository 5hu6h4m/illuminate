import { isValidParticipantAccessToken } from "@/lib/payment";
import { isDbConfigured } from "@/lib/mongodb";
import { apiError, sensitiveJson } from "@/lib/http";
import { getPublicStatusForParticipantToken } from "@/lib/payment-flow-service";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured() || !isValidParticipantAccessToken(token)) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
  try {
    const status = await getPublicStatusForParticipantToken(token);
    if (!status) return apiError(404, "INVALID_STATUS_TOKEN", "Not found.");
    return sensitiveJson(status);
  } catch { return apiError(404, "INVALID_STATUS_TOKEN", "Not found."); }
}
