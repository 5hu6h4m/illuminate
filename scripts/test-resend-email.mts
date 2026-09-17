import { Resend } from "resend";
import { buildTransactionalEmail } from "@/lib/email/transactional-email";

function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }

async function run() {
  if (process.env.NODE_ENV === "production") throw new Error("This development-only email test refuses production.");
  const apiKey = required("RESEND_API_KEY");
  const from = required("RESEND_FROM_EMAIL");
  const to = required("RESEND_TEST_TO");
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim() || "met.iot.ecell@gmail.com";
  const baseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  const registration = {
    publicId: "ILL26-EMAIL1",
    isTest: true,
    environment: "development" as const,
    participant: { fullName: "Illuminate Email Test", email: "synthetic@example.invalid", normalizedEmail: "synthetic@example.invalid", phone: "9000000000", normalizedPhone: "9000000000" },
    payment: { status: "payment_pending" as const, transactionReference: "DEV-EMAIL-TEST", proofHistory: [{ fileId: "synthetic", submittedAt: new Date(), transactionReference: "DEV-EMAIL-TEST" }], snapshot: { registrationAvailable: true, expectedAmount: 599, currency: "INR" as const, payeeName: "Preview Recipient", upiId: "preview-not-payable", eventKey: "illuminate-email-test", mode: "development_preview" as const, pricingTier: "development_preview" as const, calculatedAt: new Date().toISOString(), registrationOpenAt: null, earlyBirdEndsAt: null } },
  };
  const resend = new Resend(apiKey);
  for (const kind of ["paymentSubmitted", "paymentVerified"] as const) {
    const message = buildTransactionalEmail(kind, registration, baseUrl);
    const result = await resend.emails.send({ from, to, replyTo, subject: `[TEST] ${message.subject}`, html: message.html, text: message.text, headers: { "Idempotency-Key": `illuminate-email-test-${kind}-${Date.now()}` } });
    if (result.error || !result.data?.id) throw new Error(`${kind} email was not accepted.`);
    console.log(`[PASS] ${kind === "paymentSubmitted" ? "Payment-submitted" : "Registration-confirmed"} email accepted`);
  }
}

run().catch(() => { console.error("[FAIL] Resend test email was not accepted. Check development email configuration and the verified/testing sender."); process.exit(1); });
