import { test } from "node:test";
import assert from "node:assert/strict";
import { BETA_TERM_HEADS, BETA_TERMS } from "../shared/beta";

test("every beta term has its own short label, in the same order", () => {
  assert.equal(BETA_TERM_HEADS.length, BETA_TERMS.length);
  assert.ok(BETA_TERM_HEADS.every((h) => h.trim().length > 0 && h.length < 30));
});
