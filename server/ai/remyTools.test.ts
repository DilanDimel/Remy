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

test("Remy speaks first after setup, once, from the student's own best fit, before they've written anything", async () => {
  const { reachOut } = await import("./remyTools");
  const ws = emptyWorkspace();
  ws.profile.preferredName = "Maya";
  assert.equal(reachOut(ws, TODAY, "t"), ""); // setup not done
  ws.onboarding.done = true;
  ws.jobs = [{ ...job("j1"), deadline: "2026-12-05" }, { ...job("j2"), company: "Old Co", deadline: "2026-11-01" }];
  const fit = (score: number) => ({ at: "t", by: "rules", eligibility: "likely", eligibilityNote: "", matched: [], gaps: [], score }) as any;
  ws.fits = { j1: fit(80), j2: fit(95) };
  ws.resume = { fileName: "r.pdf", doc: { sections: [] } } as any;
  const said = reachOut(ws, TODAY, "t1");
  assert.match(said, /^Hi Maya\. I read your resume and found 1 internship that fits you\. The best one is Finance Intern at Q2, due /);
  assert.deepEqual(ws.chat.at(-1)!.replies, ["Tailor my resume for Q2", "Why does it fit me?"]);
  assert.equal(ws.remyHello, TODAY);
  assert.equal(reachOut(ws, "2026-11-24", "t2"), ""); // once
});

test("quiet week stops offers, check-ins and opening emails, and undoes; a passed career fair gets one 'who did you meet?'", async () => {
  const { reachOut } = await import("./remyTools");
  const { remyOffers } = await import("@shared/remyOffers");
  const { nudgeFor } = await import("../coach/nudges");
  const ws = emptyWorkspace();
  ws.calendar = [{ id: "c1", title: "TCU Career Fair", date: "2026-11-22", time: "", kind: "Event", source: "x", notes: "" },
    { id: "c2", title: "Interview with PwC", date: TODAY, time: "", kind: "Interview", source: "x", notes: "" }];
  const r = doActions(ws, [{ kind: "quiet", days: 7 }], find, TODAY);
  assert.equal(ws.settings.quietUntil, "2026-11-29");
  assert.deepEqual(remyOffers(ws, TODAY), []);
  assert.equal(reachOut(ws, TODAY, "t"), "");
  ws.onboarding.done = true;
  assert.equal(nudgeFor(ws, new Date(TODAY + "T12:00:00Z")), null);
  assert.equal(undoDid(ws, r.did[0]), null);
  assert.equal(ws.settings.quietUntil, undefined);
  assert.equal(remyOffers(ws, TODAY).length, 2); // prep + practice
  assert.match(reachOut(ws, TODAY, "t1"), /How did TCU Career Fair go\?/);
  assert.equal(reachOut(ws, TODAY, "t2"), "");
  assert.equal(doActions(ws, [{ kind: "quiet", days: 0 }], find, TODAY).notes[0], "I wasn't being quiet.");
});

test("prep sheet on an interview, from the student's own pitch and stories, with Undo", () => {
  const ws = emptyWorkspace();
  ws.jobs = [job("j1")];
  ws.pitch = { text: "I'm a finance junior who builds models.", at: "t" };
  ws.stories = [{ id: "s1", title: "Budget model", theme: "", situation: "", task: "", action: "Built a model", result: "Saved 10%", missing: "", source: "" }];
  ws.calendar = [{ id: "c1", title: "Q2 interview", date: "2026-11-25", time: "", kind: "Interview", source: "x", notes: "Bring ID" }];
  const r = doActions(ws, [{ kind: "prep", calId: "c1" }], find, TODAY);
  const n = ws.calendar[0].notes;
  assert.match(n, /^Prep sheet from Remy/);
  assert.match(n, /Finance Intern at Q2/);
  assert.match(n, /builds models/);
  assert.match(n, /Budget model: Built a model Saved 10%/);
  assert.match(n, /Bring ID$/);
  assert.equal(undoDid(ws, r.did[0]), null);
  assert.equal(ws.calendar[0].notes, "Bring ID");
});

test("Remy's context lists the emails he sent this student, newest first", async () => {
  const { moreContext } = await import("./remyTools");
  const ws = emptyWorkspace();
  assert.match(moreContext(ws, "2026-11-23", find), /EMAILS YOU \(REMY\) SENT THEM.*\(none yet\)/);
  ws.emails = [{ at: "2026-11-21T09:00:00Z", kind: "digest", subject: "Frost and 2 more" }, { at: "2026-11-22T09:00:00Z", kind: "match", subject: "Ally Financial: Intern fits you" }];
  assert.match(moreContext(ws, "2026-11-23", find), /2026-11-22 match: "Ally Financial: Intern fits you"; 2026-11-21 digest/);
});

test("remove a to-do or contact, stop a role, note on a board card, rest days: all undo", () => {
  const ws = emptyWorkspace();
  ws.tasks = [{ id: "k1", title: "Email Dr. Kim", why: "", done: false, due: "" } as any, { id: "k2", title: "Update LinkedIn", why: "", done: false, due: "" } as any];
  ws.contacts = [{ id: "p1", name: "Ana Ruiz", title: "", org: "Deloitte", email: "", why: "", tags: [], label: "x" } as any];
  ws.profile.targetRoles = "Financial Analyst, Treasury Analyst";
  ws.tracker = [{ id: "t1", company: "Q2", role: "Intern", status: "Applied", events: [], notes: "" }];
  const before = JSON.stringify({ t: ws.tasks, c: ws.contacts, r: ws.profile.targetRoles, n: ws.tracker[0].notes, g: ws.game?.restDays || [] });
  const r = doActions(ws, [{ kind: "dropTask", taskId: "k1" }, { kind: "roleOff", title: "treasury analyst" }, { kind: "cardNote", trackId: "t1", note: "Recruiter is Sam" }, { kind: "restDays", days: [0] }], find, TODAY);
  const r2 = doActions(ws, [{ kind: "dropContact", contactId: "p1" }, { kind: "roleOff", title: "Nurse" }], find, TODAY);
  assert.equal(r.did.length + r2.did.length, 5);
  assert.match(r2.notes[0], /wasn't in the roles/);
  assert.deepEqual(ws.tasks.map((t) => t.id), ["k2"]);
  assert.equal(ws.profile.targetRoles, "Financial Analyst");
  assert.equal(ws.tracker[0].notes, "Recruiter is Sam");
  assert.deepEqual(ws.game!.restDays, [0]);
  assert.equal(ws.contacts.length, 0);
  for (const d of [...r.did, ...r2.did].reverse()) assert.equal(undoDid(ws, d), null);
  assert.equal(JSON.stringify({ t: ws.tasks, c: ws.contacts, r: ws.profile.targetRoles, n: ws.tracker[0].notes, g: ws.game?.restDays || [] }), before);
  assert.deepEqual(chatActions([{ kind: "restDays", days: [0, 1, 2, 3] }, { kind: "cardNote", trackId: "t1", note: "" }]), []);
});

test("Remy's first hello without a resume says the matches came from the major, year and places (Explore for now)", async () => {
  const { firstHello } = await import("./remyTools");
  const ws = emptyWorkspace();
  ws.profile.preferredName = "Maya";
  ws.onboarding.done = true;
  ws.jobs = [{ ...job("j1"), deadline: "2026-12-05" }];
  ws.fits = { j1: { at: "t", by: "rules", eligibility: "likely", eligibilityNote: "", matched: [], gaps: [], score: 80 } as any };
  const hello = firstHello(ws, TODAY)!;
  assert.doesNotMatch(hello.text, /read your resume/);
  assert.match(hello.text, /^Hi Maya\. From your major, year and the places you chose, I found 1 internship that could fit you\./);
  assert.match(hello.text, /Add your resume/);
});
