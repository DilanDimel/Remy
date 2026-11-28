// Transcript reading check (Dilan, Nov 28: "a deep test like the resumes, 10,000s of them, unique, different").
// No server, database or AI needed. Builds transcripts in the layouts US registrars print (Banner, Banner two-column,
// three-up landscape, Banner Self-Service browser prints, PeopleSoft, Workday, Colleague, community-college
// institutional/transfer/combined GPAs, Jenzabar, the CSU mainframe report, quarter schools), on four grade scales
// (A to F, A+ as 4.33, grades out of 100, narrative schools with no GPA), with Parchment cover pages, transcript keys,
// exam credit (AP, CLEP, IB), study abroad, repeats, withdrawals, standing notes and page breaks inside terms.
// Each renders to a real PDF and is read back with the same reader uploads use (fileToText). Checks: every course row
// whole on one line, every printed GPA and the credits inside the reader's window, the GPA guard keeping printed
// numbers and dropping worked-out ones, and scans caught. TRANSCRIPT_CASES=1000 runs the full 12,000 (about 2 minutes).
// With REMY_TRANSCRIPT_AI=1 and the app's AI key it also runs the real reader (TRANSCRIPT_AI_CASES per layout) and
// scores it. Real registrar samples can be added locally with TRANSCRIPT_SAMPLES=<folder of PDFs> (never committed).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { fileToText, norm } from "../server/resume/parse";
import { TRANSCRIPT_WINDOW, isScanned, numbersPrinted, readerSystem, transcriptGrounded, transcriptText } from "../server/resume/transcript";

// ---------- a small seeded random, so every run builds the same transcripts ----------
let seed = 20261128;
const rnd = () => { // mulberry32: a plain LCG in floating point loses precision and repeats after ~1,000 transcripts
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const SCHOOLS = ["Texas Christian University", "University of North Texas", "Baylor University", "Southern Methodist University", "Texas A&M University",
  "University of Texas at Arlington", "San Diego State University", "Ohio State University", "University of Georgia", "Arizona State University",
  "Rochester Institute of Technology", "Indiana University Bloomington", "University of South Carolina", "Purdue University", "Tarrant County College"];
const FIELDS: Record<string, [string, string][]> = {
  Finance: [["FINA", "Financial Management"], ["FINA", "Investments"], ["FINA", "Corporate Finance"], ["FINA", "Financial Modeling"]],
  Accounting: [["ACCT", "Financial Accounting"], ["ACCT", "Managerial Accounting"], ["ACCT", "Intermediate Accounting I"], ["ACCT", "Federal Income Tax"]],
  "Business Information Systems": [["INSC", "Business Information Systems"], ["INSC", "Database Management"], ["INSC", "Business Analytics"]],
  Marketing: [["MARK", "Principles of Marketing"], ["MARK", "Consumer Behavior"], ["MARK", "Digital Marketing"]],
  "Computer Science": [["COSC", "Programming I"], ["COSC", "Data Structures"], ["COSC", "Algorithms"], ["COSC", "Operating Systems"]],
  Psychology: [["PSYC", "General Psychology"], ["PSYC", "Research Methods"], ["PSYC", "Social Psychology"]],
  Nursing: [["NURS", "Health Assessment"], ["NURS", "Pharmacology"], ["NURS", "Adult Health I"]],
  Economics: [["ECON", "Principles of Microeconomics"], ["ECON", "Principles of Macroeconomics"], ["ECON", "Econometrics"]],
};
const CORE: [string, string][] = [["ENGL", "Composition I"], ["MATH", "Calculus I"], ["HIST", "American History"], ["POSC", "American Government"],
  ["COMM", "Public Speaking"], ["BIOL", "General Biology"], ["PHIL", "Ethics"], ["SPAN", "Elementary Spanish I"], ["MATH", "Statistics"]];
const GRADES: [string, number][] = [["A", 4], ["A-", 3.67], ["B+", 3.33], ["B", 3], ["B-", 2.67], ["C+", 2.33], ["C", 2], ["D", 1]];

// Grade scales seen on US transcripts: the usual A to F on 4.00, schools that give A+ as 4.33 (GPAs above 4.00),
// number grades out of 100 with a cumulative average, and narrative schools that give credit with a written evaluation
// and print no GPA at all (Evergreen, Hampshire, New College).
const PLUS: [string, number][] = [["A+", 4.33], ...GRADES];
const SCALES = ["standard", "standard", "standard", "plus", "percent", "narrative"] as const;
type Scale = (typeof SCALES)[number];
const EVALS = ["Evaluation: Jordan wrote with growing confidence and led two seminar discussions.", "Evaluation: careful, steady work; the final project was the strongest in the section.",
  "Evaluation: met every learning goal; lab reports improved across the term."];
const ABROAD = ["Universidad de Salamanca, Spain", "University College London, England", "Sciences Po, France", "Kansai Gaidai University, Japan"];

type Course = { code: string; title: string; grade: string; credits: number; points: number; counts: boolean; val: number; mark?: string };
type Term = { name: string; courses: Course[]; inProgress?: boolean; honors?: string; note?: string; abroad?: string };
type Truth = { school: string; majors: string[]; minors: string[]; gpa: string; transferGpa?: string; overallGpa?: string; majorGpa?: string; credits: string; quarters: boolean;
  courses: { code: string; grade: string }[]; taking: string[]; honors: string[]; withdrawn: string[]; probation: boolean };

const LAYOUTS = ["banner", "banner2col", "peoplesoft", "workday", "colleague", "jenzabar", "csu", "quarter", "landscape", "threecol", "selfservice", "community"] as const;
type Layout = (typeof LAYOUTS)[number];
type Case = { id: string; layout: Layout; scale: Scale; parchment: boolean; key: boolean; scanned: boolean; decimals: 2 | 3; terms: Term[]; truth: Truth; fakeGpa: string;
  exams: boolean; pageLen: number; font: string; fontSize: number };
const fmt = (c: Case) => [c.layout, c.scale, c.font, c.fontSize, c.decimals, c.parchment, c.key, c.exams, c.pageLen, !!c.truth.overallGpa, !!c.truth.majorGpa, c.truth.minors.length, c.truth.majors.length,
  c.terms.some((t) => t.abroad), c.truth.probation, c.truth.taking.length > 0, c.truth.quarters].join("|");

function grade(scale: Scale): [string, number, number] { // [what's printed, points per credit, value for a plain average]
  if (scale === "percent") { const n = int(62, 100); return [String(n), n, n]; }
  if (scale === "narrative") return rnd() < 0.93 ? ["CR", 0, 0] : ["NC", 0, 0];
  const [g, p] = pick(scale === "plus" ? PLUS : GRADES);
  return [g, p, p];
}

function makeCase(i: number, layout: Layout): Case {
  const scale: Scale = layout === "csu" ? "standard" : pick(SCALES);
  const quarters = layout === "quarter" || (layout === "workday" && rnd() < 0.2);
  const majors = rnd() < 0.3 ? [pick(Object.keys(FIELDS)), pick(Object.keys(FIELDS))].filter((x, k, a) => a.indexOf(x) === k) : [pick(Object.keys(FIELDS))];
  const minors = rnd() < 0.35 ? [pick(Object.keys(FIELDS).filter((f) => !majors.includes(f)))] : [];
  const pool = [...majors.flatMap((m) => FIELDS[m]), ...minors.flatMap((m) => FIELDS[m]), ...CORE];
  const years = int(1, 4), perYear = quarters ? 3 : 2;
  const seasons = quarters ? ["Fall", "Winter", "Spring"] : ["Fall", "Spring"];
  const start = 2026 - years;
  const terms: Term[] = [];
  const used = new Set<string>();
  let n = 100 + int(0, 50);
  for (let y = 0; y < years; y++) for (let s = 0; s < perYear; s++) {
    const year = start + y + (s > 0 ? 1 : 0);
    const courses: Course[] = [];
    for (let c = 0; c < int(3, 5); c++) {
      const [subj, title] = pick(pool);
      const code = `${subj} ${y + 1}${String(n++).slice(-3)}`;
      if (used.has(code)) continue;
      used.add(code);
      const credits = quarters ? 4 : pick([3, 3, 3, 4, 1]);
      const roll = rnd();
      if (roll < 0.05) courses.push({ code, title, grade: "W", credits, points: 0, counts: false, val: 0 });
      else if (roll < 0.1 && scale !== "narrative") courses.push({ code, title, grade: pick(["P", "CR", "S"]), credits, points: 0, counts: false, val: 0 });
      else { const [g, p, v] = grade(scale); courses.push({ code, title, grade: g, credits, points: +(p * credits).toFixed(2), counts: scale !== "narrative", val: v }); }
    }
    if (rnd() < 0.15 && courses.length && scale !== "narrative") { // a retaken course: first try marked excluded, the new grade counts
      const first = courses[0];
      first.mark = layout === "peoplesoft" ? "Repeated" : "E";
      first.counts = false;
      const top = scale === "percent" ? 95 : 4;
      const again = { ...first, grade: scale === "percent" ? "95" : "A", points: top * first.credits, val: top, counts: true, mark: layout === "peoplesoft" ? "" : "I" };
      courses.push(again);
    }
    const t: Term = { name: `${seasons[s]} ${year}`, courses };
    const r = rnd();
    if (r < 0.18 && scale !== "narrative") t.honors = pick(["Dean's List", "Dean's List", "President's List", "Chancellor's List", "Dean's Honor Roll"]);
    else if (r < 0.23) t.note = pick(["Academic Probation", "Academic Warning", "Good Standing Restored"]);
    terms.push(t);
  }
  if (rnd() < 0.12 && terms.length > 2) { // a study-abroad term: transfer courses, graded TR, outside the GPA
    const at = int(1, terms.length - 1);
    const courses = [0, 1, 2].map((k): Course => { const [subj, title] = pick(CORE); return { code: `${subj} ${3900 + k * 11 + int(0, 9)}`, title: `${title} (Abroad)`, grade: "TR", credits: 3, points: 0, counts: false, val: 0 }; });
    terms.splice(at, 0, { name: `Summer ${start + at}`, courses, abroad: pick(ABROAD) });
  }
  const now: Term = { name: `Spring ${2027}`, inProgress: true, courses: [] };
  if (rnd() < 0.6) for (let c = 0; c < int(2, 4); c++) { const [subj, title] = pick(pool); now.courses.push({ code: `${subj} 4${n++}`, title, grade: "IP", credits: 3, points: 0, counts: false, val: 0 }); }
  if (now.courses.length) terms.push(now);
  const decimals = scale === "percent" ? 2 : pick([2, 3] as const);
  const graded = terms.flatMap((t) => t.courses).filter((c) => c.counts);
  const hrs = graded.reduce((a, c) => a + c.credits, 0), pts = graded.reduce((a, c) => a + c.points, 0);
  const transfer = rnd() < 0.35 ? int(3, 30) : 0;
  const abroadHrs = terms.filter((t) => t.abroad).reduce((a, t) => a + t.courses.length * 3, 0);
  const earned = terms.flatMap((t) => t.courses).filter((c) => !["W", "IP", "NC", "TR"].includes(c.grade) && c.mark !== "E" && c.mark !== "Repeated").reduce((a, c) => a + c.credits, 0) + transfer + abroadHrs;
  const gpaNum = hrs ? Math.floor((pts / hrs) * 1000) / 1000 : 0; // registrars truncate, they don't round
  const gpa = scale === "narrative" ? "" : gpaNum.toFixed(decimals);
  const transferGpa = transfer && scale !== "narrative" ? (scale === "percent" ? (80 + rnd() * 19).toFixed(2) : (3 + rnd()).toFixed(2)) : undefined;
  // Community colleges and many transfer-heavy schools print institutional, transfer and overall GPAs together.
  const overall = transferGpa && (layout === "community" || rnd() < 0.3)
    ? (Math.floor(((pts + Number(transferGpa) * transfer) / (hrs + transfer)) * 1000) / 1000).toFixed(decimals) : undefined;
  const majorPts = graded.filter((c) => majors.some((m) => FIELDS[m].some(([s]) => c.code.startsWith(s))));
  const majorGpa = scale !== "narrative" && majorPts.length > 2 && rnd() < 0.2
    ? (Math.floor((majorPts.reduce((a, c) => a + c.points, 0) / majorPts.reduce((a, c) => a + c.credits, 0)) * 1000) / 1000).toFixed(decimals) : undefined;
  // A GPA an AI might "work out" itself: the plain average of letter grades, rounded. Unless it happens to be printed, the guard must drop it.
  const plain = graded.length ? graded.reduce((a, c) => a + c.val, 0) / graded.length : 0;
  const latest = (code: string) => terms.flatMap((t) => t.courses).filter((c) => c.code === code).pop()!;
  const done = terms.filter((t) => !t.inProgress && !t.abroad).flatMap((t) => t.courses);
  return {
    id: `${layout}-${String(i).padStart(4, "0")}`, layout, scale, decimals, terms,
    parchment: rnd() < 0.3, key: rnd() < 0.5, scanned: false, exams: rnd() < 0.25,
    pageLen: rnd() < 0.3 ? int(380, 560) : 740, // short pages split terms across page breaks, with a header on each page
    font: layout === "csu" ? "Courier" : pick(["Helvetica", "Times-Roman", "Courier", "Helvetica", "Times-Roman"]),
    fontSize: layout === "csu" ? 7.5 : pick([7.5, 8, 8.5, 9]),
    fakeGpa: (Math.round(plain * 100) / 100 + 0.01).toFixed(2),
    truth: {
      school: pick(SCHOOLS), majors, minors, gpa, quarters, transferGpa, overallGpa: overall, majorGpa,
      credits: earned.toFixed(decimals),
      courses: [...new Set(done.filter((c) => c.grade !== "W").map((c) => c.code))].map((code) => ({ code, grade: latest(code).grade })),
      taking: now.courses.map((c) => c.code),
      honors: terms.filter((t) => t.honors).map((t) => `${t.honors} ${t.name}`),
      withdrawn: done.filter((c) => c.grade === "W" && latest(c.code).grade === "W").map((c) => c.code), // a W retaken later is a course again
      probation: terms.some((t) => t.note && /Probation|Warning/.test(t.note)),
    },
  };
}

// ---------- rendering: each layout prints rows of [x, text] cells, the way registrar systems place columns ----------
type Row = [number, string][];
const f = (n: number, d: number) => n.toFixed(d);
function termRows(c: Case, t: Term, x0: number, narrow = false): Row[] {
  const rows = layoutRows(c, t, x0, narrow);
  // Lines every system can add under a term: a standing note, a study-abroad school, a narrative evaluation.
  if (t.abroad) rows.splice(1, 0, [[x0, `Study Abroad: ${t.abroad}  (transfer credit, not in GPA)`]]);
  if (t.note) rows.push([[x0, `Academic Standing: ${t.note}`]]);
  if (c.scale === "narrative" && !narrow) for (let i = rows.length - 1; i > 0; i--) if (rows[i].length > 3 && rnd() < 0.5) rows.splice(i + 1, 0, [[x0 + 20, pick(EVALS)]]);
  return rows;
}
function layoutRows(c: Case, t: Term, x0: number, narrow: boolean): Row[] {
  const d = c.decimals, rows: Row[] = [];
  const gpaHrs = t.courses.filter((k) => k.counts).reduce((a, k) => a + k.credits, 0);
  const tp = t.courses.filter((k) => k.counts).reduce((a, k) => a + k.points, 0);
  const tg = gpaHrs ? f(Math.floor((tp / gpaHrs) * 1000) / 1000, d) : f(0, d);
  const year = t.name.split(" ")[1], season = t.name.split(" ")[0];
  const nogpa = c.scale === "narrative";
  const base = c.layout === "landscape" || c.layout === "threecol" || c.layout === "selfservice" ? "banner" : c.layout === "community" ? "colleague" : c.layout;
  const w = c.layout === "landscape" ? 1.35 : c.layout === "threecol" ? 0.86 : 1; // landscape spreads columns, three-up squeezes them
  const X = (dx: number) => x0 + Math.round(dx * w);
  switch (base) {
    case "banner": case "banner2col": {
      rows.push([[x0, c.layout === "selfservice" ? `Academic Term : ${t.name}` : `Term: ${t.name}`]]);
      if (!narrow) rows.push([[X(0), "Subject"], [X(50), "Course"], [X(95), "Level"], [X(130), "Title"], [X(330), "Grade"], [X(370), "Credit Hours"], [X(440), "Quality Points"], [X(510), "R"]]);
      for (const k of t.courses) {
        const [subj, num] = k.code.split(" ");
        rows.push(narrow
          ? [[X(0), subj], [X(32), num], [X(62), k.title.slice(0, 22)], [X(185), k.grade], [X(210), f(k.credits, d)], [X(245), k.counts ? f(k.points, d) : ""], [X(278), k.mark || ""]]
          : [[X(0), subj], [X(50), num], [X(95), "UG"], [X(130), k.title], [X(330), k.grade], [X(370), f(k.credits, d)], [X(440), k.counts ? f(k.points, d) : ""], [X(510), k.mark || ""]]);
      }
      if (!t.inProgress && !nogpa) rows.push([[x0, "Term Totals"], [X(narrow ? 120 : 200), `GPA Hours ${f(gpaHrs, d)}`], [X(narrow ? 210 : 330), `GPA ${tg}`]]);
      if (t.honors) rows.push([[x0, `Term Comments: ${t.honors}`]]);
      break;
    }
    case "peoplesoft":
      rows.push([[x0, `${year} ${season}`]]);
      rows.push([[x0, "Course"], [x0 + 75, "Description"], [x0 + 290, "Attempted"], [x0 + 350, "Earned"], [x0 + 405, "Grade"], [x0 + 450, "Points"]]);
      for (const k of t.courses) rows.push([[x0, k.code], [x0 + 75, k.title + (k.mark ? ` (${k.mark})` : "")], [x0 + 290, f(k.credits, 3)], [x0 + 350, k.grade === "W" || k.grade === "IP" ? f(0, 3) : f(k.credits, 3)], [x0 + 405, k.grade], [x0 + 450, f(k.points, 3)]]);
      if (!t.inProgress && !nogpa) rows.push([[x0, "Term GPA"], [x0 + 75, tg.padEnd(5, "0")], [x0 + 200, "Term Totals"], [x0 + 290, f(gpaHrs, 3)]]);
      if (t.honors) rows.push([[x0, t.honors]]);
      break;
    case "workday":
      rows.push([[x0, `${year} ${season} ${c.truth.quarters ? "Quarter" : "Semester"}`]]);
      rows.push([[x0, "Course"], [x0 + 80, "Description"], [x0 + 300, "Attempted"], [x0 + 360, "Earned"], [x0 + 415, "Grade"], [x0 + 460, "Points"]]);
      for (const k of t.courses) rows.push([[x0, k.code.replace(" ", "_")], [x0 + 80, k.title], [x0 + 300, f(k.credits, 2)], [x0 + 360, k.grade === "W" || k.grade === "IP" ? "0.00" : f(k.credits, 2)], [x0 + 415, k.grade], [x0 + 460, f(k.points, 2)]]);
      if (!t.inProgress && !nogpa) rows.push([[x0, "Period GPA"], [x0 + 80, tg]]);
      if (t.honors) rows.push([[x0, `Academic Honors: ${t.honors}`]]);
      break;
    case "colleague":
      rows.push([[x0, `${year.slice(2)}/${season.slice(0, 2).toUpperCase()}  ${t.name}`]]);
      for (const k of t.courses) rows.push([[x0, k.code.replace(" ", "-")], [x0 + 80, k.title.toUpperCase()], [x0 + 300, k.grade], [x0 + 340, f(k.credits, 2)], [x0 + 390, k.grade === "W" ? "0.00" : f(k.credits, 2)], [x0 + 440, f(k.points, 2)]]);
      if (!t.inProgress && !nogpa) rows.push([[x0, c.layout === "community" ? "Term Inst GPA:" : "Term GPA:"], [x0 + 60, tg]]);
      if (t.honors) rows.push([[x0, t.honors.toUpperCase()]]);
      break;
    case "jenzabar":
      rows.push([[x0, t.name.toUpperCase()]]);
      for (const k of t.courses) rows.push([[x0, k.code], [x0 + 70, k.title], [x0 + 300, k.grade], [x0 + 340, f(k.credits, 2)], [x0 + 390, f(k.points, 2)]]);
      if (!t.inProgress && !nogpa) rows.push([[x0, `SEMESTER: ATT ${f(gpaHrs, 2)}  GPA ${tg}`]]);
      if (t.honors) rows.push([[x0, `*** ${t.honors.toUpperCase()} ***`]]);
      break;
    case "csu":
      rows.push([[x0, `${season.toUpperCase()} ${year}`], [x0 + 330, "UA"], [x0 + 360, "UE"], [x0 + 390, "GRADE"], [x0 + 430, "PTS"]]);
      for (const k of t.courses) rows.push([[x0, k.code.replace(" ", "   ")], [x0 + 90, k.title.toUpperCase().slice(0, 25)], [x0 + 330, f(k.credits, 1)], [x0 + 360, f(k.credits, 1)], [x0 + 390, k.grade], [x0 + 430, f(k.points, 1)]]);
      if (!t.inProgress) rows.push([[x0, "TERM TOTALS:"], [x0 + 330, f(gpaHrs, 1)], [x0 + 430, `GPA: ${f(Math.floor((tp / (gpaHrs || 1)) * 100) / 100, 2)}`]]);
      if (t.honors) rows.push([[x0, `** ${t.honors.toUpperCase()} **`]]);
      break;
    case "quarter":
      rows.push([[x0, `${t.name} Quarter`]]);
      for (const k of t.courses) rows.push([[x0, k.code], [x0 + 70, k.title], [x0 + 290, f(k.credits, 1)], [x0 + 330, k.grade], [x0 + 370, f(k.points, 1)]]);
      if (!t.inProgress && !nogpa) rows.push([[x0, "Quarter GPA"], [x0 + 70, tg]]);
      if (t.honors) rows.push([[x0, t.honors]]);
  }
  return rows;
}

const KEY = ["TRANSCRIPT KEY", "Grading System: A 4.00, A- 3.67, B+ 3.33, B 3.00, B- 2.67, C+ 2.33, C 2.00, C- 1.67, D+ 1.33, D 1.00, F 0.00",
  "W Withdrawal. P Pass. CR Credit. IP In Progress. I Incomplete. E Excluded from GPA (course repeated). I Included in GPA.",
  "Credit: One semester hour equals 1.50 quarter hours. Quarter hours convert to semester hours at 0.6666667.",
  "Academic Honors: Dean's List requires a term GPA of 3.50 on at least 12.00 graded hours.",
  "This transcript is official only when it bears the seal of the University and the signature of the Registrar."];
const PARCHMENT = ["How to Authenticate This Official PDF Transcript", "This official PDF transcript has been transmitted electronically to the recipient, and is intended solely for use by that recipient.",
  "This document will reveal a digital certificate that has been applied to the transcript. The blue ribbon is your assurance that the digital certificate is valid.",
  "ABOUT PARCHMENT: Parchment is an academic credential management company, specializing in delivery of official electronic credentials."];

function headerRows(c: Case): Row[] {
  const t = c.truth, d = c.decimals;
  const rows: Row[] = [[[50, c.layout === "csu" ? `${t.school.toUpperCase()}  Unofficial Transcript` : t.school]], [[50, c.layout === "workday" ? "Academic Record" : "Unofficial Academic Transcript"]], [[50, "Student Name:"], [140, "Jordan Q. Rivera"]]];
  const plan = (m: string) => (c.layout === "peoplesoft" ? `Plan: ${m} Major` : c.layout === "workday" ? `Program of Study: ${m} (BBA)` : c.layout === "csu" ? `MAJOR: ${m.toUpperCase()}` : `Major: ${m}`);
  for (const m of t.majors) rows.push([[50, plan(m)]]);
  for (const m of t.minors) rows.push([[50, c.layout === "peoplesoft" ? `Plan: ${m} Minor` : `Minor: ${m}`]]);
  if (t.transferGpa) rows.push([[50, "Transfer Credit"]], [[50, "Advanced Placement Exam"], [300, "Earned"], [360, f(Number(t.credits) > 6 ? 6 : 3, d)]], [[50, "Tarrant County College"], [300, "GPA"], [360, t.transferGpa]]);
  if (c.exams) rows.push([[50, "Credit by Examination"]], ...pick([[["CLEP", "College Algebra"], ["AP", "English Language and Composition"]], [["IB", "Higher Level Biology"], ["AP", "Calculus BC"]], [["CLEP", "Spanish Language"], ["DSST", "Principles of Supervision"]]]).map(([e, n]): Row => [[60, `${e} ${n}`], [300, "CR"], [360, f(3, d)]]));
  return rows;
}
function totalsRows(c: Case): Row[] {
  const t = c.truth;
  const lab = c.layout === "peoplesoft" ? ["Cum GPA", "Cum Totals Earned"] : c.layout === "workday" ? ["Cumulative GPA", "Cumulative Earned Credits"] : c.layout === "csu" ? ["OVERALL CUMULATIVE TOTALS: GPA:", "UNITS EARNED"]
    : c.layout === "jenzabar" ? ["CUMULATIVE: GPA", "ERN"] : c.layout === "colleague" ? ["Cum GPA:", "Cum Cred Cmpl:"] : ["Overall GPA", "Overall Earned Hours"];
  const rows: Row[] = [[[50, c.layout.startsWith("banner") || c.layout === "selfservice" ? "TRANSCRIPT TOTALS (UNDERGRADUATE)" : "Totals"]]];
  if (c.scale === "percent") lab[0] = pick(["Cumulative Average", "Cumulative Weighted Average", "Overall Average (out of 100)"]);
  if (t.overallGpa) rows.push([[50, c.layout === "community" ? "Institutional GPA" : "Institution GPA"], [300, t.gpa]], [[50, "Transfer GPA"], [300, t.transferGpa!]], [[50, c.layout === "community" ? "Combined GPA" : "Overall GPA"], [300, t.overallGpa]]);
  else {
    if (t.transferGpa && (c.layout.startsWith("banner") || c.layout === "selfservice")) rows.push([[50, "Total Transfer"], [300, `GPA ${t.transferGpa}`]]);
    if (t.gpa) rows.push([[50, lab[0]], [300, t.gpa]]);
  }
  if (t.majorGpa) rows.push([[50, "Major GPA"], [300, t.majorGpa]]);
  if (c.scale === "narrative") rows.push([[50, "This college does not compute a grade point average. Written evaluations are part of the record."]]);
  rows.push([[50, lab[1]], [300, t.credits]], [[50, "*** END OF TRANSCRIPT ***"]]);
  return rows;
}

async function render(c: Case): Promise<Buffer> {
  const wide = c.layout === "landscape" || c.layout === "threecol";
  const doc = new PDFDocument({ size: "LETTER", layout: wide ? "landscape" : "portrait", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (b: Buffer) => chunks.push(b));
  const done = new Promise<void>((r) => doc.on("end", () => r()));
  doc.font(c.font).fontSize(c.layout === "threecol" ? 6.5 : c.fontSize);
  const bottom = Math.min(c.pageLen, wide ? 560 : 740);
  let y = 50, page = 1;
  // A browser-printed self-service page carries the print date and the portal address on every page.
  const chrome = () => { if (c.layout === "selfservice") { doc.text(`11/28/26, 3:14 PM    Academic Transcript`, 30, 20, { lineBreak: false }); doc.text(`https://selfservice.school.edu/StudentSelfService/ssb/academicTranscript  ${page}/${page + 1}`, 30, 770, { lineBreak: false }); } };
  chrome();
  const line = (row: Row) => {
    if (y > bottom) { doc.addPage(); page++; y = 50; chrome(); doc.text(`${c.truth.school}  Page ${page}`, 40, 30, { lineBreak: false }); }
    for (const [x, s] of row) if (s) doc.text(s, x, y, { lineBreak: false });
    y += c.layout === "threecol" ? 9 : 12;
  };
  if (c.parchment) { for (const p of PARCHMENT) line([[40, p.slice(0, 120)]]); doc.addPage(); y = 50; }
  for (const r of headerRows(c)) line(r);
  y += 6;
  if (c.layout === "banner2col" || c.layout === "threecol") { // terms side by side, as on many official paper transcripts
    const xs = c.layout === "threecol" ? [30, 290, 550] : [40, 320];
    for (let i = 0; i < c.terms.length; i += xs.length) {
      const cols = xs.map((x, k) => (c.terms[i + k] ? termRows(c, c.terms[i + k], x, true) : []));
      for (let k = 0; k < Math.max(...cols.map((x) => x.length)); k++) line(cols.flatMap((col) => col[k] || []));
      y += 6;
    }
  } else for (const t of c.terms) { if (t.inProgress) line([[50, c.layout === "peoplesoft" ? "Courses in Progress" : "Course(s) in Progress"]]); for (const r of termRows(c, t, 50)) line(r); y += 6; }
  for (const r of totalsRows(c)) line(r);
  if (c.key) { doc.addPage(); y = 50; for (const k of KEY) line([[40, k]]); }
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
/** A scan: the page is a picture, so there's no text in the PDF at all. */
async function scannedPdf(): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (b: Buffer) => chunks.push(b));
  const done = new Promise<void>((r) => doc.on("end", () => r()));
  for (let i = 0; i < 40; i++) doc.rect(40, 50 + i * 16, 300 + (i % 5) * 40, 6).fill("#333333");
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

// ---------- checks ----------
const failures: string[] = [];
const tally: Record<string, { cases: number; ok: number }> = {};
const lineWith = (text: string, a: string, b: string) => text.split("\n").map((l) => l.replace(/\s+/g, " ")).some((l) => l.includes(a.replace(/\s+/g, " ")) && new RegExp(`(^|\\s)${b.replace(/[+]/g, "\\+")}(\\s|$)`).test(l));
const codeIn = (c: Case, code: string) => (c.layout === "workday" ? code.replace(" ", "_") : c.layout === "colleague" || c.layout === "community" ? code.replace(" ", "-") : c.layout === "csu" ? code.replace(" ", "   ")
  : c.layout.startsWith("banner") || ["landscape", "threecol", "selfservice"].includes(c.layout) ? code.split(" ")[1] : code);

async function check(c: Case) {
  const errs: string[] = [];
  const raw = await fileToText(await render(c), `${c.id}.pdf`, "application/pdf");
  if (process.env.DUMP === c.id) { console.log(raw); if (process.env.DUMP_PDF) fs.writeFileSync(process.env.DUMP_PDF, await render(c)); }
  const text = transcriptText(raw);
  if (text.length > TRANSCRIPT_WINDOW) errs.push(`over the reader's window (${text.length} chars)`);
  const seen = text.slice(0, TRANSCRIPT_WINDOW);
  const t = c.truth;
  if (!seen.toUpperCase().includes(t.school.toUpperCase())) errs.push("school name missing");
  for (const m of t.majors) if (!seen.toUpperCase().includes(m.toUpperCase())) errs.push(`major ${m} missing`);
  for (const g of [t.gpa, t.overallGpa, t.majorGpa]) if (g && !seen.includes(g)) errs.push(`GPA ${g} not in what the reader sees`);
  if (!seen.includes(t.credits)) errs.push(`earned credits ${t.credits} not in what the reader sees`);
  for (const k of t.courses) {
    const term = c.terms.find((x) => x.courses.some((y) => y.code === k.code))!;
    const row = term.courses.filter((y) => y.code === k.code).pop()!;
    if (!lineWith(seen, codeIn(c, k.code), row.grade)) errs.push(`course ${k.code} and its grade ${row.grade} not on one line`);
  }
  if (t.gpa && !numbersPrinted(`Cumulative GPA ${t.gpa}`, raw)) errs.push("guard dropped the printed GPA");
  if (!numbersPrinted(`Total earned credits ${t.credits}`, raw)) errs.push("guard dropped the printed credits");
  const fakePrinted = (raw.match(/\d+\.\d+/g) || []).some((n) => Number(n) === Number(c.fakeGpa)); // 2.70 is "printed" when a 2.7 is
  if (!fakePrinted && numbersPrinted(`Cumulative GPA ${c.fakeGpa}`, raw)) errs.push(`guard kept a worked-out GPA ${c.fakeGpa}`);
  if (c.parchment && /How to Authenticate|ABOUT PARCHMENT/.test(text)) errs.push("Parchment cover page left in");
  if (c.key && /^TRANSCRIPT KEY/m.test(text)) errs.push("transcript key page left in");
  tally[c.layout] ??= { cases: 0, ok: 0 };
  tally[c.layout].cases++;
  if (errs.length) failures.push(`${c.id}${c.parchment ? " (Parchment)" : ""}${c.key ? " (key)" : ""}: ${errs.slice(0, 4).join("; ")}${errs.length > 4 ? ` (+${errs.length - 4})` : ""}`);
  else tally[c.layout].ok++;
}

const PER_LAYOUT = Number(process.env.TRANSCRIPT_CASES || 40);
const cases = LAYOUTS.flatMap((l) => Array.from({ length: PER_LAYOUT }, (_, i) => makeCase(i, l)));
for (const c of cases) await check(c);

// A scan has no text: the upload must say so plainly instead of "something went wrong".
const scan = await fileToText(await scannedPdf(), "scan.pdf", "application/pdf").catch((e) => `ERROR ${e.message}`);
assert(isScanned(scan), `a scanned transcript should be caught (got ${JSON.stringify(scan.slice(0, 60))})`);

// Real registrar samples, read locally only.
const samples = process.env.TRANSCRIPT_SAMPLES;
if (samples) for (const name of fs.readdirSync(samples).filter((x) => /\.pdf$/i.test(x))) {
  const raw = await fileToText(fs.readFileSync(path.join(samples, name)), name, "application/pdf").catch((e) => `ERROR ${e.message}`);
  const text = transcriptText(raw);
  console.log(`  sample ${name}: ${isScanned(raw) ? "scan (no text): student is told to download the PDF from their portal" : `${raw.length} chars, ${text.length} after cleanup${text.length > TRANSCRIPT_WINDOW ? " OVER WINDOW" : ""}`}`);
}

// ---------- the real reader (REMY_TRANSCRIPT_AI=1, OPENROUTER_API_KEY and OR_AI_CHAIN set) ----------
type Fact = { text: string; category: string; quote: string };
const score: Record<string, number> = {};
const misses: Record<string, string[]> = {};
const add = (k: string, ok: boolean, id: string) => { score[k + (ok ? ":ok" : ":no")] = (score[k + (ok ? ":ok" : ":no")] || 0) + 1; if (!ok) (misses[k] ??= []).push(id); };
const flat = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const digits = (code: string) => code.replace(/\D/g, "");
async function readWithAi(c: Case, raw: string) {
  const { aiJson } = await import("../server/ai/ai");
  const text = transcriptText(raw).slice(0, TRANSCRIPT_WINDOW);
  const out = await aiJson<{ facts: Fact[] }>(readerSystem(true, false),
    `Source: Transcript\nRESUME AND PROFILE (for spotting disagreements only):\n(empty)\n(no resume)\n\nReturn {"facts":[{"text":"","category":"background|goal|preference|skill|experience|constraint|other","quote":"exact words","conflict":"","notOnResume":false}]} with at most 30 facts.\n\nTEXT:\n"""${text}"""`, 8000);
  // The same two filters the server applies: the quote must be in the text, and every decimal must be printed.
  const n = norm(raw);
  const grounded = (x: Fact) => !x.quote || n.includes(norm(x.quote).slice(0, 80)) || transcriptGrounded(String(x.text || ""), x.quote, raw);
  for (const x of out.facts || []) { if (!grounded(x)) score["dropped:quote"] = (score["dropped:quote"] || 0) + 1; else if (!numbersPrinted(String(x.text || ""), raw)) score["dropped:number"] = (score["dropped:number"] || 0) + 1; }
  const kept = (out.facts || []).filter((x) => grounded(x) && numbersPrinted(String(x.text || ""), raw));
  const all = kept.map((x) => x.text).join("\n");
  if (process.env.AI_SHOW?.split(",").includes(c.id)) console.log(`\n=== ${c.id}\n${(out.facts || []).map((x) => (kept.includes(x) ? "  " + x.text : `x ${x.text}  [quote: ${x.quote}]`)).join("\n")}\nTRUTH ${JSON.stringify(c.truth)}`);
  const t = c.truth;
  add("school", flat(all).includes(flat(t.school)), c.id);
  add("majors", t.majors.every((m) => flat(all).includes(flat(m))), c.id);
  const G = "(gpa|grade point average|average)";
  const gpaFacts = kept.filter((x) => new RegExp(`\\b${G}\\b`, "i").test(x.text));
  if (t.gpa) add("gpa", gpaFacts.some((x) => x.text.includes(t.gpa) && !/transfer|\bterm\b|semester|period|quarter|major/i.test(x.text.split(t.gpa)[0].slice(-40))), c.id);
  else add("no GPA made up", !gpaFacts.some((x) => /\d\.\d/.test(x.text)), c.id);
  if (t.overallGpa) add("every GPA kept", [t.gpa, t.overallGpa, t.transferGpa!].every((g) => gpaFacts.some((x) => x.text.includes(g))), c.id);
  if (t.majorGpa) add("major GPA labeled", gpaFacts.some((x) => /major/i.test(x.text) && x.text.includes(t.majorGpa!)), c.id);
  if (t.probation) add("standing left out", !kept.some((x) => /probation|warning/i.test(x.text)), c.id);
  add("credits", all.includes(t.credits) || all.includes(String(Number(t.credits))), c.id);
  const courseText = kept.filter((x) => !/taking now|in progress/i.test(x.text)).map((x) => x.text).join("\n");
  const found = t.courses.filter((k) => courseText.includes(digits(k.code))).length;
  score["courses:found"] = (score["courses:found"] || 0) + found;
  if (found < t.courses.length) (misses.courses ??= []).push(`${c.id} ${found}/${t.courses.length}`);
  score["courses:all"] = (score["courses:all"] || 0) + t.courses.length;
  const wrongGrade = t.courses.filter((k) => { const m = courseText.match(new RegExp(`${digits(k.code)}[^,;\\n]*?\\((\\w+[+-]?)\\)`)); return m && m[1] !== k.grade; }).length;
  score["courses:wrongGrade"] = (score["courses:wrongGrade"] || 0) + wrongGrade;
  if (t.withdrawn.length) add("withdrawn left out", !t.withdrawn.some((w) => courseText.includes(digits(w))), c.id);
  if (t.taking.length) add("taking now", t.taking.every((k) => all.includes(digits(k))), c.id);
  if (t.honors.length) add("honors", /(dean|president|chancellor)'?s (list|honor roll)/i.test(all), c.id);
}
if (process.env.REMY_TRANSCRIPT_AI === "1") {
  const n = Number(process.env.TRANSCRIPT_AI_CASES || 8); // per layout
  const ids = process.env.TRANSCRIPT_AI_IDS?.split(",");
  const run = ids ? cases.filter((c) => ids.includes(c.id)) : LAYOUTS.flatMap((l) => cases.filter((c) => c.layout === l).slice(0, n));
  let failed = 0;
  const par = Number(process.env.TRANSCRIPT_AI_PARALLEL || 6);
  for (let i = 0; i < run.length; i += par) {
    await Promise.all(run.slice(i, i + par).map(async (c) => {
      try { await readWithAi(c, await fileToText(await render(c), `${c.id}.pdf`, "application/pdf")); }
      catch (e) { failed++; console.log(`  ${c.id}: AI error ${(e as Error).message.slice(0, 120)}`); }
    }));
  }
  console.log(`\nReal reader on ${run.length} transcripts (${failed} AI errors):`);
  for (const k of ["school", "majors", "gpa", "no GPA made up", "every GPA kept", "major GPA labeled", "credits", "withdrawn left out", "taking now", "honors", "standing left out"]) {
    const ok = score[k + ":ok"] || 0, no = score[k + ":no"] || 0;
    if (ok + no) console.log(`  ${k.padEnd(19)} ${ok}/${ok + no}${no ? `  missed: ${misses[k].slice(0, 8).join(", ")}` : ""}`);
  }
  console.log(`  courses found      ${score["courses:found"] || 0}/${score["courses:all"] || 0}, wrong grade on ${score["courses:wrongGrade"] || 0}`);
  console.log(`  facts dropped      ${score["dropped:quote"] || 0} with a quote not in the text, ${score["dropped:number"] || 0} with a number not printed`);
  if (misses.courses) console.log(`  courses missed in  ${misses.courses.length} transcripts: ${misses.courses.slice(0, 30).join(", ")}`);
}

console.log(`Transcript check: ${cases.length} transcripts in ${LAYOUTS.length} layouts, ${new Set(cases.map(fmt)).size} different formats (layout, grade scale, font, page length, GPAs printed, extras)`);
const by = (k: (c: Case) => string) => Object.entries(cases.reduce<Record<string, number>>((a, c) => ((a[k(c)] = (a[k(c)] || 0) + 1), a), {})).map(([x, n]) => `${x} ${n}`).join(", ");
console.log(`  grade scales: ${by((c) => c.scale)}`);
for (const [l, v] of Object.entries(tally)) console.log(`  ${l.padEnd(11)} ${v.ok}/${v.cases}`);
if (failures.length) {
  console.log(`${failures.length} failed:`);
  for (const x of failures.filter((x) => process.env.SHOW_ALL || !/: (Parchment cover page left in|transcript key page left in)(; (Parchment cover page left in|transcript key page left in))?$/.test(x)).slice(0, 40)) console.log("  " + x);
  process.exit(1);
}
console.log("All passed.");
