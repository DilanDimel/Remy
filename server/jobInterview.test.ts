import { test } from "node:test";
import assert from "node:assert/strict";
import { jobQuestions } from "@shared/jobInterview";
import { pickProfile } from "@shared/interview";
import { BANK, SOURCES, COMPANIES, companyFacts } from "@shared/questionBank";

const doc = { contact: {} as any, skills: [{ id: "k", label: "", items: "Excel, PowerPoint" }], sections: [{ id: "s", heading: "Experience", entries: [{ id: "e", org: "Chick-fil-A", role: "", location: "", dates: "", bullets: [
  { id: "b1", text: "Led a team of 6 on the drive-thru line" }, { id: "b2", text: "Built a budget tracker in Excel" }] }] }] } as any;
const req = (keyword: string) => ({ id: keyword, keyword, quote: `Experience with ${keyword}` });

test("job questions: tied to the posting's skills, with the resume line that answers each, and no eligibility labels", () => {
  const qs = jobQuestions({ company: "Q2", title: "Finance Intern", requirements: [req("Excel"), req("leadership"), req("SQL"), req("Minimum GPA"), req("Excel")] }, doc);
  assert.match(qs[0].q, /Why Q2/);
  assert.equal(qs.at(-1)!.q, "What questions do you have for us?");
  const mid = qs.filter((q) => q.from === "posting");
  assert.deepEqual(mid.map((q) => q.why), ["The posting asks for: “Experience with Excel”", "The posting asks for: “Experience with leadership”", "The posting asks for: “Experience with SQL”"]);
  assert.equal(mid[0].line, "Built a budget tracker in Excel");
  assert.match(mid[1].q, /led others/);
  assert.equal(mid[1].line, "Led a team of 6 on the drive-thru line");
  assert.equal(mid[2].line, undefined);
  assert.match(mid[2].tip, /Nothing on your resume/);
});

test("a posting about patients asks about a patient, not a customer", () => {
  const qs = jobQuestions({ company: "Tenet Healthcare", title: "Nurse Extern", requirements: [req("patient care")] });
  assert.ok(qs.some((x) => /difficult patient/.test(x.q)), qs.map((x) => x.q).join(" | "));
  assert.ok(!qs.some((x) => /customer/.test(x.q)));
});

test("soft skills become real questions, and two skills that ask the same thing ask it once (interview test lab)", () => {
  const qs = jobQuestions({ company: "Q2", title: "Analyst", requirements: [req("creativity"), req("problem solving"), req("analytical"), req("resilience")] });
  const mid = qs.slice(1, -1).map((x) => x.q);
  assert.ok(!mid.some((q) => /How have you used (creativity|resilience)/.test(q)), mid.join(" | "));
  assert.equal(new Set(mid).size, mid.length);
  assert.equal(mid.filter((q) => /solved a problem/.test(q)).length, 1);
});

test("researched questions: each role gets questions from a published guide, labelled with its source", () => {
  const qs = jobQuestions({ company: "Q2", title: "Audit Intern", requirements: [req("Excel")] });
  const role = qs.filter((q) => q.from === "role");
  assert.equal(role.length, 2);
  for (const q of role) { assert.ok(BANK.accounting.some((b) => b.q === q.q)); assert.match(q.why, /^Common in accounting and controls interviews, from a published interview guide\.$/); assert.ok(q.source?.url.startsWith("https://")); }
  // Nothing claims the company asks it unless the company's own site lists it.
  assert.ok(!qs.some((q) => q.from === "company"));
  assert.ok(!qs.some((q) => /Q2 (will|is known to) ask/.test(q.why)));
});

test("company notes come only from the company's own careers page, and look-alike names don't match", () => {
  const mck = jobQuestions({ company: "McKinsey & Company", title: "Business Analyst Intern", requirements: [] });
  assert.equal(mck.filter((q) => q.from === "company").length, 1);
  assert.equal(mck.find((q) => q.from === "company")!.source, SOURCES.mckinsey);
  assert.match(mck[0].why, /McKinsey says/);
  assert.equal(companyFacts("Bain Capital"), undefined);
  assert.equal(companyFacts("Bain & Company")?.src, "bain");
  assert.equal(companyFacts("Amazon Web Services")?.src, "amazon");
  assert.equal(companyFacts("Amazonia Foods"), undefined);
});

test("the question bank: every question has a real source, no duplicates in a field, and a short spoken length", () => {
  for (const [field, qs] of Object.entries(BANK)) {
    assert.equal(new Set(qs.map((q) => q.q)).size, qs.length, field);
    for (const q of qs) { assert.ok(SOURCES[q.src], `${field}: ${q.q}`); assert.ok(q.q.split(/\s+/).length <= 40, q.q); }
  }
  for (const c of COMPANIES) assert.ok(SOURCES[c.src].url.startsWith("https://"));
});

test("real finance-board titles get their scoring guide (98 public postings, Nov 27)", () => {
  assert.equal(pickProfile({ title: "Cyber-Security Internship" }), "cybersecurity");
  assert.equal(pickProfile({ title: "Direct Tax Corporate Internship - Summer 2027 (Undergraduate)" }), "accounting");
  assert.equal(pickProfile({ title: "Assurance Intern - Summer 2027 (Norfolk)" }), "accounting");
  assert.equal(pickProfile({ title: "Intern - Controllership & Tax" }), "accounting");
  assert.equal(pickProfile({ title: "Business Valuation Intern - Summer 2027" }), "banking");
  assert.equal(pickProfile({ title: "Syntax Researcher" }), "generic");
});
