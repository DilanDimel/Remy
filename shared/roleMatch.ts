// Which openings are "this kind of job": My Path counts them under a direction and Opportunities shows the same list
// when opened from there (?role=), so the number and the list always agree.
//
// A title is split into field words (what the work is about: tax, marketing, credit, software) and role words (what kind
// of position: analyst, associate, intern). An opening is this kind of job when it has every field word; role words are
// interchangeable, since students mostly find internships ("Tax Associate" → "Tax Intern"). Skeptic review, Nov 20.
import { families } from "./words";

// Spelled through shared/words so they match how titles are read ("Associate" → "associat").
const spelled = (words: string) => families(words);
// Words that only narrow a title or don't say what the work is.
const SKIP = spelled("corporate commercial senior junior entry level the for registered certified licensed general new grad graduate university campus full time part year summer winter spring fall remote hybrid program internship intern co op personal");
// Kinds of position, interchangeable between a direction and an opening ("Tax Associate" → "Tax Intern").
const ROLE = spelled("analyst associate specialist assistant officer trainee representative coordinator engineer developer consultant advisor adviser manager director technician clerk lead staff worker");
// Role words too vague to be a job on their own ("Analyst" alone says nothing about the work).
const VAGUE = spelled("analyst associate specialist assistant officer trainee representative coordinator manager director technician clerk lead staff worker intern");

/** Field words of a title. All-capital short words count too (FP&A, HR, UX, IT, AI, M&A). */
function fieldWords(title: string): string[] {
  const caps = (title.match(/\b[A-Z][A-Z&]{1,3}\b/g) || []).map((w) => w.toLowerCase());
  const all = [...families(title)].filter((w) => w.length > 2 && !SKIP.has(w));
  const field = all.filter((w) => !ROLE.has(w));
  // A title that is only a role ("Consultant", "Management Consultant") is matched on its role words, unless they're vague.
  const words = field.length || caps.length ? field : all.filter((w) => !VAGUE.has(w));
  return [...new Set([...words, ...caps])];
}
function jobWords(title: string): string[] {
  const caps = (title.match(/\b[A-Z][A-Z&]{1,3}\b/g) || []).map((w) => w.toLowerCase());
  return [...families(title), ...caps];
}
// The same word in another form: "audit"/"auditor", "actuary"/"actuarial", "consultant"/"consult" (a shared start of
// 5+ letters covering most of the shorter word). Never "account"/"accountancy": an Account Executive isn't accounting.
const same = (a: string, b: string) => {
  if (a === b) return true;
  if ((a === "account") !== (b === "account")) return false;
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n >= 5 && n >= 0.8 * Math.min(a.length, b.length);
};

function one(role: string, job: string[]): boolean {
  const need = fieldWords(role);
  if (!need.length) return false; // "Analyst" alone says nothing about the work
  return need.every((w) => job.some((j) => same(w, j)));
}

/** A job title is this kind of job. Government titles list two jobs ("Accountants and auditors"): either counts.
 *  Not split on commas ("Sales representatives, wholesale and manufacturing" is one job). */
export function matchesRole(role: string, jobTitle: string): boolean {
  const job = jobWords(jobTitle);
  const parts = role.includes(",") ? [role] : role.split(/\s+and\s+/i);
  return parts.some((r) => one(r, job));
}

type JobLike = { id: string; title: string; kind?: string };
type FitLike = { excluded?: boolean; regionMatch?: boolean | null; relocate?: string } | undefined;
/** An opening (not an event) of this kind. Opportunities' ?role= filter uses the same test. */
export const isRoleOpening = (role: string, j: JobLike) => j.kind !== "event" && matchesRole(role, j.title);
/** The openings Opportunities shows for this role by default: not ruled out, not hidden, in the student's places or
 *  worth relocating for. My Path's count uses this, so "See 3 openings" opens exactly 3. */
export const shownForRole = <J extends JobLike>(role: string, jobs: J[], fits: Record<string, FitLike>, hidden: string[]) =>
  jobs.filter((j) => { const f = fits[j.id]; return !!f && !f.excluded && (f.regionMatch !== false || !!f.relocate) && !hidden.includes(j.id) && isRoleOpening(role, j); });
