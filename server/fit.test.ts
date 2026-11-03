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

test("deadline reminders: 1–3 days before and on the day, once each, only when on", async () => {
  const { dueReminders } = await import("./reminders");
  const { emptyWorkspace } = await import("./db");
  const ws = emptyWorkspace();
  ws.onboarding.done = true;
  ws.calendar = [
    { id: "a", title: "Deloitte: deadline", date: "2026-11-03", time: "", kind: "Deadline", source: "", notes: "" },
    { id: "b", title: "PwC: deadline", date: "2026-11-01", time: "", kind: "Deadline", source: "", notes: "" },
    { id: "c", title: "Far away", date: "2026-12-01", time: "", kind: "Deadline", source: "", notes: "" },
    { id: "d", title: "Career fair", date: "2026-11-02", time: "", kind: "Event", source: "", notes: "" },
  ];
  const r = dueReminders(ws, "2026-11-01");
  assert.deepEqual(r.map((x) => [x.title, x.left]), [["Deloitte: deadline", 2], ["PwC: deadline", 0]]);
  ws.reminded = r.map((x) => x.key);
  assert.equal(dueReminders(ws, "2026-11-01").length, 0, "sent once");
  assert.equal(dueReminders(ws, "2026-11-02").length, 0, "the 'soon' reminder isn't repeated the next day");
  assert.equal(dueReminders(ws, "2026-11-03").length, 1, "but the day-of one still comes");
  ws.settings.notify.deadlines = false;
  assert.equal(dueReminders(ws, "2026-11-03").length, 0, "off means off");
});

test("same employer however it's written", async () => {
  const { sameOrg } = await import("@shared/org");
  assert.equal(sameOrg("Deloitte LLP", "deloitte"), true);
  assert.equal(sameOrg("Ernst & Young", "Ernst and Young LLP"), true);
  assert.equal(sameOrg("PwC", "Deloitte"), false);
  assert.equal(sameOrg("", "Deloitte"), false);
});

test("weekly digest: on the student's day, once, only with news, only when on", async () => {
  const { weeklyDigest } = await import("./reminders");
  const { emptyWorkspace } = await import("./db");
  const ws = emptyWorkspace();
  ws.onboarding.done = true;
  ws.settings.notify.weeklyPlan = true;
  ws.settings.careerTime = { day: 0, time: "19:00" };
  const job = (id: string, foundAt: string) => ({ id, kind: "internship", title: "Audit Intern", company: "Deloitte", foundAt } as any);
  ws.jobs = [job("a", "2026-10-30T10:00:00Z"), job("b", "2026-09-01T10:00:00Z")];
  const d = weeklyDigest(ws, "2026-11-01", 0, "x.test");
  assert.ok(d && d.subject === "Deloitte: Audit Intern for you", d?.subject); // a real employer in the subject
  assert.doesNotMatch(d!.text, /road to an offer/i);
  assert.equal(weeklyDigest(ws, "2026-11-02", 1, "x.test"), null, "not on another day");
  ws.lastDigest = "2026-11-01";
  assert.equal(weeklyDigest(ws, "2026-11-01", 0, "x.test"), null, "once");
  ws.lastDigest = undefined; ws.lastDigestAt = "2026-10-31T00:00:00Z";
  assert.equal(weeklyDigest(ws, "2026-11-08", 0, "x.test"), null, "no news, no email");
  // A saved opening Remy found closed since the last digest is news too.
  ws.savedJobIds = ["b"];
  (ws.jobs[1] as any).checks = [{ at: "2026-11-05T03:00:00Z", httpStatus: 404, result: "unreachable", note: "" }];
  const c = weeklyDigest(ws, "2026-11-08", 0, "x.test");
  assert.ok(c && c.subject === "Deloitte closed its posting" && /No longer open/.test(c.text), c?.subject);
  ws.settings.notify.weeklyPlan = false;
  assert.equal(weeklyDigest(ws, "2026-11-01", 0, "x.test"), null, "off means off");
});

test("recruiting season: matches the field and says whether it's open now", async () => {
  const { seasonFor } = await import("@shared/seasons");
  const fin = seasonFor("Finance, investment banking", new Date("2026-11-15T12:00:00"));
  assert.deepEqual([fin?.label, fin?.open, fin?.monthsUntil], ["Finance", false, 2]);
  const tech = seasonFor("Computer Science", new Date("2026-11-15T12:00:00"));
  assert.deepEqual([tech?.label, tech?.open], ["Tech", true], "a window that wraps the new year");
  assert.equal(seasonFor("Underwater basket weaving"), null);
});

test("regions: a state after a city labels that city ('Fort Worth, TX' is not all of Texas); states alone still mean the state", async () => {
  const { emptyWorkspace } = await import("./db");
  const { regionMatch } = await import("./fit");
  const at = (regions: string, location: string) => { const ws = emptyWorkspace(); ws.profile.regions = regions; return regionMatch(ws, { location, format: "" } as any); };
  assert.equal(at("Fort Worth, TX", "Houston, TX"), false);
  assert.equal(at("Fort Worth, TX", "Dallas, TX"), true);
  assert.equal(at("Austin, Texas", "Houston, TX"), false);
  assert.equal(at("Austin, Texas", "Austin, TX"), true);
  assert.equal(at("Texas, California", "Houston, TX"), true);
  assert.equal(at("TX", "Houston, TX"), true);
  assert.equal(at("Fort Worth", "New York, NY"), false);
});

test("field roads: major wins, trade paths get the trades road, class year maps to a step year", async () => {
  const { roadFor, yearNumber } = await import("@shared/roads");
  assert.equal(roadFor("Accounting")?.key, "accounting");
  assert.equal(roadFor("Finance & Business Information Systems")?.key, "finance");
  assert.equal(roadFor("Actuarial Science")?.key, "actuarial", "not finance");
  assert.equal(roadFor("Nursing")?.key, "nursing", "not health");
  assert.equal(roadFor("Electrical apprenticeship", "apprenticeship")?.key, "trades");
  // A wrong road is worse than none (persona test Nov 1): welder ≠ electrician, pre-dental ≠ MCAT, economics ≠ SIE.
  assert.equal(roadFor("Welding Technology Certificate", "trade"), null);
  assert.equal(roadFor("", "apprenticeship"), null);
  assert.equal(roadFor("Biochemistry (Pre-Dental)"), null);
  assert.equal(roadFor("dentistry"), null);
  assert.equal(roadFor("Economics"), null);
  assert.equal(roadFor("Biology"), null);
  assert.equal(roadFor("Medical Assistant"), null);
  assert.equal(roadFor("Pre-Med Biology")?.key, "health");
  assert.equal(roadFor("Pre-PT Kinesiology")?.key, "health");
  assert.equal(roadFor("Pharmacy")?.key, "health");
  assert.equal(roadFor("Electrical Engineering")?.key, "engineering", "engineering before electrician");
  assert.equal(roadFor("Underwater basket weaving"), null);
  assert.deepEqual(["First-year", "Freshman", "Sophomore", "Senior", "Graduate student", ""].map(yearNumber), [1, 1, 2, 4, 5, 0]);
});

test("early programs rank higher for first-years and sophomores; conferences aren't hidden as off-field", () => {
  const job = (kind: string, title: string) => ({ id: "x", kind, title, company: "EY", location: "Dallas, TX", format: "", dates: "", deadline: "", deadlineText: "", eligibility: [], requirements: [], summary: "", applyUrl: "", sourceUrl: "", sourceName: "EY careers (Workday job board)", label: "Live", checkedAt: "", checks: [], origin: "imported" }) as unknown as Job;
  const soph = student({ classYear: "Sophomore", targetRoles: "accounting" });
  const senior = student({ classYear: "Senior", targetRoles: "accounting" });
  const disc = job("program", "EY Discovery Day Accounting");
  assert.ok(computeFit(soph, disc, "").score! > computeFit(senior, disc, "").score!);
  const conf = { ...job("event", "NABA National Convention"), sourceName: "Conference found by Remy's researcher (dates checked on the event page)" };
  assert.equal(computeFit(soph, conf, "").excluded, false);
});

test("LinkedIn coach: lists resume items missing from the LinkedIn PDF with copy-ready fields; guessed fields stay blank", async () => {
  const { linkedinGaps, linkedinBasics } = await import("@shared/linkedin");
  const doc = { contact: {}, skills: [], sections: [
    { id: "s1", heading: "Experience", entries: [
      { id: "e1", org: "Chick-fil-A", role: "Team Member", location: "Fort Worth, TX", dates: "2024 – Present", bullets: [{ id: "b", text: "Took orders" }] },
      { id: "e2", org: "PwC", role: "Extern", location: "", dates: "2025", bullets: [] },
    ] },
    { id: "s2", heading: "Volunteer Work", entries: [{ id: "e3", org: "Tarrant Area Food Bank", role: "Volunteer", location: "", dates: "2025", bullets: [], unverified: ["role"] }] },
    { id: "s3", heading: "Skills", entries: [{ id: "e4", org: "Excel", role: "", location: "", dates: "", bullets: [] }] },
  ] } as any;
  const li = "Dilan\nSummary\nFinance student\nExperience\nPwC\nExtern\n2025";
  const gaps = linkedinGaps(doc, li);
  assert.deepEqual(gaps.map((g) => [g.section, g.title]), [["Experience", "Team Member, Chick-fil-A"], ["Volunteering", "Tarrant Area Food Bank"]]);
  assert.deepEqual(gaps[0].fields.find((f) => f.label === "Description")?.value, "• Took orders");
  assert.equal(gaps[1].fields.find((f) => f.label === "Role"), undefined, "a role the resume reader guessed isn't offered");
  assert.deepEqual(linkedinBasics(li).map((b) => b.ok), [true, false, true, null]);
});

test("weekly digest asks for a fresh LinkedIn PDF after a month", async () => {
  const { weeklyDigest } = await import("./reminders");
  const { emptyWorkspace } = await import("./db");
  const ws = emptyWorkspace();
  ws.onboarding.done = true;
  ws.settings.notify.weeklyPlan = true;
  ws.calendar = [{ id: "c", kind: "Deadline", date: "2026-11-03", time: "", title: "EY app", source: "", notes: "" }];
  ws.linkedin = { text: "", at: "2026-09-20T10:00:00Z" };
  assert.match(weeklyDigest(ws, "2026-11-01", 0, "x.test")!.text, /LinkedIn check is over a month old/);
  ws.linkedin.at = "2026-10-25T10:00:00Z";
  assert.doesNotMatch(weeklyDigest(ws, "2026-11-01", 0, "x.test")!.text, /LinkedIn/);
});

test("regionMatch: DFW city names in other states don't count as DFW", () => {
  const dfw = student({ regions: "Fort Worth, Dallas" });
  assert.equal(regionMatch(dfw, job({ location: "Arlington, VA" })), false);
  assert.equal(regionMatch(dfw, job({ location: "Plano, IL" })), false);
  assert.equal(regionMatch(dfw, job({ location: "Arlington, TX" })), true);
  assert.equal(regionMatch(dfw, job({ location: "Arlington, Texas" })), true);
  assert.equal(regionMatch(dfw, job({ location: "Chicago, IL, United States; Dallas, TX, United States" })), true);
  assert.equal(regionMatch(dfw, job({ location: "Irving" })), true, "no state named: still DFW");
});

test("dealbreaker: a high school internship rules out a college student, not a high schooler", () => {
  const hs = job({ title: "High School Internship, Software Engineering (Summer 2027)" });
  assert.equal(dealbreaker(student({ classYear: "Sophomore" }), hs), "This one is for high school students.");
  assert.equal(dealbreaker(student({ classYear: "", path: "high-school" }), hs), "");
});

test("fit: eligibility labels aren't gaps, and no readable skills isn't called a stretch", () => {
  const ws = student({ classYear: "Sophomore", graduation: "May 2029", targetRoles: "accounting" });
  (ws as any).resume = { doc: { sections: [] } };
  const req = (keyword: string) => ({ id: keyword, keyword, quote: keyword });
  const ey = { ...job({ title: "EY Discovery Day" }), requirements: ["Academic standing", "Eligible majors", "Minimum GPA", "Core skills"].map(req) } as Job;
  const f = computeFit(ws, ey, "Treasurer, budgeting, Excel");
  assert.deepEqual(f.gaps, []);
  assert.match(f.why, /couldn't read the skills/);
  const real = { ...ey, requirements: [req("Excel"), req("Minimum GPA")] } as Job;
  assert.deepEqual([computeFit(ws, real, "Built models in Excel").matched, computeFit(ws, real, "Built models in Excel").gaps], [["Excel"], []]);
});

// Piece 6 (Nov 2): "You qualify" only when true (persona test Nov 1: welder, high-school senior, finance, mech-eng, studio art).
test("'You qualify' needs a rule Remy checked: no stated limit is 'likely' but not checked", () => {
  const open = computeFit(student({ classYear: "Junior" }), job({ eligibility: [] }), "");
  assert.equal(open.eligibility, "likely");
  assert.equal(open.checked, false);
  assert.equal(computeFit(student({ classYear: "Junior" }), job({ eligibility: ["Open to juniors."] }), "").checked, true);
  assert.equal(computeFit(student({ graduation: "May 2029" }), job({ eligibility: ["Open to students in the Class of 2029"] }), "").checked, true);
  assert.equal(computeFit(student({ classYear: "Junior", gpa: "3.4" }), job({ eligibility: ["Minimum GPA of 3.0 required."] }), "").checked, true); // a GPA rule met
  assert.equal(computeFit(student({ classYear: "Junior" }), job({ eligibility: ["Minimum GPA of 3.0 required."] }), "").checked, false); // GPA unknown
});
test("a welding-certificate student isn't eligible for an 'Undergraduate' internship", () => {
  const f = computeFit(student({ path: "trade", major: "Welding Technology Certificate", classYear: "First-year" }), job({ title: "2027 Undergraduate Summer Internship" }), "");
  assert.equal(f.eligibility, "unlikely");
  assert.equal(f.excluded, true);
  assert.match(f.eligibilityNote, /college students/);
});
test("a high-school senior isn't a college senior, and 'current undergraduate enrollment' rules them out", () => {
  const hs = student({ path: "high-school", classYear: "Senior", graduation: "May 2027" });
  assert.equal(computeFit(hs, job({ title: "2028 Investment Banking Summer Internship", eligibility: ["Open to rising seniors."] }), "").eligibility, "unlikely");
  assert.equal(computeFit(hs, job({ title: "AVID Tutor", eligibility: ["Current undergraduate enrollment at an accredited university preferred."] }), "").eligibility, "unlikely");
  assert.notEqual(computeFit(hs, job({ title: "High School Summer Program", eligibility: ["Open to high school students."] }), "").eligibility, "unlikely");
});
test("community college: 'undergraduate' is fine, 'pursuing a bachelor's' isn't", () => {
  const cc = student({ path: "community-college", classYear: "Sophomore" });
  assert.notEqual(computeFit(cc, job({ title: "Undergraduate Research Assistant" }), "").eligibility, "unlikely");
  assert.equal(computeFit(cc, job({ eligibility: ["Must be currently pursuing a bachelor's degree."] }), "").eligibility, "unlikely");
});
test("a full-time job needing a finished bachelor's: not for a junior 18 months out, fine for a senior about to graduate", () => {
  const j = job({ kind: "job", title: "Mechanical Designer", summary: "Bachelor's degree in Mechanical Engineering required." });
  const junior = computeFit(student({ classYear: "Junior", graduation: "May 2028" }), j, "");
  assert.equal(junior.eligibility, "unlikely");
  assert.match(junior.eligibilityNote, /finished bachelor's/);
  assert.notEqual(computeFit(student({ classYear: "Senior", graduation: "May 2027" }), j, "").eligibility, "unlikely");
  assert.notEqual(computeFit(student({ classYear: "Junior", graduation: "May 2028" }), job({ kind: "internship", title: "Mechanical Engineering Intern", summary: "Pursuing a bachelor's degree in Mechanical Engineering." }), "").eligibility, "unlikely");
});
test("MBA-only is 'Not eligible'; not-your-field is 'Hidden' and never next to a 'You qualify' reason", () => {
  const mba = computeFit(student({ classYear: "Senior" }), job({ title: "MBA Strategy Intern" }), "");
  assert.equal(mba.eligibility, "unlikely");
  assert.equal(mba.hidden, undefined);
  const mechJunior = student({ classYear: "Junior", major: "Mechanical Engineering" });
  const sw = computeFit(mechJunior, job({ title: "Software Engineer Intern", origin: "verified-catalog", eligibility: ["Open to juniors."] } as Partial<Job>), "");
  assert.equal(sw.excluded, true);
  assert.equal(sw.hidden, "This isn't in the fields you chose.");
  assert.doesNotMatch(sw.eligibilityNote, /fields you chose/); // the eligibility line stays about eligibility
  const avoid = computeFit(student({ classYear: "Junior", avoid: "sales" }), job({ title: "Sales Intern", eligibility: ["Open to juniors."] }), "");
  assert.equal(avoid.excluded, true);
  assert.match(avoid.hidden || "", /avoid/);
  assert.equal(avoid.checked, true); // they do qualify; it's hidden because they said avoid
});

test("second review: preferred or equivalent degrees, trade-friendly and associate-friendly postings aren't 'not eligible'", () => {
  const junior = student({ classYear: "Junior", graduation: "May 2028" });
  for (const summary of ["Bachelor's degree in Marketing preferred.", "Bachelor's degree in IT or equivalent experience.", "Requires a bachelor's degree in progress.", "Bachelor's degree from an accredited university."])
    assert.notEqual(computeFit(junior, job({ kind: "job", title: "Marketing Coordinator", summary }), "").eligibility, "unlikely", summary);
  assert.equal(computeFit(junior, job({ kind: "job", title: "Marketing Coordinator", summary: "A bachelor's degree is required." }), "").eligibility, "unlikely");
  const welder = student({ path: "trade", major: "Welding", classYear: "First-year" });
  assert.notEqual(computeFit(welder, job({ eligibility: ["Currently enrolled in an accredited college, university, or technical school."] }), "").eligibility, "unlikely");
  assert.notEqual(computeFit(welder, job({ eligibility: ["Pursuing a degree or certificate in welding."] }), "").eligibility, "unlikely");
  assert.notEqual(computeFit(student({ path: "community-college", classYear: "Sophomore" }), job({ eligibility: ["Currently pursuing an associate's or bachelor's degree."] }), "").eligibility, "unlikely");
  const quote = computeFit(welder, job({ title: "Summer Analyst", eligibility: ["Open to undergraduates."] }), "").eligibilityNote;
  assert.match(quote, /“Open to undergraduates”/);
});
test("second review: a high-school senior never qualifies through a college graduation-year rule", () => {
  const hs = student({ path: "high-school", classYear: "Senior", graduation: "May 2027" });
  for (const e of ["Open to students in the Class of 2027", "Graduating between December 2026 and June 2027"]) {
    const f = computeFit(hs, job({ eligibility: [e] }), "");
    assert.equal(f.eligibility, "unlikely", e);
    assert.notEqual(f.checked, true, e);
  }
});
test("second review: lookalike fields get no road", async () => {
  const { roadFor } = await import("@shared/roads");
  for (const f of ["Veterinary Medicine", "Sports Medicine", "Pharmacy Technician", "Pharmaceutical Sciences", "Electric vehicles"]) assert.equal(roadFor(f), null, f);
  assert.equal(roadFor("Electrical lineworker")?.key, "trades");
});

test("abroad: US towns with foreign names stay in the US; remote jobs abroad aren't local (persona test Nov 1)", () => {
  for (const l of ["Albuquerque, New Mexico", "Dublin, OH", "Paris, TX", "St. Petersburg, FL", "London, KY", "Berlin, NH", "Atlanta, Georgia", "Remote, US", "Remote, Chattanooga, TN", "Ontario, CA", "Panama City, FL", "Remote - United States"])
    assert.equal(abroad(l), false, l);
  for (const l of ["Lima, OH", "Mexico, MO", "Peru, IN", "Dallas, On-site", "san francisco, ca", "Dallas, TX; London, UK", "London, UK; Dallas, TX", "US-TX-Dallas", "Panama City Beach, FL"])
    assert.equal(abroad(l), false, l);
  for (const l of ["Remote, St. Petersburg, Russian Federation", "Remote, Tunis, Tunisia", "Remote - EMEA", "Remote, LATAM", "Toronto, ON, Canada", "Toronto, ON", "Remote - Querétaro, Mexico", "Hybrid - London, UK", "Dublin, Ireland", "Vancouver, BC", "Remote - Europe",
    "Toronto, ON, CA", "Berlin, DE", "Bengaluru, IN", "Remote, Bengaluru, IN", "Tel Aviv, IL", "Bogotá, CO", "Buenos Aires, AR", "Lima, Peru", "Mexico City", "Paris, France"])
    assert.equal(abroad(l), true, l);
  const dfw = student({ regions: "Dallas-Fort Worth" });
  assert.equal(regionMatch(dfw, job({ location: "Remote, St. Petersburg, Russian Federation" })), false);
  assert.equal(regionMatch(dfw, job({ location: "Remote" })), true);
  assert.equal(regionMatch(student({ regions: "Texas" }), job({ location: "Paris, TX" })), true);
});

test("ranking: a title with the student's own field words beats one that only fits the broad field (persona test Nov 1)", () => {
  const mech = student({ classYear: "Junior", major: "Mechanical Engineering", targetRoles: "aerospace, manufacturing" });
  const s = (title: string) => computeFit(mech, job({ title, origin: "verified-catalog" } as Partial<Job>), "").score!;
  assert.ok(s("Mechanical Design Intern") > s("Hardware Engineering Intern"), "mechanical beats hardware");
  assert.ok(s("Manufacturing Engineering Intern") > s("Software Engineering Intern"));
  const fin = student({ classYear: "Sophomore", major: "Finance", targetRoles: "investment banking" });
  const f = (title: string) => computeFit(fin, job({ title, origin: "verified-catalog" } as Partial<Job>), "").score!;
  assert.ok(f("Investment Banking Summer Analyst") > f("IT Business Analyst Intern"));
  // Generic words ("engineering", "intern", "analyst") don't count as the student's own field.
  assert.equal(s("Engineering Intern") < s("Mechanical Engineering Intern"), true);
});
