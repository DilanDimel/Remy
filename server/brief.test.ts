// The coach's brief before tailoring: only real requirements and real resume lines, options grounded in the posting.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { briefMessages, cleanBrief } from "./brief";

const job = {
  id: "j1", title: "2027 Summer Business & Operations Intern", company: "Alcon", location: "Fort Worth, TX", format: "On-site",
  summary: "Alcon is the global leader in eye care, making contact lenses, eye drops and surgical equipment. Interns support supply chain analysis and process improvement projects and present findings to managers.",
  requirements: [{ id: "r1", quote: "Strong analytical skills and proficiency in Excel" }, { id: "r2", quote: "Experience presenting to leadership" }],
  eligibility: [], postingText: "",
} as unknown as Job;
const lines = [
  { id: "b1", where: "Experience › Treasurer, NABA", text: "Built budget trackers in Excel for a 40-member chapter" },
  { id: "b2", where: "Projects › Remy AI", text: "Presented an AI career coach to Neeley leadership and won first place" },
  { id: "b3", where: "Experience › Server, Cafe", text: "Served 80 tables a night" },
];

test("brief: fits pair a real requirement with a real resume line, quoted exactly; made-up ids and unrelated pairs are dropped", () => {
  const b = cleanBrief({
    company: "Alcon makes contact lenses, eye drops and surgical equipment for eye care.",
    role: "Supply chain analysis and process improvement, presenting findings to managers.",
    fits: [
      { requirementId: "r1", bulletId: "b1" },
      { requirementId: "r2", bulletId: "b2" },
      { requirementId: "r2", bulletId: "b3" },     // serving tables doesn't show presenting
      { requirementId: "r9", bulletId: "b1" },     // no such requirement
      { requirementId: "r1", bulletId: "b-fake" }, // no such line
    ],
    questions: [],
  }, job, lines)!;
  assert.deepEqual(b.fits.map((f) => f.evidence), [lines[0].text, lines[1].text]);
  assert.equal(b.fits[0].requirement, "Strong analytical skills and proficiency in Excel");
  // One line per requirement: a second Excel line for the same ask isn't another reason.
  const twice = cleanBrief({ fits: [{ requirementId: "r1", bulletId: "b1" }, { requirementId: "r1", bulletId: "b4" }] }, job, [...lines, { id: "b4", where: "Certifications › ", text: "Microsoft Office Specialist: Excel" }])!;
  assert.equal(twice.fits.length, 1);
});

test("brief: company facts the posting backs say so; anything else is marked as Remy's to check", () => {
  const fromPosting = cleanBrief({ company: "Alcon makes contact lenses, eye drops and surgical equipment for eye care." }, job, lines)!;
  assert.equal(fromPosting.companySource, "posting");
  const outside = cleanBrief({ company: "Alcon was spun off from Novartis in 2019 and trades on the NYSE." }, job, lines)!;
  assert.equal(outside.companySource, "remy");
  assert.match(briefMessages(outside, "Alcon")[0], /check it on their site/);
  assert.doesNotMatch(briefMessages(fromPosting, "Alcon")[0], /check it/);
});

test("brief: tap options for why/learn must come from the posting; experience options are the student's own lines", () => {
  const b = cleanBrief({
    questions: [
      { key: "why", q: "Which part draws you most?", options: ["Eye care products like contact lenses", "Supply chain and process improvement", "It's in Fort Worth", "I've used their products for years", "Great free snacks"] },
      { key: "learn", q: "What would you want to learn?", options: ["Supply chain analysis", "Presenting findings to managers"] },
      { key: "proud", bulletIds: ["b2", "b-fake", "b1"] },
    ],
  }, job, lines)!;
  const why = b.questions.find((q) => q.key === "why")!;
  assert.ok(why.options.includes("Supply chain and process improvement"));
  assert.ok(why.options.includes("It's in Fort Worth"));
  assert.ok(!why.options.some((o) => /used their products|snacks/.test(o)), "claims about the student and unbacked reasons are dropped");
  assert.equal(b.questions.find((q) => q.key === "learn")!.options.length, 2);
  const proud = b.questions.find((q) => q.key === "proud")!;
  const cert = { id: "c1", where: "Certifications › ", text: "Microsoft Office Specialist: Excel & PowerPoint" };
  const treasurer = { id: "t1", where: "Experience › Treasurer, TCU NABA (National Association of Black Accountants)", text: "Oversee an estimated annual chapter budget of $5,000+, managing SGA funding allocations and reimbursements for 40 members" };
  const uno = { id: "u1", where: "Activities and Leadership › President & Founder, UNO Club – TCU", text: "Founded club from concept to active organization and led effort for official TCU recognition" };
  // Live test Nov 19: the only choice was "CERTIFICATIONS: Microsoft Office Specialist…" (a section heading, not an experience).
  const one = cleanBrief({ company: "Alcon makes contact lenses.", questions: [{ key: "proud", bulletIds: ["c1", "t1"] }] }, job, [cert, treasurer])!;
  assert.equal(one.questions.find((q) => q.key === "proud"), undefined, "a certification isn't an experience, and one choice isn't a question");
  const labels = cleanBrief({ questions: [{ key: "proud", bulletIds: ["c1", "t1", "u1"] }] }, job, [cert, treasurer, uno])!.questions[0].options;
  assert.equal(labels.length, 2);
  assert.match(labels[0], /^Treasurer, TCU NABA: Oversee .*…$/);
  assert.doesNotMatch(labels[0], /allocations an…/);
  assert.match(labels[1], /^President & Founder, UNO Club/);
  assert.deepEqual(proud.options, ["Remy AI: Presented an AI career coach to Neeley leadership and won first place", "Treasurer, NABA: Built budget trackers in Excel for a 40-member chapter"]);
});

test("brief: nothing usable means no brief (the chat falls back to the plain questions)", () => {
  assert.equal(cleanBrief(null, job, lines), null);
  assert.equal(cleanBrief({ fits: [{ requirementId: "zz", bulletId: "zz" }], questions: [{ key: "why", options: ["Great free snacks", "Nice office"] }] }, job, lines), null);
});

test("brief: filler words don't make a match, a fact, or a tap option (skeptic's cases)", () => {
  const j = { ...job, requirements: [{ id: "q1", quote: "Proficiency in SQL and Python" }, { id: "q2", quote: "Experience with financial modeling" }, { id: "q3", quote: "Strong analytical skills" }] } as unknown as Job;
  const ls = [{ id: "x1", where: "Experience › Server", text: "Served tables and greeted guests" }, { id: "x2", where: "Volunteer › Church", text: "Volunteered with kids at church" }, { id: "x3", where: "Clubs › Debate", text: "Strong communicator in debate club" }, { id: "x4", where: "Projects › Class", text: "Wrote SQL queries for a class database" }];
  const b = cleanBrief({ fits: [{ requirementId: "q1", bulletId: "x1" }, { requirementId: "q2", bulletId: "x2" }, { requirementId: "q3", bulletId: "x3" }, { requirementId: "q1", bulletId: "x4" }] }, j, ls)!;
  assert.deepEqual(b.fits.map((f) => f.evidence), ["Wrote SQL queries for a class database"]);
  // A number the posting never gives (pay) isn't "from the posting".
  assert.equal(cleanBrief({ company: "Alcon is the global leader in eye care and pays interns $40 an hour" }, job, lines)!.companySource, "remy");
  // Claims about the student never become tap options.
  const opts = cleanBrief({ questions: [{ key: "why", options: ["I have always been passionate about healthcare", "My family works in healthcare", "Eye care products like contact lenses", "Supply chain and process improvement"] }] }, job, lines)!.questions[0].options;
  assert.deepEqual(opts, ["Eye care products like contact lenses", "Supply chain and process improvement"]);
  // A role the posting doesn't describe isn't shown as "from the posting".
  assert.equal(cleanBrief({ role: "You will run the trading desk", company: "Alcon makes contact lenses." }, job, lines)!.role, "");
  // The AI's question wording isn't used (it's saved with the answer).
  const q = cleanBrief({ questions: [{ key: "why", q: "Since you love eye care, which part draws you?", options: ["Eye care products like contact lenses", "Supply chain and process improvement"] }] }, job, lines)!.questions[0].q;
  assert.equal(q, "Which part of this draws you most?");
});

test("brief: whole numbers only, 'led' is lead, and R&D isn't the R language (second review)", () => {
  const j = { ...job, summary: job.summary + " Alcon serves patients in over 140 countries.", requirements: [{ id: "l1", quote: "Leadership experience" }, { id: "d1", quote: "Interest in R&D" }] } as unknown as Job;
  assert.equal(cleanBrief({ company: "Alcon is the global leader in eye care and pays interns $40 an hour" }, j, lines)!.companySource, "remy");
  assert.equal(cleanBrief({ company: "Alcon serves patients in over 140 countries." }, j, lines)!.companySource, "posting");
  const ls = [{ id: "t1", where: "Experience › Treasurer", text: "Led a 40-member chapter as treasurer" }, { id: "r1", where: "Projects › Stats", text: "Ran regressions in R" }];
  const b = cleanBrief({ fits: [{ requirementId: "l1", bulletId: "t1" }, { requirementId: "d1", bulletId: "r1" }] }, j, ls)!;
  assert.deepEqual(b.fits.map((f) => f.evidence), ["Led a 40-member chapter as treasurer"]);
});
