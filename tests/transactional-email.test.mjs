import assert from "node:assert/strict";
import test from "node:test";

process.env.PARTICIPANT_TOKEN_SECRET = "email-template-test-secret-that-is-long-enough";
const { buildTransactionalEmail, emailEventKey } = await import("../src/lib/email/transactional-email.ts");

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

test("payment-submitted template uses the immutable snapshot and never claims confirmation", () => {
  const message = buildTransactionalEmail("paymentSubmitted", registration(), "https://illuminate.example");
  assert.match(message.subject, /Payment submitted/);
  assert.match(message.text, /Verification pending/);
  assert.match(message.text, /₹599/);
  assert.match(message.text, /Early Bird/);
  assert.doesNotMatch(message.text, /registration is now confirmed/i);
  assert.match(message.text, /registration\/status\/ILL26-ABCD23\./);
});

test("confirmed template has only confirmed wording and does not publish pending logistics", () => {
  const message = buildTransactionalEmail("paymentVerified", registration({ payment: { ...registration().payment, snapshot: { ...registration().payment.snapshot, expectedAmount: 699, pricingTier: "regular" } } }), "https://illuminate.example");
  assert.match(message.subject, /Registration confirmed/);
  assert.match(message.text, /₹699/);
  assert.match(message.text, /Regular/);
  assert.match(message.text, /Final event date, time and venue details will be communicated once confirmed/);
  assert.doesNotMatch(message.text, /10:00 AM|IOT Building/);
});

test("email event keys are stable per immutable submission version", () => {
  const first = registration();
  assert.equal(emailEventKey("paymentSubmitted", first), "illuminate-payment-submitted-ILL26-ABCD23-1");
  assert.equal(emailEventKey("paymentVerified", first), "illuminate-registration-verified-ILL26-ABCD23-1");
  assert.notEqual(emailEventKey("paymentSubmitted", { ...first, payment: { ...first.payment, proofHistory: [...first.payment.proofHistory, first.payment.proofHistory[0]] } }), emailEventKey("paymentSubmitted", first));
});
