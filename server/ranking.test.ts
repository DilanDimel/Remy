import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job, JobFit, JobInterestRating, JobInterestReason, Workspace } from "@shared/types";
import { employerPreferences, interestContext, interestEnabled, preferenceAdjustment, rankJobs, weakInterestJobIds } from "./ranking";

const at = "2026-11-03T12:00:00Z";
const workspace = () => ({
  profile: { major: "Computer Science", targetRoles: "software engineering", interests: "", classYear: "Junior", regions: "Dallas, TX", opportunityTypes: "Internships", email: "private@example.test", gpa: "3.5", workAuth: "Private" },
  jobs: [], savedJobIds: [], hiddenJobIds: [], applications: [], tracker: [], jobFeedback: {},
}) as unknown as Workspace;
const opening = (id: string, patch: Partial<Job> = {}): Job => ({
  id, kind: "internship", title: "Software Engineer Intern", company: "Acme", location: "Dallas, TX", format: "On-site", dates: "", deadline: "", deadlineText: "", eligibility: [], requirements: [], summary: "", applyUrl: `https://example.test/${id}`, sourceUrl: "", sourceName: "Acme careers", label: "Live", checkedAt: at, checks: [], origin: "imported", ...patch,
});
function rate(ws: Workspace, job: Job, rating: JobInterestRating, reason?: JobInterestReason) {
  ws.jobFeedback![job.id] = { rating, ...(reason ? { reason } : {}), createdAt: at, updatedAt: at, context: interestContext(ws, job, at) };
}
const fit = (score: number, patch: Partial<JobFit> = {}): JobFit => ({ at, by: "rules", score, eligibility: "likely", eligibilityNote: "", matched: [], gaps: [], why: "", ...patch });

test("interest: all five explicit answers are centered and bounded; missing stays distinguishable from neutral", () => {
  const ws = workspace(), job = opening("one");
  assert.deepEqual(preferenceAdjustment(ws, job), { adjustment: 0, reasons: [] });
  for (const rating of [1, 2, 3, 4, 5] as const) {
    rate(ws, job, rating);
    assert.equal(preferenceAdjustment(ws, job).adjustment, 4 * (rating - 3));
  }
  rate(ws, job, 3);
  assert.match(preferenceAdjustment(ws, job).reasons[0], /neutral/);
});

test("interest: explicit answers, including neutral, replace save signals and prevent company double counting", () => {
  const ws = workspace(), job = opening("saved"), other = opening("other");
  ws.jobs = [job, other]; ws.savedJobIds = [job.id];
  assert.equal(preferenceAdjustment(ws, job).adjustment, 2);
  assert.equal(preferenceAdjustment(ws, other).adjustment, 1);
  rate(ws, job, 3);
  assert.equal(preferenceAdjustment(ws, job).adjustment, 0);
  assert.equal(preferenceAdjustment(ws, other).adjustment, 0);
  rate(ws, job, 1);
  assert.equal(preferenceAdjustment(ws, job).adjustment, -8);
  assert.equal(preferenceAdjustment(ws, other).adjustment, 0, "no reason: no transfer to the company or role");
});

test("interest: tailoring and outcomes are not applications; only a linked confirmed Applied event is weak evidence", () => {
  const ws = workspace(), job = opening("one"); ws.jobs = [job];
  ws.applications = [{ jobId: job.id, generatedAt: at, versions: [{ v: 1 }] }] as any;
  for (const status of ["Interview", "Offer", "Rejected", "Withdrawn"] as const) {
    ws.tracker = [{ id: "track", jobId: job.id, company: job.company, role: job.title, status, notes: "", events: [{ id: "event", at, status, source: "Manual" }] }];
    assert.equal(preferenceAdjustment(ws, job).adjustment, 0, status);
  }
  ws.tracker[0].events.push({ id: "applied", at, status: "Applied", source: "Manual (asked on Home)" });
  assert.deepEqual([...weakInterestJobIds(ws)], [job.id]);
  assert.equal(preferenceAdjustment(ws, job).adjustment, 2, "no extra bonus for outcome or tailoring");
  ws.savedJobIds = [job.id];
  assert.equal(preferenceAdjustment(ws, job).adjustment, 2, "saving and applying count once");
  ws.savedJobIds = []; ws.tracker[0].events[1].source = "Sample email · sample-id";
  assert.equal(preferenceAdjustment(ws, job).adjustment, 0, "synthetic events aren't evidence");
  ws.tracker[0].events[1].source = "Manual"; delete ws.tracker[0].jobId;
  assert.equal(preferenceAdjustment(ws, job).adjustment, 0, "no guessed job link from a company name");
});

test("interest: location feedback transfers only by location, never by a shared role or employer", () => {
  const ws = workspace(), job = opening("rated"); rate(ws, job, 1, "location");
  assert.equal(preferenceAdjustment(ws, opening("same-role", { location: "Austin, TX" })).adjustment, 0);
  assert.equal(preferenceAdjustment(ws, opening("same-location", { title: "Accounting Intern", company: "Another", location: "Dallas TX" })).adjustment, -4);
  rate(ws, opening("unknown", { location: "Not stated" }), 1, "location");
  assert.equal(preferenceAdjustment(ws, opening("also-unknown", { location: "Not stated" })).adjustment, 0);
  assert.equal(employerPreferences(ws).size, 0);
});

test("interest: role transfer is specific and kind-aware; format requires a known matching format", () => {
  const ws = workspace(), job = opening("rated"); rate(ws, job, 5, "role");
  assert.equal(preferenceAdjustment(ws, opening("similar", { title: "2027 Software Engineering Internship", company: "Another" })).adjustment, 4);
  assert.equal(preferenceAdjustment(ws, opening("different", { title: "Civil Engineer Intern" })).adjustment, 0);
  assert.equal(preferenceAdjustment(ws, opening("different-kind", { kind: "job" })).adjustment, 0);
  ws.jobFeedback = {}; rate(ws, opening("remote", { format: "Remote" }), 2, "format");
  assert.equal(preferenceAdjustment(ws, opening("new-remote", { format: "Remote" })).adjustment, -2);
  assert.equal(preferenceAdjustment(ws, opening("hybrid", { format: "Hybrid" })).adjustment, 0);
  assert.equal(preferenceAdjustment(ws, opening("unspecified", { format: "" })).adjustment, 0);
  assert.equal(preferenceAdjustment(ws, opening("ambiguous", { format: "Remote or hybrid" })).adjustment, 0);
});

test("interest: pay and requirements remain direct-only without comparable captured values", () => {
  const ws = workspace(), job = opening("rated");
  for (const reason of ["pay", "requirements"] as const) {
    rate(ws, job, 1, reason);
    assert.equal(preferenceAdjustment(ws, job).adjustment, -8);
    assert.equal(preferenceAdjustment(ws, opening("other")).adjustment, 0);
    assert.equal(employerPreferences(ws).size, 0);
  }
});

test("interest: changed professional context stops transfer but keeps the direct answer; private facts are not captured", () => {
  const ws = workspace(), job = opening("rated"); rate(ws, job, 5, "company");
  const context = interestContext(ws, job, at);
  assert.deepEqual(Object.keys(context.profile).sort(), ["major", "targetRoles", "interests", "classYear", "regions", "opportunityTypes"].sort());
  assert.equal(context.capturedAt, at);
  assert.doesNotMatch(JSON.stringify(context), /private@example|Private|3\.5/);
  ws.profile.email = "changed@example.test"; ws.profile.workAuth = "Changed";
  assert.equal(interestContext(ws, job, at).profileKey, context.profileKey);
  ws.profile.targetRoles = "SOFTWARE  ENGINEERING";
  assert.equal(interestContext(ws, job, at).profileKey, context.profileKey, "formatting alone is not a new goal");
  ws.profile.targetRoles = "data science";
  assert.equal(preferenceAdjustment(ws, job).adjustment, 8);
  assert.equal(preferenceAdjustment(ws, opening("other")).adjustment, 0);
  assert.equal(employerPreferences(ws).size, 0);
});

test("interest: many ratings stay bounded, neutral replaces inferred affinity, and company transfer is explicit", () => {
  const ws = workspace(), candidate = opening("candidate");
  for (let i = 0; i < 40; i++) rate(ws, opening(`rated-${i}`), 5, "company");
  assert.equal(preferenceAdjustment(ws, candidate).adjustment, 4);
  assert.equal(employerPreferences(ws).get("acme"), 4);
  ws.jobFeedback = {}; rate(ws, opening("rated"), 3, "company");
  ws.savedJobIds = [candidate.id];
  assert.equal(preferenceAdjustment(ws, candidate).adjustment, 0);
  assert.equal(employerPreferences(ws).get("acme"), 0);
  assert.equal(preferenceAdjustment(ws, opening("unrelated", { company: "Acme Partners" })).adjustment, 0);
});

test("ranking: uses a single stable order, keeps fit verdicts intact, and interest cannot promote ineligible or closed jobs", () => {
  const ws = workspace(), a = opening("a"), b = opening("b"), excluded = opening("excluded"), closed = opening("closed");
  const jobs = [a, b, excluded, closed];
  const fits = { a: fit(50), b: fit(50), excluded: fit(95, { excluded: true, eligibility: "unlikely" }), closed: fit(100, { closed: "Closed" }) };
  rate(ws, b, 5); rate(ws, excluded, 5); rate(ws, closed, 5);
  const before = JSON.stringify(fits), input = jobs.map((j) => j.id);
  const ranked = rankJobs(ws, jobs, fits);
  assert.deepEqual(ranked.jobs.map((j) => j.id), ["b", "a", "excluded", "closed"]);
  assert.equal(ranked.rankings.b.score, 58);
  assert.equal(JSON.stringify(fits), before);
  assert.deepEqual(jobs.map((j) => j.id), input);
  ws.jobFeedback = {};
  assert.deepEqual(rankJobs(ws, [b, a], fits).jobs.map((j) => j.id), rankJobs(ws, [a, b], fits).jobs.map((j) => j.id));
});

test("ranking: rollback ignores ratings and transfer, while preserving the unified base and weak save signal", () => {
  const ws = workspace(), job = opening("rated"), candidate = opening("candidate");
  ws.jobs = [job, candidate]; ws.savedJobIds = [job.id]; rate(ws, job, 1, "company");
  assert.equal(preferenceAdjustment(ws, job, false).adjustment, 2);
  assert.equal(preferenceAdjustment(ws, candidate, false).adjustment, 1);
  assert.equal(employerPreferences(ws, false).size, 0);
  const fits = { rated: fit(50), candidate: fit(60) };
  const disabled = rankJobs(ws, ws.jobs, fits, false);
  ws.jobFeedback = {};
  assert.deepEqual(disabled, rankJobs(ws, ws.jobs, fits, true));
  const previous = process.env.OR_JOB_INTEREST_ENABLED;
  try { process.env.OR_JOB_INTEREST_ENABLED = "false"; assert.equal(interestEnabled(), false); }
  finally { if (previous === undefined) delete process.env.OR_JOB_INTEREST_ENABLED; else process.env.OR_JOB_INTEREST_ENABLED = previous; }
});
