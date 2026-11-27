import type { Job } from "./types";

/** What kind of opening it is, as a student thinks of it (Dilan, Nov 27: sections for internships, early careers,
 *  part-time and every other type, and Remy knows the difference). Read from the posting's kind, title and text,
 *  with the words that decided it, so a card can say why. Used by the website, the app and Remy's chat. */
export type OpType = "internship" | "early" | "parttime" | "campus" | "program" | "apprentice" | "event";

export const OP_TYPES: { type: OpType; label: string; short: string; means: string }[] = [
  { type: "internship", label: "Internships", short: "Internship", means: "A set term while you're in school, usually a summer" },
  { type: "early", label: "Early career", short: "Early career", means: "Full-time first jobs: junior, entry-level, trainee, new grad" },
  { type: "parttime", label: "Part-time", short: "Part-time", means: "Fewer hours or a season, alongside your classes" },
  { type: "campus", label: "Campus jobs", short: "Campus job", means: "Student-worker jobs at a school" },
  { type: "program", label: "Programs", short: "Program", means: "Fellowships, insight weeks and programs with set dates" },
  { type: "apprentice", label: "Apprenticeships", short: "Apprenticeship", means: "Paid training on the job toward a trade or skill" },
  { type: "event", label: "Events", short: "Event", means: "Career fairs, info sessions and competitions" },
];
export const opLabel = (t: OpType) => OP_TYPES.find((o) => o.type === t)!.short;

/** "Says Part-Time": the posting's own words, as written. */
const says = (title: string, re: RegExp) => { const m = title.match(re); return m ? `Says ${m[0].trim()}` : ""; };

const PART_TITLE = /\bpart[- ]?time\b|\bPT\b|\bseasonal\b|\bholiday\b|\btemporary\b|\bsummer (?:job|help|associate|staff)\b/i;
// Hours a week the posting states ("20 hours per week", "15-25 hrs/week"): under 30 is part-time.
const HOURS = /\b(\d{1,2})\s*(?:-|–|to)?\s*(\d{1,2})?\s*(?:hours|hrs)\s*(?:per|a|\/|each)\s*week\b/i;
const PART_TEXT = /\b(?:this is a|is a|for a|seeking a|hiring a|hiring) part[- ]time\b|\bpart[- ]time (?:position|role|job|opportunity|schedule|employee)\b/i;
const CAMPUS = /\bstudent (?:worker|assistant|employee|aide|technician|ambassador)\b|\bwork[- ]study\b|\bon[- ]campus\b/i;
// In order of how clearly they say "first job".
const EARLY = [/\bnew grad(?:uate)?\b/i, /\bentry[- ]level\b/i, /\bearly career\b/i, /\brecent graduate\b/i, /\btrainee\b/i, /\bjunior\b/i, /\bjr\b/i];

export function opType(j: Pick<Job, "kind" | "title"> & { postingText?: string; summary?: string }): { type: OpType; why: string } {
  const title = j.title || "", text = `${j.summary || ""} ${(j.postingText || "").slice(0, 4000)}`;
  if (j.kind === "event") return { type: "event", why: "An event" };
  if (CAMPUS.test(title)) return { type: "campus", why: says(title, CAMPUS) };
  if (j.kind === "campus") return { type: "campus", why: "A job at a school" };
  if (/\bapprentice(?:ship)?s?\b/i.test(title)) return { type: "apprentice", why: says(title, /\bapprentice(?:ship)?s?\b/i) };
  if (j.kind === "internship") return { type: "internship", why: says(title, /\bintern(?:ship)?s?\b|\bco-?op\b|\bextern(?:ship)?\b|\bsummer analyst\b/i) || "An internship" };
  if (PART_TITLE.test(title)) return { type: "parttime", why: says(title, PART_TITLE) };
  const h = text.match(HOURS);
  const hours = h ? Number(h[2] || h[1]) : 0;
  if (hours >= 5 && hours < 30) return { type: "parttime", why: `About ${hours} hours a week` };
  if (PART_TEXT.test(text) && !/\bfull[- ]time\b/i.test(title)) return { type: "parttime", why: "Says part-time" };
  if (j.kind === "program") return { type: "program", why: says(title, /\bfellow(?:ship)?s?\b|\bprogram(?:me)?\b|\binsight\b|\bscholars?\b|\brotational\b/i) || "A program" };
  return { type: "early", why: EARLY.map((re) => says(title, re)).find(Boolean) || "" };
}
