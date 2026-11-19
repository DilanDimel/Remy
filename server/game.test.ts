// Career quest: missions finish from real actions, the weekly streak forgives one missed week, XP and levels add up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { counters, doneThisWeek, levelOf, streak, weekKey, weekMissions, xpOf } from "../shared/game";
import { emptyWorkspace } from "./db";

test("career quest: a mission is done when its count goes up by the target this week", () => {
  const w = emptyWorkspace();
  const key = weekKey(new Date("2026-11-19T12:00:00"));
  assert.equal(key, "2026-11-16", "weeks start on Monday");
  const g = { weeks: { [key]: { base: counters(w), done: [] as string[] } } };
  const missions = weekMissions(w, key);
  assert.equal(missions.length, 3);
  assert.ok(!missions.some((m) => m.key === "number" || m.key === "apply" || m.key === "story"), "no resume, nothing tailored, no stories: those missions wait");
  // The student saves 2 openings and adds a contact.
  w.savedJobIds = ["j1", "j2"]; w.contacts = [{ id: "c1" } as any];
  const done = doneThisWeek(w, g, key, counters(w));
  for (const m of missions) assert.equal(done.includes(m.key), (m.key === "save") || (m.key === "person"), m.key);
});

test("career quest: weekly streak counts back, one missed week is covered by the freeze, two aren't", () => {
  const wk = (done: string[]) => ({ base: {}, done });
  const g = { weeks: { "2026-11-16": wk([]), "2026-11-09": wk(["rate"]), "2026-11-02": wk([]), "2026-10-26": wk(["save"]), "2026-10-19": wk(["rate"]) } };
  assert.deepEqual(streak(g, "2026-11-16"), { weeks: 3, freezeUsed: true }, "this week still open; last week + freeze + two before");
  const two = { weeks: { "2026-11-09": wk(["rate"]), "2026-11-02": wk([]), "2026-10-26": wk([]), "2026-10-19": wk(["rate"]) } };
  assert.equal(streak(two, "2026-11-16").weeks, 1);
  assert.equal(streak({ weeks: {} }, "2026-11-16").weeks, 0);
});

test("career quest: XP from missions (all-three bonus) and real wins; levels", () => {
  const w = emptyWorkspace();
  const g = { weeks: { "2026-11-16": { base: {}, done: ["rate", "save", "person"] } } };
  assert.equal(xpOf(w, g), 45 + 35 + 40 + 50);
  assert.equal(levelOf(0).name, "Rookie");
  assert.equal(levelOf(300).name, "Prospect");
  assert.equal(levelOf(5000).max, true);
});
