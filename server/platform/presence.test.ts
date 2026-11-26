// Using Remy (Admin → Team & hours): owners' own use is counted, students never are. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { action, activity, areaOf, beat } from "./presence";
import { q } from "./sql";

process.env.OWNER_EMAILS = "founder@test.edu,mate@test.edu";
const owner = { kind: "google" as const, email: "Founder@test.edu" };
const at = (iso: string) => new Date(iso);

test("areas: website and app paths get the names people know", () => {
  assert.equal(areaOf("/"), "Home");
  assert.equal(areaOf("/opportunities?x=1"), "Jobs");
  assert.equal(areaOf("/jobs"), "Jobs");
  assert.equal(areaOf("/admin"), "Owners' dashboard");
  assert.equal(areaOf("/something-new"), "Other");
});

test("students and guests: a beat stores nothing", async () => {
  assert.equal(await beat({ kind: "google", email: "student@school.edu" }, { path: "/resume" }), false);
  assert.equal(await beat({ kind: "guest", email: "founder@test.edu" }, { path: "/resume" }), false);
  assert.equal(await beat(null, {}), false);
  await action({ id: "s", kind: "google", email: "student@school.edu" } as any, "POST", "/api/remy/ask");
  assert.equal((await q("SELECT count(*)::int AS n FROM owner_minutes WHERE email = 'student@school.edu'"))[0].n, 0);
  assert.equal((await q("SELECT count(*)::int AS n FROM owner_actions WHERE email = 'student@school.edu'"))[0].n, 0);
});

test("owners: minutes, visits, days, devices, areas, actions and the 8-week trend", async () => {
  const now = at("2026-11-26T22:00:00Z");
  // Today: 3 minutes on Resume from the website, a 40-minute gap, then 2 in the app (two visits).
  for (const t of ["21:00", "21:01", "21:02"]) assert.equal(await beat(owner, { path: "/resume", device: "desktop" }, at(`2026-11-26T${t}:30Z`)), true);
  for (const t of ["21:45", "21:46"]) await beat(owner, { path: "/admin", device: "app" }, at(`2026-11-26T${t}:10Z`));
  await beat(owner, { path: "/resume", device: "desktop" }, at("2026-11-26T21:46:50Z")); // same minute again: still one minute
  await beat(owner, { path: "/jobs", device: "phone" }, at("2026-11-24T18:00:00Z")); // two days ago
  await beat(owner, { path: "/jobs", device: "phone" }, at("2026-11-17T18:00:00Z")); // the week before
  await action({ id: "f", kind: "google", email: "founder@test.edu", owner: true } as any, "POST", "/api/remy/ask");
  await action({ id: "f", kind: "google", email: "founder@test.edu", owner: true } as any, "POST", "/api/admin/tasks"); // dashboard actions don't count

  const a = await activity("founder@test.edu", now);
  assert.deepEqual(a.people.map((p) => p.email), ["founder@test.edu", "mate@test.edu"]); // alphabetical, everyone listed
  const f = a.people[0];
  assert.equal(f.me, true);
  assert.equal(f.minutes, 6);
  assert.equal(f.prevMinutes, 1);
  assert.equal(f.visits, 3);
  assert.equal(f.perDay.filter(Boolean).length, 2);
  assert.equal(f.perDay[6], 5);
  assert.deepEqual(f.devices, { desktop: 4, phone: 1, app: 1 });
  assert.equal(f.areas[0].name, "Resume");
  assert.equal(f.dashboard, 1);
  assert.equal(f.lastDevice, "desktop");
  assert.equal(f.weeks[7], 6);
  assert.equal(f.weeks[6], 1);
  assert.deepEqual(f.did, [{ label: "asked Remy", n: 1 }]);
  assert.ok(f.notOpened.includes("Interview") && !f.notOpened.includes("Resume"));
  const m = a.people[1];
  assert.equal(m.minutes, 0);
  assert.equal(m.lastSeen, null);
  assert.equal(a.goalDays, 3);
});
