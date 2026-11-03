// Profile facts read from a resume: majors, minors, GPA, graduation, and pre-college entries. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entry, ResumeDoc } from "@shared/types";
import { gpaOf, graduationOf, majorsOf, minorsOf, nameCase, preCollegeIds, primaryEducation, rulesParse, verifyAiDoc } from "./resume";
import { normalizeResumeText } from "./resume";

let n = 0;
const entry = (org: string, role = "", dates = "", bullets: string[] = []): Entry =>
  ({ id: "e" + n++, org, role, location: "", dates, bullets: bullets.map((text, i) => ({ id: `b${n}-${i}`, text })) }) as Entry;
const doc = (sections: [string, Entry[]][]): ResumeDoc =>
  ({ contact: { name: "", email: "", phone: "", location: "", links: "" }, skills: [], sections: sections.map(([heading, entries], i) => ({ id: "s" + i, heading, entries })) }) as unknown as ResumeDoc;

test("majors: double majors and 'Majors:' lines are kept whole", () => {
  assert.equal(majorsOf(entry("Texas Christian University", "Bachelor of Science, Mathematics; Bachelor of Science, Physics")), "Mathematics, Physics");
  assert.equal(majorsOf(entry("Texas Christian University", "Bachelor of Business Administration", "", ["Majors: Entrepreneurship | Religion | Digital Culture and Data Analytics GPA: 3.7"])), "Entrepreneurship, Religion, Digital Culture and Data Analytics");
  assert.equal(majorsOf(entry("Texas Christian University", "Finance & BIS with Fintech Certification")), "Finance & BIS with Fintech Certification");
});
test("majors: school name and capitals cleaned off; 'Class of' is a May graduation", () => {
  assert.equal(majorsOf(entry("TEXAS CHRISTIAN UNIVERSITY", "ENTREPRENEURSHIP AND INNOVATION NEELEY SCHOOL OF BUSINESS")), "Entrepreneurship and Innovation");
  assert.equal(graduationOf("CLASS OF 2030"), "May 2030");
});
test("majors: a date, scholarship or GPA is never a major", () => {
  assert.equal(majorsOf(entry("Texas Christian University", "Aug 2026 – May 2030 (Expected)")), "");
  assert.equal(majorsOf(entry("TCU", "FULL RIDE SCHOLARSHIP | JOHN V. ROACH HONORS STUDENT")), "");
});
test("minors and GPA come from the university entry, on a 4-point scale only", () => {
  assert.equal(minorsOf(entry("Texas Christian University", "BBA, Finance", "", ["Minor: Economics"])), "Economics");
  assert.equal(gpaOf(entry("Texas Christian University", "Finance | GPA: 3.8")), "3.8");
  assert.equal(gpaOf(entry("Instituto América (IAES)", "HIGH SCHOOL GPA: 9.6 / 10")), "");
});
test("graduation: the end of the range, without '(Expected)' leftovers", () => {
  assert.equal(graduationOf("Aug 2026 – May 2030 (Expected)"), "May 2030");
  assert.equal(graduationOf("Expected Graduation: May 2029"), "May 2029");
});
test("profile school: the university, never a high school or a name", () => {
  const d = doc([["Education", [entry("Instituto América de Estudios Superiores (IAES)", "HIGH SCHOOL GPA: 9.6 / 10"), entry("TEXAS CHRISTIAN UNIVERSITY (TCU)", "John V. Roach Honors Student")]]]);
  assert.match(primaryEducation(d)!.org, /TEXAS CHRISTIAN/);
  assert.equal(primaryEducation(doc([["Education", [entry("Ashton Zane Wisecarver", "", "CLASS OF 2030")]]])), undefined);
});
test("pre-college: high school, its activities, and entries that ended before college", () => {
  const hs = entry("Instituto América de Estudios Superiores (IAES)", "HIGH SCHOOL GPA: 9.6 / 10");
  const tcu = entry("Texas Christian University", "Economics");
  const mun = entry("Deputy Secretary-General IAES Model United Nations (MUN)", "", "2025");
  const guard = entry("Honor Guard Instructor", "", "Aug 2024 - June 2025");
  const olympiad = entry("Competitive Math, Physics Olympiad", "", "May 2022 - Present");
  const job = entry("College of Education", "Work Study Student", "Oct 2025 – Present");
  const ids = preCollegeIds(doc([["Education", [hs, tcu]], ["Activities", [mun, guard, olympiad, job]]]), { y: 2025, m: 8 });
  assert.deepEqual([hs, tcu, mun, guard, olympiad, job].map((e) => ids.has(e.id)), [true, false, true, true, false, false]);
});

test("nursing resumes: 'CLINICAL EXPERIENCE' is its own section; 'B.S. Computer Science' reads as Computer Science", () => {
  const nurse = rulesParse("Aaliyah Brooks\naaliyah@example.com\nEDUCATION\nTexas Christian University\nBachelor of Science in Nursing (BSN)\nCLINICAL EXPERIENCE\nCook Children's Medical Center\nPediatric Clinical Rotation, Student Nurse\n• Provided care for pediatric patients under RN supervision\nWORK EXPERIENCE\nBrookdale Senior Living\nCertified Nursing Assistant\n• Help residents with daily activities");
  assert.deepEqual(nurse.sections.map((s) => s.heading), ["Education", "Clinical Experience", "Work Experience"]);
});
test("'B.S. Computer Science' reads as Computer Science", () => {
  assert.equal(majorsOf({ id: "e", org: "UT Dallas", role: "B.S. Computer Science", location: "", dates: "", bullets: [] }), "Computer Science");
});

test("profile name: all-caps resume names become name case; mixed case is kept", () => {
  assert.equal(nameCase("DEMETRE DONDOLADZE"), "Demetre Dondoladze");
  assert.equal(nameCase("MARY-KATE O'NEIL"), "Mary-Kate O'Neil");
  assert.equal(nameCase("Julio Cesar Renovato Rios"), "Julio Cesar Renovato Rios");
  assert.equal(nameCase("Dilandimel McDesman"), "Dilandimel McDesman");
});

test("reader: control characters from symbol fonts become spaces", () => {
  assert.equal(normalizeResumeText("Seesaw\u0000CPR\u0003First Aid"), "Seesaw CPR First Aid");
});

test("profile: a casual heading like 'school stuff:' still gives the school and major", () => {
  const doc = { contact: { name: "jaylen carter" }, skills: [], sections: [
    { id: "s1", heading: "school stuff:", entries: [entry("Texas Christian University", "B.S. Undeclared (exploring Business)", "Expected May 2030"), entry("Paschal High School", "High School Diploma, GPA 3.8", "May 2026")] },
    { id: "s2", heading: "jobs + things ive done:", entries: [entry("Chick-fil-A", "Team Member", "Jun 2024 – Aug 2026")] },
  ] } as unknown as ResumeDoc;
  assert.equal(primaryEducation(doc)?.org, "Texas Christian University");
  assert.equal(nameCase("jaylen carter"), "Jaylen Carter");
  assert.equal(nameCase("DeShawn McAllister"), "DeShawn McAllister");
});
test("AI reading: 'Role @ Org' with no role is split", () => {
  const raw = "Jaylen Carter\njobs\nTeam Member @ Chick-fil-A Jun 2024 – Aug 2026\n- Took orders";
  const { doc } = verifyAiDoc(raw, { contact: { name: "Jaylen Carter" }, sections: [{ heading: "jobs", entries: [{ org: "Team Member @ Chick-fil-A", role: "", dates: "Jun 2024 – Aug 2026", bullets: ["Took orders"] }] }] });
  assert.equal(doc.sections[0].entries[0].role, "Team Member");
  assert.equal(doc.sections[0].entries[0].org, "Chick-fil-A");
});

test("skill lists don't split inside parentheses; HTML leftovers are cleaned (persona test Nov 1)", async () => {
  const { splitList } = await import("@shared/words");
  assert.deepEqual(splitList("Excel (pivot tables, VLOOKUP), R (beginner); Python"), ["Excel (pivot tables, VLOOKUP)", "R (beginner)", "Python"]);
  assert.deepEqual(splitList("bilingual (English/Spanish, conversational), CPR"), ["bilingual (English/Spanish, conversational)", "CPR"]);
  assert.deepEqual(splitList("Excel and PowerPoint, SQL", { and: true }), ["Excel", "PowerPoint", "SQL"]);
  assert.deepEqual(splitList("Research and Development", { and: false }), ["Research and Development"]);
  const { skillParts } = await import("@shared/words");
  assert.deepEqual(splitList("Microsoft Office (Word, Excel, Outlook, Access), Python").flatMap(skillParts), ["Microsoft Office", "Word", "Excel", "Outlook", "Access", "Python"]);
  assert.deepEqual(splitList("Excel (advanced, Python, SQL"), ["Excel advanced", "Python", "SQL"]); // unclosed "(" doesn't swallow the rest
  assert.deepEqual(skillParts("R (beginner)"), ["R"]);
  const { htmlToText } = await import("./parse");
  assert.equal(htmlToText("Use document.write() sparingly"), "Use document.write() sparingly");
  assert.equal(htmlToText("?a=1&copy=2"), "?a=1&copy=2");
  assert.equal(htmlToText(`document.write('<p>AVID</p>'); document.write('Tutor');`).replace(/\s+/g, " "), "AVID Tutor");
  const t = htmlToText(`<p>AVID Tutor</p>'); document.write(' &bull; Location: Keller&nbsp&nbsp ISD &#8211; Fort Worth &amp; AT&T`);
  assert.doesNotMatch(t, /document\.write|&bull;|&nbsp|&#8211;/);
  assert.match(t, /• Location: Keller ISD – Fort Worth & AT&T/);
});
