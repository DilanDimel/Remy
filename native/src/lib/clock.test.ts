import { test } from "node:test";
import assert from "node:assert/strict";
import { shift } from "./clock.ts";

test("shift moves and wraps round midnight", () => {
  assert.equal(shift("19:00", 5), "19:05");
  assert.equal(shift("23:30", 60), "00:30");
  assert.equal(shift("00:00", -5), "23:55");
});
