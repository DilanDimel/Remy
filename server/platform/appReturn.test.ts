import { test } from "node:test";
import assert from "node:assert/strict";
import { appReturnPage, putHandoff, takeHandoff } from "./auth";

test("appReturnPage hands only the code or error to remy://auth, escaped", () => {
  const ok = appReturnPage({ code: "abc-123", state: "x", next: "https://evil.example" });
  assert.match(ok, /href="remy:\/\/auth\?code=abc-123"/);
  assert.doesNotMatch(ok, /evil|state=/);
  const bad = appReturnPage({ error: "access_denied", error_description: 'No "way" <b>' });
  assert.match(bad, /remy:\/\/auth\?error=access_denied&amp;error_description=No\+%22way%22\+%3Cb%3E/);
  assert.doesNotMatch(bad, /<b>/);
  assert.match(appReturnPage({ code: "c1" }, true), /href="intent:\/\/auth\?code=c1#Intent;scheme=remy;package=org\.remyai\.app;end"/);
});

test("Expo Go handoff: the page saves the code under the app's key, the app takes it once", () => {
  const key = "k".repeat(30);
  assert.match(appReturnPage({ code: "c9", state: key }), /You're signed in/);
  assert.equal(takeHandoff(key), "code=c9");
  assert.equal(takeHandoff(key), null);
  assert.equal(putHandoff("short", new URLSearchParams("code=x")), false);
  assert.match(appReturnPage({ code: "c9", state: "bad key!" }), /Almost done/);
  putHandoff(key, new URLSearchParams("code=old"), 0);
  assert.equal(takeHandoff(key, 200_000), null);
});
