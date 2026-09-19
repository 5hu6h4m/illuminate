import { isAdminAuthenticated } from "@/lib/admin-auth";
import { apiError } from "@/lib/http";
import { getDisplayAmount } from "@/lib/ecell-pricing";
import { getRegistrationsCollection } from "@/lib/mongodb";
import { realRegistrationFilter } from "@/lib/registration-filters";

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function asCsv(rows: unknown[][]): string { return rows.map((row) => row.map(csvCell).join(",")).join("\r\n"); }

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!await isAdminAuthenticated()) return apiError(401, "UNAUTHORIZED", "Unauthorized.");
  const internal = new URL(request.url).searchParams.get("mode") === "internal";
  try {
    const registrations = await (await getRegistrationsCollection()).find({ ...realRegistrationFilter, ...(internal ? {} : { "payment.status": "verified" }) }).sort({ createdAt: 1 }).toArray();
    // "Expected Amount" stays the canonical immutable snapshot amount.
    // "E-cell Display Amount" preserves the remote admin display override
    // (getDisplayAmount) as a separately labelled column so it can never be
    // mistaken for the amount actually encoded in the participant's QR.
    const header = internal ? ["Registration ID", "Name", "Email", "Phone Number", "College", "Branch", "Year", "Payment Status", "Pricing Tier", "Expected Amount", "E-cell Member", "E-cell Display Amount", "Transaction Reference", "Payment Destination ID", "Payment Destination Label", "Payment Payee", "Payment UPI ID", "Created At", "Submitted At", "Verified At"] : ["Name", "Email", "Phone Number"];
    const rows = registrations.map((r) => internal ? [r.publicId, r.participant.fullName, r.participant.email, r.participant.phone, r.participant.college, r.participant.branch, r.participant.year, r.payment.status, r.payment.snapshot.pricingTier, r.payment.snapshot.expectedAmount, r.ecellMember === true ? "YES" : "NO", getDisplayAmount(r.payment.snapshot.expectedAmount, r.ecellMember), r.payment.transactionReference, r.payment.destination?.destinationId ?? "", r.payment.destination?.internalLabel ?? "", r.payment.destination?.payeeName ?? r.payment.snapshot.payeeName, r.payment.destination?.upiId ?? r.payment.snapshot.upiId, r.createdAt.toISOString(), r.payment.submittedAt?.toISOString(), r.payment.verifiedAt?.toISOString()] : [r.participant.fullName, r.participant.email, r.participant.phone]);
    return new Response(asCsv([header, ...rows]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="illuminate-${internal ? "internal-payment" : "verified-participants"}.csv"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch { return apiError(503, "SERVER_ERROR", "Could not create export."); }
}
