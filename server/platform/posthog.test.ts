import { test } from "node:test";
import assert from "node:assert/strict";
import { posthogConfig } from "./posthog";

test("posthog: default key, US host, and an empty POSTHOG_KEY switches it off", () => {
  assert.equal(posthogConfig({})?.host, "https://us.i.posthog.com");
  assert.match(posthogConfig({})!.key, /^phc_/);
  assert.equal(posthogConfig({ POSTHOG_KEY: "" }), null);
  assert.equal(posthogConfig({ POSTHOG_KEY: "phc_x", POSTHOG_HOST: "https://eu.i.posthog.com" })?.host, "https://eu.i.posthog.com");
});

test("posthog: AI events carry numbers only, and nothing for guests or Do Not Track", async () => {
  const { aiEvent } = await import("./posthog");
  assert.equal(aiEvent(null, { model: "m", provider: "p", ms: 10, streamed: false }), null);
  const e = aiEvent({ distinctId: "u1", feature: "POST /api/ai/chat" }, { model: "anthropic/claude-haiku-5.5", provider: "OpenRouter", ms: 1500, streamed: true, usage: { prompt_tokens: 900, completion_tokens: 120, cost: 0.0012 } })!;
  assert.equal(e.event, "$ai_generation");
  assert.equal(e.properties.$ai_latency, 1.5);
  assert.equal(e.properties.$ai_total_cost_usd, 0.0012);
  assert.equal(e.properties.feature, "POST /api/ai/chat");
  assert.ok(!("$ai_input" in e.properties) && !("$ai_output_choices" in e.properties));
});
