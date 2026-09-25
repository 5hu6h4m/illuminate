import { isAdminAuthenticated } from "@/lib/admin-auth";
import { apiError, sensitiveJson } from "@/lib/http";
import { ECELL_MEMBER_AMOUNT, ECELL_STANDARD_AMOUNT } from "@/lib/ecell-pricing";
import { getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import type { PaymentStatus } from "@/lib/payment";
import { isDevE2EPreviewEnabled } from "@/lib/payment";
import { adminVisibleRegistrationFilter, developmentTestRegistrationFilter, realRegistrationFilter } from "@/lib/registration-filters";

const statuses = new Set<PaymentStatus>(["payment_pending", "submitted_for_verification", "verified", "rejected"]);
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  if (!isDbConfigured()) return apiError(503, "ADMIN_DB_NOT_CONFIGURED", "Admin is unavailable: server database is not configured (code ADMIN-DB-CONFIG).");
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const status = url.searchParams.get("status");
  const scope = url.searchParams.get("scope");
  const qr = url.searchParams.get("qr");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "30") || 30));
  const developmentE2EEnabled = isDevE2EPreviewEnabled();
  const filter: Record<string, unknown> = { ...adminVisibleRegistrationFilter(developmentE2EEnabled) };
  if (status && statuses.has(status as PaymentStatus)) filter["payment.status"] = status;
  if (scope === "test" && developmentE2EEnabled) Object.assign(filter, developmentTestRegistrationFilter);
  if (scope === "real") Object.assign(filter, realRegistrationFilter);
  // Server-side QR-issuance filter (counts stay consistent with pagination).
  if (qr === "issued") filter["payment.destination.destinationId"] = { $exists: true };
  else if (qr === "draft") filter["payment.destination.destinationId"] = { $exists: false };
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ publicId: { $regex: escaped, $options: "i" } }, { "participant.fullName": { $regex: escaped, $options: "i" } }, { "participant.email": { $regex: escaped, $options: "i" } }, { "participant.phone": { $regex: escaped, $options: "i" } }, { "payment.transactionReference": { $regex: escaped, $options: "i" } }];
  }
  try {
    const collection = await getRegistrationsCollection();
    const [rows, total, metrics, testRecords, realTotal] = await Promise.all([
      collection.find(filter, { projection: { participantAccessTokenHash: 0, idempotencyKeyHash: 0, audit: 0 } }).sort({ "payment.submittedAt": 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(filter),
      // Verified revenue uses the admin display amount: an E-cell flagged
      // standard snapshot counts as the member amount. Snapshot itself stays
      // immutable. Amounts come from the shared ecell-pricing constants.
      collection.aggregate([{ $match: realRegistrationFilter }, { $group: { _id: "$payment.status", count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$payment.status", "verified"] }, { $cond: [{ $and: [{ $eq: ["$ecellMember", true] }, { $eq: ["$payment.snapshot.expectedAmount", ECELL_STANDARD_AMOUNT] }] }, ECELL_MEMBER_AMOUNT, { $ifNull: ["$payment.snapshot.expectedAmount", 0] }] }, 0] } } } }]).toArray(),
      developmentE2EEnabled ? collection.countDocuments(developmentTestRegistrationFilter) : Promise.resolve(0),
      collection.countDocuments(realRegistrationFilter),
    ]);
    return sensitiveJson({ rows, total, page, limit, metrics, testRecords, realTotal });
  } catch { return apiError(503, "ADMIN_REQUEST_FAILED", "Admin is temporarily unavailable (server issue). Retry in a minute (code ADMIN-SERVER)."); }
}
