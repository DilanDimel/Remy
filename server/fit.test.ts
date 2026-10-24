// Eligibility, class standing and region rules behind the Opportunities ranking. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job, Workspace } from "@shared/types";
import { abroad, classYearOf, computeFit, dealbreaker, fieldMatch, regionMatch } from "./fit";

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
test("standing by credit hours is left for the student to check, not hidden", () => {
  const f = computeFit(student({ classYear: "First-year" }), job({ eligibility: ["Open to sophomores (by credit hours)."] }), "");
  assert.equal(f.eligibility, "check");
  assert.ok(!f.excluded);
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
