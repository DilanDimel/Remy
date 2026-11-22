// The owners' dashboard: who is an owner, the board, and errors marked fixed. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addEvent, emails, overview, setEventPeople, addMember, errors, fixError, isOwner, recordError, removeMember, rsvp, saveTask, team, teamCalendarItems } from "./admin";

process.env.OWNER_EMAILS = "founder@test.edu";
const user = (email: string, kind: any = "supabase") => ({ kind, email });

test("owners: founders from the server, teammates added in the dashboard, never guests", async () => {
  assert.equal(await isOwner(user("founder@test.edu")), true);
  assert.equal(await isOwner(user("mate@test.edu")), false);
  await addMember("founder@test.edu", { email: "Mate@Test.edu", name: "Mate" });
  assert.equal(await isOwner(user("mate@test.edu")), true);
  assert.equal(await isOwner(user("mate@test.edu", "guest")), false);
  await assert.rejects(removeMember("founder@test.edu", "founder@test.edu"), /yourself/);
  await removeMember("founder@test.edu", "mate@test.edu");
  assert.equal(await isOwner(user("mate@test.edu")), false);
});

test("board: moving a card to Done records who finished it; moving back clears it", async () => {
  await saveTask("founder@test.edu", { title: "Email the Career Center", assignee: "founder@test.edu" });
  let t = (await team("founder@test.edu")).tasks.find((x: any) => x.title === "Email the Career Center")!;
  assert.equal(t.status, "todo");
  await saveTask("founder@test.edu", { id: t.id, status: "doing" });
  await saveTask("founder@test.edu", { id: t.id, status: "done" });
  t = (await team("founder@test.edu")).tasks.find((x: any) => x.id === t.id)!;
  assert.equal(t.done, true);
  assert.equal(t.done_by, "founder@test.edu");
  await saveTask("founder@test.edu", { id: t.id, status: "todo" });
  t = (await team("founder@test.edu")).tasks.find((x: any) => x.id === t.id)!;
  assert.equal(t.done, false);
  assert.equal(t.done_by, "");
  const acts = (await team("founder@test.edu")).activity.map((a: any) => a.action);
  assert.ok(acts.includes("Started a to-do") && acts.includes("Finished a to-do") && acts.includes("Reopened a to-do"));
});

test("errors: marked fixed leaves the open list, and comes back if it happens again", async () => {
  await recordError("browser", "/opportunities", "Boom", "stack");
  assert.ok((await errors()).open.some((e: any) => e.message === "Boom"));
  await fixError("founder@test.edu", "Boom", "browser");
  assert.ok(!(await errors()).open.some((e: any) => e.message === "Boom"));
  await recordError("browser", "/opportunities", "Boom", "stack");
  assert.ok((await errors()).open.some((e: any) => e.message === "Boom"));
});

test("meetings: the adder is going, teammates answer, and the team calendar notes carry the headcount", async () => {
  await addMember("founder@test.edu", { email: "mate@test.edu", name: "Mate" });
  await addEvent("founder@test.edu", { title: "Career Center meeting", date: "2099-01-15", time: "14:00" });
  let e = (await team("founder@test.edu")).events.find((x: any) => x.title === "Career Center meeting")!;
  assert.deepEqual(e.rsvps, { "founder@test.edu": "yes" });
  await rsvp("mate@test.edu", e.id, "maybe");
  await rsvp("mate@test.edu", e.id, "no");
  e = (await team("founder@test.edu")).events.find((x: any) => x.id === e.id)!;
  assert.equal(e.rsvps["mate@test.edu"], "no");
  await assert.rejects(rsvp("mate@test.edu", e.id, "sure"), /going, maybe/);
  const item = (await teamCalendarItems()).find((x) => x.id === e.id)!;
  assert.match(item.notes, /Going \(1\): founder/);
  assert.match(item.notes, /Can't go \(1\): Mate/);
  await rsvp("mate@test.edu", e.id, "");
  e = (await team("founder@test.edu")).events.find((x: any) => x.id === e.id)!;
  assert.equal(e.rsvps["mate@test.edu"], undefined);
  await removeMember("founder@test.edu", "mate@test.edu");
});

test("several teammates on one to-do and one meeting; the calendar notes name them", async () => {
  assert.equal(emails(["B@x.edu", "a@x.edu", "b@x.edu", "not-an-email"]), "b@x.edu,a@x.edu");
  await saveTask("founder@test.edu", { title: "Pitch deck", assignee: ["Founder@test.edu", "mate2@test.edu"] });
  const t = (await team("founder@test.edu")).tasks.find((x: any) => x.title === "Pitch deck");
  assert.equal(t.assignee, "founder@test.edu,mate2@test.edu");
  await addEvent("founder@test.edu", { title: "Banos check-in", date: "2099-01-05", assignees: ["founder@test.edu"] });
  const e = (await team("founder@test.edu")).events.find((x: any) => x.title === "Banos check-in");
  await setEventPeople("founder@test.edu", e.id, ["founder@test.edu", "mate2@test.edu"]);
  const item = (await teamCalendarItems()).find((x) => x.id === e.id)!;
  assert.match(item.notes, /^Team: /);
  assert.match(item.notes, /mate2/);
});

test("overview: email counts are who left each email on and who got a digest this week", async () => {
  const { ensureUser, loadWorkspace, saveSections } = await import("./db");
  await ensureUser({ id: "mail1", kind: "supabase", email: "m1@test.edu", name: "M", picture: "" } as any);
  const ws = await loadWorkspace("mail1");
  await saveSections("mail1", { settings: { ...ws.settings, notify: { ...ws.settings.notify, deadlines: true, weeklyPlan: false } }, lastDigestAt: new Date().toISOString() } as any);
  const o = await overview();
  assert.equal(o.emails.ready, false);
  assert.ok(o.emails.reminders >= 1);
  assert.ok(o.emails.digestsWeek >= 1);
});

test("retention watcher: quiet means last visit 8–21 days ago; counts the step they stopped before", async () => {
  const { emptyWorkspace } = await import("./db");
  const { retentionReport } = await import("../ai/agents");
  const mk = (done: boolean, visits: string[]) => { const w = emptyWorkspace(); w.onboarding.done = done; w.visits = visits; return w; };
  const r = retentionReport([mk(true, ["2026-10-20"]), mk(true, ["2026-10-22"]), mk(true, ["2026-10-25"]), mk(true, ["2026-10-30"]), mk(true, ["2026-10-01"]), mk(false, [])], "2026-11-01");
  assert.equal(r.quiet, 2);
  assert.equal(r.noSetup, 1);
  assert.equal(r.stoppedAt.reduce((s, x) => s + x.n, 0), 2);
});

test("email rules: an interview invite with words in between is an interview, not a receipt", async () => {
  const { rulesClassify } = await import("../routes");
  const invite = "Thank you for applying to the 2027 Summer Analyst Internship at Texas Capital. We'd like to invite you to a 30-minute first round virtual interview on Thursday, November 12.";
  assert.equal(rulesClassify(invite).status, "Interview");
  assert.equal(rulesClassify("Thank you for applying. We have received your application and will be in touch.").status, "Received");
  assert.equal(rulesClassify("We'd like to schedule a final round interview with the team.").status, "Interview");
});
