import { ObjectId } from "mongodb";
import { Readable } from "stream";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { apiError } from "@/lib/http";
import { getDb, getPaymentProofBucket } from "@/lib/mongodb";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ fileId: string }> }) {
  if (!await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  const { fileId } = await params;
  if (!ObjectId.isValid(fileId)) return apiError(404, "NOT_FOUND", "Not found.");
  try {
    const id = new ObjectId(fileId);
    const file = await (await getDb()).collection("payment_proofs.files").findOne({ _id: id });
    if (!file) return apiError(404, "NOT_FOUND", "Not found.");
    const stream = (await getPaymentProofBucket()).openDownloadStream(id);
    return new Response(Readable.toWeb(stream) as ReadableStream, { headers: { "Content-Type": String((file.metadata as { contentType?: string } | undefined)?.contentType || "application/octet-stream"), "Content-Disposition": "inline", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
  } catch { return apiError(404, "NOT_FOUND", "Not found."); }
}
