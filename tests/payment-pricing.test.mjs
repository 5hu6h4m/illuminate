import assert from "node:assert/strict";
import test from "node:test";
import { displayPricingTier, resolveScheduledPricing, sumVerifiedSnapshotRevenue } from "../src/lib/payment-pricing.ts";

const pricing = {
  openAt: "2026-09-15T00:00:00+05:30",
  earlyBirdEndAt: "2026-09-24T00:00:00+05:30",
  closeAt: "2026-10-06T00:00:00+05:30",
  earlyBirdAmount: 599,
  regularAmount: 699,
};

test("uses the fixed IST schedule at every registration boundary", () => {
  const cases = [
    ["before opening", "2026-09-14T23:59:59+05:30", false, null, null],
    ["opening instant", "2026-09-15T00:00:00+05:30", true, "early_bird", 599],
    ["end of 23 September", "2026-09-23T23:59:00+05:30", true, "early_bird", 599],
    ["Regular opening instant", "2026-09-24T00:00:00+05:30", true, "regular", 699],
    ["end of 5 October", "2026-10-05T23:59:00+05:30", true, "regular", 699],
    ["closing instant", "2026-10-06T00:00:00+05:30", false, null, null],
  ];
  for (const [label, instant, registrationAvailable, tier, amount] of cases) {
    const result = resolveScheduledPricing(pricing, new Date(instant));
    assert.deepEqual(result, { registrationAvailable, tier, amount }, label);
  }
});

test("rejects invalid fixed schedules and invalid price amounts", () => {
  assert.throws(() => resolveScheduledPricing({ ...pricing, earlyBirdEndAt: pricing.openAt }, new Date()), /invalid/i);
  assert.throws(() => resolveScheduledPricing({ ...pricing, closeAt: pricing.earlyBirdEndAt }, new Date()), /invalid/i);
  assert.throws(() => resolveScheduledPricing({ ...pricing, earlyBirdAmount: 0 }, new Date()), /invalid/i);
});

test("calculates verified revenue from immutable snapshots and excludes test records", () => {
  assert.equal(sumVerifiedSnapshotRevenue([
    { isTest: false, payment: { status: "verified", snapshot: { expectedAmount: 599 } } },
    { isTest: false, payment: { status: "verified", snapshot: { expectedAmount: 699 } } },
    { isTest: false, payment: { status: "submitted_for_verification", snapshot: { expectedAmount: 699 } } },
    { isTest: true, payment: { status: "verified", snapshot: { expectedAmount: 699 } } },
  ]), 1298);
});

test("display helper maps raw tiers without rewriting them", () => {
  assert.equal(displayPricingTier("early_bird"), "Early Bird");
  assert.equal(displayPricingTier("regular"), "Late Registration");
  assert.equal(displayPricingTier("development_preview"), "Development preview");
});

test("raw regular tier stays regular while displaying Late Registration", () => {
  const result = resolveScheduledPricing(pricing, new Date("2026-09-24T00:00:00+05:30"));
  assert.equal(result.tier, "regular");
  assert.equal(result.amount, 699);
  assert.equal(displayPricingTier(result.tier), "Late Registration");
  const early = resolveScheduledPricing(pricing, new Date("2026-09-15T00:00:00+05:30"));
  assert.equal(early.tier, "early_bird");
  assert.equal(displayPricingTier(early.tier), "Early Bird");
});
