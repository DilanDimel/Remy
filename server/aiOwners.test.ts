// Redesign stage 1 (Nov 21, 2026): owners trial Claude Haiku 5.5 with OpenRouter privacy rules; students unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.OPENROUTER_API_KEY ||= "test-key";
process.env.OR_AI_CHAIN = "openrouter:google/gemini-3.8-flash";
process.env.OR_AI_CHAIN_OWNERS = "openrouter:anthropic/claude-haiku-5.5,openrouter:google/gemini-3.8-flash";
const { model, runAiAs, privacyRouting } = await import("./ai/ai");

test("ai owners: an owner's request uses the trial chain, a student's keeps today's", async () => {
  assert.equal(model(), "google/gemini-3.8-flash");
  assert.equal(await runAiAs(true, async () => model()), "anthropic/claude-haiku-5.5");
  assert.equal(await runAiAs(false, async () => model()), "google/gemini-3.8-flash");
});
test("ai owners: privacy routing is zero-retention, no data collection, chosen providers only", () => {
  assert.deepEqual(privacyRouting("anthropic/claude-haiku-5.5"), { zdr: true, data_collection: "deny", order: ["amazon-bedrock"], allow_fallbacks: false });
  assert.deepEqual(privacyRouting("google/gemini-3.8-flash"), { zdr: true, data_collection: "deny", order: ["google-ai-studio", "google-vertex"], allow_fallbacks: false });
  assert.deepEqual(privacyRouting("openai/gpt-5.6-luna"), { zdr: true, data_collection: "deny" });
});
test("ai owners: the dashboard status names the owners' trial model", async () => {
  const { aiStatus } = await import("./ai/ai");
  assert.equal(aiStatus().ownerTrial, "anthropic/claude-haiku-5.5");
});
