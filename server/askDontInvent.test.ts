// Ask, don't invent (Dilan, Nov 18): Remy asks where a skill was learned instead of writing "through my coursework".
import { test } from "node:test";
import assert from "node:assert/strict";
import { claimCheck } from "./ai/claims";
import { skillOriginQuestion } from "./coach/brief";

const resume = "Sales Associate, Academy Sports + Outdoors\nRan the register and handled cash and card payments\nSkills: Excel, PowerPoint, customer service";

test("letter lines that say where a skill was learned or what a job taught are flagged without the student's word", () => {
  for (const t of ["Through my academic coursework, I have built competencies in Excel.", "In my finance classes I learned PowerPoint.", "That job has taught me to communicate clearly.", "I learned the importance of attention to detail.", "Working retail helped me develop patience."]) {
    assert.ok(claimCheck(t, resume).some((f) => f.type === "scope"), t);
  }
  // Once the student said it, it's theirs.
  assert.ok(!claimCheck("Through my coursework, I built Excel skills.", resume + "\nWhere I learned Excel — In a class").length);
  assert.ok(!claimCheck("I'm proficient in Excel and PowerPoint.", resume).length);
  assert.ok(!claimCheck("It taught me to stay calm with upset customers.", resume, { original: "it taught me to stay calm with upset customers" }).some((f) => /taught/.test(f.term)));
});

const job = (keywords: string[]) => ({ company: "Frost Bank", requirements: keywords.map((k, i) => ({ id: `r${i}`, keyword: k, quote: k })) }) as any;
const doc = { skills: [{ id: "k", label: "SKILLS", items: "Excel, PowerPoint, customer service" }], sections: [], contact: {} } as any;
const lines = [{ id: "b1", where: "Experience", text: "Ran the register and handled cash and card payments" }];

test("Remy asks where a listed skill came from, once, for hard skills only", () => {
  const q = skillOriginQuestion(job(["customer service", "Microsoft Excel", "PowerPoint"]), lines, doc, []);
  assert.equal(q?.key, "skill");
  assert.match(q!.q, /asks for Excel/);
  assert.equal(q!.label, "Where I learned Excel");
  // Soft skills, skills a resume line already shows, skills not on the resume, or already answered: no question.
  assert.equal(skillOriginQuestion(job(["customer service", "communication"]), lines, doc, []), null);
  assert.equal(skillOriginQuestion(job(["Excel"]), [{ id: "b2", where: "x", text: "Built budgets in Excel" }], doc, []), null);
  assert.equal(skillOriginQuestion(job(["Python"]), lines, doc, []), null);
  assert.equal(skillOriginQuestion(job(["Excel"]), lines, doc, ["Where I learned Excel — In a class"]), null);
});

// Review, Nov 18: judged per skill and sentence, not by anything anywhere on the resume.
test("coursework claims need the student's own answer for that skill; honest study lines pass", () => {
  const withCoursework = resume + "\nRelevant Coursework: Financial Accounting, Business Statistics";
  assert.ok(claimCheck("Through my coursework, I built strong Excel skills.", withCoursework).some((f) => f.type === "scope"), "a coursework section isn't an answer");
  const excelClass = resume + "\nWhere I learned Excel — In a class";
  assert.ok(claimCheck("Through my coursework, I built Python skills.", excelClass).some((f) => f.type === "scope"), "a class answer for Excel doesn't cover Python");
  assert.ok(claimCheck("In my finance classes I learned Excel.", excelClass).some((f) => f.type === "scope"), "the student never said finance");
  assert.ok(!claimCheck("I learned Excel through my coursework.", excelClass).some((f) => f.type === "scope"));
  // Real Gemini, Nov 18: "Through my finance studies, I learned Excel in a class" and "allowed me to develop".
  assert.ok(claimCheck("Through my finance studies, I learned Excel in a class.", excelClass).some((f) => f.type === "scope"));
  assert.ok(claimCheck("Working retail allowed me to develop strong communication skills.", resume).some((f) => f.type === "scope"));
  for (const t of ["During my studies at TCU, I have worked 20 hours a week at Academy.", "In my studies I focus on corporate finance.", "We deliver best in class service."]) {
    assert.ok(!claimCheck(t, resume).some((f) => f.type === "scope" && /class|stud/i.test(f.term)), t);
  }
});

test("what-a-job-taught-me lines are caught in their other wordings, and one fact doesn't unlock them all", () => {
  for (const t of ["Retail teaches me patience.", "The job showed me how to stay calm.", "It gave me a strong sense of attention to detail.", "I learned how to communicate with customers.", "Retail helped me to develop patience.", "Retail helped me become more patient."]) {
    assert.ok(claimCheck(t, resume).some((f) => f.type === "scope"), t);
  }
  assert.ok(claimCheck("Retail taught me to communicate clearly.", resume + "\nmy manager taught me the inventory system").some((f) => f.type === "scope"));
});

test("the question names the skill as the resume does and skips soft skills and languages", () => {
  const q = skillOriginQuestion(job(["Advanced Excel"]), lines, doc, []);
  assert.equal(q?.label, "Where I learned Excel");
  for (const k of ["written and verbal skills", "public speaking", "sales", "research", "Spanish"]) {
    const d = { ...doc, skills: [{ id: "k", label: "Skills", items: k }] };
    assert.equal(skillOriginQuestion(job([k]), lines, d, []), null, k);
  }
});

// Review round 2, Nov 18: honest lines pass; wordings that slipped through are caught.
test("plans, the student's own words and honest study lines are never flagged", () => {
  const scopeOf = (t: string, ev = resume, o?: Parameters<typeof claimCheck>[2]) => claimCheck(t, ev, o).filter((f) => /taught you|where you learned/.test(f.message));
  for (const t of ["I am interested in learning how to underwrite commercial loans.", "I look forward to learning how to build models with your team.", "I'm excited for an internship that will teach me how credit decisions are made.",
    "Through my studies at TCU, I have become interested in commercial banking.", "I'd love to learn from world class analysts.", "We deliver best in class service."]) assert.deepEqual(scopeOf(t), [], t);
  const said = resume + "\nRetail taught me patience";
  for (const t of ["Academy taught me patience. I also handled cash.", "Retail taught me patience, which matters in banking.", "Retail taught me patience."]) assert.deepEqual(scopeOf(t, said), [], t);
  assert.deepEqual(scopeOf("Learned how to reconcile daily cash accounts", resume, { original: "Learned how to reconcile accounts" }), []);
});

test("coursework claims: any shortcut in the record doesn't unlock them, longer class names need the student's words", () => {
  const ev = resume + "\nThrough my coursework in finance, I studied valuation.\nWhere I learned Excel — In a class";
  assert.ok(claimCheck("Through my coursework, I built strong Python skills.", ev).some((f) => f.type === "scope"));
  for (const t of ["Through my corporate finance classes, I learned Excel.", "Through my undergraduate finance coursework, I built Excel skills.", "In my Financial Accounting course I learned Excel."]) {
    assert.ok(claimCheck(t, ev).some((f) => f.type === "scope"), t);
  }
  assert.ok(!claimCheck("Through my coursework, I built strong Excel skills.", ev).some((f) => f.type === "scope"));
  // Real Gemini, Nov 18.
  assert.ok(claimCheck("Through my academic program, I have developed proficiencies in Microsoft Excel and Microsoft PowerPoint.", ev).some((f) => f.type === "scope"));
  assert.ok(!claimCheck("Through my Finance major at TCU, I became interested in banking.", ev).some((f) => /where you learned/.test(f.message)));
});

test("skill names with parentheses or symbols: asked once, named cleanly", () => {
  const d = (items: string) => ({ ...doc, skills: [{ id: "k", label: "Skills", items }] });
  assert.equal(skillOriginQuestion(job(["Excel"]), lines, d("Excel (pivot tables, VLOOKUP), Word"), [])?.label, "Where I learned Excel");
  assert.equal(skillOriginQuestion(job(["C++"]), lines, d("C++, Java"), ["Where I learned C++ — In a class"]), null);
  assert.equal(skillOriginQuestion(job(["C++"]), lines, d("C++, Java"), [])?.label, "Where I learned C++");
  assert.ok(!claimCheck("Through my coursework, I built C++ skills.", resume + "\nWhere I learned C++ — In a class").some((f) => f.type === "scope"));
  for (const k of ["Salesforce", "Microsoft Teams"]) assert.ok(skillOriginQuestion(job([k]), lines, d(k), []), k);
});

test("Strongest match: 'while pursuing a Finance degree' is a where-learned claim unless the student said so", () => {
  const t = "I have built skills in Excel, PowerPoint, and customer service while pursuing a Finance degree in Fort Worth.";
  assert.ok(claimCheck(t, resume).some((f) => /where you learned/.test(f.message)));
  assert.ok(!claimCheck("I am a sophomore pursuing a Finance degree.", resume).some((f) => /where you learned/.test(f.message)));
  assert.ok(!claimCheck("I worked 20 hours a week while pursuing my degree.", resume).some((f) => /where you learned/.test(f.message)));
});
