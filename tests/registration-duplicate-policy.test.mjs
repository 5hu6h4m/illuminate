import assert from "node:assert/strict";
import test from "node:test";
import {
  decideExistingIdentityDuplicate,
  isIdempotentReplayForIdentity,
  isInRegistrationScope,
} from "../src/lib/registration-duplicate-policy.ts";

test("an exact idempotent retry is the only production path that may resume an authorized continuation", () => {
  assert.equal(isIdempotentReplayForIdentity(
    { normalizedEmail: "student@example.com", normalizedPhone: "9876543210" },
    { normalizedEmail: "student@example.com", normalizedPhone: "9876543210" },
  ), true);
  assert.equal(decideExistingIdentityDuplicate("payment_pending", "production").kind, "safe_conflict");
  assert.equal(decideExistingIdentityDuplicate("payment_pending", "development_preview").kind, "resume_test");
});

test("an idempotency key cannot be reused to retrieve a different participant continuation", () => {
  assert.equal(isIdempotentReplayForIdentity(
    { normalizedEmail: "first@example.com", normalizedPhone: "9876543210" },
    { normalizedEmail: "second@example.com", normalizedPhone: "9876543210" },
  ), false);
});

test("a different idempotency key cannot create a second pending production registration", () => {
  const result = decideExistingIdentityDuplicate("payment_pending", "production");
  assert.deepEqual(result, {
    kind: "safe_conflict",
    code: "REGISTRATION_ALREADY_STARTED",
    message: "A registration is already in progress for these details. Continue using your secure registration link, or contact the organizer if you no longer have it.",
  });
});

test("submitted and verified production registrations return non-PII state-specific conflicts", () => {
  assert.equal(decideExistingIdentityDuplicate("submitted_for_verification", "production").code, "PAYMENT_ALREADY_SUBMITTED");
  assert.equal(decideExistingIdentityDuplicate("verified", "production").code, "REGISTRATION_ALREADY_COMPLETED");
});

test("rejected production registrations direct the participant to their existing secure resubmission link", () => {
  assert.equal(decideExistingIdentityDuplicate("rejected", "production").code, "REGISTRATION_REQUIRES_ACTION");
});

test("development test registrations and real registrations are isolated duplicate scopes", () => {
  const testRecord = { isTest: true, environment: "development" };
  const realRecord = { isTest: false, environment: "production" };
  assert.equal(isInRegistrationScope(testRecord, "development_preview"), true);
  assert.equal(isInRegistrationScope(testRecord, "production"), false);
  assert.equal(isInRegistrationScope(realRecord, "production"), true);
  assert.equal(isInRegistrationScope(realRecord, "development_preview"), false);
});
