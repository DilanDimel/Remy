// One repair pass for tailoring: when Remy's own honesty check flags a rewrite or the cover letter, the AI gets one
// more try with the exact words that aren't supported. A rewrite that still fails isn't offered (the student keeps
// their own line); a letter keeps whichever version has fewer problems. So students aren't shown changes Remy
// itself would refuse at Approve.
import type { ClaimFlag } from "@shared/types";

export type FlaggedRewrite = { id: string; original: string; revised: string; flags: ClaimFlag[] };

const problems = (flags: ClaimFlag[]) => flags.filter((f) => f.type !== "placeholder").map((f) => `- "${f.term}": ${f.message}`).join("\n");

export function rewriteFixPrompt(items: FlaggedRewrite[]) {
  return {
    system: `You repair resume bullet rewrites that an honesty check rejected. For each item, write a new version of the ORIGINAL bullet that fixes every listed problem: drop or replace each flagged word, never upgrade the student's verb (ran → managed, helped → led), and never add qualities, outcomes, numbers, tools or details the ORIGINAL doesn't state (no "with attention to detail", "ensuring", "efficiently"). Rewording is fine; adding is not. If the original can't be improved honestly, return it unchanged.`,
    user: `${items.map((x) => `ID: ${x.id}\nORIGINAL: ${x.original}\nREJECTED REWRITE: ${x.revised}\nPROBLEMS:\n${problems(x.flags)}`).join("\n\n")}\n\nReturn {"fixes":[{"id":"","revised":""}]}`,
  };
}

export function letterFixPrompt(letter: string, flags: ClaimFlag[]) {
  return {
    system: `You repair a student's cover letter that an honesty check flagged. Change ONLY the sentences with the listed problems: remove or reword each flagged claim so it says no more than the student's own record (never upgrade a verb like "ran" to "managed", never add numbers, titles, tools or outcomes). Keep everything else word for word, including the greeting, paragraphs and sign-off. Never add placeholders or brackets.`,
    user: `LETTER:\n${letter}\n\nPROBLEMS:\n${problems(flags)}\n\nReturn {"letter":""}`,
  };
}

/** The repaired text for each id, only when it passes the check (`clean`) and still differs from the original. */
export function keptFixes(items: FlaggedRewrite[], out: any, clean: (text: string, item: FlaggedRewrite) => boolean, norm: (s: string) => string): Map<string, string> {
  const got = new Map<string, string>();
  for (const f of Array.isArray(out?.fixes) ? out.fixes : []) {
    const item = items.find((x) => x.id === String(f?.id || ""));
    const text = String(f?.revised || "").replace(/\s+/g, " ").trim();
    if (item && text && norm(text) !== norm(item.original) && clean(text, item)) got.set(item.id, text);
  }
  return got;
}
