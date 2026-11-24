import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyQuests, seasonOf } from "../shared/path";

test("seasonOf: fall until mid-December, then spring, with the goal for the student's year", () => {
  const s = seasonOf(new Date(2026, 10, 24), 2);
  assert.equal(s.name, "Fall"); assert.equal(s.left, 21); assert.equal(s.goal, "Get your first interview");
  assert.equal(seasonOf(new Date(2026, 11, 20), 1).name, "Spring");
  assert.equal(seasonOf(new Date(2026, 5, 1), 9).goal, "Find the jobs that fit you");
});

test("dailyQuests count what the student did today", () => {
  const today = "2026-11-24";
  const w = { jobFeedback: { a: { rating: 5, createdAt: "2026-11-24T15:00:00" }, b: { rating: 1, createdAt: "2026-11-24T16:00:00" }, c: { rating: 1, createdAt: "2026-11-20T16:00:00" } } } as any;
  const q = dailyQuests(w, ["role", "openings"], today);
  assert.deepEqual(q.map((x) => [x.key, x.n, x.of]), [["rate", 2, 3], ["role", 1, 1], ["xp", 20, 30]]);
});
