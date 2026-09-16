import { event, isPaymentRegistrationAvailable } from "@/config/event";
import { getDb, isDbConfigured } from "@/lib/mongodb";
import { buildUpiUri, getConfirmedPaymentSnapshot, getDevelopmentPreviewSnapshot, isDevE2EPreviewEnabled, isDevPaymentPreviewEnabled, parseRegistrationOpen, parseRegistrationPriceTier } from "@/lib/payment";
import { resolveManualPricing } from "@/lib/payment-pricing";
import { isRegistrationPreviewEnabled } from "@/lib/registration-preview";

type Level = "PASS" | "PENDING" | "BLOCKER";
let blockers = 0;
let pending = 0;

function result(level: Level, message: string) {
  console.log(`[${level}] ${message}`);
  if (level === "BLOCKER") blockers += 1;
  if (level === "PENDING") pending += 1;
}

function hasUsableAdminHash() {
  const value = process.env.ADMIN_PASSWORD_HASH?.trim() ?? "";
  const [kind, salt, hash] = value.split(/[$:]/);
  return kind === "scrypt" && Boolean(salt) && Boolean(hash);
}

function hasSufficientSecret(name: string) {
  return (process.env[name]?.trim().length ?? 0) >= 32;
}
function hasProductionEmailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim();
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!apiKey || !from || !replyTo || !baseUrl) return false;
  try { return new URL(baseUrl).protocol === "https:"; } catch { return false; }
}

function checkPreviewProductionInvariant() {
  const environment = process.env as Record<string, string | undefined>;
  const original = {
    nodeEnv: environment.NODE_ENV,
    registration: environment.REGISTRATION_PREVIEW,
    payment: environment.PAYMENT_UI_PREVIEW,
    e2e: environment.PAYMENT_E2E_PREVIEW,
  };
  try {
    environment.NODE_ENV = "production";
    environment.REGISTRATION_PREVIEW = "1";
    environment.PAYMENT_UI_PREVIEW = "1";
    environment.PAYMENT_E2E_PREVIEW = "1";
    return !isRegistrationPreviewEnabled() && !isDevPaymentPreviewEnabled() && !isDevE2EPreviewEnabled() && getDevelopmentPreviewSnapshot() === null;
  } finally {
    if (original.nodeEnv === undefined) delete environment.NODE_ENV; else environment.NODE_ENV = original.nodeEnv;
    if (original.registration === undefined) delete environment.REGISTRATION_PREVIEW; else environment.REGISTRATION_PREVIEW = original.registration;
    if (original.payment === undefined) delete environment.PAYMENT_UI_PREVIEW; else environment.PAYMENT_UI_PREVIEW = original.payment;
    if (original.e2e === undefined) delete environment.PAYMENT_E2E_PREVIEW; else environment.PAYMENT_E2E_PREVIEW = original.e2e;
  }
}

function checkPaymentBuilderInvariant() {
  const uri = buildUpiUri({
    expectedAmount: 123.45,
    currency: "INR",
    payeeName: "Preview & Co",
    upiId: "preview@upi",
    eventKey: "launch-check-fixture",
    mode: "production",
    pricingTier: "early_bird",
    calculatedAt: "2026-01-01T00:00:00.000Z",
  }, "ILL26-ABC123");
  const query = new URL(uri).searchParams;
  return uri.startsWith("upi://pay?")
    && query.get("pa") === "preview@upi"
    && query.get("pn") === "Preview & Co"
    && query.get("am") === "123.45"
    && query.get("cu") === "INR"
    && query.get("tn") === "ILL26-ABC123";
}

async function checkDatabase() {
  if (!isDbConfigured()) {
    result("BLOCKER", "MONGODB_URI is not configured.");
    return;
  }
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    result("PASS", "MongoDB reachable.");
    const registrationNames = new Set((await db.collection("registrations").indexes()).map((index) => index.name));
    const rateLimitNames = new Set((await db.collection("rate_limits").indexes()).map((index) => index.name));
    const expectedRegistrations = ["v2_public_id_unique", "v2_event_email_unique", "v2_event_phone_unique", "v2_idempotency_unique", "v2_transaction_reference_unique", "v2_admin_queue", "v2_access_token", "v2_created_at"];
    const expectedRateLimits = ["rate_limit_expiry", "rate_limit_key"];
    const missing = [
      ...expectedRegistrations.filter((name) => !registrationNames.has(name)),
      ...expectedRateLimits.filter((name) => !rateLimitNames.has(name)),
    ];
    if (missing.length) result("BLOCKER", "Required current-registration indexes are missing. Run a safe application request in the target environment before launch.");
    else result("PASS", "Current-registration indexes are present.");
    const testRecords = await db.collection("registrations").countDocuments({ schemaVersion: 2, isTest: true, environment: "development" });
    if (!testRecords) result("PASS", "No development test registrations are present.");
    else if (process.env.NODE_ENV === "production") result("BLOCKER", "Development test registrations exist in the production database.");
    else result("PENDING", `${testRecords} development test registration(s) remain; clear them before using this database for launch.`);
  } catch {
    result("BLOCKER", "MongoDB could not be reached. Database-backed payment operations must remain unavailable.");
  }
}

async function run() {
  console.log("Illuminate Launch Check\n");
  const adminHashConfigured = hasUsableAdminHash();
  const adminSessionConfigured = hasSufficientSecret("ADMIN_SESSION_SECRET");
  const participantSecretConfigured = hasSufficientSecret("PARTICIPANT_TOKEN_SECRET");
  const previewInvariant = checkPreviewProductionInvariant();
  const paymentBuilderInvariant = checkPaymentBuilderInvariant();
  const registrationOpen = parseRegistrationOpen(process.env.REGISTRATION_OPEN);
  const priceTier = parseRegistrationPriceTier(process.env.REGISTRATION_PRICE_TIER);
  const configuredPricing = priceTier
    ? resolveManualPricing({ tier: priceTier, earlyBirdAmount: event.fee.pricing.earlyBirdAmount, regularAmount: event.fee.pricing.regularAmount })
    : null;
  const paymentSnapshot = getConfirmedPaymentSnapshot();
  result(adminHashConfigured ? "PASS" : "BLOCKER", adminHashConfigured ? "Admin password hash configured." : "ADMIN_PASSWORD_HASH is missing or malformed.");
  result(adminSessionConfigured ? "PASS" : "BLOCKER", adminSessionConfigured ? "Admin session secret configured." : "ADMIN_SESSION_SECRET must be at least 32 characters.");
  result(participantSecretConfigured ? "PASS" : "BLOCKER", participantSecretConfigured ? "Participant token secret configured." : "PARTICIPANT_TOKEN_SECRET must be at least 32 characters.");
  result(previewInvariant ? "PASS" : "BLOCKER", previewInvariant ? "Preview flags are hard-disabled when NODE_ENV is production." : "Production preview invariant failed.");
  result(paymentBuilderInvariant ? "PASS" : "BLOCKER", paymentBuilderInvariant ? "Canonical UPI URI builder preserves encoded fixture facts." : "Canonical UPI URI invariant failed.");
  result(registrationOpen !== null ? "PASS" : "BLOCKER", registrationOpen !== null ? `REGISTRATION_OPEN is valid (${registrationOpen ? "open" : "closed"}).` : "REGISTRATION_OPEN must be exactly true or false; new payment registrations remain unavailable.");
  result(priceTier && configuredPricing ? "PASS" : "BLOCKER", priceTier && configuredPricing ? `REGISTRATION_PRICE_TIER is valid and maps to INR ${configuredPricing.amount}.` : "REGISTRATION_PRICE_TIER must be early_bird or regular; new payment registrations remain unavailable.");
  const paymentSnapshotValid = isPaymentRegistrationAvailable() && registrationOpen === true && Boolean(configuredPricing) && paymentSnapshot?.pricingTier === configuredPricing?.tier && paymentSnapshot?.expectedAmount === configuredPricing?.amount;
  const manualCloseSafe = isPaymentRegistrationAvailable() && registrationOpen === false && paymentSnapshot === null;
  result(registrationOpen === false ? (manualCloseSafe ? "PASS" : "BLOCKER") : (paymentSnapshotValid ? "PASS" : "BLOCKER"), registrationOpen === false ? (manualCloseSafe ? "Manual close safely prevents new payment registrations." : "Manual close safety check failed.") : (paymentSnapshotValid ? "Confirmed payment configuration creates the organizer-selected canonical snapshot." : "Confirmed payment configuration is incomplete or its canonical snapshot could not be created."));
  result(hasProductionEmailConfiguration() ? "PASS" : "PENDING", hasProductionEmailConfiguration() ? "Transactional email configuration is present." : "Transactional email configuration incomplete (RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_REPLY_TO_EMAIL, and APP_BASE_URL are required for delivery).");
  await checkDatabase();

  const configurationFacts = [
    [String(event.fee.confirmation) === "confirmed" && event.fee.pricing.earlyBirdAmount === 599 && event.fee.pricing.regularAmount === 699, "Early Bird (INR 599) and Regular (INR 699) pricing"],
    [String(event.payment.recipient.confirmation) === "confirmed", "Payee name"],
    [String(event.payment.upiId.confirmation) === "confirmed", "UPI ID"],
    [String(event.payment.refundPolicy.confirmation) === "confirmed", "Refund/cancellation policy"],
    [String(event.policies.privacy.confirmation) === "confirmed", "Privacy policy"],
    [String(event.policies.terms.confirmation) === "confirmed", "Terms"],
    [String(event.contacts.support.confirmation) === "confirmed", "Public support contact"],
  ] as const;
  for (const [isConfigured, label] of configurationFacts) result(isConfigured ? "PASS" : "PENDING", isConfigured ? `${label} configured.` : `${label} requires organizer confirmation.`);
  const logisticsFacts = [
    [event.schedule.date, "Confirmed event date"],
    [event.schedule.time, "Confirmed event time"],
    [event.schedule.venue, "Confirmed venue"],
  ] as const;
  for (const [fact, label] of logisticsFacts) {
    const configured = String(fact.confirmation) === "confirmed";
    result(configured ? "PASS" : "PENDING", configured ? `${label} configured.` : `${label} remains intentionally pending.`);
  }
  result("PASS", "Registration availability is manually controlled; no scheduled opening or closing timestamp is used.");

  console.log(`\nRESULT: ${blockers ? "NO-GO" : pending ? "TECHNICALLY READY — EVENT CONFIGURATION INCOMPLETE" : "READY"}`);
  if (blockers) process.exitCode = 1;
}

void run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(() => {
    console.error("[BLOCKER] Launch check could not complete safely.");
    process.exit(1);
  });
