// Remy's one-line reply to each setup answer. No AI reads the answer, so the reply only says what
// actually happened to it: which profile field it went into (if any) and that the plan reads it.
// It never promises a search, a ranking or a filter that doesn't run.

export const UNSURE = /\b(not sure|no idea|idk|don'?t know|unsure|no clue)\b/i;

/** Whether an answer goes into its profile field. "I'm not sure" never does (it would become a start date
 *  or a search word). Search fields (roles, employers, things to leave out) only take short answers that
 *  name things; a sentence ("I want to…") stays in Remy's AI memory instead. */
export function fitsField(target: string | undefined, a: string): boolean {
  if (!a.trim() || UNSURE.test(a)) return false;
  const searchField = target === "targetRoles" || target === "dreamEmployers" || target === "avoid";
  return !searchField || (a.length <= 60 && !/\b(i|i'm|im|don'?t|maybe)\b/i.test(a));
}

const items = (s: string) => s.toLowerCase().split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean);

/** Every piece of the answer ("Bell, SpaceX" = two) is already in the field's comma list. */
export function alreadyIn(field: string, a: string): boolean {
  const have = new Set(items(field));
  const want = items(a);
  return want.length > 0 && want.every((x) => have.has(x));
}

/** The answer is in its profile field. `pending` = still saving, so say what the save is about to do. */
export function inField(profile: object, target: string | undefined, a: string, pending = false): boolean {
  if (!target || !(target in profile) || !fitsField(target, a)) return false;
  return pending || alreadyIn(String((profile as Record<string, unknown>)[target] ?? ""), a);
}

const SAVED: Record<string, string> = {
  targetRoles: "Saved to the roles you're looking for. Your plan will use it too.",
  dreamEmployers: "Saved to your dream employers. Remy looks for their openings when it searches.",
  avoid: "Saved to your leave-out list. Openings whose company name or job title contains that exact phrase are hidden.",
  timeline: "Saved as when you want to start. Your plan will use it.",
  interests: "Saved. Your plan will use it.",
  goals: "Saved. Your plan will build on it.",
};

/** `saved` = the answer is in the target profile field (not just Remy's AI memory). */
export function setupReply(a: string, target: string | undefined, saved: boolean): string {
  if (!a) return "No problem, we can come back to that.";
  if (UNSURE.test(a)) return target === "timeline" ? "No problem. You can add a start date in your profile any time."
    : target === "dreamEmployers" ? "That's fine. Save openings you like as you go, and Remy will learn from them."
    : "That's completely normal. My Path shows where your major can lead, and we'll figure it out together.";
  if (saved && target && SAVED[target]) return SAVED[target];
  return "Thanks. I saved that to your AI memory, and your plan will use it.";
}

/** Optional Preferences fields the student left empty. Preferences comes right before the questions,
 *  so an empty one was skipped on purpose (empty start date = open to anything) and isn't asked again. */
export const OPTIONAL_PREFS = ["timeline", "dreamEmployers", "avoid"] as const;
export function skippedPrefs(onboardingStep: number, profile: { timeline?: string; dreamEmployers?: string; avoid?: string }): string[] {
  if (!(onboardingStep >= 4)) return [];
  return OPTIONAL_PREFS.filter((k) => !String(profile[k] ?? "").trim());
}

// The AI's own label for a question can be wrong, so its words are checked too.
const ASKS: Record<string, RegExp> = {
  timeline: /\bwhen\b.*\b(start|begin)|\bstart (date|term)|\btiming\b/i,
  dreamEmployers: /\bdream (employer|compan)|\b(companies|employers|organizations|agencies)\b.*\b(love|like|want|hope) to work\b|\bwork for\b/i,
  avoid: /\brule out\b|\bavoid\b|\bleave out\b|\bsteer clear\b/i,
};
export const FALLBACK_QUESTION = { q: "What would make this school year a win for you?", saveTo: "goals", options: [] as string[] };

/** Drops questions about fields the student skipped. If none are left, asks one goal question
 *  rather than none (no questions would wrongly read as "AI isn't available"). */
export function keepQuestions<T extends { q: string; saveTo?: string }>(qs: T[], skipped: string[]): (T | typeof FALLBACK_QUESTION)[] {
  const kept = qs.filter((x) => !skipped.includes(String(x.saveTo)) && !skipped.some((k) => ASKS[k]?.test(x.q)));
  return kept.length || !qs.length ? kept : [FALLBACK_QUESTION];
}
