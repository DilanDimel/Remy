// Daily path (stage 7): one card keeps the streak, rest days skip, a freeze covers one missed day, cards add XP once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyStreak, dailyXp, dayKey, markDay, shiftDay, weekDots, withCard } from "../shared/daily";

const run = (from: string, n: number, skip: string[] = []) => {
  let g = { weeks: {} } as Parameters<typeof withCard>[0];
  for (let i = 0; i < n; i++) { const k = shiftDay(from, i); if (!skip.includes(k)) g = withCard(g, "role", k); }
  return g;
};

test("daily streak: counts days in a row and stays alive while today is open", () => {
  const g = run("2026-11-16", 3); // Mon to Wed
  assert.equal(dailyStreak(g, "2026-11-18").days, 3);
  const thu = dailyStreak(g, "2026-11-19");
  assert.equal(thu.days, 3, "today not played yet: yesterday's streak still counts");
  assert.equal(thu.todayDone, false);
  assert.equal(dailyStreak(g, "2026-11-20").days, 0, "a full missed day with no freeze ends it");
});

test("daily streak: 7 days earn a freeze that covers one missed day, rest days skip", () => {
  const g = run("2026-11-02", 9, ["2026-11-09"]); // 7 days, miss the 8th, play the 9th
  const s = dailyStreak(g, "2026-11-10");
  assert.equal(s.status["2026-11-09"], "freeze");
  assert.equal(s.days, 8, "the frozen day doesn't add but doesn't break it");
  assert.equal(s.freezes, 0);
  const rest = run("2026-11-16", 3, ["2026-11-17"]);
  assert.equal(dailyStreak({ ...rest, restDays: [2] }, "2026-11-18").days, 2, "Tuesday is a rest day");
  assert.equal(weekDots({ ...rest, restDays: [2] }, "2026-11-18")[1].status, "rest");
});

test("daily cards: once per card per day, XP at 10 each, the match email counts as a day", () => {
  let g = withCard(withCard({ weeks: {} }, "role", "2026-11-22"), "role", "2026-11-22");
  assert.deepEqual(g.days?.["2026-11-22"], ["role"]);
  g = markDay(g, "2026-11-23");
  assert.equal(dailyXp(g), 20);
  assert.equal(dailyStreak(g, "2026-11-23").days, 2);
});

test("the day rolls over at 4 AM, so a 1 AM round counts for the evening before", () => {
  assert.equal(dayKey(new Date(2026, 10, 23, 1, 30)), "2026-11-22");
  assert.equal(dayKey(new Date(2026, 10, 23, 4, 0)), "2026-11-23");
  assert.equal(dayKey(new Date(2026, 10, 22, 23, 59)), "2026-11-22");
});
