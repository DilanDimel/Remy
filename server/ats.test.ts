// ATS keyword matching. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ResumeDoc } from "@shared/types";
import { atsScore, hasKeyword } from "./ats";

const doc = (bullets: string[], skills = ""): ResumeDoc => ({
  contact: { name: "Dilan Desman", email: "d@example.com", phone: "682-000-0000", location: "Fort Worth, TX", links: "linkedin.com/in/x" },
  sections: [{ id: "s", heading: "Experience", entries: [{ id: "e", org: "NABA", role: "Treasurer", location: "", dates: "Aug 2025 – Present", bullets: bullets.map((text, i) => ({ id: "b" + i, text })) }] }],
  skills: skills ? [{ label: "Skills", items: skills }] : [],
} as unknown as ResumeDoc);

test("keywords: a tool only counts when its whole name is there", () => {
  const r = atsScore(doc(["Built a DCF model in Excel and presented it in PowerPoint"]), ["Power BI", "Excel", "financial modeling", "SQL"], "in the posting");
  assert.deepEqual(r.keywords.matched, ["Excel"]);
  assert.deepEqual(r.keywords.missing, ["Power BI", "financial modeling", "SQL"]);
});
test("keywords: word endings still match (modeling ↔ models), so a tailored bullet raises the score", () => {
  const r = atsScore(doc(["Conducted financial models in Excel for M&A scenarios"]), ["financial modeling", "Excel"], "in the posting");
  assert.deepEqual(r.keywords.missing, []);
});

test("base resume score ignores openings: same resume, same score, scaled to 100", () => {
  const d = doc(["Built a DCF model in Excel and presented it in PowerPoint to 12 classmates"]);
  const a = atsScore(d, null, ""), b = atsScore(d, null, "");
  assert.equal(a.score, b.score);
  assert.ok(!a.categories.some((c) => c.name === "Keyword match"));
  assert.equal(a.categories.reduce((n, c) => n + c.max, 0), 75);
  assert.ok(a.score <= 100 && a.score >= Math.round(a.categories.reduce((n, c) => n + c.score, 0)));
});

test("keywords match what the resume shows, not just the posting's exact phrase", async () => {
  const { hasKeyword, isSkillKeyword } = await import("./ats");
  const r = "B.S. Mechanical Engineering, Expected May 2027. Led 5 students designing a steel tube frame in SolidWorks.";
  assert.ok(hasKeyword(r, "Pursuing Mechanical Engineering"));
  assert.ok(hasKeyword(r, "CAD experience"));
  assert.ok(hasKeyword(r, "Bachelor's Degree Pursuit"));
  assert.ok(!hasKeyword(r, "Python"));
  assert.ok(!hasKeyword(r, "Teamwork and communication"), "nothing shows communication");
  assert.ok(!isSkillKeyword("Background Check"));
});

test("keywords match whole word families, never just the first 5 letters", async () => {
  const { hasKeyword } = await import("./ats");
  // Real bugs found in the Nov 2026 tests: a shared 5-letter start counted as having the skill.
  assert.ok(!hasKeyword("Built pivot tables in Excel to track dues.", "Tableau"));
  assert.ok(!hasKeyword("Used CFD to compute drag on the wing. Bachelor of Science.", "computer science"));
  assert.ok(!hasKeyword("Accounted for weekly cash drawer totals.", "Accountability"));
  // Same word family still counts.
  assert.ok(hasKeyword("Built three financial models in Excel.", "financial modeling"));
  assert.ok(hasKeyword("Sorted donations for the food bank.", "sorting"));
  assert.ok(hasKeyword("Managed a team of four.", "management"));
  assert.ok(hasKeyword("Planned the spring banquet.", "planning"));
  assert.ok(hasKeyword("Studied consumer behavior.", "studies"));
  assert.ok(hasKeyword("Wrote Python and C++ scripts.", "C++"));
});

test("keywords: roles count for their skill, and everyday resume words still match", async () => {
  const { hasKeyword } = await import("./ats");
  const yes: [string, string][] = [
    ["Analyzed sales data for 3 stores.", "data analysis"],
    ["Shift Manager at Chick-fil-A.", "management"],
    ["Team leader for the robotics club.", "leadership"],
    ["Organized a 200-person career fair.", "organizational skills"],
    ["Presented findings to the VP.", "presentation skills"],
    ["Statistical modeling in R.", "statistics"],
    ["Accountant intern at BDO.", "accounting"],
    ["Event coordinator for NABA.", "coordination"],
    ["Mentored 5 freshmen.", "mentorship"],
    ["Researcher in the Smith lab.", "research"],
    ["Strong at problem solving.", "problem-solving"],
    ["Worked with cross functional teams.", "cross-functional"],
    ["Built financial models.", "finance"],
  ];
  for (const [text, kw] of yes) assert.ok(hasKeyword(text, kw), `${kw} should match: ${text}`);
  assert.ok(!hasKeyword("Canvas LMS admin for 3 courses.", "Canva"));
  assert.ok(!hasKeyword("Wrote a script to compute drag.", "computer"));
});

test("keywords: dates, sales terms and job titles don't pass as skills", async () => {
  const { hasKeyword } = await import("./ats");
  assert.ok(!hasKeyword("Barista, Starbucks, Aug 2025 – Present. Made drinks.", "presentation skills"));
  assert.ok(!hasKeyword("Lead generation: cold-called 50 prospects.", "leadership"));
  assert.ok(!hasKeyword("Account Executive intern, sold cloud software.", "accounting"));
  assert.ok(hasKeyword("Presented findings to the VP, Jan 2025 – Present.", "presentation skills"));
  assert.ok(hasKeyword("Led a team of 4.", "leadership"));
  assert.ok(hasKeyword("Developer intern at a startup.", "development"));
});

test("posting skills come from the posting's own words, not AI category labels", async () => {
  const { postingSkills } = await import("@shared/requirements");
  const rq = (keyword: string, quote: string) => ({ id: keyword, keyword, quote });
  // Bank posting from the Nov 2026 test: "Software Skills" was shown as missing although Excel and PowerPoint were on the resume.
  const bank = postingSkills([rq("Software Skills", "Proficiency in Microsoft Excel and PowerPoint is required."), rq("Communication skills", "Strong written and verbal communication skills.")]);
  assert.deepEqual(bank, ["Excel", "PowerPoint", "Communication skills"]);
  // Engineering posting: "Degree Program" is eligibility, not a skill; the tools in the sentence are.
  const eng = postingSkills([rq("Degree Program", "Pursuing a BS in Mechanical Engineering with SolidWorks or AutoCAD experience.")]);
  assert.deepEqual(eng, ["SolidWorks or AutoCAD"]);
  // Health and trades words count too; "R" only as the language.
  assert.deepEqual(postingSkills([rq("Certifications", "Current BLS and CPR certification; Epic EHR a plus.")]), ["BLS", "CPR", "Epic", "EHR"]);
  assert.deepEqual(postingSkills([rq("Analytics", "Experience with R or Python for data analysis.")]), ["Analytics", "R or Python", "data analysis"]);
  assert.deepEqual(postingSkills([rq("Analytics", "Report results to the team.")]), []);
});

test("posting skills: no false asks from plain English, majors, 'or' lists or boilerplate", async () => {
  const { postingSkills } = await import("@shared/requirements");
  const { requirementsFrom } = await import("./sources");
  const rq = (keyword: string, quote: string) => ({ id: keyword, keyword, quote });
  assert.deepEqual(postingSkills([rq("Adaptability", "You will excel in a fast-paced environment.")]), ["Adaptability"].filter(() => false));
  assert.deepEqual(postingSkills([rq("Composure", "Ability to react calmly under pressure with a positive outlook.")]), []);
  assert.deepEqual(postingSkills([rq("Major", "Pursuing a degree in Finance, Accounting, or Economics.")]), []);
  assert.deepEqual(postingSkills([rq("Engineering", "Pursuing a BS in Mechanical Engineering with SolidWorks experience.")]), ["SolidWorks"]);
  assert.deepEqual(postingSkills([rq("Python programming", "Programming experience in Python, Java or C++.")]), ["Python or Java or C++"]);
  assert.deepEqual(postingSkills([rq("Prior Experience", "Prior experience in a professional setting."), rq("Driver's License", "Valid driver's license."), rq("Physical Requirements", "Physical requirements: lift 25 lbs.")]), []);
  assert.deepEqual(postingSkills([rq("Excel", "Proficiency in Excel."), rq("Microsoft Excel", "Advanced Microsoft Excel skills.")]), ["Excel"]);
  const scraped = requirementsFrom("Wells Fargo is a leading financial services company with operations across the country, committed to research, community and leadership. Our consulting and analytics teams serve clients nationwide. Qualifications: Proficiency in Excel and PowerPoint. Strong written communication skills.");
  const got = postingSkills(scraped);
  assert.ok(got.includes("Excel") && got.includes("PowerPoint"), got.join(", "));
});

test("hasKeyword: 'R', 'excel at' and middle initials aren't skills", async () => {
  const { hasKeyword } = await import("./ats");
  assert.ok(!hasKeyword("Dilan R. Desman\nFinance student.", "R"));
  assert.ok(!hasKeyword("Interned in R&D at Lockheed.", "R"));
  assert.ok(hasKeyword("Cleaned survey data in R and Stata.", "R"));
  assert.ok(!hasKeyword("I excel at teamwork and deadlines.", "Excel"));
  assert.ok(hasKeyword("Built budgets in Excel.", "Excel"));
  assert.ok(hasKeyword("Wrote Python scripts.", "Python or Java or C++"));
  assert.ok(!hasKeyword("Wrote Ruby scripts.", "Python or Java or C++"));
});

test("posting skills: end-of-sentence tools, lowercase tools, and 'A/B' means both", async () => {
  const { skillsIn } = await import("@shared/requirements");
  const { hasKeyword } = await import("./ats");
  assert.deepEqual(skillsIn("Proficiency in Excel. Knowledge of SQL a plus."), ["Excel", "SQL"]);
  assert.deepEqual(skillsIn("Experience with python and sql."), ["Python", "SQL"]);
  assert.deepEqual(skillsIn("First aid and CPR certified."), ["First Aid", "CPR"]);
  assert.deepEqual(skillsIn("Comfortable with HTML/CSS."), ["HTML", "CSS"]);
  assert.ok(hasKeyword("Skills: Python, R. Projects: churn model", "R"));
});

test("an entry with no date isn't a different date format (the missing date has its own suggestion)", () => {
  const d = doc(["Led weekly budget reviews for a 40-member student club and its officers"]);
  d.sections[0].entries.push({ id: "e2", org: "Club", role: "Member", location: "", dates: "", bullets: [] } as any);
  const fixes = atsScore(d, null, "").fixes.map((f) => f.text);
  assert.ok(!fixes.some((t) => /one date format/.test(t)), fixes.join(" | "));
  assert.ok(fixes.some((t) => /missing dates/.test(t)));
});

// Nov 18: Opportunities said "Gaps: Microsoft Excel" for a student whose resume lists Excel.
test("skills: Microsoft Excel / MS Excel is the resume's Excel; Microsoft Office is shown by its apps", () => {
  const r = "Sales Associate\nSKILLS\nExcel, PowerPoint, customer service";
  for (const k of ["Microsoft Excel", "MS Excel", "Microsoft PowerPoint", "Microsoft Office", "Excel"]) assert.ok(hasKeyword(r, k), k);
  for (const k of ["Microsoft Word", "Microsoft Project", "Power BI"]) assert.ok(!hasKeyword(r, k), k);
  assert.ok(!hasKeyword("I excel at teamwork", "Microsoft Excel")); // "excel at" isn't Excel
  // The everyday words aren't the programs (skeptic, Nov 18).
  for (const [t, k] of [["Strive to excel", "Excel"], ["Strive to excel", "Microsoft Office"], ["Wrote a weekly market outlook", "Microsoft Outlook"], ["Wrote the Weekly Market Outlook", "Outlook"]]) assert.ok(!hasKeyword(t, k), `${t} / ${k}`);
  assert.ok(hasKeyword("skills: excel, powerpoint", "Excel")); // lowercase, but clearly a list of programs
  assert.ok(hasKeyword("Managed Outlook calendars for 3 managers", "Outlook"));
  // Skeptic round 2: any capitalisation and "spreadsheets" still show Excel; "Word and Excel" too.
  for (const [t, k] of [["Built spreadsheets to track inventory", "Excel"], ["Used excel to build models", "Excel"], ["PROFICIENT IN EXCEL AND WORD", "Excel"], ["managed outlook calendars", "Outlook"], ["Skills: Word and Excel", "Microsoft Excel"], ["Built spreadsheets for the club", "Microsoft Excel"]]) assert.ok(hasKeyword(t, k), `${t} / ${k}`);
  for (const [t, k] of [["We excel in teamwork", "Excel"], ["I will excel as an analyst", "Excel"]]) assert.ok(!hasKeyword(t, k), `${t} / ${k}`);
  // Skeptic round 3: "to Excel" (the program) vs "to excel" (the verb); "Excel in/with…" mid-line is the program; "credit outlook" isn't Outlook.
  for (const t of ["Exported reports to Excel", "Migrated tracking from paper to Excel", "Built models in Excel in 2024", "Used Excel with VBA to automate reports", "Used Excel as a database for 200 members", "Tracked inventory in Excel when the POS failed", "Excel: pivot tables", "Excel modeling for 3 clients"]) assert.ok(hasKeyword(t, "Excel"), t);
  for (const t of ["Students who excel academically", "Athletes who excel", "Eager to excel and grow", "Motivated student who wants to excel", "I can excel in fast-paced roles"]) assert.ok(!hasKeyword(t, "Excel"), t);
  for (const k of ["Excel skills", "Advanced Excel"]) { assert.ok(!hasKeyword("Strive to excel", k), k); assert.ok(hasKeyword("Built budgets in Excel", k), k); }
  for (const t of ["Authored quarterly credit outlook", "Wrote 2025 housing outlook report", "fresh outlook on problems", "Wrote the Weekly Market Outlook"]) assert.ok(!hasKeyword(t, "Outlook"), t);
  assert.ok(hasKeyword("Scheduled meetings in Outlook", "Outlook"));
});
