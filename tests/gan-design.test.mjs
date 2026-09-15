import assert from "node:assert/strict";
import test from "node:test";
import { parseGanArgs, RUBRIC_WEIGHTS, scoreDesign } from "../scripts/gan-design.mjs";

test("defaults: max-iterations 10, pass-threshold 7.5", () => {
  const parsed = parseGanArgs(["my brief"]);
  assert.equal(parsed.brief, "my brief");
  assert.equal(parsed.maxIterations, 10);
  assert.equal(parsed.passThreshold, 7.5);
});

test("parses brief + --max-iterations + --pass-threshold", () => {
  const parsed = parseGanArgs(["hello world", "--max-iterations", "3", "--pass-threshold", "8"]);
  assert.equal(parsed.brief, "hello world");
  assert.equal(parsed.maxIterations, 3);
  assert.equal(parsed.passThreshold, 8);
});

test("supports --max-iterations=3 / --pass-threshold=8 equals form", () => {
  const parsed = parseGanArgs(["brief text", "--max-iterations=4", "--pass-threshold=6.5"]);
  assert.equal(parsed.maxIterations, 4);
  assert.equal(parsed.passThreshold, 6.5);
});

test("throws when brief is missing", () => {
  assert.throws(() => parseGanArgs([]), /brief/);
  assert.throws(() => parseGanArgs(["--max-iterations", "3"]), /brief/);
});

test("throws on non-positive iterations / out-of-range threshold", () => {
  assert.throws(() => parseGanArgs(["b", "--max-iterations", "0"]), /max-iterations/);
  assert.throws(() => parseGanArgs(["b", "--pass-threshold", "11"]), /pass-threshold/);
});

test("rubric weights match design spec and sum to 1", () => {
  assert.deepEqual(RUBRIC_WEIGHTS, {
    designQuality: 0.35,
    originality: 0.3,
    craft: 0.25,
    functionality: 0.1,
  });
  const sum = Object.values(RUBRIC_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("scoreDesign computes weighted 0-10 score", () => {
  // 0.35*8 + 0.30*7 + 0.25*9 + 0.10*10 = 2.8 + 2.1 + 2.25 + 1.0 = 8.15
  const score = scoreDesign({ designQuality: 8, originality: 7, craft: 9, functionality: 10 });
  assert.ok(Math.abs(score - 8.15) < 1e-9);
});
