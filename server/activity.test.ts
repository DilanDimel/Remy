import { test } from "node:test";
import assert from "node:assert/strict";
import { activityDays, dayOf, todayBrief } from "@shared/activity";

const now = new Date("2026-11-23T15:00:00");
const iso = (d: string) => new Date(d).toISOString();
const base = { chat: [], aiLog: [], jobs: [], applications: [], steps: [], hiddenJobIds: [], calendar: [], tasks: [] } as any;

test("activityDays groups by day, newest first, one chat session per day, repeats counted", () => {
  const w = { ...base,
    chat: [{ id: "c1", role: "user", text: "hi", at: iso("2026-11-22T10:00:00") }, { id: "c2", role: "assistant", text: "hey", at: iso("2026-11-22T10:01:00") }],
    aiLog: [{ id: "a", ok: true, purpose: "Parse resume", at: iso("2026-11-21T09:00:00") }, { id: "b", ok: true, purpose: "Assistant chat", at: iso("2026-11-22T10:01:00") },
      { id: "c", ok: true, purpose: "Tailor for PwC", at: iso("2026-11-23T09:00:00") }, { id: "d", ok: true, purpose: "Tailor for PwC", at: iso("2026-11-23T11:00:00") }, { id: "e", ok: false, purpose: "Story deck", at: iso("2026-11-23T11:00:00") }] };
  const days = activityDays(w);
  assert.deepEqual(days.map((d) => d.day), ["2026-11-23", "2026-11-22", "2026-11-21"]);
  assert.deepEqual(days[0].events.map((e) => [e.text, e.count]), [["Tailored your resume for PwC", 2]]);
  assert.equal(days[1].chat.length, 2);
  assert.deepEqual(days[1].events.map((e) => e.kind), ["chat"]); // chat log entries aren't repeated as "did"
});

test("todayBrief: new openings, nearest deadline, what Remy did, next to-do", () => {
  const w = { ...base,
    jobs: [{ id: "j1", title: "Analyst", company: "PwC", foundAt: iso("2026-11-23T08:00:00") }, { id: "j2", title: "Old", company: "EY", foundAt: iso("2026-11-10T08:00:00") }],
    calendar: [{ id: "k", title: "PwC application", date: "2026-11-25" }, { id: "k2", title: "Past", date: "2026-11-20" }],
    tasks: [{ id: "t", title: "Tailor resume", done: false }],
    aiLog: [{ id: "a", ok: true, purpose: "Parse resume", at: now.toISOString() }] };
  assert.deepEqual(todayBrief(w, now).map((r) => r.text), ["New opening: Analyst at PwC", "PwC application is due in 2 days", "I read your resume today", "Next up: Tailor resume"]);
  assert.deepEqual(todayBrief(base, now), []);
  assert.equal(dayOf(now.toISOString()), "2026-11-23");
});

test("found openings read as one line with the number; todayBrief drops openings Home hides", () => {
  const at = iso("2026-11-23T08:00:00");
  const w = { ...base, jobs: [{ id: "a", title: "A", company: "X", foundAt: at }, { id: "b", title: "B", company: "Y", foundAt: at }] };
  assert.equal(activityDays(w)[0].events[0].text, "Found 2 new openings for you");
  assert.deepEqual(todayBrief(w, now, { b: { excluded: true } }).map((r) => r.text), ["New opening: A at X"]);
});
