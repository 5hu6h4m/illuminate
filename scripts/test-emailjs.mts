// Env loaded via node --env-file

if (process.env.NODE_ENV === "production") {
  console.error("This test script must not be run in production.");
  process.exit(1);
}

const targetEmail = process.env.EMAILJS_TEST_TO?.trim();
if (!targetEmail) {
  console.error("Please set EMAILJS_TEST_TO in your .env.local to run this test.");
  process.exit(1);
}

// @ts-expect-error TS5097: explicit `.ts` extension is resolved at runtime by
// scripts/register-dev-ts-loader.mjs; tsc flags it without allowImportingTsExtensions.
const { buildEmailJSPayload } = await import("../src/lib/email/transactional-email.ts");

const mockConfig = {
  serviceId: process.env.EMAILJS_SERVICE_ID?.trim() || "",
  submittedTemplateId: process.env.EMAILJS_PAYMENT_SUBMITTED_TEMPLATE_ID?.trim() || "",
  verifiedTemplateId: process.env.EMAILJS_PAYMENT_VERIFIED_TEMPLATE_ID?.trim() || "",
  publicKey: process.env.EMAILJS_PUBLIC_KEY?.trim() || "",
  privateKey: process.env.EMAILJS_PRIVATE_KEY?.trim() || "",
  baseUrl: process.env.APP_BASE_URL?.trim() || "http://localhost:3000"
};

const missing = Object.entries(mockConfig).filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.error("Missing EmailJS configuration:", missing.join(", "));
  process.exit(1);
}

const mockRegistration = {
  publicId: "ILL26-TESTME",
  isTest: true,
  environment: "development" as const,
  participant: {
    fullName: "EmailJS Test User",
    email: targetEmail,
  },
  payment: {
    transactionReference: "UPI-REF-12345",
    snapshot: {
      expectedAmount: 599,
      currency: "INR",
      payeeName: "Yash Patil",
      upiId: "yashpatil76317@okicici",
      eventKey: "illuminate-2026",
      mode: "production",
      pricingTier: "early_bird",
      calculatedAt: new Date().toISOString(),
      registrationOpenAt: new Date().toISOString(),
      earlyBirdEndsAt: new Date().toISOString(),
    },
    proofHistory: []
  },
  emailNotifications: {}
} as unknown as Parameters<typeof buildEmailJSPayload>[1];

async function sendTest(kind: "paymentSubmitted" | "paymentVerified") {
  console.log(`\nTesting template: ${kind}`);
  const payload = buildEmailJSPayload(kind, mockRegistration, mockConfig);
  if (!payload) {
    console.error(`Failed to build payload for ${kind}`);
    return;
  }

  // Never log the EmailJS private key (payload.accessToken).
  const loggedPayload = { ...payload, accessToken: "[REDACTED]" };
  console.log("Sending payload:", JSON.stringify(loggedPayload, null, 2));
  
  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✅ Success: ${kind}`);
    } else {
      console.error(`❌ Failed: HTTP ${response.status}`);
      const text = await response.text();
      console.error(text);
    }
  } catch (err) {
    console.error(`❌ Error:`, err);
  }
}

async function run() {
  await sendTest("paymentSubmitted");
  await sendTest("paymentVerified");
}

run();
