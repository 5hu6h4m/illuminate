import assert from "node:assert/strict";
import test from "node:test";
import { resolveManualPricing, sumVerifiedSnapshotRevenue } from "../src/lib/payment-pricing.ts";

const pricing = {
  earlyBirdAmount: 599,
  regularAmount: 699,
};

test("maps the organizer-selected Early Bird tier to the configured amount", () => {
  const result = resolveManualPricing({ ...pricing, tier: "early_bird" });
  assert.equal(result.tier, "early_bird");
  assert.equal(result.amount, 599);
});

test("maps the organizer-selected Regular tier to the configured amount", () => {
  const result = resolveManualPricing({ ...pricing, tier: "regular" });
  assert.equal(result.tier, "regular");
  assert.equal(result.amount, 699);
});

test("rejects invalid manual tier or amount configuration", () => {
  assert.throws(() => resolveManualPricing({ ...pricing, tier: "other" }), /invalid/i);
  assert.throws(() => resolveManualPricing({ ...pricing, tier: "early_bird", earlyBirdAmount: 0 }), /invalid/i);
  assert.throws(() => resolveManualPricing({ ...pricing, tier: "regular", regularAmount: -1 }), /invalid/i);
});

test("calculates verified revenue from immutable snapshots and excludes test records", () => {
  assert.equal(sumVerifiedSnapshotRevenue([
    { isTest: false, payment: { status: "verified", snapshot: { expectedAmount: 599 } } },
    { isTest: false, payment: { status: "verified", snapshot: { expectedAmount: 699 } } },
    { isTest: false, payment: { status: "submitted_for_verification", snapshot: { expectedAmount: 699 } } },
    { isTest: true, payment: { status: "verified", snapshot: { expectedAmount: 699 } } },
  ]), 1298);
});
