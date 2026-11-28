// Transcript reading (Dilan, Nov 27): its own instructions for the AI and a check on what comes back.
import { norm } from "./parse";
// What a transcript reader pulls out. Layouts differ by school system (Banner, PeopleSoft, Workday, Colleague,
// Jenzabar, Parchment/Clearinghouse PDFs): terms may sit side by side, and repeated or withdrawn courses appear.
export const TRANSCRIPT_READER = "This text is a college transcript. Pull out, each as one fact: the school; each major and minor; expected graduation or class standing; the cumulative GPA exactly as printed with its printed label; total earned credits exactly as printed; honors such as dean's list, president's list or honor roll, with the term. When several GPAs are printed (institutional, transfer, combined or overall, major), give each as its own fact with its printed label, e.g. \"Institutional GPA 3.412\" and \"Combined GPA 3.507\". Some schools grade out of 100 and print a cumulative average instead: copy it as printed. Narrative schools print no GPA: then give none. Then group completed courses by subject in one fact per subject, e.g. \"Accounting courses: ACCT 2xxx Financial Accounting (A), ...\" (code, title, grade). List every completed course: a long transcript can have 40 or more. Leave out a course whose grade is W (withdrawn) unless it was retaken; for a repeated course keep only the latest grade. Courses in progress (grade IP or none yet, often under \"in progress\" or the newest term) go in one fact \"Taking now: ...\" with their codes. Leave out academic standing notes (probation, warning). Terms may be printed side by side or out of order; read every page. Never compute a GPA or credit total yourself: only copy printed numbers. Use category \"background\" for school, majors and GPA, \"skill\" for courses.";

/** Every decimal number in a fact (a GPA like 3.82, credits like 45.0) must be printed on the transcript itself,
 *  so Remy never shows a GPA or credit total the AI worked out or misread. */
export function numbersPrinted(fact: string, raw: string): boolean {
  const printed = new Set((raw.match(/\d+\.\d+/g) || []).map(Number));
  return (fact.match(/\d+\.\d+/g) || []).every((n) => printed.has(Number(n)));
}

/** How much transcript text the reader is given. */
export const TRANSCRIPT_WINDOW = 40000;

// Official PDFs sent through Parchment open with a page on checking the digital signature, and most transcripts end
// with a "transcript key" (grading scale, credit rules). Neither is about the student, and the key is full of numbers
// like 3.50 or 12.00 that would let a misread GPA pass the printed-number check.
const COVER_END = /parchment\.com|ABOUT PARCHMENT|adobe\.com|reject this (document|transcript)|registrar\S*@\S+.*\d{3}/i;
const KEY_START = /^\W*(.*\btranscript (key|guide|legend)\b|academic transcript guide|grading (system|scale)\b|guide to (the )?transcript|explanation of (grades|the transcript))/i;

/** The text the reader is given: the transcript without the signature cover page or the key at the end. */
export function transcriptText(raw: string): string {
  let lines = raw.split("\n");
  if (lines.slice(0, 10).some((l) => /how to authenticate|digitally signed|official (pdf|electronic) transcript/i.test(l))) {
    const end = lines.slice(0, 60).map((l) => COVER_END.test(l)).lastIndexOf(true);
    if (end >= 0) lines = lines.slice(end + 1);
  }
  const key = lines.findIndex((l, i) => i >= lines.length / 2 && KEY_START.test(l));
  return (key > 0 ? lines.slice(0, key) : lines).join("\n").trim();
}

/** A scan or photo: the PDF is pictures, so almost no text comes out of it. */
export function isScanned(raw: string): boolean {
  return raw.replace(/\s+/g, "").length < 200;
}

/** The instructions for reading an imported profile file (LinkedIn, Handshake, a transcript). `nameChecked`: Remy already
 *  asks the student about their name, so name differences aren't flagged. */
export function readerSystem(transcript: boolean, nameChecked: boolean): string {
  return (transcript ? TRANSCRIPT_READER + " " : "") + "You extract factual statements about a student from their own exported profile text. Only include facts stated in the text, in its own words: never add a skill level (proficient, skilled, expert, strong, fluent) the text doesn't state, so a bare skills list stays a list. Keep each fact short and specific. Include a verbatim supporting quote. If a fact disagrees with the student's resume or profile (a different major, school, title, employer or dates), say how in \"conflict\" in plain words, e.g. \"Your resume says Finance & BIS\"; otherwise leave it empty. Name each source (\"your resume says…\", \"your setup answers say…\"); never write \"you said\" about the profile, because parts of it are filled in automatically. " + (nameChecked ? "Ignore name differences: Remy asks the student about their name separately." : "The profile name may come from the sign-in account, so for a different name say \"your sign-in account is under …\".") + " Something missing from the resume is not a conflict: instead set \"notOnResume\": true for experience, skills, certifications, awards or activities the resume doesn't mention.";
}

const flatCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
/** A course list ("Finance courses: FINA 3313 Investments (A), FINA 3323 Corporate Finance (B+)") gathers rows from
 *  across the transcript, so its quote can't be one stretch of the text. It counts as grounded when every course code
 *  is printed and each grade sits on the same printed line as its code. */
export function coursesGrounded(fact: string, raw: string): boolean {
  const lines = raw.split("\n").map((l) => ({ code: flatCode(l), words: new Set(l.split(/[\s,;:()]+/).filter(Boolean)) }));
  const courses = [...fact.matchAll(/\b([A-Z]{2,5})[\s_-]?(\d{3,5}[A-Z]?)\b([^()\n,;]*\(([^)]*)\))?/g)];
  return courses.length > 0 && courses.every((m) => {
    const code = flatCode(m[1] + m[2]), grade = m[4]?.split(/[\s,;]+/)[0];
    return lines.some((l) => l.code.includes(code) && (!grade || l.words.has(grade)));
  });
}

/** A transcript fact is grounded when its quote is printed, or when it joins printed pieces ("Term: Fall 2023 …
 *  Term Comments: Dean's List"), or when it is a course list whose rows are all printed (coursesGrounded). */
export function transcriptGrounded(fact: string, quote: string, raw: string): boolean {
  const n = norm(raw);
  const pieces = String(quote || "").split(/\.{3}|…|\n|\t|\s{2,}|\s[|;]\s/).map(norm).filter((p) => p.length >= 4);
  return (pieces.length > 0 && pieces.every((p) => n.includes(p.slice(0, 80)))) || coursesGrounded(fact, raw);
}
