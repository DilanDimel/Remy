import { test } from "node:test";
import assert from "node:assert/strict";
import { greetingFor } from "@shared/greeting";

test("late at night the greeting is a plain Hey, not good evening or good night", () => {
  assert.deepEqual([23, 0, 3, 4, 11, 12, 17, 18, 21, 22].map(greetingFor),
    ["Hey", "Hey", "Hey", "Good morning", "Good morning", "Good afternoon", "Good afternoon", "Good evening", "Good evening", "Hey"]);
});
