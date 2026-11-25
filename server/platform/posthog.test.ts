import { test } from "node:test";
import assert from "node:assert/strict";
import { posthogConfig } from "./posthog";

test("posthog: default key, US host, and an empty POSTHOG_KEY switches it off", () => {
  assert.equal(posthogConfig({})?.host, "https://us.i.posthog.com");
  assert.match(posthogConfig({})!.key, /^phc_/);
  assert.equal(posthogConfig({ POSTHOG_KEY: "" }), null);
  assert.equal(posthogConfig({ POSTHOG_KEY: "phc_x", POSTHOG_HOST: "https://eu.i.posthog.com" })?.host, "https://eu.i.posthog.com");
});
