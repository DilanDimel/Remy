import { test } from "node:test";
import assert from "node:assert/strict";
import { many, remyLine } from "../shared/homeLine";

const base = { hour: 10, interviewSoon: false, cheer: false, done: 2, total: 5, newJobs: 0, deadlines: 0, pending: 0 };

test("many pluralises", () => {
  assert.equal(many(1, "suggested change"), "1 suggested change");
  assert.equal(many(3, "suggested change"), "3 suggested changes");
});

test("remyLine picks the most urgent line first", () => {
  assert.match(remyLine({ ...base, interviewSoon: true, deadlines: 2 }), /^Big couple of days/);
  assert.match(remyLine({ ...base, deadlines: 1 }), /^1 deadline this week\. I'm keeping it/);
  assert.match(remyLine({ ...base, deadlines: 2 }), /^2 deadlines this week\. I'm keeping them/);
  assert.match(remyLine({ ...base, newJobs: 1 }), /^1 new opening since/);
  assert.match(remyLine({ ...base, hour: 23 }), /^Late one/);
  assert.match(remyLine({ ...base, done: 0 }), /^Let's start small/);
  assert.equal(remyLine({ ...base }), "2 of 5 getting-started steps done. 3 to go, and none take long.");
  assert.match(remyLine({ ...base, done: 5 }), /^Here's where things stand/);
});

test("a different tip each day when nothing is urgent, and the same one all day", async () => {
  const { remyLine, tipOfDay, TIPS } = await import("@shared/homeLine");
  const calm = { hour: 12, interviewSoon: false, cheer: false, done: 5, total: 5, newJobs: 0, deadlines: 0, pending: 0 };
  assert.equal(remyLine({ ...calm, day: "2026-11-23" }), tipOfDay("2026-11-23"));
  assert.notEqual(tipOfDay("2026-11-23"), tipOfDay("2026-11-24"));
  assert.equal(new Set(Array.from({ length: TIPS.length }, (_, i) => tipOfDay(`2026-12-${String(i + 1).padStart(2, "0")}`))).size, TIPS.length);
  assert.match(remyLine({ ...calm, deadlines: 1, day: "2026-11-23" }), /deadline/); // urgent things still win
  const { spoken } = await import("../client/src/lib/voice");
  assert.equal(spoken("• **Saved** it. See [Calendar](/calendar)."), "Saved it. See Calendar.");
});
