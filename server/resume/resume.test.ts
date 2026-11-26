// Profile facts read from a resume: majors, minors, GPA, graduation, and pre-college entries. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entry, ResumeDoc } from "@shared/types";
import { gpaOf, graduationOf, majorsOf, minorsOf, nameCase, preCollegeIds, primaryEducation, rulesParse, schoolName, verifyAiDoc } from "./resume";
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
  // A dot separator before the GPA ("Finance · GPA 3.6", found reading a scanned resume on remyai.org, Nov 25) isn't part of the major.
  assert.equal(majorsOf(entry("Texas Christian University", "Bachelor of Business Administration, Finance · GPA 3.6")), "Finance");
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

// Nov 17 audit: a downloaded resume read "BBA Finance, Expected May 2029. GPA 3.6 | Expected May 2029" and
// "SKILLS" then "SKILLS: Excel…", and the major showed as "BBA Finance, Expected May 2029." in four places.
test("export: the graduation date prints once and a plain Skills group isn't labelled twice", async () => {
  const { majorsOf, resumeToText } = await import("./resume");
  const { dropDates, skillGroupName } = await import("@shared/words");
  const edu = (role: string) => ({ id: "e", org: "Texas Christian University", role, dates: "", location: "", bullets: [] });
  assert.equal(dropDates("BBA Finance, Expected May 2029. GPA 3.6", "Expected May 2029"), "BBA Finance, GPA 3.6");
  assert.equal(dropDates("BBA Finance | Expected May 2029", "Expected May 2029"), "BBA Finance");
  assert.equal(dropDates("B.S. Computer Science", "Aug 2024 - May 2028"), "B.S. Computer Science");
  assert.equal(dropDates("BBA Finance, Expected May 2029. GPA 3.6", "May 2029"), "BBA Finance, GPA 3.6");
  assert.equal(dropDates("Team Captain (Aug 2024 - Present) HPW:4", "Aug 2024 - Present"), "Team Captain, HPW:4");
  assert.equal(dropDates("Intern (2024)", "2024"), "Intern");
  assert.equal(dropDates("Finance, Class of 2028", "2028"), "Finance");
  assert.equal(dropDates("Data Analyst — May 2025", "May 2025"), "Data Analyst");
  assert.equal(dropDates("Analyst 20245", "2024"), "Analyst 20245");
  assert.equal(dropDates("Summer Analyst", "Summer"), "Summer Analyst"); // no year: part of the title
  assert.equal(dropDates("Present Day Ministries Volunteer", "Present"), "Present Day Ministries Volunteer");
  assert.equal(dropDates("BS Finance (GPA 3.6, Expected May 2029)", "Expected May 2029"), "BS Finance (GPA 3.6)");
  assert.equal(dropDates("Analyst (Summer 2025, Remote)", "Summer 2025"), "Analyst (Remote)");
  assert.equal(dropDates("BBA Finance. Expected May 2029", "May 2029"), "BBA Finance");
  assert.equal(dropDates("Finance, B.S., May 2029", "May 2029"), "Finance, B.S.");
  assert.equal(dropDates("Analyst, J.P. Morgan Co., 2025", "2025"), "Analyst, J.P. Morgan Co.");
  assert.equal(majorsOf(edu("BBA Marketing, May 2028")), "Marketing"); // "Mar…" isn't March
  // Saved resumes are cleaned when printed, not only new uploads.
  const saved = { contact: { name: "Chris", email: "", phone: "", location: "", links: "" }, skills: [], sections: [{ id: "s", heading: "Education", entries: [{ ...edu("BBA Finance, Expected May 2029. GPA 3.6"), dates: "Expected May 2029" }] }] };
  assert.match(resumeToText(saved as any), /BBA Finance, GPA 3\.6 \| Expected May 2029/);
  assert.equal(majorsOf(edu("BBA Finance, Expected May 2029. GPA 3.6")), "Finance");
  assert.equal(majorsOf(edu("Bachelor of Science in Biology, May 2028")), "Biology");
  for (const l of ["Skills", "SKILLS", "Skills:", " skill "]) assert.equal(skillGroupName(l), "", l);
  assert.equal(skillGroupName("Technical Skills"), "Technical Skills");
  assert.equal(skillGroupName("Languages"), "Languages");
  const doc = { contact: { name: "Chris", email: "", phone: "", location: "", links: "" }, sections: [], skills: [{ id: "k", label: "SKILLS", items: "Excel, PowerPoint" }, { id: "k2", label: "Languages", items: "Spanish" }] };
  const txt = resumeToText(doc as any);
  assert.match(txt, /SKILLS\nExcel, PowerPoint\nLanguages: Spanish/);
  assert.doesNotMatch(txt, /SKILLS: /);
});

// Found by the 1,000-resume test set (Nov 25): degree lines and school names Remy didn't read before.
test("majors: every common way of writing the degree", () => {
  const cases: [string, string][] = [
    ["MS in Finance", "Finance"], ["BSEd, Special Education", "Special Education"], ["BFA, Interior Design", "Interior Design"],
    ["BSW in Social Work", "Social Work"], ["Bachelor of Engineering in Computer Systems", "Computer Systems"], ["Bachelor in Computer Systems Engineering", "Computer Systems Engineering"],
    ["Associate of Applied Science in Network Administration", "Network Administration"], ["Master of Accountancy in Taxation", "Taxation"], ["Diploma in Business Informatics", "Business Informatics"],
    ["Doctor of Philosophy in Machine Learning", "Machine Learning"], ["Double Major in Finance and Accounting", "Finance and Accounting"],
    ["BSN", "Nursing"], ["MBA", "Business Administration"], ["Bachelor of Social Work", "Social Work"], ["Bachelor of Science", ""], ["B.A.", ""],
  ];
  for (const [role, want] of cases) assert.equal(majorsOf(entry("Example University", role)), want, role);
});
test("school: named without 'University' or 'College', and the campus after a comma", () => {
  for (const org of ["Virginia Tech", "Riga Institute of Engineering Sciences", "Latvian Academy of Applied Computing", "Hochschule Ostwald-Rheinau"])
    assert.equal(primaryEducation(doc([["Education", [entry(org, "Bachelor of Science in Biology")]]]))?.org, org);
  assert.equal(primaryEducation(doc([["Education", [entry("Westlake Academy", "High School Diploma")]]])), undefined);
  assert.equal(schoolName("University of California, Los Angeles"), "University of California, Los Angeles");
  assert.equal(schoolName("University of Texas at Austin, BBA Finance"), "University of Texas at Austin");
});

test("PDF lists drawn without a bullet character still read as bullets", async () => {
  const { markIndentedBullets } = await import("./parse");
  const L = (text: string, x: number, end: number) => ({ text, x, end, size: 10 });
  const out = markIndentedBullets([
    L("Example Labs\tAustin, TX", 50, 560), L("Data Intern\tJun 2025 – Aug 2025", 50, 560),
    L("Built a dashboard used by 40 engineers to track every test run across", 64, 559), L("three teams", 64, 120),
    L("Wrote unit tests for a payments service", 64, 300), L("Retail Co\tDallas, TX", 50, 560), L("Cashier\t2024", 50, 560),
    L("Helped 100 customers a shift and handled the register", 64, 330),
  ]);
  assert.deepEqual(out.filter((l) => l.startsWith("• ")), ["• Built a dashboard used by 40 engineers to track every test run across", "• Wrote unit tests for a payments service", "• Helped 100 customers a shift and handled the register"]);
  // A page that prints its own bullets is left alone.
  assert.equal(markIndentedBullets([L("• One", 50, 90), L("• Two", 50, 90), L("next line of two", 60, 200)])[2], "next line of two");
});
test("contact details lower down, or run together on one line", () => {
  const d = rulesParse("Quinn Hussein\nEXPERIENCE\nLocal Diner\nServer\tJan 2025 – Present\n• Helped 75 customers\nquinn@example.com\n(817) 555-0166\nSKILLS\nExcel");
  assert.equal(d.contact.email, "quinn@example.com");
  assert.equal(d.contact.phone, "(817) 555-0166");
  const e = rulesParse("Ana Ruiz\nPlano, TX ana@example.com 817-555-0101\nEDUCATION\nExample University");
  assert.equal(e.contact.email, "ana@example.com");
  assert.equal(e.contact.phone, "817-555-0101");
});
