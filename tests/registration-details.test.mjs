import assert from "node:assert/strict";
import test from "node:test";
import {
  createRegistrationDetailsSchema,
  normalizeIndianPhone,
} from "../src/lib/registration-details.ts";
import { calculateProductionPricing } from "../src/lib/payment-pricing.ts";

test("normalizeIndianPhone handles +91, spaces, dashes, and 0-prefix edge cases", () => {
  assert.equal(normalizeIndianPhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizeIndianPhone("919876543210"), "9876543210");
  assert.equal(normalizeIndianPhone("98765-43210"), "9876543210");
  assert.equal(normalizeIndianPhone("+91-98765 43210"), "9876543210");
  // 0-prefixed and foreign numbers are NOT silently coerced to valid Indian numbers
  assert.notEqual(normalizeIndianPhone("09876543210"), "9876543210");
  assert.equal(createRegistrationDetailsSchema().safeParse({
    fullName: "Test User", email: "t@example.com", phone: "09876543210",
    college: "MET", branch: "Computer Engineering", year: "1st Year",
  }).success, false);
});

test("registration schema rejects short/foreign/invalid phones and accepts canonical", () => {
  const schema = createRegistrationDetailsSchema();
  const base = { fullName: "Test User", email: "Test@Example.com", phone: "+91 98765 43210", college: "MET", branch: "Computer Engineering", year: "1st Year" };
  const ok = schema.safeParse(base);
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.email, "test@example.com");
  for (const phone of ["12345", "123456789", "+1 4155552671", ""]) {
    assert.equal(schema.safeParse({ ...base, phone }).success, false, `phone ${phone} should reject`);
  }
});

test("pricing throws on invalid config and pins cutoff boundary", () => {
  const good = { registrationOpenAt: "2026-09-14T14:32:12.635Z", earlyBirdDurationHours: 120, earlyBirdAmount: 599, regularAmount: 699 };
  const cutoff = new Date("2026-09-19T14:32:12.635Z");
  assert.equal(calculateProductionPricing(good, new Date(cutoff.getTime() - 1)).tier, "early_bird");
  assert.equal(calculateProductionPricing(good, cutoff).tier, "regular");
  for (const bad of [
    { ...good, registrationOpenAt: "garbage" },
    { ...good, earlyBirdDurationHours: 0 },
    { ...good, earlyBirdDurationHours: -5 },
    { ...good, earlyBirdDurationHours: 1.5 },
    { ...good, earlyBirdAmount: 0 },
    { ...good, regularAmount: -1 },
  ]) {
    assert.throws(() => calculateProductionPricing(bad), /invalid/i);
  }
});
