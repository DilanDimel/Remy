// The AI's almost-JSON is repaired before a request fails. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "./ai";

test("raw line breaks inside a quoted string are escaped; breaks between fields stay", () => {
  const reply = '{"facts":[{"text":"Led the club",\n "quote":"President, Finance Club\nAug 2025 - Present\tTCU"}],}';
  assert.deepEqual(extractJson(reply), { facts: [{ text: "Led the club", quote: "President, Finance Club\nAug 2025 - Present\tTCU" }] });
  assert.deepEqual(extractJson('{"a":"say \\"hi\\"\nthen"}'), { a: 'say "hi"\nthen' });
  assert.throws(() => extractJson("not json"), /not valid JSON/);
});
