// Owners' Calendar "Remy's plan" (shared/calendarPlan.ts): only real interviews, deadlines and to-dos, nothing twice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarPlan } from "../shared/calendarPlan";

const job = (id: string, company: string, deadline: string): any => ({ id, company, title: "Intern", deadline, applyUrl: "" });
const base = (): any => ({ calendar: [], tasks: [], jobs: [], savedJobIds: [], hiddenJobIds: [], fits: {} });

test("prep two days before an interview, never in the past", () => {
  const w = base();
  w.calendar = [{ id: "a", title: "Interview: Ally", date: "2026-11-28", time: "", kind: "Interview" }, { id: "b", title: "Interview: Comerica", date: "2026-11-25", time: "", kind: "Interview" }];
  const p = calendarPlan(w, "2026-11-24");
  assert.deepEqual(p.map((s) => [s.title, s.date]), [["Practice for Ally", "2026-11-26"], ["Practice for Comerica", "2026-11-24"]]);
  w.calendar.push({ id: "c", title: "Practice for Ally", date: "2026-11-26", time: "", kind: "Task" });
  assert.equal(calendarPlan(w, "2026-11-24").filter((s) => s.title === "Practice for Ally").length, 0);
});

test("deadlines: saved first, skips closed, hidden and ones already on the calendar", () => {
  const w = base();
  w.jobs = [job("1", "Goldman", "2026-12-01"), job("2", "Ally", "2026-12-10"), job("3", "Old", "2026-11-01"), job("4", "Hidden", "2026-11-30"), job("5", "Closed", "2026-11-30"), job("6", "Dupe", "2026-11-29")];
  w.savedJobIds = ["2"]; w.hiddenJobIds = ["4"]; w.fits = { "5": { closed: "Deadline passed" } };
  w.calendar = [{ id: "x", title: "Dupe internship closes", date: "2026-11-29", time: "", kind: "Deadline" }];
  assert.deepEqual(calendarPlan(w, "2026-11-24").map((s) => s.id), ["deadline-2", "deadline-1"]);
});

test("to-dos with no day get different weekdays", () => {
  const w = base();
  w.tasks = [{ id: "t1", title: "A.", why: "", due: "", done: false }, { id: "t2", title: "B", why: "", due: "", done: false }, { id: "t3", title: "C", why: "", due: "2026-11-25", done: false }];
  const p = calendarPlan(w, "2026-11-24"); // a Tuesday; the 25th already has a to-do
  assert.deepEqual(p.map((s) => [s.title, s.date]), [["A", "2026-11-26"], ["B", "2026-11-27"]]);
});
