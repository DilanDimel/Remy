// Profile facts read from a resume: majors, minors, GPA, graduation, and pre-college entries. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entry, ResumeDoc } from "@shared/types";
import { gpaOf, graduationOf, majorsOf, minorsOf, preCollegeIds, primaryEducation, rulesParse } from "./resume";

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
