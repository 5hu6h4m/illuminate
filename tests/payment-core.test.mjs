import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUpiUri,
  canTransitionPayment,
  detectImageType,
  generateParticipantAccessToken,
  hashParticipantAccessToken,
  isValidParticipantAccessToken,
  normalizeTransactionReference,
} from "../src/lib/payment.ts";

const PROD_SNAPSHOT = {
  expectedAmount: 599,
  currency: "INR",
  payeeName: "Preview & Co",
  upiId: "preview@upi",
  eventKey: "illuminate-2026",
  mode: "production",
  pricingTier: "early_bird",
  calculatedAt: "2026-01-01T00:00:00.000Z",
  registrationOpenAt: "2026-01-01T00:00:00.000Z",
  earlyBirdEndsAt: "2026-01-06T00:00:00.000Z",
};

test("buildUpiUri encodes payee, fixes 2dp amount, and binds publicId", () => {
  const uri = buildUpiUri(PROD_SNAPSHOT, "ILL26-ABC123");
  const url = new URL(uri);
  assert.equal(url.protocol, "upi:");
  assert.equal(url.searchParams.get("pa"), "preview@upi");
  assert.equal(url.searchParams.get("pn"), "Preview & Co");
  assert.equal(url.searchParams.get("am"), "599.00");
  assert.equal(url.searchParams.get("cu"), "INR");
  assert.equal(url.searchParams.get("tn"), "ILL26-ABC123");
});

test("buildUpiUri throws for preview or null-amount snapshots", () => {
  assert.throws(() => buildUpiUri({ ...PROD_SNAPSHOT, mode: "development_preview" }, "ILL26-ABC123"));
  assert.throws(() => buildUpiUri({ ...PROD_SNAPSHOT, expectedAmount: null }, "ILL26-ABC123"));
});

test("normalizeTransactionReference uppercases and strips all whitespace idempotently", () => {
  assert.equal(normalizeTransactionReference("  abc 123 -x "), "ABC123-X");
  assert.equal(normalizeTransactionReference("a b-c"), "AB-C");
  const once = normalizeTransactionReference(" ab 12 ");
  assert.equal(normalizeTransactionReference(once), once);
});

test("detectImageType sniffs magic bytes and rejects SVG/GIF/empty/truncated", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const webp = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);
  assert.equal(detectImageType(png), "image/png");
  assert.equal(detectImageType(jpg), "image/jpeg");
  assert.equal(detectImageType(webp), "image/webp");
  assert.equal(detectImageType(new Uint8Array([])), null);
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8])), null);
  assert.equal(detectImageType(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(detectImageType(new TextEncoder().encode("GIF89a")), null);
});

test("participant token round-trips and rejects tampered/foreign tokens", () => {
  process.env.PARTICIPANT_TOKEN_SECRET = "test-secret-at-least-32-chars-long!!";
  const token = generateParticipantAccessToken("ILL26-ABCDEF");
  assert.ok(token?.startsWith("ILL26-ABCDEF."));
  assert.equal(isValidParticipantAccessToken(token), true);
  assert.equal(isValidParticipantAccessToken(`${token}x`), false);
  assert.equal(isValidParticipantAccessToken("ILL26-XXXXXX.invalidsignature"), false);
  assert.equal(isValidParticipantAccessToken("garbage"), false);
  assert.equal(hashParticipantAccessToken(token).length, 64);
});

test("payment state machine is terminal for verified and reversible for rejected", () => {
  assert.equal(canTransitionPayment("payment_pending", "submitted_for_verification"), true);
  assert.equal(canTransitionPayment("submitted_for_verification", "verified"), true);
  assert.equal(canTransitionPayment("submitted_for_verification", "rejected"), true);
  assert.equal(canTransitionPayment("rejected", "submitted_for_verification"), true);
  assert.equal(canTransitionPayment("verified", "submitted_for_verification"), false);
  assert.equal(canTransitionPayment("verified", "rejected"), false);
  assert.equal(canTransitionPayment("payment_pending", "verified"), false);
});
