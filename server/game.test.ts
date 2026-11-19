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
  const { createSession, ensureUser, saveWorkspace, loadWorkspace } = await import("./db");
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
  } finally { server.close(); }
});
