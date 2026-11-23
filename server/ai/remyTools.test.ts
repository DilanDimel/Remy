import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { emptyWorkspace } from "../platform/db";
import { doActions, undoDid } from "./chatDo";
import { chatActions } from "./safety";

const job = (id: string): Job => ({
  id, kind: "internship", title: "Finance Intern", company: "Q2", location: "Austin, TX", format: "On-site", dates: "", deadline: "", deadlineText: "",
  eligibility: [], requirements: [], summary: "", applyUrl: "", sourceUrl: "", sourceName: "test", label: "Live", checkedAt: "", checks: [], origin: "manual",
});
const find = (ws: any, id: string) => ws.jobs.find((j: Job) => j.id === id);
const TODAY = "2026-11-23";

test("chatActions checks the new kinds and drops bad ones", () => {
  assert.deepEqual(chatActions([{ kind: "interest", jobId: "j1", more: false }, { kind: "go", link: "/opportunities?kind=jobs&role=Analyst", label: "Openings" }]),
    [{ kind: "interest", jobId: "j1", more: false }, { kind: "go", link: "/opportunities?kind=jobs&role=Analyst", label: "Openings" }]);
  assert.deepEqual(chatActions([{ kind: "go", link: "https://evil.example" }, { kind: "prefs", field: "name", value: "x" }, { kind: "track", status: "Hired", company: "Q2" }, { kind: "hours", activity: "Shadowing", hours: 99, date: TODAY }, { kind: "start", what: "deleteAccount" }]), []);
});

test("Keep / Pass, search preferences, board, calendar, hours, career, contacts and forget all undo", () => {
  const ws = emptyWorkspace();
  ws.jobs = [job("j1"), job("j2")];
  ws.profile.regions = "Fort Worth";
  ws.fits = { j1: { by: "rules", v: 9 } as any, j2: { by: "ai", v: 9, why: "kept" } as any };
  ws.calendar = [{ id: "c1", title: "Info session", date: "2026-12-01", time: "", kind: "Event", source: "x", notes: "" }];
  ws.tracker = [{ id: "t1", company: "Q2", role: "Finance Intern", status: "Applied", events: [], notes: "" }];
  ws.plan = { generatedAt: "", generatedBy: "", nextAction: { title: "", why: "", link: "" }, careers: [{ id: "k1", title: "Analyst", what: "", fit: [], gaps: [], steps: [] }], skills: [], academic: [] };
  ws.memory = [{ id: "f1", text: "Likes fintech", category: "other", source: "x", status: "approved", createdAt: "", updatedAt: "" }];
  const before = JSON.stringify({ fb: ws.jobFeedback, hidden: ws.hiddenJobIds, saved: ws.savedJobIds, p: ws.profile, cal: ws.calendar, tr: ws.tracker.map((t) => t.status), plan: ws.plan.chosenCareerId, mem: ws.memory, c: ws.contacts, h: ws.hours?.length || 0 });
  const r = doActions(ws, [
    { kind: "interest", jobId: "j1", more: false }, { kind: "prefs", field: "regions", value: "Austin, Remote", mode: "add" },
    { kind: "track", trackId: "t1", status: "Interview" }, { kind: "moveEvent", calId: "c1", date: "2026-12-03", time: "15:00" },
  ], find, TODAY);
  const r2 = doActions(ws, [
    { kind: "hours", activity: "Volunteering", hours: 2, date: TODAY }, { kind: "career", careerId: "k1" },
    { kind: "contact", name: "Ana Ruiz", org: "Deloitte", title: "Recruiter", why: "Met at the fair" }, { kind: "forget", factId: "f1" },
  ], find, TODAY);
  assert.equal(r.did.length + r2.did.length, 8, JSON.stringify([r.notes, r2.notes]));
  assert.ok(ws.hiddenJobIds.includes("j1") && ws.jobFeedback!.j1.rating === 1);
  assert.equal(ws.profile.regions, "Fort Worth, Austin, Remote");
  assert.equal(ws.fits.j1, undefined); // re-checked against the new preferences
  assert.equal(ws.fits.j2.why, "kept");
  assert.equal(ws.tracker[0].status, "Interview");
  assert.equal(ws.calendar[0].date, "2026-12-03");
  assert.equal(ws.plan.chosenCareerId, "k1");
  assert.equal(ws.memory.length, 0);
  for (const d of [...r.did, ...r2.did].reverse()) assert.equal(undoDid(ws, d), null);
  assert.equal(JSON.stringify({ fb: ws.jobFeedback, hidden: ws.hiddenJobIds, saved: ws.savedJobIds, p: ws.profile, cal: ws.calendar, tr: ws.tracker.map((t) => t.status), plan: ws.plan.chosenCareerId, mem: ws.memory, c: ws.contacts, h: ws.hours?.length || 0 }), before);
});

test("a new board card from chat, and opening or starting something has no Undo", () => {
  const ws = emptyWorkspace();
  ws.jobs = [job("j1")];
  ws.resume = { doc: { sections: [], skills: [] } } as any;
  const r = doActions(ws, [{ kind: "track", company: "Q2", jobId: "j1", status: "Applied" }, { kind: "go", link: "/calendar", label: "Calendar" }, { kind: "start", what: "resumeFix" }], find, TODAY);
  assert.equal(ws.tracker[0].role, "Finance Intern");
  assert.deepEqual(r.did.map((d) => !!d.noUndo), [false, true, true]);
  assert.equal(r.did[2].link, "/resume?tab=base");
  assert.equal(undoDid(ws, r.did[0]), null);
  assert.equal(ws.tracker.length, 0);
  assert.match(String(undoDid(ws, r.did[1])), /nothing to undo/);
  // No resume yet: Remy says so instead of starting.
  const none = doActions(emptyWorkspace(), [{ kind: "start", what: "resumeFix" }], find, TODAY);
  assert.equal(none.did.length, 0);
  assert.match(none.notes[0], /resume first/);
});

test("Remy reaches out: a promised question on its day, else the weekly check-in, once", async () => {
  const { addLoop, reachOut, WEEKLY_CHECKIN } = await import("./remyTools");
  const ws = emptyWorkspace();
  addLoop(ws, { ask: "How did the PwC interview go?", on: "2026-11-25" }, TODAY);
  addLoop(ws, { ask: "How did the PwC interview go?", on: "2026-11-25" }, TODAY); // once
  addLoop(ws, { ask: "Old", on: "2026-11-01" }, TODAY); // past: ignored
  assert.equal(ws.loops!.length, 1);
  assert.equal(reachOut(ws, TODAY, "t"), ""); // not due, and a new account gets no check-in
  assert.equal(reachOut(ws, "2026-11-25", "t1"), "How did the PwC interview go?");
  assert.equal(reachOut(ws, "2026-11-25", "t2"), "");
  ws.savedJobIds = ["j1"];
  ws.chat.push({ id: "x", role: "user", text: "hi", at: "t" }, { id: "y", role: "assistant", text: "a", at: "t" });
  assert.equal(reachOut(ws, "2026-11-26", "t3"), WEEKLY_CHECKIN);
  assert.equal(reachOut(ws, "2026-11-30", "t4"), ""); // a week apart
  assert.equal(reachOut(ws, "2026-12-03", "t5"), ""); // last one still unanswered
  for (let i = 0; i < 6; i++) ws.chat.push({ id: "m" + i, role: i % 2 ? "assistant" : "user", text: "x", at: "t" });
  assert.equal(reachOut(ws, "2026-12-03", "t6"), WEEKLY_CHECKIN);
});
