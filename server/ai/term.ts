// "What's that?" on a term Remy shows (an exam, a tool, a skill): a short plain answer, shared by every student
// because it's about the term, not them. The field keeps "PE" or "FE" from meaning the wrong thing.

export type TermAnswer = { known: boolean; what: string; why: string };

/** The term and field as sent, tidied; "" when the term is too short or too long to be one thing. */
export function cleanTerm(term: unknown, field: unknown): { term: string; field: string } {
  const tidy = (v: unknown, n: number) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
  const t = tidy(term, 120);
  return { term: t.length >= 2 ? t : "", field: tidy(field, 80) };
}

/** The AI's answer, checked before anyone sees or caches it. */
export function readTermAnswer(raw: any): TermAnswer {
  const s = (v: unknown) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 400);
  const what = s(raw?.what);
  return { known: raw?.known !== false && !!what, what, why: s(raw?.why) };
}

export const TERM_SYSTEM = "You explain words college students meet on a career plan (exams, licenses, tools, skills, programs) in plain everyday words, like a friend who knows the field. Be accurate. If you don't know the term or it's too vague, set \"known\": false.";
export const termPrompt = (term: string, field: string) =>
  `Term: ${term}${field ? `\nThe student's field: ${field}` : ""}\n\nReturn {"known":true,"what":"one or two short sentences: what it is","why":"one short sentence: why it matters for a student in this field, and when people usually do it"}`;
