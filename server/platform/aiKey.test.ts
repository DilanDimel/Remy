// The lead AI's key: owners' board read-only plus "Mark fixed". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiKeyMe, AI_ME } from "./aiKey";

const KEY = "k".repeat(40);
test("the right key reads the owners' board and marks errors fixed", () => {
  assert.equal(aiKeyMe(`Bearer ${KEY}`, "GET", "/api/admin/errors", KEY), AI_ME);
  assert.equal(aiKeyMe(`Bearer ${KEY}`, "POST", "/api/admin/errors/fix", KEY), AI_ME);
});
test("it can't change anything else or see feedback screenshots", () => {
  assert.equal(aiKeyMe(`Bearer ${KEY}`, "DELETE", "/api/admin/members/x", KEY), "denied");
  assert.equal(aiKeyMe(`Bearer ${KEY}`, "POST", "/api/admin/beta", KEY), "denied");
  assert.equal(aiKeyMe(`Bearer ${KEY}`, "GET", "/api/admin/feedback/3/screenshot", KEY), "denied");
  assert.equal(aiKeyMe(`Bearer ${KEY}`, "GET", "/api/workspace", KEY), "denied");
});
test("a wrong, missing or too-short key is ignored", () => {
  assert.equal(aiKeyMe(`Bearer ${"x".repeat(40)}`, "GET", "/api/admin/errors", KEY), null);
  assert.equal(aiKeyMe(undefined, "GET", "/api/admin/errors", KEY), null);
  assert.equal(aiKeyMe("Bearer short", "GET", "/api/admin/errors", "short"), null);
});
