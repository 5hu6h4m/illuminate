import { Resend } from "resend";
import { event, isConfirmedText } from "@/config/event";
import { getRegistrationsCollection } from "@/lib/mongodb";
import { generateParticipantAccessToken } from "@/lib/payment";
import type { RegistrationV2, TransactionalEmailNotification } from "@/lib/registration-v2";

type EmailKind = "paymentSubmitted" | "paymentVerified";
type EmailRecipient = Pick<RegistrationV2, "publicId" | "participant" | "payment" | "isTest" | "environment" | "emailNotifications">;

function configuredEmail() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim() || event.contacts.support.value;
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!apiKey || !from || !replyTo || !baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return { apiKey, from, replyTo, baseUrl: url.toString().replace(/\/$/, "") };
  } catch { return null; }
}

function tierLabel(value: RegistrationV2["payment"]["snapshot"]["pricingTier"]) { return value === "early_bird" ? "Early Bird" : value === "regular" ? "Regular" : "Development preview"; }
function textEscape(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
function statusUrl(registration: EmailRecipient, baseUrl: string): string | null {
  const token = generateParticipantAccessToken(registration.publicId);
  return token ? `${baseUrl}/registration/status/${encodeURIComponent(token)}` : null;
}
function logisticsCopy() {
  const facts = [event.schedule.date, event.schedule.time, event.schedule.venue];
  if (!facts.every(isConfirmedText)) return "Final event date, time and venue details will be communicated once confirmed.";
  return `Date: ${event.schedule.date.value}\nTime: ${event.schedule.time.value}\nVenue: ${event.schedule.venue.value}`;
}
export function emailEventKey(kind: EmailKind, registration: EmailRecipient) {
  const version = kind === "paymentSubmitted" ? registration.payment.proofHistory.length : 1;
  return `illuminate-${kind === "paymentSubmitted" ? "payment-submitted" : "registration-verified"}-${registration.publicId}-${version}`;
}
export function buildTransactionalEmail(kind: EmailKind, registration: EmailRecipient, baseUrl: string) {
  const name = registration.participant.fullName.split(/\s+/)[0] || "there";
  const snapshot = registration.payment.snapshot;
  const amount = snapshot.expectedAmount === null ? "₹XXX" : `₹${snapshot.expectedAmount.toLocaleString("en-IN")}`;
  const isVerified = kind === "paymentVerified";
  const title = isVerified ? "Registration confirmed" : "Payment submitted";
  const message = isVerified
    ? "The E-Cell MET team has verified your payment, and your Illuminate registration is now confirmed."
    : "We received your payment details and proof for Illuminate. Your registration is awaiting manual payment verification by the E-Cell MET team.";
  const reassurance = isVerified ? logisticsCopy() : "You do not need to keep the website open. Once payment is verified, we will send another confirmation email.";
  const link = statusUrl(registration, baseUrl);
  const status = isVerified ? "Confirmed" : "Verification pending";
  const reference = registration.payment.transactionReference ? `Transaction/reference: ${registration.payment.transactionReference}` : "";
  const text = [`Hi ${name},`, "", message, "", `Status: ${status}`, `Pricing tier: ${tierLabel(snapshot.pricingTier)}`, `Amount: ${amount}`, `Registration ID: ${registration.publicId}`, reference, "", reassurance, "", link ? `Check registration status: ${link}` : "", "", `Questions? ${event.contacts.organizer.value}`, String(event.contacts.support.value)].filter(Boolean).join("\n");
  const html = `<main style="margin:0 auto;padding:32px 20px;max-width:620px;background:#11111a;color:#f8f5ee;font-family:Arial,sans-serif"><p style="margin:0;color:#9c8cff;font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Illuminate 2026</p><h1 style="margin:14px 0 8px;font-size:30px;color:#fff">${title}</h1><p style="line-height:1.6;color:#dedbea">Hi ${textEscape(name)},</p><p style="line-height:1.6;color:#dedbea">${textEscape(message)}</p><section style="margin:24px 0;padding:20px;border:1px solid #37304e;border-radius:14px;background:#1a1826"><strong style="color:#b8a8ff">${status}</strong><p style="margin:12px 0 0;color:#fff">${textEscape(tierLabel(snapshot.pricingTier))} · ${textEscape(amount)}</p><p style="margin:8px 0 0;color:#dedbea">Registration ID: ${textEscape(registration.publicId)}</p>${reference ? `<p style="margin:8px 0 0;color:#dedbea">${textEscape(reference)}</p>` : ""}</section><p style="line-height:1.6;color:#dedbea">${textEscape(reassurance).replace(/\n/g, "<br />")}</p>${link ? `<p style="margin:26px 0"><a href="${textEscape(link)}" style="display:inline-block;padding:13px 18px;border-radius:8px;background:#8f7cff;color:#fff;text-decoration:none;font-weight:bold">Check registration status</a></p>` : ""}<p style="margin-top:32px;color:#aaa4ba;font-size:13px;line-height:1.5">Questions?<br />${textEscape(String(event.contacts.organizer.value))}<br /><a style="color:#b8a8ff" href="mailto:${textEscape(String(event.contacts.support.value))}">${textEscape(String(event.contacts.support.value))}</a></p></main>`;
  return { subject: isVerified ? "Registration confirmed — Illuminate 2026" : "Payment submitted — Illuminate 2026", html, text };
}

async function record(kind: EmailKind, publicId: string, eventKey: string, update: Partial<TransactionalEmailNotification>) {
  await (await getRegistrationsCollection()).updateOne({ schemaVersion: 2, publicId, [`emailNotifications.${kind}.eventKey`]: eventKey }, { $set: Object.fromEntries(Object.entries(update).map(([key, value]) => [`emailNotifications.${kind}.${key}`, value])) });
}

export async function dispatchTransactionalEmail(kind: EmailKind, registration: EmailRecipient): Promise<TransactionalEmailNotification["status"]> {
  const eventKey = emailEventKey(kind, registration);
  if (registration.isTest || registration.environment === "development") {
    await record(kind, registration.publicId, eventKey, { status: "suppressed", lastAttemptAt: new Date() });
    return "suppressed";
  }
  const collection = await getRegistrationsCollection();
  const now = new Date();
  const claimed = await collection.findOneAndUpdate({ schemaVersion: 2, publicId: registration.publicId, [`emailNotifications.${kind}.eventKey`]: eventKey, [`emailNotifications.${kind}.status`]: "pending" }, { $set: { [`emailNotifications.${kind}.status`]: "sending", [`emailNotifications.${kind}.lastAttemptAt`]: now } }, { returnDocument: "after" });
  if (!claimed) return registration.emailNotifications?.[kind]?.status ?? "pending";
  const config = configuredEmail();
  if (!config) { await record(kind, registration.publicId, eventKey, { status: "failed", lastAttemptAt: now, errorCode: "EMAIL_CONFIGURATION_UNAVAILABLE" }); return "failed"; }
  const template = buildTransactionalEmail(kind, registration, config.baseUrl);
  try {
    const response = await new Resend(config.apiKey).emails.send({ from: config.from, to: registration.participant.email, replyTo: config.replyTo, subject: template.subject, html: template.html, text: template.text, headers: { "Idempotency-Key": eventKey } });
    if (response.error || !response.data?.id) throw new Error("EMAIL_PROVIDER_REJECTED");
    await record(kind, registration.publicId, eventKey, { status: "sent", lastAttemptAt: now, sentAt: new Date(), resendId: response.data.id, errorCode: undefined });
    return "sent";
  } catch {
    await record(kind, registration.publicId, eventKey, { status: "failed", lastAttemptAt: now, errorCode: "EMAIL_DELIVERY_FAILED" });
    return "failed";
  }
}
