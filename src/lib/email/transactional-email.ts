import { getRegistrationsCollection } from "@/lib/mongodb";
import { generateParticipantAccessToken } from "@/lib/payment";
import type { RegistrationV2, TransactionalEmailNotification } from "@/lib/registration-v2";

type EmailKind = "paymentSubmitted" | "paymentVerified";
type EmailRecipient = Pick<RegistrationV2, "publicId" | "participant" | "payment" | "isTest" | "environment" | "emailNotifications">;

function configuredEmailJS() {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
  const submittedTemplateId = process.env.EMAILJS_PAYMENT_SUBMITTED_TEMPLATE_ID?.trim();
  const verifiedTemplateId = process.env.EMAILJS_PAYMENT_VERIFIED_TEMPLATE_ID?.trim();
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!serviceId || !submittedTemplateId || !verifiedTemplateId || !publicKey || !privateKey || !baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return { serviceId, submittedTemplateId, verifiedTemplateId, publicKey, privateKey, baseUrl: url.toString().replace(/\/$/, "") };
  } catch { return null; }
}

function statusUrl(registration: EmailRecipient, baseUrl: string): string | null {
  const token = generateParticipantAccessToken(registration.publicId);
  return token ? `${baseUrl}/registration/status/${encodeURIComponent(token)}` : null;
}

export function emailEventKey(kind: EmailKind, registration: EmailRecipient) {
  const version = kind === "paymentSubmitted" ? registration.payment.proofHistory.length : 1;
  return `illuminate-${kind === "paymentSubmitted" ? "payment-submitted" : "registration-verified"}-${registration.publicId}-${version}`;
}

export function buildEmailJSPayload(kind: EmailKind, registration: EmailRecipient, config: ReturnType<typeof configuredEmailJS>) {
  if (!config) return null;
  
  const name = registration.participant.fullName.split(/\s+/)[0] || "there";
  const snapshot = registration.payment.snapshot;
  const amount = snapshot.expectedAmount === null ? "₹XXX" : `₹${snapshot.expectedAmount.toLocaleString("en-IN")}`;
  const link = statusUrl(registration, config.baseUrl);
  
  if (!link) return null; // Secure status link is mandatory for both emails

  const baseParams = {
    to_email: registration.participant.email,
    participant_name: name,
    registration_id: registration.publicId,
    amount,
    status_url: link,
  };

  if (kind === "paymentSubmitted") {
    return {
      service_id: config.serviceId,
      template_id: config.submittedTemplateId,
      user_id: config.publicKey,
      accessToken: config.privateKey,
      template_params: {
        ...baseParams,
        transaction_reference: registration.payment.transactionReference ?? "",
      },
    };
  }

  if (kind === "paymentVerified") {
    return {
      service_id: config.serviceId,
      template_id: config.verifiedTemplateId,
      user_id: config.publicKey,
      accessToken: config.privateKey,
      template_params: baseParams,
    };
  }

  return null;
}

async function record(kind: EmailKind, publicId: string, eventKey: string, update: Partial<TransactionalEmailNotification>) {
  await (await getRegistrationsCollection()).updateOne(
    { schemaVersion: 2, publicId, [`emailNotifications.${kind}.eventKey`]: eventKey },
    { $set: Object.fromEntries(Object.entries(update).map(([key, value]) => [`emailNotifications.${kind}.${key}`, value])) }
  );
}

export async function dispatchTransactionalEmail(kind: EmailKind, registration: EmailRecipient): Promise<TransactionalEmailNotification["status"]> {
  const eventKey = emailEventKey(kind, registration);
  if (registration.isTest || registration.environment === "development") {
    await record(kind, registration.publicId, eventKey, { status: "suppressed", lastAttemptAt: new Date() });
    return "suppressed";
  }
  const collection = await getRegistrationsCollection();
  const now = new Date();
  
  const claimed = await collection.findOneAndUpdate(
    { schemaVersion: 2, publicId: registration.publicId, [`emailNotifications.${kind}.eventKey`]: eventKey, [`emailNotifications.${kind}.status`]: "pending" },
    { $set: { [`emailNotifications.${kind}.status`]: "sending", [`emailNotifications.${kind}.lastAttemptAt`]: now } },
    { returnDocument: "after" }
  );
  if (!claimed) return registration.emailNotifications?.[kind]?.status ?? "pending";
  
  const config = configuredEmailJS();
  if (!config) { 
    console.error(`[email] EMAILJS_CONFIG_MISSING for ${kind}`);
    await record(kind, registration.publicId, eventKey, { status: "failed", lastAttemptAt: now, errorCode: "EMAILJS_CONFIG_MISSING" }); 
    return "failed"; 
  }
  
  const payload = buildEmailJSPayload(kind, registration, config);
  if (!payload) {
    console.error(`[email] Invalid payload structure generated for ${kind}`);
    await record(kind, registration.publicId, eventKey, { status: "failed", lastAttemptAt: now, errorCode: "EMAILJS_PAYLOAD_INVALID" });
    return "failed";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[email] EMAILJS_${kind === "paymentSubmitted" ? "SUBMITTED" : "VERIFIED"}_SEND_FAILED: Provider returned HTTP ${response.status}`);
      if (response.status === 429) {
        console.error(`[email] EMAILJS_RATE_LIMITED`);
      }
      throw new Error(`EMAILJS_PROVIDER_ERROR`);
    }

    console.log(`[email] EmailJS dispatched ${kind} to ${registration.publicId}`);
    await record(kind, registration.publicId, eventKey, { status: "sent", lastAttemptAt: now, sentAt: new Date(), errorCode: undefined });
    return "sent";
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[email] EMAILJS_PROVIDER_ERROR: ${(error as Error).message}`);
    await record(kind, registration.publicId, eventKey, { status: "failed", lastAttemptAt: now, errorCode: "EMAILJS_PROVIDER_ERROR" });
    return "failed";
  }
}
