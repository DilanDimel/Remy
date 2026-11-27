import { test } from "node:test";
import assert from "node:assert/strict";
import { jobQuestions } from "@shared/jobInterview";

const doc = { contact: {} as any, skills: [{ id: "k", label: "", items: "Excel, PowerPoint" }], sections: [{ id: "s", heading: "Experience", entries: [{ id: "e", org: "Chick-fil-A", role: "", location: "", dates: "", bullets: [
  { id: "b1", text: "Led a team of 6 on the drive-thru line" }, { id: "b2", text: "Built a budget tracker in Excel" }] }] }] } as any;
const req = (keyword: string) => ({ id: keyword, keyword, quote: `Experience with ${keyword}` });

test("job questions: tied to the posting's skills, with the resume line that answers each, and no eligibility labels", () => {
  const qs = jobQuestions({ company: "Q2", title: "Finance Intern", requirements: [req("Excel"), req("leadership"), req("SQL"), req("Minimum GPA"), req("Excel")] }, doc);
  assert.match(qs[0].q, /Why Q2/);
  assert.equal(qs.at(-1)!.q, "What questions do you have for us?");
  const mid = qs.slice(1, -1);
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
