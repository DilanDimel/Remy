// Resume reading check. No server, database or AI needed.
// Runs the rules reader, the checks on AI output and the profile helpers against
// synthetic resumes in script/fixtures/resumes (in those files "⇥" stands for a
// tab: a column gap in the original PDF or Word file) and against the real PDF
// and Word exports in docs/evidence/pairs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Document, Header, Packer, Paragraph, Tab, TextRun } from "docx";
import type { ResumeDoc, Workspace } from "@shared/types";
import { dropRunningLines, fileToText, layoutLines } from "../server/resume/parse";
import {
  chooseReading, graduationOf, headingOf, majorsOf, minorsOf, normalizeResumeText, parseQuality, primaryEducation, resumeToText, rulesParse, schoolName, splitDate,
  splitLocation, verifyAiDoc,
} from "../server/resume/resume";
import { classYearOf, gradDate } from "../server/jobs/fit";

const root = path.resolve(import.meta.dirname, "..");
const fixture = (name: string) => fs.readFileSync(path.join(root, "script/fixtures/resumes", name), "utf8").replace(/ ?⇥ ?/g, "\t");
const failures: string[] = [];
let count = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  count++;
  try {
    await fn();
  } catch (e) {
    failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
const entries = (d: ResumeDoc) => d.sections.flatMap((s) => s.entries);
const bullets = (d: ResumeDoc) => entries(d).flatMap((e) => e.bullets);
const section = (d: ResumeDoc, heading: string) => {
  const s = d.sections.find((x) => x.heading === heading);
  assert(s, `no "${heading}" section (have: ${d.sections.map((x) => x.heading).join(", ")})`);
  return s;
};
const pick = (d: ResumeDoc, heading: string) => section(d, heading).entries.map((e) => ({ org: e.org, role: e.role, location: e.location, dates: e.dates, bullets: e.bullets.length }));
const char = (code: number) => String.fromCharCode(code);

// ---------- pieces ----------
await check("PDF lines and columns", () => {
  const at = (str: string, x: number, y: number, width: number, hasEOL = false) => ({ str, transform: [10, 0, 0, 10, x, y], width, height: 10, hasEOL });
  const lines = layoutLines([
    at("Texas Christian University", 46, 700, 140),
    at(" ", 186, 700, 200),
    at("Fort Worth, TX", 480, 700, 70, true),
    at("Analyst", 46, 688, 40),
    at("Jun 2024", 500, 688, 40),
    at("next line without an end-of-line mark", 46, 676, 180),
    at("GPA", 46, 664, 20),
    at(":", 66, 664, 3),
    at(" ", 69, 664, 3),
    at("3.8", 72, 664, 15),
  ]);
  assert.deepEqual(lines, ["Texas Christian University\tFort Worth, TX", "Analyst\tJun 2024", "next line without an end-of-line mark", "GPA: 3.8"]);
});

await check("headers and footers printed on every PDF page", () => {
  const pages = dropRunningLines([
    ["Jane Doe", "jane@example.com", "• Led a team of 5", "Jane Doe · Résumé | 1"],
    ["Jane Doe", "• Led a team of 8", "Jane Doe · Résumé | 2"],
  ]);
  assert.deepEqual(pages, [["Jane Doe", "jane@example.com", "• Led a team of 5"], ["• Led a team of 8"]]);
});

await check("headings", () => {
  for (const h of ["EXPERIENCE", "Work Experience", "EXTRA-CURRICULAR ACTIVITIES", "HONORS & AWARDS", "ATHLETICS AWARDS", "ADDITIONAL SKILLS:", "Leadership & Activities", "PROJECTS & EXTERNSHIPS", "EDUCACIÓN", "Skills:", "TEST SCORES", "ADDITIONAL INFORMATION", "CLASS PROJECTS"])
    assert.equal(headingOf(h)?.rest, "", `"${h}" should be a heading`);
  assert.deepEqual(headingOf("EDUCATION\tExample College of Rochester"), { heading: "Education", rest: "Example College of Rochester", continued: false });
  assert.deepEqual(headingOf("SCHOLARSHIPS: FULL RIDE, TCU, 2026"), { heading: "Scholarships", rest: "FULL RIDE, TCU, 2026", continued: false });
  assert.equal(headingOf("ADDITIONAL COURSEWORK “Game Theory”—Coursera")?.heading, "Additional Coursework");
  assert.equal(headingOf("Work Experience (continued)")?.continued, true);
  for (const l of ["Research Assistant", "AWARDS COMMITTEE CHAIR", "Relevant Coursework: Accounting, Statistics", "TOEFL iBT: 97/120", "LEADERSHIP FORT WORTH", "Finance Club", "Treasurer", "MATH Olympiad tutor (2025) HPW:6/WPY:5", "TEXAS CHRISTIAN UNIVERSITY (TCU) - FULL RIDE SCHOLARSHIP", "• Skills", "SKILLS EXCEL, PYTHON"])
    assert.equal(headingOf(l), null, `"${l}" should not be a heading`);
});

await check("dates", () => {
  const cases: [string, string, string][] = [
    ["Honor Guard Instructor (Aug 2024 - June 2025) HPW:7 / WPY:3", "Aug 2024 - June 2025", "Honor Guard Instructor HPW:7 / WPY:3"],
    ["Debate Team Member (2025) HPW:2/WPY:16", "2025", "Debate Team Member HPW:2/WPY:16"],
    ["Team leader- Diamond Challenge (2025-Present)", "2025-Present", "Team leader- Diamond Challenge"],
    ["Finance & BIS | GPA: 3.8 Expected Graduation: May 2029", "Expected Graduation: May 2029", "Finance & BIS | GPA: 3.8"],
    ["Example Capital Partners June – August 2025", "June – August 2025", "Example Capital Partners"],
    ["Example Coffee Co. 05/2024 – 08/2024", "05/2024 – 08/2024", "Example Coffee Co."],
    ["Work Study Student Oct 2025 – Present", "Oct 2025 – Present", "Work Study Student"],
    ["MERIT SCHOLARSHIP, TCU, 2026", "2026", "MERIT SCHOLARSHIP, TCU"],
    ["Banco Ejemplo Jun 2025 – Ago 2025", "Jun 2025 – Ago 2025", "Banco Ejemplo"],
    ["Software Engineer Sep. 2023 Mar. 2024", "Sep. 2023 Mar. 2024", "Software Engineer"],
    ["Example Café, Pittsford, NY (7/24-Present)", "7/24-Present", "Example Café, Pittsford, NY"],
    ["Data Scientist Summer 2012 and 2013", "Summer 2012 and 2013", "Data Scientist"],
    ["La Martiniere Grad. May 2011", "Grad. May 2011", "La Martiniere"],
  ];
  for (const [line, date, rest] of cases) assert.deepEqual(splitDate(line), { date, rest }, line);
  for (const line of ["Managed a marketing 2024", "SAT:1440", "Bronze Medalist (Concurso Mexicano de Física)", "Founded in 2020 by students"])
    assert.equal(splitDate(line).date, "", `"${line}" has no entry dates`);
});

await check("locations", () => {
  assert.deepEqual(splitLocation("Texas Christian University Fort Worth, Texas"), { text: "Texas Christian University", location: "Fort Worth, Texas" });
  assert.deepEqual(splitLocation("Instituto Ejemplo (IE) - Nuevo Laredo, Mexico"), { text: "Instituto Ejemplo (IE)", location: "Nuevo Laredo, Mexico" });
  assert.deepEqual(splitLocation("Example Startup Denver, CO"), { text: "Example Startup", location: "Denver, CO" });
  assert.deepEqual(splitLocation("Dunamu Inc. Seoul, S.Korea"), { text: "Dunamu Inc.", location: "Seoul, S.Korea" });
  assert.deepEqual(splitLocation("Example Lab Salt Lake City, UT"), { text: "Example Lab", location: "Salt Lake City, UT" });
  assert.deepEqual(splitLocation("Example Coffee Co. Fort Worth, TX"), { text: "Example Coffee Co.", location: "Fort Worth, TX" });
  for (const t of ["Founder & Director, Cursus Honorum", "University of California, Berkeley", "Texas A&M University, College Station", "Analyst, Investment Banking", "Volunteer, Red Cross", "John Doe, Sarah Williams, David Park", "Kyoto University of Foreign Studies, Japan", "Example Coffee Co. Fort Worth, Example"])
    assert.equal(splitLocation(t).location, "", `"${t}" has no location`);
});

await check("contact details", () => {
  const d = rulesParse("Ana Ruiz | ana.ruiz@example.com | Phone: 817-555-0100\nlinkedin.com/in/ana-ruiz • Dallas, TX\nEXPERIENCE\nExample Bank\tDallas, TX\nTeller\tJune 2024 – Present\n• Balanced a drawer of $5,000 every shift");
  assert.deepEqual({ ...d.contact }, { name: "Ana Ruiz", email: "ana.ruiz@example.com", phone: "817-555-0100", location: "Dallas, TX", links: "linkedin.com/in/ana-ruiz" });
  assert.deepEqual(pick(d, "Experience"), [{ org: "Example Bank", role: "Teller", location: "Dallas, TX", dates: "June 2024 – Present", bullets: 1 }]);
  // A street address with a ZIP code, a phone with a country code and an icon, and a sentence that only mentions a portfolio.
  const e = rulesParse("Last updated in March 2026\nLee Example\n12 Example Road | Example City, NY 10001\n📱 (+52) 81-5555-0101 | lee@example.com\nProud of my portfolio of client work\nEXPERIENCE\nExample Shop\nClerk\n• Restocked shelves");
  assert.deepEqual({ ...e.contact }, { name: "Lee Example", email: "lee@example.com", phone: "(+52) 81-5555-0101", location: "12 Example Road, Example City, NY 10001", links: "" });
  assert.match(section(e, "Summary").entries[0].bullets[0].text, /portfolio of client work/);
});

await check("text clean-up", () => {
  const raw = [`${char(0xf0b7)}${char(0x9)}Built a ${char(0xfb01)}nancial model`, `Kept the team${char(0xb4)}s budget${char(0xa0)}of $800`, "Page 1 of 2", "", "2"].join("\r\n");
  assert.equal(normalizeResumeText(raw), "• Built a financial model\nKept the team’s budget of $800");
});

// ---------- whole resumes ----------
await check("activities on one line (high-school style)", () => {
  const d = rulesParse(fixture("activities-one-line.txt"));
  assert.deepEqual(d.sections.map((s) => s.heading), ["Introduction", "Education", "Extra-Curricular Activities", "Scholarships", "Honors & Awards", "Athletics Awards", "Artistic Activities", "Additional Coursework"]);
  assert.deepEqual({ ...d.contact }, { name: "Alex Rivera Example", email: "alex.example@example.com", phone: "+1 555 010 0199", location: "Laredo, Texas", links: "" });
  assert.deepEqual(pick(d, "Education")[0], { org: "Example Preparatory Academy (EPA)", role: "HIGH SCHOOL GPA: 3.9 / 4.0", location: "Laredo, Texas", dates: "", bullets: 0 });
  const acts = section(d, "Extra-Curricular Activities").entries;
  assert.deepEqual(acts.map((e) => e.dates), ["Aug 2023 - Present", "Aug 2022 - May 2025", "Jan 2025 - Present", "2025"]);
  assert.deepEqual([acts[0].org, acts[0].role], ["Robotics Club Captain", "HPW:6 WPY:30"]);
  assert.equal(acts[1].org, "Varsity Cross Country HPW:8/WPY:20");
  assert.deepEqual(acts.map((e) => e.bullets.length), [2, 1, 1, 1]);
  assert.match(acts[1].bullets[0].text, /two full minutes over three seasons\.$/);
  assert.match(acts[0].bullets[1].text, /team’s budget/);
  assert.deepEqual(pick(d, "Scholarships"), [{ org: "MERIT SCHOLARSHIP, TCU", role: "", location: "", dates: "2026", bullets: 0 }]);
  assert.deepEqual(section(d, "Honors & Awards").entries[0].bullets.length, 2);
  assert.equal(pick(d, "Artistic Activities")[0].dates, "2024");
  assert.match(section(d, "Additional Coursework").entries[0].org, /^“Introduction to Statistics”/);
  assert.deepEqual(d.skills.map((k) => k.label), ["Languages", "Hard skills"]);
  assert.match(d.skills[1].items, /survey design, research, spreadsheets, presentations\.$/);
  const edu = primaryEducation(d)!;
  assert.equal(schoolName(edu.org), "Texas Christian University (TCU)");
  assert.equal(majorsOf(edu), "");
  const q = parseQuality(normalizeResumeText(fixture("activities-one-line.txt")), d);
  assert(q.coverage >= 0.98, `coverage ${q.coverage}`);
  assert.deepEqual(q.missingLines, []);
});

const titleCase = fixture("title-case-dates-first.txt");
await check("title-case headings, dates on the organization line", () => {
  const d = rulesParse(titleCase);
  assert.deepEqual(d.sections.map((s) => s.heading), ["Summary", "Education", "Work Experience", "Leadership & Activities"]);
  assert.deepEqual({ ...d.contact }, { name: "Jordan Example", email: "jordan.example@example.com", phone: "(817) 555-0142", location: "Fort Worth, TX", links: "linkedin.com/in/jordan-example" });
  assert.deepEqual(pick(d, "Education"), [{ org: "Texas Christian University", role: "BBA in Finance, Minor in Economics | GPA: 3.7", location: "Fort Worth, TX", dates: "Expected May 2028", bullets: 1 }]);
  assert.match(section(d, "Education").entries[0].bullets[0].text, /Business Information Systems, Macroeconomics$/);
  assert.deepEqual(pick(d, "Work Experience"), [
    { org: "Example Capital Partners", role: "Summer Analyst", location: "Dallas, TX", dates: "June – August 2025", bullets: 2 },
    { org: "Example Coffee Co.", role: "Shift Lead", location: "Fort Worth, TX", dates: "05/2024 – 08/2024", bullets: 1 },
    { org: "Campus Recreation", role: "Front Desk Assistant", location: "Fort Worth, TX", dates: "2023 – Present", bullets: 1 },
  ]);
  assert.deepEqual(pick(d, "Leadership & Activities"), [{ org: "Finance Club", role: "Treasurer", location: "", dates: "", bullets: 1 }]);
  assert.deepEqual(d.skills.map((k) => [k.label, k.items]), [["Skills", "Excel, PowerPoint, Python, Bloomberg Market Concepts, financial modeling"]]);
  const edu = primaryEducation(d)!;
  assert.deepEqual([schoolName(edu.org), majorsOf(edu), minorsOf(edu), graduationOf(edu.dates)], ["Texas Christian University", "Finance", "Economics", "May 2028"]);
  assert(!entries(d).some((e) => /Page 1|^Jordan Example$/.test(e.org)), "page marks and the repeated name are not entries");
});

await check("same resume without columns, Symbol-font bullets and ligatures", () => {
  const plain = titleCase.replace(/\t/g, " ").replace(/^• /gm, char(0xf0b7) + " ").replace(/financial/g, char(0xfb01) + "nancial");
  const d = rulesParse(plain);
  assert.equal(bullets(d).length, bullets(rulesParse(titleCase)).length);
  assert.deepEqual(pick(d, "Work Experience")[0], { org: "Example Capital Partners", role: "Summer Analyst", location: "Dallas, TX", dates: "June – August 2025", bullets: 2 });
  assert.equal(pick(d, "Education")[0].role, "BBA in Finance, Minor in Economics | GPA: 3.7");
  assert.match(d.skills[0].items, /financial modeling$/);
});

await check("Spanish resume", () => {
  const d = rulesParse(fixture("spanish.txt"));
  assert.deepEqual(d.sections.map((s) => s.heading), ["Perfil", "Educación", "Experiencia"]);
  assert.deepEqual([d.contact.name, d.contact.location, d.contact.phone], ["María Ejemplo", "Monterrey, Nuevo León", "+52 81 5555 0101"]);
  assert.deepEqual(pick(d, "Educación"), [{ org: "Universidad Ejemplo de Monterrey", role: "Licenciatura en Finanzas", location: "", dates: "Ago 2024 – Actualidad", bullets: 1 }]);
  assert.deepEqual(pick(d, "Experiencia"), [{ org: "Banco Ejemplo", role: "Practicante de Análisis", location: "Monterrey, Nuevo León", dates: "Jun 2025 – Ago 2025", bullets: 1 }]);
  assert.deepEqual(d.skills.map((k) => k.label), ["Idiomas", "Herramientas"]);
  assert.equal(graduationOf(primaryEducation(d)!.dates), "", "still enrolled: no graduation date");
});

await check("job title before the company, several roles at one organization", () => {
  const d = rulesParse(fixture("title-dates-then-company.txt"));
  assert.deepEqual(d.sections.map((s) => s.heading), ["Education", "Professional Experience", "Leadership", "Additional Information"]);
  assert.equal(d.contact.location, "Example City, MO 63101");
  assert.deepEqual(pick(d, "Education"), [{ org: "Example University – School of Business", role: "Bachelor of Science in Finance", location: "St. Louis, MO", dates: "May 2027", bullets: 2 }]);
  assert.deepEqual(section(d, "Education").entries[0].bullets.map((b) => b.text), ["Minor in Data Analytics", "Cumulative GPA: 3.55 / 4.00"]);
  assert.deepEqual(pick(d, "Professional Experience"), [
    { org: "Example Bank", role: "Intern", location: "St. Louis, MO", dates: "Summer 2026", bullets: 2 },
    { org: "Example Sports", role: "Shift Leader", location: "Nashville, TN", dates: "2024 – 2025", bullets: 1 },
  ]);
  assert.deepEqual(pick(d, "Leadership"), [
    { org: "Example Business Society", role: "President", location: "St. Louis, MO", dates: "May 2026 – Present", bullets: 0 },
    { org: "Example Business Society", role: "Secretary", location: "St. Louis, MO", dates: "August 2025 – May 2026", bullets: 1 },
    { org: "Example Investment Club", role: "Member", location: "", dates: "August 2025 – Present", bullets: 0 },
  ]);
});

await check("headings in a left-hand column, descriptions as paragraphs", () => {
  const d = rulesParse(fixture("margin-headings.txt"));
  assert.deepEqual(d.sections.map((s) => s.heading), ["Objective", "Education", "Internship Experience", "Customer Service Experience", "College Employment", "College Activities"]);
  assert.deepEqual({ ...d.contact }, { name: "Taylor Example", email: "taylor@example.edu", phone: "(585) 555-0123", location: "10 Example Avenue, Rochester, NY 14600", links: "www.linkedin.com/in/taylor-example" });
  assert.deepEqual(pick(d, "Education"), [{ org: "Example College of Rochester", role: "B.S. in Business Administration", location: "", dates: "May 2027", bullets: 2 }]);
  assert.deepEqual(pick(d, "Internship Experience"), [{ org: "Example Advisors", role: "", location: "Rochester, NY", dates: "Fall 2026", bullets: 2 }]);
  assert.deepEqual(pick(d, "Customer Service Experience"), [{ org: "Example Café", role: "", location: "Pittsford, NY", dates: "7/24-Present", bullets: 1 }]);
  assert.match(section(d, "Customer Service Experience").entries[0].bullets[0].text, /^Serve food .* Train and supervise four employees .* Manage the cash drawer\.$/);
  assert.match(section(d, "College Employment").entries[0].bullets[0].text, /^Help Desk - .* students and faculty\.$/);
  assert.deepEqual(pick(d, "College Activities"), [{ org: "Student Government", role: "", location: "", dates: "Fall 2025-Fall 2026", bullets: 0 }]);
});

await check("engineering layouts (LaTeX, RenderCV)", () => {
  const d = rulesParse(fixture("engineering.txt"));
  assert.deepEqual({ ...d.contact }, { name: "Riley Example", email: "riley@example.com", phone: "+1-555-010-0177", location: "", links: "rileyexample.dev" });
  assert.deepEqual(pick(d, "Education"), [{ org: "Example Institute of Technology", role: "Master of Science in Computer Science; GPA: 3.9", location: "Atlanta, GA", dates: "Aug 2024 – May 2026", bullets: 0 }]);
  assert.deepEqual(pick(d, "Experience"), [
    { org: "Example Cloud", role: "Software Engineer", location: "Seattle, WA", dates: "Sep. 2026 Mar. 2027", bullets: 1 },
    { org: "Example Labs", role: "Data Science Intern", location: "Austin, TX", dates: "Summer 2025 and 2026", bullets: 2 },
  ]);
  assert.match(section(d, "Experience").entries[1].bullets[0].text, /30%\. Documented every job so new teammates could run it alone\.$/);
  assert.deepEqual(pick(d, "Projects"), [{ org: "Example Search Engine", role: "Lead Developer", location: "San Francisco, CA", dates: "June 2025 – Aug 2025 · 3 months", bullets: 1 }]);
  assert.deepEqual(pick(d, "Awards"), [{ org: "1st Place, Example Coding Competition", role: "", location: "", dates: "2024", bullets: 0 }]);
  assert(section(d, "Publications").entries.every((e) => !e.location), "author names are not places");
});

await check("Word file with the contact details in the page header", async () => {
  const cols = (left: string, right: string) => new Paragraph({ children: [new TextRun(left), new TextRun({ children: [new Tab(), right] })] });
  const file = new Document({
    sections: [{
      headers: { default: new Header({ children: [new Paragraph("ALEX EXAMPLE"), new Paragraph("123 Example Street | Example City, NY 10001 | (555) 010-0100 | alex@example.edu")] }) },
      children: [
        new Paragraph("________________________________"),
        new Paragraph("EDUCATION"),
        new Paragraph("Example State University"),
        cols("Bachelor of Science in Economics", "Expected May 2027"),
        new Paragraph("Minor in Statistics"),
        new Paragraph("Cumulative GPA: 3.62/4.00 | Dean’s List Fall 2024, Spring 2025"),
        new Paragraph("EXPERIENCE"),
        cols("Example Market", "Example City, NY"),
        cols("Cashier", "June 2025 – Present"),
        new Paragraph({ text: "Handled 200 transactions a shift", bullet: { level: 0 } }),
      ],
    }],
  });
  const d = rulesParse(await fileToText(await Packer.toBuffer(file), "header.docx", ""));
  assert.deepEqual({ ...d.contact }, { name: "ALEX EXAMPLE", email: "alex@example.edu", phone: "(555) 010-0100", location: "123 Example Street, Example City, NY 10001", links: "" });
  assert.deepEqual(pick(d, "Education"), [{ org: "Example State University", role: "Bachelor of Science in Economics", location: "", dates: "Expected May 2027", bullets: 2 }]);
  assert.match(section(d, "Education").entries[0].bullets[1].text, /Dean’s List Fall 2024, Spring 2025$/, "a semester list is not the entry's dates");
  assert.deepEqual(pick(d, "Experience"), [{ org: "Example Market", role: "Cashier", location: "Example City, NY", dates: "June 2025 – Present", bullets: 1 }]);
});

await check("sample resume keeps its structure", () => {
  const d = rulesParse(fs.readFileSync(path.join(root, "server/sample-resume.txt"), "utf8"));
  assert.deepEqual(d.sections.map((s) => s.heading), ["Education", "Experience", "Projects & Externships", "Activities and Leadership", "Certifications"]);
  assert.equal(entries(d).length, 10);
  assert.equal(entries(d).filter((e) => e.dates).length, 9);
  assert.equal(bullets(d).length, 19);
  assert.equal(d.skills.length, 4);
  const edu = primaryEducation(d)!;
  assert.deepEqual([schoolName(edu.org), majorsOf(edu), graduationOf(edu.dates)], ["Texas Christian University", "Finance & BIS with Fintech Certification", "May 2029"]);
});

await check("a resume without headings loses nothing", () => {
  const text = "Sam Example\nsam@example.com\nI organized a neighborhood food drive that collected 2,000 pounds of food.\nI tutor middle school students in math every Saturday.";
  const d = rulesParse(text);
  assert.equal(d.contact.name, "Sam Example");
  assert.deepEqual(parseQuality(normalizeResumeText(text), d).missingLines, []);
  assert.match(bullets(d)[0].text, /food drive.*every Saturday/);
});

// ---------- real files ----------
for (const pair of ["evercore-ma-2028", "db-develop-ib", "insight-inclusion-2027"]) {
  await check(`real PDF and Word exports: ${pair}`, async () => {
    const read = async (ext: string) => {
      const file = path.join(root, "docs/evidence/pairs", `${pair}-resume.${ext}`);
      const raw = normalizeResumeText(await fileToText(fs.readFileSync(file), file, ""));
      return { raw, doc: rulesParse(raw) };
    };
    const pdf = await read("pdf");
    const docx = await read("docx");
    for (const { raw, doc } of [pdf, docx]) {
      assert(doc.sections.length >= 5, `${doc.sections.length} sections`);
      assert(entries(doc).filter((e) => e.dates).length >= 8, "dated entries");
      assert(parseQuality(raw, doc).coverage >= 0.95, `coverage ${parseQuality(raw, doc).coverage}`);
    }
    assert(bullets(docx.doc).length >= 10, `Word bullets: ${bullets(docx.doc).length}`);
    assert.equal(bullets(docx.doc).length, bullets(pdf.doc).length, "Word and PDF give the same bullets");
    assert.deepEqual(docx.doc.sections.map((s) => s.heading), pdf.doc.sections.map((s) => s.heading));
  });
}

await check("file types are recognized by content", async () => {
  const docx = fs.readFileSync(path.join(root, "docs/evidence/pairs/evercore-ma-2028-resume.docx"));
  assert.match(await fileToText(docx, "renamed.pdf", "application/pdf"), /Texas Christian University/);
  await assert.rejects(fileToText(Buffer.from("%PDF-1.7 broken"), "x.pdf", "application/pdf"), (e: any) => e.status === 422);
  await assert.rejects(fileToText(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "old.doc", ""), (e: any) => e.status === 415 && /\.docx/.test(e.message));
  await assert.rejects(fileToText(Buffer.from("hello"), "photo.png", "image/png"), (e: any) => e.status === 415);
});

// ---------- AI output checks ----------
const raw = normalizeResumeText(titleCase);
await check("AI output is checked against the file", () => {
  const { doc, notes } = verifyAiDoc(raw, {
    contact: { name: "Jordan Example", email: "jordan.example@example.com", phone: "(817) 555-0142", location: "Fort Worth, TX", links: "linkedin.com/in/jordan-example" },
    sections: [
      { heading: "Education", entries: [{ org: "Texas Christian University", role: "BBA in Finance, Minor in Economics | GPA: 3.7", location: "Fort Worth, TX", dates: "Expected May 2028", bullets: ["Relevant coursework: Corporate Finance, Financial Accounting, Statistics, Microeconomics, Business Information Systems, Macroeconomics"] }] },
      {
        heading: "Work Experience",
        entries: [
          { org: "Goldman Sachs", role: "Summer Analyst", location: "New York, NY", dates: "Jun 2025 – Aug 2025", bullets: ["Built a three-statement model for a $40M acquisition target and presented the findings to two managing directors", "Raised $2M from 14 investors"] },
          { org: "Example Coffee Co.", role: "Shift Lead", location: "Fort Worth, TX", dates: "May 2027 – Aug 2027", bullets: [] },
        ],
      },
      { heading: "Empty", entries: [] },
    ],
    skills: [{ label: "Technical", items: "Excel, Python, SQL" }],
  });
  assert.deepEqual({ ...doc.contact }, { name: "Jordan Example", email: "jordan.example@example.com", phone: "(817) 555-0142", location: "Fort Worth, TX", links: "linkedin.com/in/jordan-example" });
  assert.deepEqual(doc.sections.map((s) => s.heading), ["Education", "Work Experience"]);
  assert.equal(doc.sections[0].entries[0].bullets[0].verified, true, "a bullet joined across lines is still verbatim");
  const [gs, coffee] = doc.sections[1].entries;
  assert.deepEqual(gs.unverified, ["org"]);
  assert.deepEqual([gs.location, gs.dates], ["", "Jun 2025 – Aug 2025"], "an invented place is dropped; reformatted dates are kept");
  assert.deepEqual(gs.bullets.map((b) => b.verified), [true, false]);
  assert.equal(coffee.dates, "", "invented dates are dropped");
  assert.deepEqual(doc.skills, [{ id: doc.skills[0].id, label: "Technical", items: "Excel, Python" }]);
  assert.equal(notes.length, 2);
  const evidence = resumeToText(doc, { verifiedOnly: true });
  assert(!/Goldman|Raised \$2M/.test(evidence), "unverified text is not evidence");
  assert(/Goldman/.test(resumeToText(doc)), "but the student still sees it");
  assert.equal(verifyAiDoc(raw, { contact: { email: "someone@else.com", phone: "555 123 9999" }, sections: [] }).doc.contact.email, "");
});

await check("an AI reading that drops part of the file loses to the rules reading", () => {
  const rules = rulesParse(raw);
  const full = chooseReading(raw, rules, { doc: rules, notes: [] });
  assert.equal(full.parsedBy, "ai");
  const partial: ResumeDoc = { ...rules, sections: rules.sections.filter((s) => s.heading !== "Work Experience") };
  const chosen = chooseReading(raw, rules, { doc: partial, notes: [] });
  assert.equal(chosen.parsedBy, "rules");
  assert.match(chosen.notes[0], /left out part of your file/);
  assert(parseQuality(raw, partial).missingLines.some((l) => /three-statement model/.test(l)), "the dropped lines are listed");
});

// ---------- profile facts ----------
await check("graduation, major and class standing", () => {
  assert.equal(graduationOf("Aug 2025 – May 2029"), "May 2029");
  assert.equal(graduationOf("Expected Graduation: May 2029"), "May 2029");
  assert.equal(graduationOf("2025-Present"), "");
  const role = (r: string) => ({ id: "x", org: "", role: r, location: "", dates: "", bullets: [] }) as any;
  assert.equal(majorsOf(role("Full Ride Scholarship (12,000 USD per yr)")), "");
  assert.equal(majorsOf(role("Bachelor of Business Administration, Finance; Honors College")), "Finance");
  assert.equal(schoolName("UNIVERSITY OF TEXAS AT AUSTIN, MCCOMBS SCHOOL OF BUSINESS"), "University of Texas at Austin");
  const ws = (rawText: string, graduation = "") =>
    ({ profile: { classYear: "", graduation }, resume: { rawText, doc: rulesParse(raw) } }) as unknown as Workspace;
  const fall2026 = new Date("2026-10-01T12:00:00Z");
  assert.equal(classYearOf(ws("Senior Analyst at Example Bank; Junior Achievement volunteer"), fall2026), "Junior", "titles don't set class standing");
  assert.equal(classYearOf(ws("Class: Sophomore"), fall2026), "Sophomore");
  assert.deepEqual(gradDate(ws("", "Aug 2025 – May 2029")), { y: 2029, m: 5 });
  assert.deepEqual(gradDate(ws("")), { y: 2028, m: 5 }, "from the university entry");
});

console.log(`resume: ${count} checks`);
if (failures.length) {
  console.error(`\nresume FAILED (${failures.length}):`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("resume OK");
