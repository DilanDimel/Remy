import { test } from "node:test";
import assert from "node:assert/strict";
process.env.OWNER_EMAILS = "owner@nudge.test";
import type { Job, JobFit } from "@shared/types";
import { emptyWorkspace, ensureUser, loadWorkspace, saveWorkspace } from "../platform/db";
import { answerNudge, nudgeEmail, nudgeFor, sendNudges } from "./nudges";

const now = new Date("2026-11-22T15:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 36e5).toISOString();
const job = (id: string, foundAt = hoursAgo(5)): Job => ({
  id, kind: "internship", title: "Finance Intern", company: "Synthetic Bank " + id, location: "Dallas, TX", format: "On-site", dates: "", deadline: "",
  deadlineText: "", eligibility: [], requirements: [], summary: "", applyUrl: "https://example.com/" + id, sourceUrl: "https://example.com/" + id,
  sourceName: "test", label: "Live", checkedAt: foundAt, checks: [], origin: "manual", foundAt,
});
const fit = (score: number, extra: Partial<JobFit> = {}): JobFit => ({ at: "", by: "rules", eligibility: "likely", eligibilityNote: "", matched: [], gaps: [], why: "Your Excel work matches.", score, regionMatch: true, ...extra });
function ws() {
  const w = emptyWorkspace();
  w.onboarding.done = true;
  w.profile.preferredName = "Maya";
  w.jobs = [job("a"), job("b"), job("old", hoursAgo(24 * 5)), job("far"), job("weak")];
  w.fits = { a: fit(70), b: fit(90), old: fit(110), far: fit(100, { regionMatch: false }), weak: fit(40) };
  return w;
}

test("nudgeFor picks the best fresh fit and respects frequency, off, and what the student already did", () => {
  const w = ws();
  assert.equal(nudgeFor(w, now)?.id, "b");
  w.savedJobIds = ["b"];
  assert.equal(nudgeFor(w, now)?.id, "a", "saved openings aren't nudged");
  w.savedJobIds = [];
  w.nudges = [{ id: "n1", jobId: "b", at: hoursAgo(30) }];
  assert.equal(nudgeFor(w, now), null, "weekly by default: one a week");
  w.settings.nudges = "daily";
  assert.equal(nudgeFor(w, now)?.id, "a", "daily: next day, and never the same opening twice");
  w.nudges = [{ id: "n1", jobId: "b", at: hoursAgo(3) }];
  assert.equal(nudgeFor(w, now), null, "daily: not twice in a day");
  w.settings.nudges = "off";
  w.nudges = [];
  assert.equal(nudgeFor(w, now), null);
  w.settings.nudges = "weekly";
  w.onboarding.done = false;
  assert.equal(nudgeFor(w, now), null, "not before setup");
});

test("nudge email has Yes and Not now links to the exact step, escaped", () => {
  const w = ws();
  w.jobs[1].company = "A&B <Co>";
  const e = nudgeEmail(w, w.jobs[1], "n_x", "remyai.org");
  assert.match(e.subject, /A&B <Co>: Finance Intern fits you/);
  assert.match(e.text, /Hi Maya/);
  assert.match(e.text, /https:\/\/remyai\.org\/resume\?tab=tailor&job=b&go=1&nudge=n_x&a=yes/);
  assert.match(e.text, /https:\/\/remyai\.org\/opportunities\?nudge=n_x&a=later/);
  assert.ok(e.html.includes("A&amp;B &lt;Co&gt;") && !e.html.includes("<Co>"));
  assert.match(e.html, /Yes, tailor it/);
});

test("answerNudge records the first answer only", () => {
  const list = [{ id: "n1", jobId: "a", at: "x" }];
  const once = answerNudge(list, "n1", "yes", "t1")!;
  assert.equal(once[0].answer, "yes");
  assert.equal(answerNudge(once, "n1", "later", "t2")![0].answer, "yes");
  assert.equal(answerNudge(list, "nope", "yes", "t"), null);
});

test("sendNudges: owners only while testing, active in the window, and remembered so it isn't sent twice", async () => {
  for (const [id, email, visit] of [["nd-owner", "owner@nudge.test", "2026-11-20"], ["nd-student", "student@nudge.test", "2026-11-20"], ["nd-idle-owner", "owner@nudge.test", "2026-10-01"]] as const) {
    await ensureUser({ id, kind: "supabase", email, name: "", picture: "" });
    const w = ws();
    w.visits = [visit];
    await saveWorkspace(id, w);
  }
  const to: string[] = [];
  const fake = async (addr: string) => { to.push(addr); };
  assert.equal(await sendNudges("2026-11-08", fake, now), 1);
  assert.deepEqual(to, ["owner@nudge.test"], "a real student gets nothing");
  const saved = await loadWorkspace("nd-owner");
  assert.equal(saved.nudges?.[0].jobId, "b");
  assert.equal(await sendNudges("2026-11-08", fake, now), 0, "weekly: not again right away");
  assert.equal((await loadWorkspace("nd-student")).nudges, undefined);
});

test("overnight drafts: top fresh fits without an application; the email then offers the draft instead of redoing it", async () => {
  const { overnightPicks } = await import("./nudges");
  const w = ws();
  assert.deepEqual(overnightPicks(w, now), [], "needs a confirmed resume");
  w.resume = { confirmedAt: "2026-11-20T00:00:00Z" } as any;
  assert.deepEqual(overnightPicks(w, now).map((j) => j.id), ["b", "a"]);
  w.applications = [{ id: "app1", jobId: "b", overnight: hoursAgo(5), changes: [{ status: "pending" }] } as any];
  assert.deepEqual(overnightPicks(w, now).map((j) => j.id), ["a"], "not drafted twice");
  assert.equal(nudgeFor(w, now)?.id, "b", "a waiting overnight draft can still be emailed");
  const e = nudgeEmail(w, w.jobs[1], "n_d", "remyai.org");
  assert.match(e.text, /already drafted/);
  assert.match(e.text, /resume\?tab=tailor&app=app1&nudge=n_d&a=yes/);
  assert.ok(!e.text.includes("go=1"));
  w.applications[0].changes = [{ status: "accepted" }] as any;
  assert.equal(nudgeFor(w, now)?.id, "a", "once the student works on it, it's theirs, not a nudge");
  w.nudges = [{ id: "n9", jobId: "a", at: hoursAgo(24 * 8), answer: "later" }];
  assert.deepEqual(overnightPicks({ ...w, applications: [] }, now).map((j) => j.id), ["b"], "Not now means no draft either");
});
