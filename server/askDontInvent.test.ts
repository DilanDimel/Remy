// Ask, don't invent (Dilan, Nov 18): Remy asks where a skill was learned instead of writing "through my coursework".
import { test } from "node:test";
import assert from "node:assert/strict";
import { claimCheck } from "./claims";
import { skillOriginQuestion } from "./brief";

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
