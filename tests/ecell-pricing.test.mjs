import assert from "node:assert/strict";
import test from "node:test";
import { ECELL_MEMBER_AMOUNT, ECELL_STANDARD_AMOUNT, getDisplayAmount, isEcellOverrideApplied } from "../src/lib/ecell-pricing.ts";

test("ecell display override converts 599 to 699 only when flagged", () => {
  assert.equal(getDisplayAmount(599, true), 699);
  assert.equal(getDisplayAmount(599, false), 599);
  assert.equal(getDisplayAmount(599, undefined), 599);
});

test("ecell flag never changes 699 or null snapshots", () => {
  assert.equal(getDisplayAmount(699, true), 699);
  assert.equal(getDisplayAmount(699, false), 699);
  assert.equal(getDisplayAmount(699, null), 699);
  assert.equal(getDisplayAmount(null, true), null);
  assert.equal(getDisplayAmount(null, false), null);
  assert.equal(getDisplayAmount(null, undefined), null);
  assert.equal(getDisplayAmount(null, null), null);
  assert.equal(getDisplayAmount(undefined, true), null);
  assert.equal(getDisplayAmount(undefined, false), null);
  assert.equal(getDisplayAmount(undefined, undefined), null);
  assert.equal(getDisplayAmount(599, null), 599);
});

test("exposes canonical amounts and override predicate", () => {
  assert.equal(ECELL_STANDARD_AMOUNT, 599);
  assert.equal(ECELL_MEMBER_AMOUNT, 699);
  assert.equal(isEcellOverrideApplied(599, true), true);
  assert.equal(isEcellOverrideApplied(599, false), false);
  assert.equal(isEcellOverrideApplied(599, null), false);
  assert.equal(isEcellOverrideApplied(599, undefined), false);
  assert.equal(isEcellOverrideApplied(699, true), false);
  assert.equal(isEcellOverrideApplied(null, true), false);
  assert.equal(isEcellOverrideApplied(undefined, true), false);
});
