import assert from "node:assert/strict";
import test from "node:test";

process.env.PARTICIPANT_TOKEN_SECRET = "email-template-test-secret-that-is-long-enough";
const { buildEmailJSPayload, emailEventKey } = await import("../src/lib/email/transactional-email.ts");

function registration(overrides = {}) {
  return {
    publicId: "ILL26-ABCD23",
    isTest: false,
    environment: "production",
    participant: { fullName: "Synthetic Participant", email: "synthetic@example.invalid" },
    payment: { transactionReference: "TESTREF123", proofHistory: [{ fileId: "one", submittedAt: new Date(), transactionReference: "TESTREF123" }], snapshot: { expectedAmount: 599, currency: "INR", payeeName: "Yash Patil", upiId: "yashpatil76317@okicici", eventKey: "illuminate-2026", mode: "production", pricingTier: "early_bird", calculatedAt: "2026-09-14T00:00:00.000Z", registrationOpenAt: "2026-09-14T00:00:00.000Z", earlyBirdEndsAt: "2026-09-19T00:00:00.000Z" } },
    ...overrides,
  };
}

const mockConfig = {
  serviceId: "srv_test",
  submittedTemplateId: "tpl_submitted",
  verifiedTemplateId: "tpl_verified",
  publicKey: "pub_test",
  privateKey: "priv_test",
  baseUrl: "https://illuminate.example"
};

test("payment-submitted payload uses the immutable snapshot and includes transaction reference", () => {
  const payload = buildEmailJSPayload("paymentSubmitted", registration(), mockConfig);
  assert.equal(payload.template_id, "tpl_submitted");
  assert.equal(payload.template_params.amount, "₹599");
  assert.equal(payload.template_params.transaction_reference, "TESTREF123");
  assert.match(payload.template_params.status_url, /registration\/status\/ILL26-ABCD23\./);
});

test("confirmed template uses regular snapshot and excludes transaction reference", () => {
  const payload = buildEmailJSPayload("paymentVerified", registration({ payment: { ...registration().payment, snapshot: { ...registration().payment.snapshot, expectedAmount: 699, pricingTier: "regular" } } }), mockConfig);
  assert.equal(payload.template_id, "tpl_verified");
  assert.equal(payload.template_params.amount, "₹699");
  assert.equal(payload.template_params.transaction_reference, undefined);
  assert.match(payload.template_params.status_url, /registration\/status\/ILL26-ABCD23\./);
});

test("email event keys are stable per immutable submission version", () => {
  const first = registration();
  assert.equal(emailEventKey("paymentSubmitted", first), "illuminate-payment-submitted-ILL26-ABCD23-1");
  assert.equal(emailEventKey("paymentVerified", first), "illuminate-registration-verified-ILL26-ABCD23-1");
  assert.notEqual(emailEventKey("paymentSubmitted", { ...first, payment: { ...first.payment, proofHistory: [...first.payment.proofHistory, first.payment.proofHistory[0]] } }), emailEventKey("paymentSubmitted", first));
});
