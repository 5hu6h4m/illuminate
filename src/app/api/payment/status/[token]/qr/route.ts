import QRCode from "qrcode";
import { buildUpiUri, buildUpiUriForDestination, isDevE2EPreviewEnabled, hashParticipantAccessToken, isValidParticipantAccessToken } from "@/lib/payment";
import { getRegistrationsCollection, isDbConfigured } from "@/lib/mongodb";
import { resolveRegistrationDestination } from "@/lib/payment-flow-service";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured() || !isValidParticipantAccessToken(token)) return new Response("Not found", { status: 404 });
  const registration = await (await getRegistrationsCollection()).findOne({ schemaVersion: 2, participantAccessTokenHash: hashParticipantAccessToken(token), "payment.status": { $in: ["payment_pending", "rejected"] } });
  if (!registration || (registration.isTest ? !isDevE2EPreviewEnabled() : registration.payment.snapshot.mode !== "production")) return new Response("Not found", { status: 404 });
  const resolved = resolveRegistrationDestination(registration);
  // Blocked Account A pending records never expose a QR again.
  if (resolved.kind === "blocked_account_a_pending" || resolved.kind === "none") return new Response("Not found", { status: 404 });
  const payload = registration.isTest
    ? "ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY"
    : resolved.kind === "assigned"
      ? buildUpiUriForDestination(resolved, registration.payment.snapshot.expectedAmount, registration.publicId)
      : buildUpiUri(registration.payment.snapshot, registration.publicId);
  const svg = await QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 720, color: { dark: "#000000", light: "#FFFFFF" } });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
}
