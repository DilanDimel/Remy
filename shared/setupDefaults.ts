// Setup's first answers, started from what the student already told Remy (QA, Nov 26: a two-year nursing student got
// four-year "Senior" and "Internships", and had to dig for Nursing although the resume says Nursing).
import { fieldFor } from "./fields";

/** The year choices that fit where the student is. Community college uses the two years' usual names; high school
 *  uses grades, so a high-school junior is never read as a college junior. Paths outside school ask no year. */
export function yearOptions(path = ""): string[] {
  if (path === "community-college") return ["First-year", "Sophomore"];
  if (path === "high-school") return ["9th grade", "10th grade", "11th grade", "12th grade"];
  if (["trade", "apprenticeship", "working", "military"].includes(path)) return [];
  return ["First-year", "Sophomore", "Junior", "Senior", "Graduate student"];
}

/** A first guess at the year from the graduation date, only where the guess is reliable. */
export function guessYearFor(path: string, graduation = "", now = new Date()): string {
  const y = Number(/\b(20\d\d)\b/.exec(graduation)?.[1]);
  if (!y) return "";
  const left = y - (now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear());
  if (path === "community-college") return left === 0 ? "Sophomore" : left === 1 ? "First-year" : "";
  if (path === "high-school") return left >= 0 && left <= 3 ? ["12th grade", "11th grade", "10th grade", "9th grade"][left] : "";
  if (path && path !== "four-year") return "";
  return left >= 0 && left <= 3 ? ["Senior", "Junior", "Sophomore", "First-year"][left] : "";
}

/** The kinds of opportunities to start with, from the goal in the student's words and their path. */
export function defaultTypes(goal = "", path = ""): string[] {
  const g = goal.toLowerCase();
  if (/intern|co-?op/.test(g)) return ["Internships"];
  // A high-schooler's "job" is a part-time one: full-time openings would bury the programs they can do now.
  if (path === "high-school") return ["Part-time / campus jobs", "Programs & insight days"];
  if (/part[- ]?time/.test(g)) return ["Part-time / campus jobs"];
  if (/full[- ]?time|\bjob\b|career|after (i )?graduat|hired|position/.test(g) || ["working", "military", "trade", "apprenticeship"].includes(path)) return ["Full-time jobs"];
  return ["Internships"];
}

/** The field the student's major names, when it names exactly one ("Nursing (ADN)" → Nursing). */
export const fieldFromMajor = (major = "") => { const f = fieldFor(major); return f ? [f] : []; };
