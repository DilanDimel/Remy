// Remy's review of the base resume: each problem with the exact line or field it's about, so the Review tab can help
// fix it in place (ask → draft → approve) instead of listing generic advice. Same rules as server/resume/ats.ts.
import type { ResumeDoc } from "./types";
import { QUANT, WEAK, isAction, isListSection } from "./bullets";

export type BulletRef = { id: string; text: string; where: string };
export type ReviewItem =
  | { kind: "contact"; title: string; fields: ("phone" | "email" | "location" | "links" | "name")[] }
  | { kind: "dates"; title: string; entries: { sectionId: string; entryId: string; label: string }[] }
  | { kind: "numbers" | "verbs"; title: string; why: string; bullets: BulletRef[] }
  | { kind: "tip"; title: string; why: string };

const clean = (t: string) => t.trim().replace(/^[•\-–*]\s*/, "");

/** `listLike` (owners first, Dilan Nov 22): certifications, licenses, awards and courses are listed like skills, so
 *  they aren't asked for dates. */
export function reviewResume(doc: ResumeDoc, { listLike = false } = {}): { todo: ReviewItem[]; good: string[] } {
  const todo: ReviewItem[] = [], good: string[] = [];
  const c = doc.contact;
  const missing = ([["name", !!c.name.trim()], ["email", /@/.test(c.email)], ["phone", /\d{3}.*\d{4}/.test(c.phone)], ["location", !!c.location.trim()], ["links", /linkedin|github|http/i.test(c.links)]] as const)
    .filter(([, ok]) => !ok).map(([k]) => k);
  if (missing.length) todo.push({ kind: "contact", title: `Add your ${missing.map((k) => (k === "links" ? "LinkedIn link" : k)).join(", ").replace(/, ([^,]*)$/, " and $1")}`, fields: [...missing] });
  else good.push("Contact details are complete.");

  const entries = doc.sections.filter((s) => !(listLike ? /skill|interest|language|certif|licen[cs]e|award|honou?r|course/i : /skill|interest|language/i).test(s.heading)).flatMap((s) => s.entries.map((e) => ({ s, e })));
  const undated = entries.filter(({ e }) => !/\d{4}|present/i.test(e.dates));
  if (undated.length) todo.push({ kind: "dates", title: `${undated.length} entr${undated.length === 1 ? "y has" : "ies have"} no dates`, entries: undated.map(({ s, e }) => ({ sectionId: s.id, entryId: e.id, label: [e.role, e.org].filter(Boolean).join(", ") || s.heading })) });
  else if (entries.length) good.push("Every entry has dates.");

  const bullets: BulletRef[] = doc.sections.filter((s) => !isListSection(s.heading)).flatMap((s) => s.entries.flatMap((e) => e.bullets.filter((b) => clean(b.text)).map((b) => ({ id: b.id, text: clean(b.text), where: [e.role, e.org].filter(Boolean).join(", ") || s.heading }))));
  const n = bullets.length || 1;
  const noNumber = bullets.filter((b) => !QUANT.test(b.text));
  if (bullets.length && (bullets.length - noNumber.length) / n < 0.5) todo.push({ kind: "numbers", title: `${noNumber.length} of ${bullets.length} bullets have no number`, why: "A real number (people, events, dollars, hours) makes a line easy to believe. Only add one you actually know.", bullets: noNumber });
  else if (bullets.length) good.push("At least half your bullets have a number.");
  const noVerb = bullets.filter((b) => !isAction(b.text) || WEAK.test(b.text));
  if (bullets.length && (bullets.length - noVerb.length) / n < 0.7) todo.push({ kind: "verbs", title: `${noVerb.length} bullet${noVerb.length === 1 ? " doesn't" : "s don't"} start with what you did`, why: "Recruiters skim the first word. Starting with an action (Led, Built, Organized) shows your part.", bullets: noVerb });
  else if (bullets.length) good.push("Most bullets start with an action.");

  const badLen = bullets.filter((b) => { const k = b.text.split(/\s+/).length; return k < 8 || k > 32; });
  if (bullets.length && (bullets.length - badLen.length) / n < 0.8) todo.push({ kind: "tip", title: `${badLen.length} bullet${badLen.length === 1 ? " is" : "s are"} very short or very long`, why: "Aim for one line or two (about 8 to 32 words). Edit them in the Edit tab." });
  const headings = doc.sections.map((s) => s.heading.toLowerCase());
  if (!headings.some((h) => /experience|employment|work/.test(h))) todo.push({ kind: "tip", title: "No section called “Experience”", why: "Application systems look for that word. Rename your work or leadership section in the Edit tab." });
  if (!headings.some((h) => /education/.test(h))) todo.push({ kind: "tip", title: "No “Education” section", why: "Add your school, degree and expected graduation in the Edit tab." });
  if (!doc.skills.length && !headings.some((h) => /skill/.test(h))) todo.push({ kind: "tip", title: "No Skills section", why: "Add a plain Skills line (tools and skills, separated by commas) in the Edit tab; systems read it first." });
  const words = [doc.contact.name, ...doc.sections.flatMap((s) => [s.heading, ...s.entries.flatMap((e) => [e.org, e.role, e.dates, ...e.bullets.map((b) => b.text)])]), ...doc.skills.map((k) => k.label + " " + k.items)].join(" ").split(/\s+/).filter(Boolean).length;
  if (words > 800) todo.push({ kind: "tip", title: `${words} words: longer than one page`, why: "Most student resumes fit one page (about 450 to 700 words). Trim older or weaker lines in the Edit tab." });
  else if (words < 250 && bullets.length) todo.push({ kind: "tip", title: `Only ${words} words`, why: "Add detail to your strongest roles in the Edit tab: what you did, for whom, and a real number if you know one." });
  if (bullets.length && bullets.length < 6) todo.push({ kind: "tip", title: `Only ${bullets.length} bullet${bullets.length === 1 ? "" : "s"}`, why: "Aim for 3 to 5 under each role or project. Add them in the Edit tab." });
  const formats = new Set(entries.filter(({ e }) => e.dates.trim()).map(({ e }) => (/[a-z]{3}\s+\d{4}/i.test(e.dates) ? "word" : /\d{1,2}\/\d{4}/.test(e.dates) ? "num" : "other")));
  if (formats.size > 1) todo.push({ kind: "tip", title: "Dates use different formats", why: "Use one format everywhere, like “Jun 2025 – Aug 2025”, in the Edit tab." });
  return { todo, good };
}
