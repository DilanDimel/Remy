// Remy's voice: what gets said, and that a line is made once. Run with `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { forSpeech, MAX_CHARS, speech, VOICE_ID } from "./voice";

test("short lines are said as they are, long ones end on a full sentence", () => {
  assert.equal(forSpeech("  Check that I read\n your resume right. "), "Check that I read your resume right.");
  const long = "This is one sentence that goes on a while. ".repeat(40);
  const said = forSpeech(long);
  assert.ok(said.length <= MAX_CHARS && said.endsWith("."));
});

test("no key → null (browser voice); with a key the line is made once, then served from memory", async () => {
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal(await speech("Hello there."), null);

  process.env.ELEVENLABS_API_KEY = "test-key";
  const calls: string[] = [];
  const fake = (async (url: string, init: any) => {
    calls.push(url);
    assert.equal(init.headers["xi-api-key"], "test-key");
    assert.equal(JSON.parse(init.body).text, "Hello there.");
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  }) as unknown as typeof fetch;
  const first = await speech("Hello there.", fake);
  const again = await speech("Hello there.", fake);
  assert.deepEqual([first?.cached, again?.cached], [false, true]);
  assert.deepEqual([...again!.mp3], [1, 2, 3]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes(VOICE_ID));
  // Students (cacheOnly): a line already made is served, a new one is never bought.
  assert.equal((await speech("Hello there.", fake, true))?.cached, true);
  assert.equal(await speech("A brand new line.", fake, true), null);
  assert.equal(calls.length, 1);

  const failing = (async () => new Response("quota", { status: 401 })) as unknown as typeof fetch;
  assert.equal(await speech("Something new.", failing), null);
  delete process.env.ELEVENLABS_API_KEY;
});
