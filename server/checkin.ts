// Weekly check-in: the student taps what they did and says one sentence; the AI drafts a fact, a resume line
// and LinkedIn fields. Every piece must use only the student's words (strict honesty check), or it's dropped.
import { claimCheck } from "./claims";
export { CHECKIN_KINDS } from "@shared/checkin";
export type CheckinDraft = { kind: string; said: string; fact: string; bullet: string; linkedin: { section: string; fields: { label: string; value: string }[] } };

const SECTIONS = ["Experience", "Volunteering", "Licenses & certifications", "Projects", "Honors & awards", "Organizations"];
const ok = (text: string, said: string) => !claimCheck(text, said, { original: said, strict: true }).length;

/** Keeps only what the student said: an unsupported fact falls back to their own sentence; an unsupported line or field is left empty. */
export function cleanCheckin(kind: string, said: string, out: any): CheckinDraft {
  const words = `${kind}. ${said}`;
  const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const fact = s(out?.fact, 300), bullet = s(out?.bullet, 300);
  const section = SECTIONS.includes(s(out?.linkedin?.section, 40)) ? s(out?.linkedin?.section, 40) : "";
  const fields = (Array.isArray(out?.linkedin?.fields) ? out.linkedin.fields : []).slice(0, 6)
    .map((f: any) => ({ label: s(f?.label, 40), value: s(f?.value, 200) }))
    .filter((f: { label: string; value: string }) => f.label && f.value && ok(f.value, words));
  return {
    kind, said,
    fact: fact.length >= 8 && ok(fact, words) ? fact : said,
    bullet: bullet && ok(bullet, words) ? bullet : "",
    linkedin: { section: fields.length ? section : "", fields: section ? fields : [] },
  };
}
