// Run with `npm test`. Cases come from the Oct 2026 stress test and the real AI
// mistakes in docs/evidence/ai-error-log.md; every made-up claim here must stay flagged
// and every true statement must stay clean.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { claimCheck } from "./claims";

const evidence = fs.readFileSync(path.join(import.meta.dirname, "..", "sample-resume.txt"), "utf8") + "\nClass year: Sophomore";
const workStudy = "Provide administrative and operational support to faculty and staff within the College of Education department";
const budget = "Oversee an estimated annual chapter budget of $5,000+, managing SGA funding allocations and corporate sponsorship";
const flagged = (text: string, opts = {}) => claimCheck(text, evidence, opts).length > 0;

const madeUp: [string, string, object?][] = [
  ["invented number", "Supported 40 faculty members in the College of Education", { original: workStudy }],
  ["invented tools", "Automated office reporting using Python and SQL"],
  ["invented title", "Served as Office Manager for the College of Education"],
  ["invented employer", "Interned at Goldman Sachs over the summer"],
  ["invented outcome", "Provided administrative support, improving response times for students", { original: workStudy }],
  ["workload word (pitch AI error)", "my work-study position supporting a fast-paced office"],
  ["leadership inflation", "Led the department's operations and supervised staff", { original: workStudy }],
  ["percent written as a word", "Cut processing time by thirty percent"],
  ["number written as a word", "Managed a team of five students"],
  ["number in digits", "Managed 10 people"],
  ["fake award", "Recipient of the Dean's Excellence Award"],
  ["fake certification", "Earned a bloomberg market concepts certificate"],
  ["degree inflation", "Completed a master's-level valuation course"],
  ["dropped hedge (seen on a real resume)", "Oversee chapter budget of $5,000+, managing SGA funding allocations and corporate sponsorships", { original: budget }],
  ["letter drops 'estimated' (seen on a real letter)", "As Treasurer, I manage an annual chapter budget exceeding $5,000."],
  ["claims a class standing the resume doesn't have", "As a senior at TCU, I bring leadership experience."],
  ["letter drops 'estimated' before a comma (McKesson letter, Oct 23)", "As Treasurer, I oversee an annual budget of over $5,000, handling SGA funding allocations."],
  ["dropped co-", "Founded and led the investment club", { original: "Co-founded the investment club" }],
];
for (const [name, text, opts] of madeUp) test(`flags: ${name}`, () => assert.ok(flagged(text, opts), text));

const truthful: [string, string, object?][] = [
  ["faithful reword", "Provided administrative and operational support to faculty and staff in the College of Education", { original: workStudy }],
  ["fact from the resume", "Recipient of the TCU Founders Scholarship"],
  ["year from the resume", "Expected graduation May 2029"],
  ["hedge kept", "Oversee an estimated annual chapter budget of $5,000+ and manage SGA funding allocations", { original: budget }],
  ["'led' kept from the original (accepted in the Evercore pair)", "Founded UNO Club from concept to active organization and led effort for official TCU recognition; organized an inaugural tournament with 24 participants across a 6-pool bracket and oversee an 8-member executive board", { original: "Founded club from concept to active organization and led effort for official TCU recognition; organized inaugural tournament with 24 participants across a 6-pool bracket; oversee an 8-member executive board", entryContext: "UNO Club Founder & President" }],
  ["'graduate' as a verb in a letter", "As I graduate in 2029, I hope to build on my finance coursework."],
  ["'senior' describing other people (McKesson letter, Oct 23)", "I look forward to building models that senior finance leaders rely on."],
  ["possessive of a name on the resume", "As Treasurer for TCU's chapter of NABA, I keep the books."],
  ["posting figure in a letter", "I am excited about the 10-week program.", { postingText: "This 10-week program runs each summer.", postingNumbersOk: true }],
];
for (const [name, text, opts] of truthful) test(`clean: ${name}`, () => assert.deepEqual(claimCheck(text, evidence, opts || {}), [], text));

test("claims: simulations stay simulations, team work stays team work, recommendations aren't results", () => {
  const sim = "Built a DCF model in Excel during the J.P. Morgan Investment Banking Job Simulation (Forage)";
  assert.ok(claimCheck("Built a DCF model as an investment banking analyst at J.P. Morgan", sim, { original: sim }).some((f) => /simulation/.test(f.message)));
  assert.ok(!claimCheck("Built a DCF model in Excel in a J.P. Morgan job simulation", sim, { original: sim }).some((f) => /simulation/.test(f.message)));
  const team = "Worked with a team of classmates to build a marketing plan";
  assert.ok(claimCheck("Built a marketing plan for a local business", team, { original: team }).some((f) => f.term === "team"));
  assert.ok(!claimCheck("Collaborated with classmates to build a marketing plan", team, { original: team }).some((f) => f.term === "team"));
  const rec = "Recommended a social media strategy for a local coffee shop in a class project";
  assert.ok(claimCheck("Increased a local coffee shop's social media reach with a new strategy", rec, { original: rec }).some((f) => /recommended/.test(f.message)));
  assert.ok(!claimCheck("Recommended a new social media strategy for a local coffee shop", rec, { original: rec }).some((f) => /recommended/.test(f.message)));
});
test("claims: rewording an entry with action verbs isn't flagged as added detail", () => {
  const orig = "Designed a rear upright in SolidWorks with a team of four and ran FEA to check stress under braking loads";
  const f = claimCheck("Collaborated with a team of four to model a rear upright in SolidWorks and run FEA to analyze stress under braking loads", orig, { original: orig, entryContext: "Formula SAE Racing Team Suspension Subteam Member" });
  assert.ok(!f.some((x) => /adds detail/.test(x.message)), JSON.stringify(f));
});

test("clean: spelled-out abbreviations, same-credit verbs, plain rewording and tools that manage", () => {
  const ev = "Student nurse. Cared for 3 adult patients per shift under RN supervision. Built an Excel tracker for the team's PBC requests. Assisted officers with traffic control. Wrote incident reports used by store leadership.";
  const ok = (text: string, original: string) => assert.deepEqual(claimCheck(text, ev, { original }), [], text);
  ok("Cared for 3 adult patients per shift under registered nurse supervision", "Cared for 3 adult patients per shift under RN supervision");
  ok("Built an Excel tracker to manage the team's PBC (Provided by Client) requests", "Built an Excel tracker for the team's PBC requests");
  ok("Supported officers with traffic control", "Assisted officers with traffic control");
  ok("Assisted RNs with care for 3 adult patients per shift", "Cared for 3 adult patients per shift under RN supervision");
  ok("Authored incident reports utilized by store leadership", "Wrote incident reports used by store leadership");
  assert.ok(claimCheck("Directed officers with traffic control", ev, { original: "Assisted officers with traffic control" }).length > 0, "dropping the hedge entirely still flags");
});

test("strict (check-ins): any detail the student didn't say is flagged; rewording what they said is not", () => {
  const strict = (text: string, said: string) => claimCheck(text, said, { original: said, strict: true }).filter((f) => f.type === "scope").map((f) => f.term).join(", ");
  assert.match(strict("Elected by peers to serve as Treasurer of the Finance Club", "I'm treasurer of Finance Club now"), /elected, peers/);
  assert.match(strict("Took customer orders at the drive-thru and handled customer checkout at Chick-fil-A", "I work at Chick-fil-A taking orders at the drive-thru"), /customer, checkout/);
  assert.match(strict("Poverty Alleviation", "I volunteered at the Tarrant Area Food Bank sorting donations"), /poverty, alleviation/);
  assert.equal(strict("Volunteered at the Tarrant Area Food Bank, sorting donations", "I volunteered at the Tarrant Area Food Bank on Saturday sorting donations"), "");
  assert.equal(strict("Sorted donations at the Tarrant Area Food Bank", "I volunteered at the Tarrant Area Food Bank on Saturday sorting donations"), "");
  assert.equal(strict("Took orders at the drive-thru at Chick-fil-A", "I work at Chick-fil-A taking orders at the drive-thru"), "");
});

test("claims: added words are compared by word family, not by their first 5 letters", async () => {
  const { unsaidWords } = await import("./claims");
  assert.deepEqual(unsaidWords("Accountability for the cash drawer", "Accounted for the cash drawer"), ["accountability"]);
  assert.deepEqual(unsaidWords("Built Tableau dashboards", "Built pivot tables"), ["tableau", "dashboards"]);
  assert.deepEqual(unsaidWords("Sorted donations", "sorting the donated food"), []);
});

test("claims: past tense and role words the student used aren't flagged as new", async () => {
  const { unsaidWords } = await import("./claims");
  assert.deepEqual(unsaidWords("Took orders at the counter", "I take orders at the counter"), []);
  assert.deepEqual(unsaidWords("Made flyers for the club", "I make flyers for the club"), []);
  assert.deepEqual(unsaidWords("Exceeded sales goals", "I exceed my sales goals"), []);
  assert.deepEqual(unsaidWords("Mentorship for new hires", "I mentored new hires"), []);
});

test("claims: agreed/agree are the same word", async () => {
  const { unsaidWords } = await import("./claims");
  assert.deepEqual(unsaidWords("Agreed on a budget", "we agree on a budget"), []);
});

test("checks: the layout check fails for a Word table and is left out when Remy hasn't seen the file", async () => {
  const { atsChecks } = await import("./claims");
  const doc = { contact: { name: "A", email: "a@b.co", phone: "", location: "", links: "" }, sections: [], skills: [] } as any;
  const job = { requirements: [], company: "X" } as any;
  const style = { serif: false, size: 11, margin: 72, pages: 1 };
  assert.equal(atsChecks(doc, job, "f", { ...style, layout: { tables: true, textBoxes: false, columns: false } }).find((c) => c.id === "layout")?.pass, false);
  assert.equal(atsChecks(doc, job, "f", { ...style, layout: { tables: false, textBoxes: false, columns: false } }).find((c) => c.id === "layout")?.pass, true);
  assert.equal(atsChecks(doc, job, "f").find((c) => c.id === "layout"), undefined);
});

test("checks: the font check reads the student's own font and size instead of always passing", async () => {
  const { fontCheck } = await import("./claims");
  const style = { serif: true, size: 10.5, margin: 36, pages: 1 };
  assert.deepEqual(fontCheck(style), []); // font unknown (pasted resume): left out, not passed
  assert.equal(fontCheck({ ...style, font: "Times New Roman" })[0].pass, true);
  assert.equal(fontCheck({ ...style, font: "TimesNewRomanPSMT" })[0].pass, true); // PDF name of the same font
  assert.equal(fontCheck({ ...style, font: "Calibri", size: 11 })[0].pass, true);
  for (const f of ["TrebuchetMS", "BookAntiqua", "PalatinoLinotype-Roman", "CenturyGothic", "ArialMT", "Calibri-Bold", "Garamond-Bold", "Georgia,Bold", "Helvetica-Bold", "HelveticaNeue", "Aptos", "Book Antiqua"])
    assert.equal(fontCheck({ ...style, font: f })[0].pass, true, f);
  assert.doesNotMatch(fontCheck({ ...style, font: "Lobster" })[0].detail, /PDF/); // Remy's own PDF doesn't keep it, so don't say so
  const odd = fontCheck({ ...style, font: "Lobster" })[0];
  assert.equal(odd.pass, false);
  assert.match(odd.detail, /Lobster isn't installed on every computer/);
  const tiny = fontCheck({ ...style, font: "Arial", size: 9 })[0];
  assert.equal(tiny.pass, false);
  assert.match(tiny.detail, /about 9 pt/);
});

// Nov 17 audit: "Draft my pitch" failed 4 of 4 for a thin resume because spoken contractions after a comma
// ("Now, I'm looking") and the school's initials ("TCU" for "Texas Christian University") were flagged as names.
test("pitch speech: contractions and a school's initials are not new names", () => {
  const ev = "Chris Nguyen\nTexas Christian University\nAcademy Sports + Outdoors\nSales Associate\nRan the register and handled cash and card payments\nTarget roles: Financial analyst internship";
  const school = { allowedNames: ["Chris", "Texas Christian University"] };
  for (const s of ["Now, I'm looking for a financial analyst internship.", "At Academy Sports + Outdoors, I've run the register.", "So, I'd like to learn more.", "Honestly, it's been great and I'll keep going."])
    assert.deepEqual(claimCheck(s, ev, school), [], s);
  assert.deepEqual(claimCheck("I'm a sophomore studying finance at TCU.", ev + "\nClass year: Sophomore", school), []);
  assert.deepEqual(claimCheck("I'm studying finance at TCU.", ev, { allowedNames: ["Chris"] }), []); // initials found in the resume itself
  // Still flagged: initials of nothing on file, and real invented names after a contraction.
  assert.ok(claimCheck("I'm studying finance at SMU.", ev, school).some((f) => f.term === "SMU"));
  assert.ok(claimCheck("Now, I've also worked at Goldman Sachs.", ev, school).some((f) => f.term === "Goldman Sachs"));
  // Initials only of one whole name on one line: "University" + "Bachelor of Science" doesn't make "UBS".
  const ev2 = "Texas Christian University\nBachelor of Science in Finance\nDean's List\nCampus Recreation";
  for (const fake of ["UBS", "BFD", "CUB", "LCR"]) assert.ok(claimCheck(`Last year, I worked at ${fake}.`, ev2, school).some((f) => f.term === fake), fake);
});

test("claims (owners): a job simulation isn't a certification in a letter", () => {
  const ev = "J.P. Morgan Investment Banking Job Simulation — Forage\nParticipant\nCERTIFICATIONS\nMicrosoft Office Specialist: Excel & PowerPoint";
  const letter = "I hold a Microsoft Office Specialist certification in Excel and PowerPoint and a J.P. Morgan Investment Banking Job Simulation certification.";
  assert.ok(claimCheck(letter, ev, { owner: true }).some((f) => /simulation/i.test(f.term)));
  assert.ok(!claimCheck(letter, ev).some((f) => /simulation/i.test(f.term))); // students unchanged until the team says so
  assert.ok(!claimCheck("I completed the J.P. Morgan Investment Banking Job Simulation on Forage.", ev, { owner: true }).some((f) => /simulation/i.test(f.term)));
});

test("claims: a resume figure put on something new is flagged", () => {
  const ev = "Nurse Aide\n- Cared for 12 patients a shift\n- Trained 4 new hires";
  assert.ok(claimCheck("Trained 4 new hires across 12 states", ev, { original: "Trained 4 new hires" }).some((f) => f.type === "number"));
  assert.deepEqual(claimCheck("Cared for 12 patients each shift", ev, { original: "Cared for 12 patients a shift" }), []);
  assert.deepEqual(claimCheck("Trained and onboarded 4 new hires", ev, { original: "Trained 4 new hires" }), []);
});
