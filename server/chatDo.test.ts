import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { emptyWorkspace } from "./db";
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

test("doActions does in-app actions with Undo; open and settings stay buttons", () => {
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
  assert.equal(twice.buttons[0].kind, "open");
  // Work the student did isn't thrown away by an Undo.
  ws.applications[0].changes = [{ status: "accepted" }] as any;
  assert.match(undoDid(ws, again.did[0])!, /already worked on/);
  assert.equal(ws.applications.length, 1);
});
