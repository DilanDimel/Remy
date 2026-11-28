// Transcript reading (Dilan, Nov 27): its own instructions for the AI and a check on what comes back.
// What a transcript reader pulls out. Layouts differ by school system (Banner, PeopleSoft, Workday, Colleague,
// Jenzabar, Parchment/Clearinghouse PDFs): terms may sit side by side, and repeated or withdrawn courses appear.
export const TRANSCRIPT_READER = "This text is a college transcript. Pull out, each as one fact: the school; each major and minor; expected graduation or class standing; cumulative GPA exactly as printed; total earned credits exactly as printed; honors such as dean's list, with the term. Then group completed courses by subject in one fact per subject, e.g. \"Accounting courses: ACCT 2xxx Financial Accounting (A), ...\" (code, title, grade; skip withdrawn courses, and for a repeated course keep the latest grade). Courses in progress go in one fact \"Taking now: ...\". Terms may be printed side by side or out of order; read every page. Never compute a GPA or credit total yourself: only copy printed numbers. Use category \"background\" for school, majors and GPA, \"skill\" for courses.";

/** Every decimal number in a fact (a GPA like 3.82, credits like 45.0) must be printed on the transcript itself,
 *  so Remy never shows a GPA or credit total the AI worked out or misread. */
export function numbersPrinted(fact: string, raw: string): boolean {
  const printed = new Set((raw.match(/\d+\.\d+/g) || []).map(Number));
  return (fact.match(/\d+\.\d+/g) || []).every((n) => printed.has(Number(n)));
}
