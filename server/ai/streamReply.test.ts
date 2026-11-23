import { test } from "node:test";
import assert from "node:assert/strict";
import { partialReply } from "./streamReply";

test("partialReply reads the reply text while the JSON is still arriving", () => {
  assert.equal(partialReply(""), "");
  assert.equal(partialReply('{"rep'), "");
  assert.equal(partialReply('{"reply": "'), "");
  assert.equal(partialReply('{"reply":"Hi Mas'), "Hi Mas");
  assert.equal(partialReply('{"reply":"Hi Master.","remember":[]}'), "Hi Master.");
});

test("partialReply decodes escapes and waits for half-written ones", () => {
  assert.equal(partialReply('{"reply":"• One\\n• Two'), "• One\n• Two");
  assert.equal(partialReply('{"reply":"Say \\"hi\\" now'), 'Say "hi" now');
  assert.equal(partialReply('{"reply":"a\\'), "a");
  assert.equal(partialReply('{"reply":"caf\\u00e9'), "café");
  assert.equal(partialReply('{"reply":"caf\\u00'), "caf");
  assert.equal(partialReply('```json\n{"reply":"**Bold** text'), "**Bold** text");
});
