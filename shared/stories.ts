import type { StoryPart } from "./types";

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
