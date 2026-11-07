// Trimming a student's openings list. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { emptyWorkspace } from "./db";
import { OPENINGS_MAX_UNTOUCHED, trimOpenings } from "./trim";

const DAY = 86_400_000, NOW = Date.parse("2026-11-06T12:00:00Z");
const job = (id: string, daysOld: number, over: Partial<Job> = {}): Job => ({
  id, kind: "internship", title: "Intern", company: "Acme", location: "", format: "", dates: "", deadline: "", deadlineText: "",
  eligibility: [], requirements: [], summary: "", applyUrl: `https://x.example/${id}`, sourceUrl: `https://x.example/${id}`, sourceName: "",
  label: "Live", checkedAt: "", foundAt: new Date(NOW - daysOld * DAY).toISOString(), checks: [], origin: "imported", ...over,
});

test("old untouched openings are dropped with their fits; recent ones stay", () => {
  const ws = emptyWorkspace();
  ws.jobs = [job("j00000000old", 40), job("j00000000new", 2)];
  ws.fits = { j00000000old: {} as any, j00000000new: {} as any };
  assert.equal(trimOpenings(ws, ws, NOW), 1);
  assert.deepEqual(ws.jobs.map((j) => j.id), ["j00000000new"]);
  assert.deepEqual(Object.keys(ws.fits), ["j00000000new"]);
  assert.ok(ws.droppedJobUrls!.includes("https://x.example/j00000000old"));
});

test("anything the student touched stays, however old: saved, applied, rated, hidden, linked from a to-do, added by hand", () => {
  const ws = emptyWorkspace();
  ws.jobs = ["saved", "applied", "rated", "hidden", "linked"].map((s) => job(`j0000${s}`, 90)).concat(job("jmanual00001", 90, { origin: "manual" }));
  ws.savedJobIds = ["j0000saved"];
  ws.applications = [{ id: "a1", jobId: "j0000applied" }] as any;
  ws.jobFeedback = { j0000rated: { rating: 4 } as any };
  ws.hiddenJobIds = ["j0000hidden"];
  ws.tasks = [{ id: "t1", title: "Apply", link: "/opportunities?job=j0000linked" }] as any;
  assert.equal(trimOpenings(ws, ws, NOW), 0);
  assert.equal(ws.jobs.length, 6);
});

test("an opening saved during a search (only in the latest stored copy) is kept", () => {
  const ws = emptyWorkspace();
  ws.jobs = [job("j0000justsaved", 60)];
  const latest = emptyWorkspace();
  latest.savedJobIds = ["j0000justsaved"];
  assert.equal(trimOpenings(ws, latest, NOW), 0);
});

test("at most the newest untouched openings are kept, even when all are recent", () => {
  const ws = emptyWorkspace();
  ws.jobs = Array.from({ length: OPENINGS_MAX_UNTOUCHED + 20 }, (_, i) => job(`j${String(i).padStart(11, "0")}`, i / 100));
  assert.equal(trimOpenings(ws, ws, NOW), 20);
  assert.equal(ws.jobs.length, OPENINGS_MAX_UNTOUCHED);
  assert.ok(ws.jobs.some((j) => j.id === "j00000000000"), "newest kept");
});
