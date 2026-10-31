// Eligibility, class standing and region rules behind the Opportunities ranking. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job, Workspace } from "@shared/types";
import { abroad, classYearOf, computeFit, dealbreaker, FIELD_TITLES, fieldMatch, regionMatch } from "./fit";
import { FIELD_GROUPS } from "@shared/fields";

const fall2026 = new Date("2026-10-22T12:00:00");
const student = (profile: Partial<Workspace["profile"]>) =>
  ({ profile: { classYear: "", graduation: "", regions: "", opportunityTypes: "", ...profile }, resume: undefined } as unknown as Workspace);
const job = (j: Partial<Job>) =>
  ({ kind: "internship", title: "Summer Analyst", location: "Dallas, TX", format: "", eligibility: [], requirements: [], label: "Live", ...j } as unknown as Job);

test("class standing from graduation date: May 2029 is a sophomore in fall 2026", () => {
  assert.equal(classYearOf(student({ graduation: "May 2029" }), fall2026), "Sophomore");
  assert.equal(classYearOf(student({ graduation: "May 2030" }), fall2026), "First-year");
});
test("class standing the student states wins over the graduation date", () => {
  assert.equal(classYearOf(student({ classYear: "Junior", graduation: "May 2029" }), fall2026), "Junior");
});
test("'Class of 2029' posting: likely for a 2029 graduate, ruled out for 2030", () => {
  const j = job({ eligibility: ["Open to students in the Class of 2029"] });
  assert.equal(computeFit(student({ graduation: "May 2029" }), j, "").eligibility, "likely");
  const f = computeFit(student({ graduation: "May 2030" }), j, "");
  assert.equal(f.eligibility, "unlikely");
  assert.equal(f.excluded, true);
});
test("'must be a current sophomore' rules out a junior", () => {
  const f = computeFit(student({ classYear: "Junior" }), job({ eligibility: ["Applicants must be current sophomores."] }), "");
  assert.equal(f.excluded, true);
});
test("standing by credit hours stays visible, with the reason", () => {
  const f = computeFit(student({ classYear: "First-year" }), job({ eligibility: ["Open to sophomores (by credit hours)."] }), "");
  assert.equal(f.eligibility, "likely");
  assert.ok(!f.excluded);
  assert.match(f.eligibilityNote, /credit hours/);
});
test("eligibility: no class-year rule means eligible; a GPA minimum is checked against the student's GPA", () => {
  assert.equal(computeFit(student({ classYear: "Junior" }), job({ eligibility: [] }), "").eligibility, "likely");
  const strict = job({ eligibility: ["Minimum GPA of 3.5 required."] });
  const low = computeFit(student({ classYear: "Junior", gpa: "3.2" } as any), strict, "");
  assert.equal(low.eligibility, "unlikely");
  assert.ok(low.excluded);
  assert.equal(computeFit(student({ classYear: "Junior", gpa: "3.8" } as any), strict, "").eligibility, "likely");
});
test("'rising sophomores' means current first-years", () => {
  const f = computeFit(student({ classYear: "First-year" }), job({ eligibility: ["This program is for rising sophomores."] }), "");
  assert.equal(f.eligibility, "likely");
});
test("regions: DFW suburbs match Dallas, Europe doesn't, 'anywhere' doesn't filter", () => {
  assert.equal(regionMatch(student({ regions: "Dallas" }), job({ location: "Irving, TX" })), true);
  assert.equal(regionMatch(student({ regions: "Dallas, Fort Worth" }), job({ location: "Brussels, Belgium" })), false);
  assert.equal(regionMatch(student({ regions: "anywhere" }), job({ location: "Brussels, Belgium" })), null);
  assert.equal(regionMatch(student({ regions: "Remote" }), job({ location: "New York, NY", format: "Remote" })), true);
  assert.equal(regionMatch(student({ regions: "Dallas, Fort Worth" }), job({ location: "New York, NY / virtual" })), true, "virtual programs count everywhere");
});

test("fields: postings outside the student's chosen fields are left out", () => {
  const finance = student({ targetRoles: "investment banking", classYear: "Sophomore" });
  assert.equal(computeFit(finance, job({ title: "Brand Marketing Intern" }), "").excluded, true);
  assert.ok(!computeFit(finance, job({ title: "M&A Summer Analyst" }), "").excluded);
  const marketing = student({ major: "Marketing", targetRoles: "brand marketing", classYear: "Junior" });
  assert.equal(computeFit(marketing, job({ title: "Investment Banking Summer Analyst" }), "").excluded, true);
});
test("kinds: an internships-only student doesn't see full-time jobs", () => {
  const s = student({ opportunityTypes: "Internships", targetRoles: "finance" });
  assert.equal(computeFit(s, job({ kind: "job", title: "Financial Analyst" }), "").excluded, true);
  assert.ok(!computeFit(s, job({ kind: "internship", title: "Financial Analyst Intern" }), "").excluded);
});
test("postings the student pasted in are never hidden by field or kind", () => {
  const s = student({ targetRoles: "investment banking", opportunityTypes: "Internships" });
  const pasted = job({ kind: "job", title: "Brand Marketing Coordinator", origin: "imported", sourceName: "Pasted by student" } as Partial<Job>);
  assert.ok(!computeFit(s, pasted, "").excluded);
});

test("abroad: foreign postings are spotted, US ones are not", () => {
  for (const l of ["Sao Paulo Sao Paulo Brazil", "ES - MADRID PASEO DE LA CASTELLANA 7", "Milano, ITA", "Nottingham,  Eng", "MA - Casablanca, Morocco", "Hong Kong", "Virtual, BR", "DE - FRANKFURT, BOCKENHEIMER", "Central, HK"]) assert.equal(abroad(l), true, l);
  for (const l of ["USA, TX, Irving", "Dallas, TX", "IL-Rosemont", "FL - Plantation", "Beaverton, Oregon", "Indianapolis, Indiana", "Remote", "2 Locations", ""]) assert.equal(abroad(l), false, l);
});

test("regionMatch: a state name matches its abbreviation", () => {
  const w = { profile: { regions: "California" } } as Workspace;
  assert.equal(regionMatch(w, { location: "Glendale, CA, USA", format: "" } as Job), true);
  assert.equal(regionMatch(w, { location: "Toronto, Canada", format: "" } as Job), false);
});

test("dealbreakers: sponsorship, graduate-only, avoid list and the wrong summer are left out", () => {
  const intl = student({ workAuth: "Will need visa sponsorship (F-1)", classYear: "Sophomore" });
  assert.match(dealbreaker(intl, job({ summary: "Candidates must be authorized to work in the U.S. without the need for current or future sponsorship." })), /sponsor/);
  assert.equal(dealbreaker(student({ workAuth: "U.S. citizen" }), job({ summary: "We do not offer visa sponsorship." })), "");
  const undergrad = student({ classYear: "Sophomore" });
  assert.match(dealbreaker(undergrad, job({ title: "Finance Leadership Program Intern", requirements: [{ id: "r1", keyword: "MBA enrollment", quote: "Currently enrolled in an MBA program" }] as Job["requirements"] })), /MBA/);
  assert.equal(dealbreaker(student({ classYear: "Graduate student" }), job({ title: "MBA Summer Associate" })), "");
  assert.match(dealbreaker(student({ avoid: "tobacco, Wells Fargo" }), job({ company: "Wells Fargo", title: "Analyst Intern" })), /avoid/);
  assert.match(dealbreaker(student({ timeline: "Summer 2027" }), job({ title: "Summer 2028 Analyst Intern" })), /Summer 2028/);
  assert.equal(dealbreaker(student({ timeline: "Summer 2027" }), job({ title: "2027 Summer Analyst" })), "");
});

test("fields: nursing students match nursing roles; mechanical engineers aren't sent software jobs", () => {
  const nurse = student({ major: "Nursing (BSN)", targetRoles: "", interests: "" });
  assert.equal(fieldMatch(nurse, job({ title: "Student Nurse Extern - Summer 2027", origin: "verified-catalog" } as Partial<Job>)), true);
  const mech = student({ major: "Mechanical Engineering", targetRoles: "", interests: "" });
  assert.equal(fieldMatch(mech, job({ title: "Manufacturing Engineering Intern", origin: "verified-catalog" } as Partial<Job>)), true);
  assert.equal(fieldMatch(mech, job({ title: "Software Engineer Intern", origin: "verified-catalog" } as Partial<Job>)), false);
});
test("regions: 'Dallas-Fort Worth, Texas' means DFW, not anywhere in Texas; 'Texas' alone still means the state", () => {
  assert.equal(regionMatch(student({ regions: "Dallas-Fort Worth, Texas" }), job({ location: "El Paso, TX, United States" })), false);
  assert.equal(regionMatch(student({ regions: "Dallas-Fort Worth, Texas" }), job({ location: "Irving, TX" })), true);
  assert.equal(regionMatch(student({ regions: "Texas" }), job({ location: "El Paso, TX, United States" })), true);
});

// Stress test, Oct 26: a Finance & BIS student targeting M&A was shown petroleum and safety engineering roles.
const dilan = student({ major: "Finance & BIS with Fintech Certification", targetRoles: "Investment banking, M&A, especially sell-side advisory for middle-market companies" });
test("field: a Finance & BIS student doesn't match engineering roles outside software", () => {
  for (const title of ["Reservoir Engineer Intern - Summer 2027", "Drilling & Completions Engineer Intern - Summer 2027", "Public Notice for Safety Engineer (Direct Hire)", "Cryogenic Data Systems Architect", "Summer Intern (Legal Administrative Specialist) (Non-Tax)"])
    assert.equal(fieldMatch(dilan, job({ title })), false, title);
});
test("field: a Finance & BIS student still matches finance, risk and business-technology roles", () => {
  for (const title of ["Financial Institution Intern (Risk Management)", "2027 Intern - Technology Risk", "Summer Analyst - Investment Banking", "Business Analyst Intern", "IT Audit Intern"])
    assert.equal(fieldMatch(dilan, job({ title })), true, title);
});
test("field: a CS student still matches software engineering roles", () => {
  const cs = student({ major: "Computer Science" });
  for (const title of ["Software Engineer Intern", "Data Engineer Intern", "Backend Engineer, New Grad"]) assert.equal(fieldMatch(cs, job({ title })), true, title);
  assert.equal(fieldMatch(cs, job({ title: "Reservoir Engineer Intern" })), false);
});
test("field: 'middle-market' and 'capital markets' don't make a student a marketing student", () => {
  assert.equal(fieldMatch(student({ targetRoles: "middle-market M&A" }), job({ title: "Brand Marketing Intern" })), false);
  assert.equal(fieldMatch(student({ major: "Marketing" }), job({ title: "Brand Marketing Intern" })), true);
});

test("setup field chips: every chip a student can tap matches a field Remy searches", () => {
  for (const label of FIELD_GROUPS.flatMap(([, opts]) => opts))
    assert.ok(FIELD_TITLES.some(([field]) => field.test(label)), label);
});
test("setup field chips: 'Engineering' is engineering, not software", () => {
  const eng = student({ targetRoles: "Engineering" });
  assert.equal(fieldMatch(eng, job({ title: "Mechanical Engineering Intern" })), true);
  assert.equal(fieldMatch(eng, job({ title: "Software Engineer Intern" })), false);
});

test("past terms are dropped from setup options: Summer 2026 is past on Oct 31, 2026; Spring 2027 is not", async () => {
  const { pastTerm } = await import("./fit");
  assert.equal(pastTerm("Summer 2026", "2026-10-31"), true);
  assert.equal(pastTerm("Fall 2026", "2026-10-31"), true);
  assert.equal(pastTerm("Spring 2027", "2026-10-31"), false);
  assert.equal(pastTerm("Big 4 firms", "2026-10-31"), false);
});

test("career steps count once, saves are capped per day; road milestones read real work", async () => {
  const { step } = await import("@shared/progress");
  const { milestones } = await import("@shared/progress");
  const { emptyWorkspace } = await import("./db");
  const ws = emptyWorkspace();
  assert.equal(step(ws, "task", "c", "2026-10-27T15:00:00Z"), true);
  assert.equal(step(ws, "task", "c", "2026-10-27T16:00:00Z"), false, "same step twice doesn't count");
  for (const id of ["j1", "j2", "j3", "j4"]) step(ws, "save", id, "2026-10-29T15:00:00Z");
  assert.equal(ws.steps!.filter((s) => s.kind === "save").length, 3, "fourth save of the day isn't recorded");
  ws.savedJobIds = ["j1", "j2", "j3"];
  ws.tracker = [{ id: "t", company: "A", role: "B", status: "Saved", notes: "", events: [] }];
  const m = () => Object.fromEntries(milestones(ws).map((x) => [x.label, x.done]));
  assert.deepEqual(m(), { "Resume ready": false, "Openings picked": true, "First application": false, "Reached out": false, "Interview stories": false, Interviewing: false });
  ws.tracker[0].status = "Interview";
  assert.equal(m()["First application"], true);
  assert.equal(m().Interviewing, true);
});
