import { test } from "node:test";
import assert from "node:assert/strict";
import { guessYear } from "@shared/roads";

test("guessYear reads the class year from the expected graduation", () => {
  const fall = new Date(2026, 10, 23), spring = new Date(2027, 1, 10);
  assert.equal(guessYear("May 2029", fall), "Sophomore");
  assert.equal(guessYear("May 2027", fall), "Senior");
  assert.equal(guessYear("May 2030", fall), "First-year");
  assert.equal(guessYear("May 2029", spring), "Sophomore");
  assert.equal(guessYear("May 2031", fall), "");
  assert.equal(guessYear("", fall), "");
});
