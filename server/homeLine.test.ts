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
