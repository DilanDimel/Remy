// Checked openings: tags, recording, checks and the age cut-off, against real Postgres (PGlite in memory). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { careerPathOf, industryOf, listOpenings, openingsSummary, pruneOpenings, recordCheck, recordFound, tagsOf } from "./openings";
import { q } from "../platform/sql";

const job = (over: Partial<Job> = {}): Job => ({
  id: "j1", kind: "internship", title: "Summer Analyst", company: "Acme Capital LLC", location: "Dallas, TX", format: "", dates: "",
  deadline: "", deadlineText: "", eligibility: [], requirements: [], summary: "", applyUrl: "https://boards.example.com/acme/1",
  sourceUrl: "https://boards.example.com/acme/1", sourceName: "Acme careers (Greenhouse job board)", label: "Live",
  checkedAt: "", checks: [], origin: "imported", ...over,
});

test("industry comes from the title first, then the employer's directory field", () => {
  assert.equal(industryOf("Investment Banking Summer Analyst"), "Investment banking");
  assert.equal(industryOf("Software Engineer Intern"), "Software & computer science");
  assert.equal(industryOf("Cybersecurity Intern"), "Cybersecurity");
  assert.equal(industryOf("Mechanical Engineering Co-op"), "Engineering");
  assert.equal(industryOf("Nursing Extern"), "Nursing");
  assert.equal(industryOf("Summer Intern", ["finance"]), "Finance");
  assert.equal(industryOf("Summer Intern", ["tech", "data"]), "Software & computer science");
  assert.equal(industryOf("Summer Intern"), "");
});

test("career path is a My Path road key, or empty when none fits", () => {
  assert.ok(careerPathOf("Nursing Extern", "Nursing"));
  assert.equal(careerPathOf("Summer Intern", ""), "");
  const t = tagsOf({ title: "Investment Banking Summer Analyst", company: "The Acme Co." });
  assert.equal(t.companyKey, "acme");
  assert.equal(t.industry, "Investment banking");
});

test("recording: one row per posting; seen again counts up; student and sample openings stay out", async () => {
  const n = await recordFound([
    job(),
    job({ id: "j2", applyUrl: "", sourceUrl: "", label: "Student provided", origin: "manual" }),
    job({ id: "j3", label: "Demo data", sourceUrl: "https://example.com/demo", applyUrl: "https://example.com/demo" }),
  ], { "Acme Capital LLC": ["finance"] });
  assert.equal(n, 1);
  await recordFound([job({ title: "Summer Analyst, Investment Banking" })]);
  const rows = await listOpenings({ company: "acme capital" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].times_seen, 2);
  assert.equal(rows[0].industry, "Investment banking");
  assert.equal((await listOpenings({ industry: "investment banking" })).length, 1);
  assert.equal((await listOpenings({ status: "unchecked" })).length, 1);
});

test("a page check is recorded, and status filters follow it", async () => {
  const j = job({ id: "j4", title: "Data Analyst Intern", company: "Beta Health", sourceUrl: "https://boards.example.com/beta/9", applyUrl: "https://boards.example.com/beta/9" });
  await recordCheck(j, { at: new Date().toISOString(), httpStatus: 200, result: "closed-signal", note: "" });
  const closed = await listOpenings({ status: "closed" });
  assert.deepEqual(closed.map((r) => r.company), ["Beta Health"]);
  assert.equal(closed[0].http_status, 200);
  const s = await openingsSummary();
  assert.ok(s.total >= 2 && s.closed >= 1 && s.companies >= 2);
});

test("openings not seen or checked for the set number of days are discarded; recent ones stay", async () => {
  await recordFound([job({ id: "old", sourceUrl: "https://boards.example.com/old/1", applyUrl: "https://boards.example.com/old/1", company: "Old Co" })]);
  await q("UPDATE checked_openings SET last_seen = now() - interval '40 days', last_checked = NULL WHERE url = $1", ["https://boards.example.com/old/1"]);
  // A recent check keeps an opening even when it was first found long ago.
  await q("UPDATE checked_openings SET last_seen = now() - interval '40 days', last_checked = now() - interval '2 days' WHERE company = 'Beta Health'");
  const removed = await pruneOpenings(30);
  assert.equal(removed, 1);
  assert.equal((await listOpenings({ company: "Old Co" })).length, 0);
  assert.equal((await listOpenings({ company: "Beta Health" })).length, 1);
  assert.equal(await pruneOpenings(30), 0);
});
