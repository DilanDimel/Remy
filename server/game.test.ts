// Career quest: missions finish from real actions, the weekly streak forgives one missed week, XP and levels add up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { counters, doneThisWeek, levelOf, levelReward, nextOutfit, rankOf, streak, unlockedOutfits, weekKey, weekMissions, xpOf } from "../shared/game";
import { emptyWorkspace } from "./platform/db";

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
  assert.equal(levelOf(300).name, "Explorer");
  assert.equal(levelOf(0, 3).name, "Builder", "a level once reached is kept");
  assert.equal(levelOf(5000).max, true);
});

test("career quest, skeptic fixes: the week's missions stay fixed; the freeze holds on a Monday; bonus needs this week's three", async () => {
  const { missionsOf, xpOf } = await import("../shared/game");
  const w = emptyWorkspace();
  const key = "2026-11-23";
  const g = { weeks: { [key]: { base: counters(w), done: [] as string[], missions: ["person", "save", "tailor"] } } };
  w.contacts = [{ id: "c1" } as any];
  w.resume = { doc: { sections: [], skills: [], contact: {} } } as any; // a resume arrives mid-week: the pool would change
  assert.deepEqual(missionsOf(w, g, key).map((m) => m.key), ["person", "save", "tailor"]);
  assert.deepEqual(doneThisWeek(w, g, key, counters(w)), ["person"]);
  const wk = (done: string[]) => ({ base: {}, done });
  assert.deepEqual(streak({ weeks: { "2026-11-23": wk([]), "2026-11-16": wk([]), "2026-11-09": wk(["rate"]), "2026-11-02": wk(["save"]) } }, "2026-11-23"), { weeks: 2, freezeUsed: true });
  // Three done keys that aren't this week's list don't earn the all-three bonus.
  assert.equal(xpOf(emptyWorkspace(), { weeks: { [key]: { base: {}, done: ["person", "save", "rate"], missions: ["person", "save", "tailor"] } } }), 40 + 35 + 45);
});

test("career quest: the server merges weeks, so a stale tab can't wipe a week or its finished missions", async () => {
  const { registerRoutes } = await import("./routes");
  const { createSession, ensureUser, saveWorkspace, loadWorkspace } = await import("./platform/db");
  const express = (await import("express")).default;
  const { createServer } = await import("node:http");
  const app = express(); app.use(express.json({ limit: "5mb" }));
  const server = createServer(app); await registerRoutes(server, app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  try {
    const me = { id: "g:gametest", kind: "google", email: "gametest@example.com", name: "", picture: "" } as any;
    await ensureUser(me);
    const ws = emptyWorkspace(); ws.game = { weeks: { "2026-11-16": { base: { saved: 1 }, done: ["save", "person"], missions: ["person", "save", "tailor"] } } };
    await saveWorkspace(me.id, ws);
    const s = await createSession(me.id);
    const put = (value: unknown) => fetch(`http://localhost:${port}/api/ws/game`, { method: "PUT", headers: { "content-type": "application/json", cookie: `__Host-or_sid=${s.token}`, origin: `http://localhost:${port}` }, body: JSON.stringify({ value }) });
    // A stale tab that never saw the week re-creates it empty with higher counts.
    const r = await put({ weeks: { "2026-11-16": { base: { saved: 5 }, done: [], missions: ["rate", "save", "story"] } } });
    assert.equal(r.status, 200);
    const after = (await loadWorkspace(me.id)).game!.weeks["2026-11-16"];
    assert.deepEqual(after.done, ["save", "person"]);
    assert.deepEqual(after.base, { saved: 1 });
    assert.deepEqual(after.missions, ["person", "save", "tailor"]);
    // Owner pins: a seen tier never goes back down, so a stale tab can't replay the new-pin moment.
    assert.equal((await put({ weeks: {}, pins: { tailor: 2, story: 1 } })).status, 200);
    assert.equal((await put({ weeks: {}, pins: { tailor: 1 } })).status, 200);
    assert.deepEqual((await loadWorkspace(me.id)).game!.pins, { tailor: 2, story: 1 });
    assert.equal((await put({ weeks: {}, pins: { tailor: 9 } })).status, 400, "tiers are 0 to 3");
  } finally { server.close(); }
});

test("career quest, council: a sent application keeps its XP when withdrawn; deleting the row removes it", () => {
  const w = emptyWorkspace();
  w.tracker = [{ id: "t1", status: "Withdrawn", events: [{ id: "e1", at: "2026-11-10T00:00:00Z", status: "Applied" }, { id: "e2", at: "2026-11-12T00:00:00Z", status: "Withdrawn" }] } as any,
    { id: "t2", status: "Withdrawn", events: [{ id: "e3", at: "2026-11-10T00:00:00Z", status: "Saved" }] } as any];
  assert.equal(counters(w).sent, 1, "withdrawn after applying still counts; withdrawn before applying doesn't");
  const g = { weeks: {} };
  assert.equal(xpOf(w, g), 120);
  w.tracker = [];
  assert.equal(xpOf(w, g), 0);
});

test("career quest: Log a win is a bonus, done when a Check-in line is approved this week, worth its XP", async () => {
  const { winThisWeek, WIN } = await import("../shared/game");
  const w = emptyWorkspace();
  assert.equal(winThisWeek(w, "2026-11-16"), false);
  w.memory.push({ id: "f1", text: "Ran the tabling shift", category: "experience", source: "Check-in", status: "approved", createdAt: "2026-11-18T15:00:00Z", updatedAt: "" });
  assert.equal(winThisWeek(w, "2026-11-16"), true);
  assert.equal(winThisWeek(w, "2026-11-23"), false, "last week's win doesn't count this week");
  assert.equal(xpOf(emptyWorkspace(), { weeks: { "2026-11-16": { base: {}, done: [WIN.key] } } }), WIN.xp);
  assert.equal(streak({ weeks: { "2026-11-16": { base: {}, done: [WIN.key] } } }, "2026-11-16").weeks, 1, "a win also keeps the streak");
});

test("career quest: a Sunday-evening win (Monday in UTC) counts for its own week only (skeptic review)", async () => {
  const { winThisWeek } = await import("../shared/game");
  const tz = process.env.TZ; process.env.TZ = "America/Chicago";
  try {
    const w = emptyWorkspace();
    w.memory.push({ id: "f1", text: "x", category: "experience", source: "Check-in", status: "approved", createdAt: "2026-11-23T02:00:00Z", updatedAt: "" });
    assert.equal(winThisWeek(w, "2026-11-16"), true, "Sunday Nov 22, 8pm Central belongs to the week of Nov 16");
    assert.equal(winThisWeek(w, "2026-11-23"), false, "and isn't counted again on Monday");
  } finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; }
});

test("Log a win: the student's own sentence becomes the line when the AI's adds words (only their words)", async () => {
  const { ownLine, cleanCheckin } = await import("./coach/checkin");
  assert.equal(ownLine("Ran the NABA tabling shift at the spring org fair and signed up 15 new members."), "Ran the NABA tabling shift at the spring org fair and signed up 15 new members");
  assert.equal(ownLine("I organized our club's first study night"), "Organized our club's first study night");
  assert.equal(ownLine("it was a good week at work"), "", "not a resume line: no line offered");
  const d = cleanCheckin("Club", "Ran the NABA tabling shift at the spring org fair and signed up 15 new members", { fact: "x", bullet: "Spearheaded NABA recruitment, driving 15 sign-ups" });
  assert.equal(d.bullet, "Ran the NABA tabling shift at the spring org fair and signed up 15 new members");
});

test("owner trail: ranks never drop and levels unlock Remy's outfits", () => {
  assert.equal(rankOf(0).n, 1);
  assert.equal(rankOf(700).name, "Analyst");
  assert.equal(rankOf(100, 9).n, 9, "the best rank reached is kept");
  assert.deepEqual(unlockedOutfits(1), ["suit"]);
  assert.deepEqual(unlockedOutfits(5), ["suit", "tweed", "navy"]);
  assert.ok(unlockedOutfits(1, "Graduated").includes("gown"));
  assert.deepEqual(nextOutfit(4), ["navy", 5]);
  assert.equal(nextOutfit(15), undefined);
});

test("season rewards: every level from 2 to 15 gives an outfit or an office item", () => {
  for (let n = 2; n <= 15; n++) assert.ok(levelReward(n), `level ${n} has a reward`);
  assert.deepEqual(levelReward(5), { kind: "outfit", key: "navy", level: 5 });
  assert.equal(levelReward(2)?.kind, "item");
  assert.equal(levelReward(16), null);
});
