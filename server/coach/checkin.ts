// Weekly check-in: the student taps what they did and says one sentence; the AI drafts a fact, a resume line
// and LinkedIn fields. Every piece must use only the student's words (strict honesty check), or it's dropped.
import { claimCheck } from "../ai/claims";
import { isAction } from "@shared/bullets";
export { CHECKIN_KINDS } from "@shared/checkin";
export type CheckinDraft = { kind: string; said: string; fact: string; bullet: string; linkedin: { section: string; fields: { label: string; value: string }[] }; followups: { q: string; options: string[] }[] };

const SECTIONS = ["Experience", "Volunteering", "Licenses & certifications", "Projects", "Honors & awards", "Organizations"];
const ok = (text: string, said: string) => !claimCheck(text, said, { original: said, strict: true }).length;

/** The student's own sentence as a resume line when it already reads like one ("I ran the tabling shift…" → "Ran the
 *  tabling shift…"): only their words, so it's offered when the AI's line added any (Log a win, Nov 19). */
export function ownLine(said: string): string {
  const t = said.replace(/\s+/g, " ").trim().replace(/^(this week|today|yesterday|last week)[, ]+/i, "").replace(/^i\s+/i, "").replace(/[.!]+$/, "");
  const line = t.charAt(0).toUpperCase() + t.slice(1);
  // Irregular past tenses ("Ran", "Led", "Won") read as actions too; the shared list only knows regular "-ed" verbs.
  const irregular = /^(ran|led|built|made|wrote|taught|won|grew|began|held|took|spoke|sold|bought|met|kept|gave|drove|chose|found|brought|sent|spent|set|put|read|ran|did|hit|beat|shot|swam|flew|drew|sang|caught|fought|thought|understood)\b/i;
  return line.length >= 12 && line.length <= 220 && (isAction(line) || irregular.test(line)) ? line : "";
}

/** Keeps only what the student said: an unsupported fact falls back to their own sentence; an unsupported line or field is left empty. */
export function cleanCheckin(kind: string, said: string, out: any): CheckinDraft {
  const words = `${kind}. ${said}`;
  const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const fact = s(out?.fact, 300), bullet = s(out?.bullet, 300);
  const section = SECTIONS.includes(s(out?.linkedin?.section, 40)) ? s(out?.linkedin?.section, 40) : "";
  const fields = (Array.isArray(out?.linkedin?.fields) ? out.linkedin.fields : []).slice(0, 6)
    .map((f: any) => ({ label: s(f?.label, 40), value: s(f?.value, 200) }))
    .filter((f: { label: string; value: string }) => f.label && f.value && ok(f.value, words));
  const factOk = fact.length >= 8 && ok(fact, words);
  return {
    kind, said,
    fact: factOk ? fact : said,
    // A line that adds words falls back to the checked fact when that already reads like a resume line ("Volunteered 4–6 hours…").
    bullet: bullet && ok(bullet, words) ? bullet : factOk && !/^(i|i'm|my|me)\b/i.test(fact) ? fact : ownLine(said),
    linkedin: { section: fields.length ? section : "", fields: section ? fields : [] },
    // Questions only: an answer counts once the student taps it (it's added to their words).
    followups: (Array.isArray(out?.followups) ? out.followups : [])
      .map((f: any) => ({ q: s(f?.q, 120), options: (Array.isArray(f?.options) ? f.options : []).map((o: unknown) => s(o, 40)).filter(Boolean).slice(0, 4) }))
      .filter((f: { q: string; options: string[] }) => f.q.endsWith("?") && f.options.length >= 2).slice(0, 2),
  };
}
