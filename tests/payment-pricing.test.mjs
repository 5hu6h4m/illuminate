import assert from "node:assert/strict";
import test from "node:test";
import { calculateProductionPricing, sumVerifiedSnapshotRevenue } from "../src/lib/payment-pricing.ts";

const pricing = {
  registrationOpenAt: "2026-09-14T14:32:12.635Z",
  earlyBirdDurationHours: 120,
  earlyBirdAmount: 599,
  regularAmount: 699,
};
const cutoff = new Date("2026-09-19T14:32:12.635Z");

test("uses Early Bird pricing one second before the derived cutoff", () => {
  const result = calculateProductionPricing(pricing, new Date(cutoff.getTime() - 1000));
  assert.equal(result.tier, "early_bird");
  assert.equal(result.amount, 599);
});

test("uses Regular pricing exactly at and after the derived cutoff", () => {
  assert.equal(calculateProductionPricing(pricing, cutoff).amount, 699);
  assert.equal(calculateProductionPricing(pricing, new Date(cutoff.getTime() + 1000)).amount, 699);
});

test("calculates verified revenue from immutable snapshots and excludes test records", () => {
  assert.equal(sumVerifiedSnapshotRevenue([
    { isTest: false, payment: { status: "verified", snapshot: { expectedAmount: 599 } } },
    { isTest: false, payment: { status: "verified", snapshot: { expectedAmount: 699 } } },
    { isTest: false, payment: { status: "submitted_for_verification", snapshot: { expectedAmount: 699 } } },
    { isTest: true, payment: { status: "verified", snapshot: { expectedAmount: 699 } } },
  ]), 1298);
});
