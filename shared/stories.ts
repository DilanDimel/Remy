import type { Entry, ResumeDoc, Story, StoryPart } from "./types";
import { families } from "./words";

export const STORY_PARTS: StoryPart[] = ["situation", "task", "action", "result"];
/** Used when the AI didn't give a question of its own for an empty part. */
export const STORY_ASK: Record<StoryPart, string> = {
  situation: "Where were you and what was going on? One or two sentences of background.",
  task: "What were you responsible for, or what problem did you need to solve?",
  action: "What did you do, step by step? Say “I”, not “we”.",
  result: "What changed because of what you did? A number if you know one, or what people said.",
};

const norm = (t: string) => (t || "").toLowerCase().replace(/[‘’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
/** Exactly the same line, ignoring punctuation, quotes and case (used to carry a student's answers over). */
export const sameLine = (a: string, b: string) => norm(a).length > 0 && norm(a) === norm(b);
/** The resume line a story is about: the same words (ignoring punctuation and quotes), or one clearly containing the
 *  other. Undefined when the AI named a line the resume doesn't have. */
export function findLine<L extends { text: string }>(lines: L[], source: string): L | undefined {
  const s = norm(source);
  if (s.length < 12) return undefined;
  return lines.find((l) => norm(l.text) === s) || lines.find((l) => { const n = norm(l.text); return n.length >= 20 && (n.includes(s) || s.includes(n)); });
}

const QUESTION_START = /^(what|how|why|when|where|who|which|did|do|does|was|were|is|are|can|could|would|tell|describe|walk|in|at|for|after|before|during|looking|thinking|your|if|roughly|besides|once|about|think|say|picture|imagine)$/i;
// Everyday words that still assume a setting or people the line never mentions ("the chapter's finances").
const CONTEXT = /\b(chapter|club|team|teammate|client|customer|company|firm|employer|manager|boss|supervisor|member|organization|class|classmate|professor|course|store|restaurant|patient|student|coworker|colleague|partner|investor|donor|volunteer|budget|deadline|event|tournament|competition|co-?founder|founder|sponsor|sponsorship|administration|roommate|friend|family|parent|coach|mentor|teacher|audience|judge|board|funding|grant)/gi;
// A context word also counts as said when the line has its close relative ("your team" on "…with four teammates").
const RELATED: Record<string, string[]> = { team: ["teammate"], teammate: ["team"], class: ["classmate"], classmate: ["class"], founder: ["cofounder", "founded", "co-founded"], cofounder: ["founder", "cofounded"], club: ["clubs"], volunteer: ["volunteered", "volunteering"], member: ["members"] };
/** A question that names a club, company or person the resume line doesn't ("…at NABA?"), or assumes a setting it
 *  doesn't mention ("your team", "the sponsors"), is a guess; Remy asks plainly instead. Ordinary question words are
 *  fine: a question only asks, and nothing is saved unless the student writes it. */
export function namesNew(question: string, line: string): boolean {
  // Plain singular forms only (no word families or prefixes: "manager" isn't on a line that says "managed").
  const base = (w: string) => w.toLowerCase().replace(/['’]s$/, "").replace(/[.'’-]+$/, "").replace(/-/g, "").replace(/(ches|shes|sses|xes)$/, (m) => m.slice(0, -2)).replace(/(?<!s)s$/, "");
  const known = new Set((line.match(/[A-Za-z][A-Za-z&.'’-]*/g) || []).map(base));
  // Capitalized words that aren't just the start of a sentence (or "I"/"STAR") must be on the line.
  const tokens = question.match(/[A-Za-z][A-Za-z&.'’-]*|[.?!:;]/g) || [];
  let start = true;
  for (const w of tokens) {
    if (/^[.?!:;]$/.test(w)) { start = true; continue; }
    const cap = /^[A-Z]/.test(w);
    if (cap && !(start && QUESTION_START.test(w)) && !/^(I|I'm|I've|I'd|STAR)$/.test(w) && !known.has(base(w))) return true;
    start = false;
  }
  return (question.match(CONTEXT) || []).some((w) => { const b = base(w); return !known.has(b) && !(RELATED[b] || []).some((r) => known.has(r)); });
}

// Words that tie an answer to nothing in particular ("I", "the", "what we had").
const COMMON = new Set(["the", "and", "for", "with", "that", "this", "was", "were", "had", "have", "has", "but", "not", "our", "out", "who", "what", "when", "where", "why", "how", "which", "they", "them", "their", "there", "then", "than", "from", "into", "onto", "about", "after", "before", "during", "because", "while", "just", "also", "very", "really", "some", "all", "any", "each", "every", "more", "most", "much", "many", "one", "two", "first", "get", "got", "make", "do", "did", "done", "be", "been", "being", "go", "can", "could", "would", "should", "will", "need", "want", "know", "think", "thing", "lot", "way", "time", "day", "year", "people", "work", "help", "able", "new", "good", "great", "my", "me", "we", "us", "you", "your", "it", "its", "an", "a", "i", "to", "of", "in", "on", "at", "by", "as", "or", "so", "if", "no", "up", "is", "are", "am"]);
const GENERIC = new Set(["student", "member", "intern", "team", "staff", "assistant", "volunteer", "leader", "lead", "president", "officer", "campus", "university", "college", "club", "org", "organization", "group", "program", "project", "event"].map((w) => [...families(w)][0]));
const keyWords = (text: string) => new Set([...families(text)].filter((w) => w.length > 2 && !COMMON.has(w)));
const entryText = (e: Entry) => [e.org, e.role, ...e.bullets.map((b) => b.text)].join(" ");
// Sections that aren't experiences: a school, major or tool named in an answer ("my finance class", "an Excel sheet")
// says nothing about which experience it's about. "Activities and Leadership" or "Coursework & Projects" still count.
const NOT_EXPERIENCE = /^(education|academics?|(technical |relevant |computer |additional )?(skills?|certifications?|licen[cs]es?|course\s*work|courses|languages?|interests|tools|awards?|honou?rs))$/i;
const experienceSection = (heading: string) => !heading.split(/\s*(?:&|\band\b|,|\/|\|)\s*/i).filter(Boolean).every((part) => NOT_EXPERIENCE.test(part.trim()));
/** The other experience on the resume a story answer is really about, or undefined when it fits its own story.
 *  Flagged when the words that belong to just ONE other experience (its name counting double) outnumber, by two or
 *  more, the words the answer shares with its own story (its resume entry, line, title, other parts): the treasurer job typed into the dorm-supplies
 *  fundraiser story (live test Nov 19: "treasurer", "chapter", "SGA") is caught, while an on-topic answer in other
 *  words, or one naming the school, a tool or a word several experiences share ("campus", "budget"), isn't. */
export function otherExperience(answer: string, st: Pick<Story, "title" | "source" | "situation" | "task" | "action" | "result">, part: StoryPart, doc?: ResumeDoc): string | undefined {
  if (!doc) return undefined;
  const all = doc.sections.flatMap((sec) => sec.entries);
  const entries = doc.sections.filter((sec) => experienceSection(sec.heading)).flatMap((sec) => sec.entries);
  // The story's own entry: the bullet it came from, or (after the student reworded it) the closest one.
  const src = keyWords(st.source);
  const overlap = (e: Entry) => [...keyWords(entryText(e))].filter((w) => src.has(w)).length;
  const own = all.find((e) => e.bullets.some((b) => sameLine(b.text, st.source) || (norm(b.text).length >= 20 && (norm(st.source).includes(norm(b.text)) || norm(b.text).includes(norm(st.source))))))
    || [...all].sort((a, b) => overlap(b) - overlap(a)).find((e) => overlap(e) >= 2);
  if (!own) return undefined; // can't tell which experience the story is about: don't guess
  const ownWords = keyWords([entryText(own), st.source, st.title, ...STORY_PARTS.filter((p) => p !== part).map((p) => st[p])].join(" "));
  const mine = keyWords(answer);
  // A word counts toward another experience only if no other entry (education and skills included) has it; its
  // organization's name ("NABA", "Starbucks") counts double, being the plainest sign of a mix. Words any role or
  // group could have ("member", "student", "intern") don't count.
  const seen = new Map<string, number>();
  for (const e of all) for (const w of keyWords(entryText(e))) seen.set(w, (seen.get(w) || 0) + 1);
  // Words shared with the story's own context pull the other way, so "students" or "event" alone don't hide a mix.
  const shared = [...mine].filter((w) => ownWords.has(w)).length;
  let best: { label: string; n: number } | undefined;
  for (const e of entries) {
    if (e === own) continue;
    const name = keyWords(e.org);
    const n = [...keyWords(entryText(e))].filter((w) => mine.has(w) && seen.get(w) === 1 && !ownWords.has(w) && !GENERIC.has(w)).reduce((t, w) => t + (name.has(w) ? 2 : 1), 0);
    if (n >= 2 && n - shared >= 2 && (!best || n > best.n)) best = { label: [e.role, e.org].filter(Boolean).join(", "), n };
  }
  return best?.label;
}
