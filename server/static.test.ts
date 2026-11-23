// /interview and /careers were served with a 404 status (Nov 23 PM review): every routed page must be in PAGES.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "./static";

test("static: every app page gets a 200, unknown paths don't", () => {
  for (const p of ["/", "/interview", "/careers", "/calendar/", "/accounts", "/about"]) assert.ok(PAGES.test(p), p);
  for (const p of ["/nope", "/interviews", "/api/x"]) assert.ok(!PAGES.test(p), p);
});
