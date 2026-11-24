// The resume's colour marks (action words, hard skills, soft skills, numbers, results), each line's flags and what they
// mean. Shared by the website's drawn resume (client/src/components/ResumeMarkup.tsx, ResumeReal.tsx) and the phone app.
import type { ResumeDoc } from "./types";
import { QUANT, WEAK, isAction } from "./bullets";
import { splitList } from "./words";

export type Cat = "action" | "hard" | "soft" | "number" | "result";
export const CATS: [Cat, string][] = [["action", "Action words"], ["hard", "Hard skills & tools"], ["soft", "Soft skills"], ["number", "Numbers"], ["result", "Results"]];
// Common tools students list; the student's own Skills section is added on top of these.
const TOOLS = ["Excel", "PowerPoint", "Word", "Outlook", "Google Sheets", "Google Slides", "G-Suite", "Microsoft Office", "SQL", "Python", "R", "Java", "JavaScript", "TypeScript", "C\\+\\+", "Tableau", "Power BI", "Salesforce", "HubSpot", "QuickBooks", "Bloomberg", "Capital IQ", "FactSet", "SAP", "Oracle", "Jira", "Figma", "Canva", "Adobe", "Photoshop", "AutoCAD", "SolidWorks", "MATLAB", "Zendesk", "CRM", "VBA", "DCF", "financial model\\w*", "pivot tables?"];
const SOFT = /\b(communicat\w*|collaborat\w*|cross-functional\w*|team(?:work|s)?|leadership|led|mentor\w*|present\w*|negotiat\w*|problem[- ]solving|organiz\w*|coordinat\w*|customer service|public speaking|interpersonal|adaptab\w*|time management|partner\w*)\b/gi;
const NUMBER = /(?:\$\s?\d[\d,.]*\s?[kKmMbB]?\+?|\b\d[\d,.]*\+?%?|\b\d+(?:st|nd|rd|th)\b|#\d+)/g;
const RESULT = /\b(increas|reduc|improv|grow|grew|sav|rais|boost|cut|doubl|tripl|exceed|generat|drove|achiev)\w*\b[^.;]{0,70}?\b(?:by|to|over)\s+[$#]?\d[\d,.]*\+?%?[^.;,]{0,30}/gi;

export type Range = [number, number, Cat];
export function ranges(text: string, tools: RegExp): Range[] {
  const out: Range[] = [];
  const add = (re: RegExp, cat: Cat) => { for (const m of text.matchAll(re)) out.push([m.index!, m.index! + m[0].length, cat]); };
  add(RESULT, "result");
  add(NUMBER, "number");
  const first = text.match(/^\s*([A-Za-z][\w-]*(?:\s+and\s+[A-Za-z][\w-]*)?)/);
  if (first && isAction(text.trim()) && !WEAK.test(text.trim())) out.push([first.index! + first[0].indexOf(first[1]), first.index! + first[0].length, "action"]);
  add(tools, "hard");
  add(SOFT, "soft");
  // Earlier entries win where they overlap (a result phrase keeps its number inside it; an action word beats a soft skill).
  const kept: Range[] = [];
  for (const r of out) if (!kept.some((k) => r[0] < k[1] && k[0] < r[1])) kept.push(r);
  return kept.sort((a, b) => a[0] - b[0]);
}
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
/** What a highlight or a flag means, for the explanation that opens when a student taps it (Dilan, Nov 22: "if I click
 *  on it I want to see what Remy wants me to change"). Only explains and suggests; nothing is written into the resume. */
const STRONGER: [RegExp, string][] = [
  [/^provid/i, "Delivered, Prepared, Supplied"], [/^(assist|help|support)/i, "Ran, Built, Prepared, Handled"], [/^manag/i, "Led, Ran, Oversaw"],
  [/^(work|did|do)\b/i, "Built, Ran, Analyzed"], [/^(responsible|tasked|in charge|duties)/i, "Led, Ran, Owned"], [/^handl/i, "Resolved, Processed, Ran"],
  [/^(use|utiliz)/i, "Built, Analyzed, Modeled"], [/^(participat|involv)/i, "Organized, Presented, Built"],
];
export function explain(kind: string, text: string): { title: string; body: string; alt?: string; fix?: boolean } {
  const word = text.trim().split(/\s+/)[0] || text;
  const alt = STRONGER.find(([re]) => re.test(word))?.[1];
  switch (kind) {
    case "action": return { title: `Action word: “${text.trim()}”`, body: "Good: the line starts with what you did, and recruiters scan the first word. The colour marks it as an action word, not a mistake.", alt: alt && `If it's true, a more specific word reads stronger: ${alt}.` };
    case "hard": return { title: `Hard skill or tool: “${text.trim()}”`, body: "Postings and resume filters look for these. Keep it where you really used it, and name what you did with it." };
    case "soft": return { title: `Soft skill: “${text.trim()}”`, body: "Recruiters believe a soft skill when a line shows it. Pair it with what happened, like a number or a result." };
    case "number": return { title: `Number: “${text.trim()}”`, body: "Numbers make a line easy to believe and easy to remember." };
    case "result": return { title: "Result", body: "This shows what changed because of you: the strongest kind of line." };
    case "No number": return { title: "No number", body: "This line has no number. If you know a real one (people, events, dollars, hours, percent), adding it makes the line easier to believe. Remy asks you for it and drafts the line; you approve every word. Only add a number you actually know.", fix: true };
    case "Starts weak": return { title: "Starts weak", body: "The line doesn't start with what you did (or starts with words like “Responsible for” or “Helped with”). Start with the action you took.", alt: alt && `If it's true: ${alt}.`, fix: true };
    case "Too short": return { title: "Too short", body: "Under 8 words usually leaves out what you did or what came of it. Add the how or the result.", fix: true };
    case "Too long": return { title: "Too long", body: "Over 32 words is hard to scan. Keep the action, the how and the result; cut the rest.", fix: true };
    case "No dates": return { title: "No dates", body: "Experience entries need dates so recruiters can see when you did them. Add them in Edit." };
    default: return { title: kind, body: "" };
  }
}

// Lines that usually have a count behind them: people, events, money, how often.
const COUNTABLE = /\b(manag|organi[sz]|lead|led|coordinat|plann?|host|train|tutor|mentor|recruit|raise|raised|oversee|oversaw|run|ran|process|schedul|teach|taught|sold|sell|grew|grow|built|build|creat|launch|answer|greet|direct)\w*/i;
const sq = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A line's flags. With `doc` (Dilan, Nov 24: "are you sure those need to be fixed?"), "No number" is judged per role,
 *  not per line: career advice is to show numbers where they fit, not on every line. It goes only on the one line of a
 *  role most likely to have a count behind it, and only when no line of that role has a number yet. */
export function issues(text: string, doc?: ResumeDoc): string[] {
  const t = text.trim().replace(/^[•\-–*]\s*/, "");
  const out: string[] = [];
  if (!isAction(t) || WEAK.test(t)) out.push("Starts weak");
  const entry = doc?.sections.flatMap((s) => s.entries).find((e) => e.bullets.some((b) => sq(b.text) === sq(t)));
  const lines = entry?.bullets.map((b) => b.text.trim()).filter(Boolean) ?? [];
  const pick = lines.find((b) => COUNTABLE.test(b)) ?? lines[0];
  if (!QUANT.test(t) && (!entry || (!lines.some((b) => QUANT.test(b)) && sq(pick) === sq(t)))) out.push("No number");
  const n = words(t);
  if (n < 8) out.push("Too short"); else if (n > 32) out.push("Too long");
  return out;
}

/** Hard skills to colour: the student's own Skills section plus common tools. */
export function toolsRegex(doc: ResumeDoc): RegExp {
  const own = doc.skills.flatMap((k) => splitList(k.items)).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${[...own, ...TOOLS].join("|")})\\b`, "gi");
}

