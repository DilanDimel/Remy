// Fixes from the Nov 7 full site test: honesty gates, email matching, posting cautions. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Job, Workspace } from "@shared/types";
import { createSession, emptyWorkspace, ensureUser, loadWorkspace, saveWorkspace } from "./db";
import { registerRoutes } from "./routes";
import { cautionFor, computeFit } from "./fit";
import { postingSkills } from "@shared/requirements";
import { hasKeyword } from "./ats";

const opening = (j: Partial<Job> = {}): Job => ({
  id: "job-1", kind: "internship", title: "Marketing Intern", company: "Bluebonnet Coffee Co.", location: "Fort Worth, TX",
  format: "", dates: "", deadline: "", deadlineText: "", eligibility: [], requirements: [], summary: "",
  applyUrl: "https://example.com/1", sourceUrl: "https://example.com/1", sourceName: "Synthetic test fixture", label: "Student provided",
  checkedAt: new Date().toISOString(), checks: [], origin: "manual", ...j,
});
const student = (profile: Partial<Workspace["profile"]>) =>
  ({ profile: { classYear: "Junior", graduation: "", regions: "", opportunityTypes: "", major: "", workAuth: "", ...profile }, resume: undefined } as unknown as Workspace);

test("site test fixes: a flagged cover letter needs fixing or confirming; emails match the application they name", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const id = "sb:site-test-fixes";
  await ensureUser({ id, kind: "supabase", email: "fixes@tcu.edu", name: "", picture: "" });
  const ws = emptyWorkspace();
  ws.openingsCheckedAt = new Date().toISOString(); // no outbound job search in this test
  ws.jobs = [opening()];
  ws.tracker = [{ id: "trk-1", company: "Bluebonnet Coffee Co.", role: "Marketing Intern", status: "Applied", events: [] } as any];
  await saveWorkspace(id, ws);
  const cookie = "__Host-or_sid=" + (await createSession(id)).token;
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as any };
  };

  await t.test("cover letter: a claim the resume doesn't show stops approval until fixed or confirmed", async () => {
    assert.equal((await call("POST", "/api/resume/sample")).status, 200);
    const created = await call("POST", "/api/applications", { jobId: "job-1" });
    assert.equal(created.status, 200);
    const appId = created.data.application?.id || created.data.workspace?.applications?.[0]?.id;
    const w = await loadWorkspace(id);
    const a = w.applications.find((x) => x.id === appId)!;
    a.generatedAt = new Date().toISOString();
    a.letter = "Dear Evercore Recruiting Team,\n\nI am a finance student who built a DCF model at Goldman Sachs and raised $2,000,000 for Evercore.\n\nBest,\nDilan";
    await saveWorkspace(id, w);
    const blocked = await call("POST", `/api/applications/${appId}/approve`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.code, "letter-unshown");
    assert.ok((await loadWorkspace(id)).applications.find((x) => x.id === appId)!.versions.length === 0, "nothing approved");
    const confirmed = await call("POST", `/api/applications/${appId}/approve`, { confirmLetter: true });
    assert.equal(confirmed.status, 200);
    const after = await loadWorkspace(id);
    assert.equal(after.applications.find((x) => x.id === appId)!.versions.length, 1);
    assert.ok(after.incidents.some((x) => x.kind === "Letter check overridden by student"), "the student's confirmation is recorded");
  });

  await t.test("cover letter: the posting's own team name and 'Dear Hiring Manager' aren't claims", async () => {
    const w = await loadWorkspace(id);
    w.jobs[0].postingText = "Join our Commercial Banking team in Fort Worth. You will support marketing campaigns.";
    const a = w.applications[0];
    a.letter = "Dear Hiring Manager,\n\nI'm excited to apply to join your Commercial Banking team at Bluebonnet Coffee Co.\n\nThank you,";
    a.changes = [];
    await saveWorkspace(id, w);
    const r = await call("POST", `/api/applications/${a.id}/approve`);
    assert.equal(r.status, 200, JSON.stringify(r.data.message));
  });

  await t.test("cover letter: a skill or a word-piece the posting mentions is still a claim that needs the resume", async () => {
    const w = await loadWorkspace(id);
    w.jobs[0].postingText = "Knowledge of Salesforce and HubSpot. Skilled communicators welcome. Senior leadership exposure.";
    const a = w.applications[0];
    a.letter = "Dear Hiring Manager,\n\nI led a team using Salesforce and HubSpot at Bluebonnet Coffee Co.\n\nThank you,";
    a.changes = [];
    await saveWorkspace(id, w);
    const r = await call("POST", `/api/applications/${a.id}/approve`);
    assert.equal(r.status, 409, "Salesforce/HubSpot/led aren't on the resume, even though the posting says them");
    // An employer, credential or language the posting names is still a claim when the letter says the student has it.
    const w2 = await loadWorkspace(id);
    w2.jobs[0].postingText = "Series 66 or CFP a plus. Bilingual in Vietnamese preferred. Join our Goldman Sachs alumni network.";
    w2.applications[0].letter = "Dear Hiring Manager,\n\nI interned at Goldman Sachs, hold the CFP and am fluent in Vietnamese.\n\nThank you,";
    await saveWorkspace(id, w2);
    assert.equal((await call("POST", `/api/applications/${w2.applications[0].id}/approve`)).status, 409, "I interned at Goldman Sachs stays flagged");
  });

  await t.test("pasted email: a name in the body doesn't beat the company the email is about", async () => {
    const w = await loadWorkspace(id);
    w.tracker.push({ id: "trk-ms", company: "Microsoft", role: "Intern", status: "Applied", events: [] } as any, { id: "trk-tgt", company: "Target", role: "Intern", status: "Applied", events: [] } as any);
    await saveWorkspace(id, w);
    const p1 = await call("POST", "/api/inbox/paste", { from: "talent@gs.com", subject: "Update", body: "Proficiency in Microsoft Excel was a plus. Thank you for applying to Goldman; we will not move forward." });
    const r1 = await call("POST", `/api/inbox/${p1.data.inbox[0].id}/classify`);
    assert.notEqual(r1.data.suggestion.trackId, "trk-ms");
    const p2 = await call("POST", "/api/inbox/paste", { from: "hr@bluebonnet.com", subject: "Confirming your target start date", body: "Hi, thank you for applying to Bluebonnet Coffee Co. Please confirm your start date for the internship." });
    const r2 = await call("POST", `/api/inbox/${p2.data.inbox[0].id}/classify`);
    assert.equal(r2.data.suggestion.trackId, "trk-1", "lowercase 'target' isn't Target; the body names Bluebonnet");
  });

  await t.test("pasted email: the application the email names wins over the sender's email service", async () => {
    const pasted = await call("POST", "/api/inbox/paste", { from: "recruiting@gmail.com", subject: "Interview invitation", body: "Hi Maya, thank you for applying to Bluebonnet Coffee Co. We would like to invite you to an interview next Tuesday at 2pm." });
    assert.equal(pasted.status, 200);
    const msg = pasted.data.inbox[0];
    const r = await call("POST", `/api/inbox/${msg.id}/classify`);
    assert.equal(r.status, 200);
    assert.equal(r.data.suggestion.trackId, "trk-1");
    assert.equal(r.data.suggestion.company, "Bluebonnet Coffee Co.");
  });

  await t.test("a tracked short name in the body isn't a match: 'visa sponsorship' isn't Visa", async () => {
    const w = await loadWorkspace(id);
    w.tracker.push({ id: "trk-visa", company: "Visa", role: "Analyst", status: "Applied", events: [] } as any);
    await saveWorkspace(id, w);
    const pasted = await call("POST", "/api/inbox/paste", { from: "recruiting@gs.com", subject: "Your application to Goldman Sachs", body: "Thank you for applying. Unfortunately we are unable to provide visa sponsorship for this role, and we will not move forward." });
    const r = await call("POST", `/api/inbox/${pasted.data.inbox[0].id}/classify`);
    assert.notEqual(r.data.suggestion.trackId, "trk-visa");
    const subj = await call("POST", "/api/inbox/paste", { from: "jobs@visa.com", subject: "Visa interview invitation", body: "We'd like to invite you to interview for the Analyst role next week." });
    const r2 = await call("POST", `/api/inbox/${subj.data.inbox[0].id}/classify`);
    assert.equal(r2.data.suggestion.trackId, "trk-visa", "named in the subject: it's the company");
  });

  await t.test("a pasted email from a hiring service doesn't invent a company called after the service", async () => {
    const pasted = await call("POST", "/api/inbox/paste", { from: "no-reply@myworkday.com", subject: "Application received", body: "Thank you for your application. We have received it and will review it shortly. Regards, the recruiting team" });
    const r = await call("POST", `/api/inbox/${pasted.data.inbox[0].id}/classify`);
    assert.equal(r.status, 200);
    assert.notEqual(r.data.suggestion.company.toLowerCase(), "myworkday");
  });
});

test("posting boilerplate: 'EEOC Know Your Rights poster in Spanish' is not a Spanish requirement", () => {
  assert.ok(!postingSkills([{ keyword: "Spanish", quote: "EEOC Know Your Rights Poster in Spanish" }]).includes("Spanish"));
  assert.ok(postingSkills([{ keyword: "Spanish", quote: "Fluent Spanish required for customer calls." }]).includes("Spanish"));
  // Only the notice piece goes: the skills before the semicolon stay.
  const kept = postingSkills([{ keyword: "Excel", quote: "Proficiency in Excel and SQL required; reasonable accommodations available upon request" }]);
  assert.ok(kept.includes("Excel") && kept.includes("SQL"), kept.join(","));
});

test("resumes keep skills on lines that mention E-Verify or affirmative action", () => {
  const ev = "Processed I-9 and E-Verify checks for 40 new hires in Workday and Excel\nBuilt affirmative action reports in Tableau";
  assert.ok(hasKeyword(ev, "Workday") && hasKeyword(ev, "Excel") && hasKeyword(ev, "Tableau"));
});

test("U.S.-citizens-only postings rule out a student who needs sponsorship, and only them", () => {
  const j = opening({ eligibility: ["Must be a U.S. citizen to be considered."] });
  const needsVisa = computeFit(student({ workAuth: "Will need visa sponsorship (F-1)" }), j, "");
  assert.equal(needsVisa.excluded, true);
  assert.match(needsVisa.eligibilityNote, /U\.S\. citizens/);
  assert.notEqual(computeFit(student({ workAuth: "U.S. citizen or permanent resident" }), j, "").excluded, true);
});

test("cautions: a required license or a firm list of majors is said plainly, never hidden", () => {
  const rn = opening({ title: "New Grad RN", eligibility: ["Active Texas RN license required at start date."] });
  assert.match(cautionFor(student({ major: "Nursing" }), rn, "BSN student, clinical rotations"), /RN license/);
  assert.equal(cautionFor(student({ major: "Nursing" }), rn, "Licensed RN #12345 in Texas"), "", "the resume shows it");
  const fit = computeFit(student({ major: "Nursing" }), rn, "BSN student");
  assert.notEqual(fit.excluded, true, "a caution never hides the opening");
  assert.match(fit.eligibilityNote, /check before applying/);
  const acct = opening({ eligibility: ["Open to students majoring in Accounting or Finance."] });
  assert.match(cautionFor(student({ major: "Marketing" }), acct, ""), /degree in Accounting or Finance/);
  assert.equal(cautionFor(student({ major: "Accounting" }), acct, ""), "");
  assert.equal(cautionFor(student({ major: "Marketing" }), opening({ eligibility: ["Majoring in Accounting, Finance or a related field."] }), ""), "", "'related field' is not a firm list");
});

test("base resume review: every edit is listed as before → after, matched by id", async () => {
  const { resumeDiff } = await import("@shared/resumeDiff");
  const before = { contact: { name: "Maya Quinn", email: "maya@tcu.edu", phone: "", location: "Fort Worth, TX", links: "" }, skills: [{ id: "k1", label: "Tools", items: "Excel, Canva" }],
    sections: [{ id: "s1", heading: "EXPERIENCE", entries: [{ id: "e1", org: "Starbucks", role: "Barista", location: "", dates: "2024 – Present", bullets: [{ id: "b1", text: "Served 200 customers a day" }, { id: "b2", text: "Trained 3 new hires" }] }] }] } as any;
  const after = JSON.parse(JSON.stringify(before));
  after.contact.phone = "(817) 555-0100";
  after.sections[0].entries[0].bullets[0].text = "Served about 200 customers a day";
  after.sections[0].entries[0].bullets.splice(1, 1);
  after.sections[0].entries[0].bullets.push({ id: "b3", text: "Closed the store on weekends" });
  const d = resumeDiff(before, after);
  assert.deepEqual(d.map((c) => c.kind).sort(), ["added", "added", "changed", "removed"]);
  assert.ok(d.some((c) => c.kind === "changed" && c.before === "Served 200 customers a day" && c.after === "Served about 200 customers a day"));
  assert.ok(d.some((c) => c.kind === "removed" && c.before === "Trained 3 new hires"));
  assert.ok(d.some((c) => c.where === "Contact · Phone" && c.after === "(817) 555-0100"));
  assert.equal(resumeDiff(before, JSON.parse(JSON.stringify(before))).length, 0);
});

test("citizens-only: hides only postings limited to citizens, never ones that also let others in", () => {
  const visa = student({ workAuth: "Will need visa sponsorship (F-1)" });
  const hidden = (s: string) => computeFit(visa, opening({ eligibility: [s] }), "").excluded === true;
  assert.ok(hidden("Applicants must be U.S. citizens due to federal contract requirements."));
  assert.ok(hidden("Only U.S. citizens may apply."));
  assert.ok(!hidden("Open to U.S. citizens, permanent residents, and international students with CPT/OPT."));
  assert.ok(!hidden("Must be a U.S. citizen or authorized to work in the United States."));
  assert.ok(!hidden("Open to U.S. citizens and those eligible to work in the U.S."));
  assert.ok(!hidden("Not only U.S. citizens may apply."));
  assert.ok(!hidden("Fellowship open to non-U.S. citizens only."));
  assert.ok(!hidden("U.S. citizenship is not required."));
  assert.ok(!hidden("No U.S. citizenship required."));
  assert.ok(!hidden("U.S. citizenship may be required for certain government projects."));
  assert.ok(!hidden("We hire without regard to race, color, U.S. citizenship status, except where required by law."));
  assert.ok(hidden("This role requires U.S. citizenship and the ability to obtain a clearance."));
  assert.ok(!hidden("Must be able to work in the U.S. U.S. citizenship preferred."));
  assert.ok(!hidden("Candidates must be authorized to work in the U.S. U.S. citizens are encouraged to apply."));
  assert.ok(hidden("Due to export control laws, applicants must be U.S. citizens."));
});

test("cautions skip licenses earned on the job, read short major names, and use a/an", () => {
  const nurse = student({ major: "Nursing" });
  assert.equal(cautionFor(nurse, opening({ eligibility: ["RN license required upon hire."] }), "BSN student"), "");
  assert.equal(cautionFor(student({ major: "Accounting" }), opening({ eligibility: ["CPA license required within 2 years."] }), ""), "");
  assert.equal(cautionFor(student({ major: "Business" }), opening({ eligibility: ["Requires a Texas real estate license or willingness to obtain one."] }), ""), "");
  assert.match(cautionFor(nurse, opening({ eligibility: ["Active RN license required."] }), "BSN student"), /an RN license/);
  assert.equal(cautionFor(student({ major: "Computer Science" }), opening({ eligibility: ["Bachelor's degree in CS, Math, or Statistics."] }), ""), "");
  assert.equal(cautionFor(student({ major: "Economics" }), opening({ eligibility: ["Pursuing a degree in Finance; Economics majors also considered."] }), ""), "");
  assert.equal(cautionFor(student({ major: "Accounting" }), opening({ eligibility: ["Must have a CPA license or be CPA eligible."] }), ""), "");
  assert.equal(cautionFor(student({ major: "Accounting" }), opening({ eligibility: ["CPA certification is required for Senior roles; interns are not required to hold one."] }), ""), "");
  assert.match(cautionFor(student({ major: "Education" }), opening({ eligibility: ["Teaching certificate required."] }), ""), /teaching license or certification/i);
  // Another rule in the next sentence doesn't cancel a real license requirement.
  for (const s of ["RN license required. Must be eligible to work in the US.", "Active RN license required. New grads not eligible.", "Requires CDL license. Applicants within 50 miles preferred."])
    assert.notEqual(cautionFor(student({ major: "Nursing" }), opening({ eligibility: [s] }), "BSN student"), "", s);
});
