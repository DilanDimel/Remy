import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { emptyWorkspace } from "../platform/db";
import { doActions, undoDid } from "./chatDo";
import { chatActions } from "./safety";

const job = (id: string, deadline = ""): Job => ({
  id, kind: "internship", title: "Finance Intern", company: "Q2", location: "Austin, TX", format: "On-site", dates: "", deadline, deadlineText: "",
  eligibility: [], requirements: [], summary: "", applyUrl: "", sourceUrl: "", sourceName: "test", label: "Live", checkedAt: "", checks: [], origin: "manual",
});
const find = (ws: any, id: string) => ws.jobs.find((j: Job) => j.id === id);

test("chatActions keeps save/tailor with a clean id and a real due date", () => {
  assert.deepEqual(chatActions([{ kind: "save", jobId: "j1" }, { kind: "tailor", jobId: "bad id!" }]), [{ kind: "save", jobId: "j1" }]);
  assert.deepEqual(chatActions([{ kind: "task", title: "Email Ms. Lee", why: "", due: "2026-11-27" }])[0], { kind: "task", title: "Email Ms. Lee", why: "", due: "2026-11-27" });
  assert.equal((chatActions([{ kind: "task", title: "x", due: "Friday" }])[0] as any).due, undefined);
});

test("doActions does in-app actions with Undo; open stays a button", () => {
  const ws = emptyWorkspace();
  ws.jobs = [job("j1", "2026-12-05"), job("j2")];
  ws.resume = { doc: { sections: [], skills: [] } } as any;
  ws.profile.targetRoles = "Analyst";
  const r = doActions(ws, [
    { kind: "save", jobId: "j1" }, { kind: "task", title: "Ask Dr. Kim for a reference", why: "", due: "2026-11-27" },
    { kind: "tailor", jobId: "j2" }, { kind: "role", title: "Treasury Analyst" }, { kind: "open", link: "/calendar", label: "Calendar" }, { kind: "save", jobId: "nope" },
  ], find, "2026-11-22");
  assert.deepEqual(r.did.map((d) => d.kind), ["save", "task", "tailor", "role"]);
  assert.deepEqual(r.buttons, [{ kind: "open", link: "/calendar", label: "Calendar" }]);
  assert.deepEqual(r.notes, ["I couldn't find that opening on your list, so nothing was saved."], "the reply says what didn't happen");
  assert.deepEqual(ws.savedJobIds, ["j1"]);
  assert.equal(ws.calendar[0].linkedId, "j1", "saving puts the deadline on the calendar, as on Opportunities");
  assert.equal(ws.tasks[0].due, "2026-11-27");
  assert.equal(ws.applications[0].jobId, "j2");
  assert.match(r.did[2].link!, /go=1/);
  assert.equal(ws.profile.targetRoles, "Analyst, Treasury Analyst");

  for (const d of r.did) assert.equal(undoDid(ws, d), null);
  assert.deepEqual(ws.savedJobIds, []);
  assert.equal(ws.calendar.length, 0);
  assert.equal(ws.tasks.length, 0);
  assert.equal(ws.applications.length, 0);
  assert.equal(ws.profile.targetRoles, "Analyst");
  assert.ok(r.did.every((d) => d.undone));

  // Doing the same again doesn't duplicate; a started application is opened instead of made twice.
  const again = doActions(ws, [{ kind: "tailor", jobId: "j2" }], find, "2026-11-22");
  const twice = doActions(ws, [{ kind: "tailor", jobId: "j2" }], find, "2026-11-22");
  assert.equal(ws.applications.length, 1);
  assert.equal(twice.did.length, 0);
  assert.match(twice.notes[0], /already started/);
  assert.equal(twice.buttons[0].kind, "open");
  // Work the student did isn't thrown away by an Undo.
  ws.applications[0].changes = [{ status: "accepted" }] as any;
  assert.match(undoDid(ws, again.did[0])!, /already worked on/);
  assert.equal(ws.applications.length, 1);
});

test("Remy changes the name, settings, to-dos, calendar and memory himself, each with Undo; a profile change stays a button", () => {
  const ws = emptyWorkspace();
  ws.jobs = [job("j1")];
  ws.savedJobIds = ["j1"];
  ws.profile.preferredName = "Dilan";
  ws.settings.notify.weeklyPlan = true;
  ws.tasks = [{ id: "t1", title: "Ask Dr. Kim", why: "", due: "", category: "Prepare", done: false, source: "x" }, { id: "t2", title: "Which name should Remy use?", why: "", due: "", category: "Prepare", done: false, source: "Name check" }];
  const asked = chatActions([{ kind: "name", value: "Dee" }, { kind: "setting", key: "theme", value: "dark" }, { kind: "profile", field: "major", value: "Finance" }]);
  assert.equal(asked.length, 3);
  const r = doActions(ws, asked, find, "2026-11-23");
  assert.deepEqual(r.did.map((d) => d.kind), ["name", "setting"]);
  assert.deepEqual(r.buttons, [{ kind: "profile", field: "major", value: "Finance" }]);
  assert.equal(ws.profile.preferredName, "Dee");
  assert.ok(ws.tasks[1].done, "choosing a name answers the name check");
  assert.equal(ws.settings.theme, "dark");
  const r2 = doActions(ws, chatActions([{ kind: "done", taskId: "t1" }, { kind: "unsave", jobId: "j1" }, { kind: "event", title: "Interview with Q2", date: "2026-11-30", time: "14:00" }]), find, "2026-11-23");
  const r3 = doActions(ws, chatActions([{ kind: "remember", text: "Prefers Dallas" }, { kind: "event", title: "Old", date: "2026-11-01" }, { kind: "setting", key: "notify.weeklyPlan", value: false }]), find, "2026-11-23");
  assert.ok(ws.tasks[0].done);
  assert.deepEqual(ws.savedJobIds, []);
  assert.equal(ws.calendar[0].kind, "Interview");
  assert.match(r2.did[2].label, /2:00 PM/);
  assert.equal(ws.memory[0].text, "Prefers Dallas");
  assert.match(r3.notes[0], /already passed/);
  assert.equal(ws.settings.notify.weeklyPlan, false);
  for (const d of [...r.did, ...r2.did, ...r3.did]) assert.equal(undoDid(ws, d), null);
  assert.equal(ws.profile.preferredName, "Dilan");
  assert.equal(ws.settings.theme, "system");
  assert.equal(ws.settings.notify.weeklyPlan, true);
  assert.ok(!ws.tasks[0].done);
  assert.deepEqual(ws.savedJobIds, ["j1"]);
  assert.equal(ws.calendar.length, 0);
  assert.equal(ws.memory.length, 0);
});
