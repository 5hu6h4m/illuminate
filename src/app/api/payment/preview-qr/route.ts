import QRCode from "qrcode";
import { isDevPaymentPreviewEnabled } from "@/lib/payment";

export const runtime = "nodejs";
export async function GET() {
  if (!isDevPaymentPreviewEnabled()) return new Response("Not found", { status: 404 });
  const svg = await QRCode.toString("ILLUMINATE_DEV_PAYMENT_PREVIEW_ONLY", { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 720, color: { dark: "#000000", light: "#FFFFFF" } });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });
}
