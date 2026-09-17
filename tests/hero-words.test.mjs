import assert from "node:assert/strict";
import test from "node:test";
import { heroWordClass, isBusinessToken, stripTrailingPunctuation } from "../src/lib/hero-words.ts";

test("idea (any case, trailing punctuation) gets the accent class", () => {
  for (const word of ["idea", "Idea", "IDEA", "idea,", "Idea."]) {
    assert.equal(heroWordClass(word), "hero-word hero-accent");
  }
});

test("non-keyword tokens render as plain headline words", () => {
  for (const word of ["Problems", "business", "Business.", "ideas", "ideal", ""]) {
    assert.equal(heroWordClass(word), "hero-word");
  }
});

test("business tokens are detected regardless of case and punctuation", () => {
  assert.equal(isBusinessToken("business"), true);
  assert.equal(isBusinessToken("Business."), true);
  assert.equal(isBusinessToken("BUSINESS!"), true);
  assert.equal(isBusinessToken("businesses"), false);
  assert.equal(isBusinessToken("idea"), false);
});

test("trailing punctuation is stripped for stem measurement", () => {
  assert.equal(stripTrailingPunctuation("Business."), "Business");
  assert.equal(stripTrailingPunctuation("..."), "");
  assert.equal(stripTrailingPunctuation("plain"), "plain");
});
