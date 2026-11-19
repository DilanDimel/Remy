// LinkedIn coach: specific tips from what the PDF shows (headline, web address, top skills, About opening).
import { test } from "node:test";
import assert from "node:assert/strict";
import { linkedinTips, parseLinkedin } from "@shared/linkedin";

// Synthetic text in the shape LinkedIn's "Save to PDF" produces (left column first, then the main column).
const pdf = (headline: string, slug = "maya-lee-3a9f21b7", about = "") => `Contact
maya@example.com
www.linkedin.com/in/${slug.slice(0, 8)}
${slug.slice(8)} (LinkedIn)
Top Skills
Team Building
Public Speaking
Leadership
Languages
Spanish (Professional Working)
Maya Lee
${headline}
Fort Worth, Texas, United States
${about ? `Summary\n${about}\n` : ""}Experience
Campus Fund
Analyst
`;
const facts = { major: "Finance", school: "TCU", role: "Treasurer @ NABA", resumeSkills: ["Excel", "Financial modeling", "Public Speaking", "SQL"] };

test("linkedin: reads the wrapped web address, top skills, headline (even on two lines) and About", () => {
  const p = parseLinkedin(pdf("Finance student at TCU | Treasurer @ NABA |\nAnalyst @ Campus Fund", "maya-lee-3a9f21b7", "I study finance at TCU and run our chapter's budget."), ["Maya Lee"]);
  assert.equal(p.slug, "maya-lee-3a9f21b7");
  assert.deepEqual(p.topSkills, ["Team Building", "Public Speaking", "Leadership"]);
  assert.equal(p.headline, "Finance student at TCU | Treasurer @ NABA | Analyst @ Campus Fund");
  assert.equal(p.about, "I study finance at TCU and run our chapter's budget.");
});

test("linkedin: a generic headline gets a suggestion built only from the student's facts; a random web address is flagged", () => {
  const tips = linkedinTips(parseLinkedin(pdf("Student at Texas Christian University"), ["Maya Lee"]), facts);
  const h = tips.find((t) => t.key === "headline")!;
  assert.equal(h.ok, false);
  assert.equal(h.suggestion, "Finance student at TCU | Treasurer @ NABA"); // no "Interested in": curiosity isn't a public claim
  assert.equal(tips.find((t) => t.key === "url")!.ok, false);
  const skills = tips.find((t) => t.key === "skills")!;
  assert.match(skills.detail, /Excel, Financial modeling, SQL/); // Public Speaking is already pinned
  assert.equal(tips.find((t) => t.key === "about")!.title, "No About section");
});

test("linkedin: a specific headline and clean address pass; an About that doesn't lead with the major gets a tip", () => {
  const tips = linkedinTips(parseLinkedin(pdf("Finance student at TCU | Treasurer @ NABA", "maya-lee-tcu", "Growing up I loved puzzles and games of all kinds, and my family ran a small corner store in our neighborhood where I helped stock shelves, count the register and talk with regulars every single weekend for years. Later in life I decided that business could be a way to help people like them, which is why today I study finance."), ["Maya Lee"]), facts);
  assert.equal(tips.find((t) => t.key === "headline")!.ok, true);
  assert.equal(tips.find((t) => t.key === "url")!.ok, true);
  const about = tips.find((t) => t.key === "about")!;
  assert.equal(about.ok, false);
  assert.match(about.detail, /Lead with what you study/);
});

test("linkedin: when the name can't be found, no headline is guessed, and the tip says Remy couldn't read it", () => {
  const p = parseLinkedin(pdf("Student at TCU"), ["Someone Else"]);
  assert.equal(p.headline, null);
  assert.equal(linkedinTips(p, facts).find((t) => t.key === "headline")!.title, "Remy couldn't read your headline from the PDF");
});

const raw = (lines: string[]) => lines.join("\n");
test("linkedin (review cases): locations without commas, middle names and accents, short good headlines", () => {
  const base = ["Contact", "www.linkedin.com/in/maya-lee (LinkedIn)", "Top Skills", "Excel"];
  let p = parseLinkedin(raw([...base, "Maya Lee", "Finance Student at Texas Christian University", "Dallas-Fort Worth Metroplex", "Experience"]), ["Maya Lee"]);
  assert.equal(p.headline, "Finance Student at Texas Christian University");
  assert.equal(linkedinTips(p, facts).find((t) => t.key === "headline")!.ok, false, "still generic once the location isn't glued on");
  p = parseLinkedin(raw([...base, "Maya J. Lee (She/Her)", "Analyst @ Goldman Sachs", "United States", "Summary", "I study finance at TCU.", "Experience"]), ["Maya Lee"]);
  assert.equal(p.headline, "Analyst @ Goldman Sachs");
  assert.equal(linkedinTips(p, facts).find((t) => t.key === "headline")!.ok, true);
  assert.deepEqual(p.topSkills, ["Excel"], "skills stop at the name, never the name or headline");
  assert.equal(linkedinTips(p, facts).find((t) => t.key === "about")!.detail.startsWith("“I study finance at TCU.”"), true, "short About isn't cut");
  p = parseLinkedin(raw([...base, "José García", "Analyst @ Campus Fund", "Experience"]), ["Jose Garcia"]);
  assert.equal(p.headline, "Analyst @ Campus Fund");
});

test("linkedin (review cases): URLs, About-lead check and missing (LinkedIn) marker", () => {
  const url = (slug: string) => linkedinTips({ slug, topSkills: [], headline: null, about: "" }, facts).find((t) => t.key === "url")!.ok;
  assert.equal(url("maya-lee-2027"), true);
  assert.equal(url("jsmith123"), true);
  assert.equal(url("maya-lee-3a9f21b7"), false);
  const lead = (major: string, about: string) => linkedinTips({ slug: "", topSkills: [], headline: null, about }, { ...facts, major }).find((t) => t.key === "about")!.ok;
  assert.equal(lead("Finance, Accounting", "I study finance and accounting at TCU."), true);
  assert.equal(lead("Art", "I love to start things and build communities."), false);
  assert.doesNotThrow(() => lead("C++ (Computer Science)", "I code in C++."));
  const p = parseLinkedin(raw(["Contact", "www.linkedin.com/in/maya-lee", "Top Skills", "Excel", "Maya Lee", "Analyst @ Fund", "Experience"]), ["Maya Lee"]);
  assert.equal(p.slug, "maya-lee");
});

test("LinkedIn coach: a headline field of study the resume's major doesn't say is flagged as a question (live test Nov 19)", async () => {
  const { linkedinTips } = await import("../shared/linkedin");
  const facts = { major: "Finance & BIS with Fintech Certification", school: "Texas Christian University", role: "", resumeSkills: [] };
  const tips = (headline: string) => linkedinTips({ slug: "", topSkills: [], headline, about: "" } as any, facts).filter((t) => t.key === "headline" && !t.ok);
  assert.match(tips("Finance & Accounting Student at TCU Neeley | Treasurer @ NABA")[0]?.title || "", /Finance & Accounting.*Finance & BIS/);
  assert.equal(tips("Finance Student at TCU | Treasurer @ NABA").length, 0, "a shorter headline is fine");
  assert.equal(tips("Finance & BIS Student at TCU Neeley | Treasurer @ NABA").length, 0);
  assert.equal(tips("Treasurer @ NABA | Director of Travel").length, 0, "no field of study named");
});
