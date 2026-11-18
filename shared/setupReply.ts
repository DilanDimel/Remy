// Remy's one-line reply to each setup answer. No AI reads the answer, so the reply only says what
// actually happened to it: which profile field it went into (if any) and that the plan reads it.
// It never promises a search, a ranking or a filter that doesn't run.

/** Phone keyboards type ’ (curly); every check reads the straight ' instead. */
const norm = (a: string) => a.replace(/[\u2018\u2019\u02bc]/g, "'");
/** Words that say "I don't know yet" or "not decided", anywhere in an answer. */
export const UNSURE = /\b(not (really |quite |totally |entirely |100% )?(sure|certain)|no idea|idk|dunno|(don'?t|do not) (really )?know|unsure|uncertain|no clue|undecided|still (deciding|figuring|thinking|exploring|unsure)|(haven'?t|have not) (really |yet )?(decided|figured|thought)|no preference|tb[da]|to be (determined|decided|announced)|not (yet )?decided|not yet|unknown|maybe|h+m+)\b/i;
// Small words that, next to an unsure phrase, add nothing ("I have no idea what I want to do yet lol").
const FILLER = new Set(("i i'm im am me my have has had what want wanna do doing it that this those about out yet really honestly right now at the moment " +
  "still just um hmm well so to be honest kind of sure not totally tbh yeah lol haha one any anything which where how go get there a an for much " +
  "figure figuring thought thinking decide deciding decided think know idea clue yet maybe exactly too either").split(" "));
const words = (a: string) => norm(a).toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
/** The whole answer is "I don't know" (not "Not sure about finance but love consulting", which says something). */
export function isUnsure(a: string): boolean {
  a = norm(a);
  if (a.trim() && /^[\s\p{P}]+$/u.test(a)) return true; // "?" or "..."
  if (!UNSURE.test(a)) return false;
  return words(a.replace(new RegExp(UNSURE.source, "gi"), " ")).every((w) => FILLER.has(w));
}
// "no", "none", "Nothing comes to mind", "No thanks": nothing to add.
const NO_WORDS = new Set(["no", "nope", "nah", "none", "nothing", "na", "n/a"]);
const NO_FILLER = new Set("not really specific particular in thanks thank you to avoid comes come mind i can think of that for now right so far yet at all lol off top my head i'm im good fine the above know open flexible anything".split(" "));
/** "Open to anything", "Any company", "Whenever": no names to search for or hide, and no start date. */
const OPEN_CORE = new Set("open anything any anywhere anytime whenever whatever flexible everything either picky matter".split(" "));
const OPEN_FILLER = new Set(("i'm im i am to all really role roles company companies employer employers job jobs place places location locations time " +
  "works work is fine pretty very not doesn't does the above of them one kind type field fields honestly totally").split(" "));
export function isOpen(a: string): boolean {
  const w = words(a);
  return w.some((x) => OPEN_CORE.has(x)) && w.every((x) => OPEN_CORE.has(x) || OPEN_FILLER.has(x));
}
export function isNothing(a: string): boolean {
  if (/^\W*(n\/a|not (really|anything|at the moment|right now)|not that i (can think|know) of)\W*$/i.test(norm(a))) return true;
  const w = words(norm(a).replace(/^\W*not really\b/i, "no")); // "Not really, I'm flexible"
  return w.some((x) => NO_WORDS.has(x)) && w.every((x) => NO_WORDS.has(x) || NO_FILLER.has(x));
}

const items = (s: string) => s.toLowerCase().split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean);

/** Whether an answer goes into its profile field. "I'm not sure" never does (it would become a start date
 *  or a search word), and a search field or start date never takes an answer that hedges at all.
 *  Search fields (roles, employers, things to leave out) only take short answers that name things; a
 *  sentence ("I want to…") stays in Remy's AI memory instead. */
export function fitsField(target: string | undefined, a: string): boolean {
  a = norm(a);
  if (!a.trim() || isUnsure(a) || isNothing(a)) return false;
  const searchField = target === "targetRoles" || target === "dreamEmployers" || target === "avoid";
  if ((searchField || target === "timeline") && (UNSURE.test(a) || isOpen(a))) return false;
  // The leave-out filter skips pieces of 2 letters or fewer, so "HR" would be saved but never hide anything.
  if (target === "avoid" && items(a).some((x) => x.length <= 2)) return false;
  // Names, not sentences: each comma piece is short, and no "I want…" ("Software Engineer I" is a role level, not "I").
  return !searchField || (a.length <= 300 && items(a).every((x) => x.length <= 60) && !/\b(i'm|im|don'?t|maybe)\b|\bi\s+[a-z]/i.test(a));
}

/** Every piece of the answer ("Bell, SpaceX" = two) is already in the field's comma list. */
export function alreadyIn(field: string, a: string): boolean {
  const have = new Set(items(field));
  const want = items(a);
  return want.length > 0 && want.every((x) => have.has(x));
}

/** The answer is in its profile field (checked after the save; while saving, the reply is "Saving…"). */
export function inField(profile: object, target: string | undefined, a: string): boolean {
  if (!target || !(target in profile) || !fitsField(target, a)) return false;
  return alreadyIn(String((profile as Record<string, unknown>)[target] ?? ""), a);
}

const SAVED: Record<string, string> = {
  targetRoles: "Saved to the roles you're looking for. Your plan will use it too.",
  dreamEmployers: "Saved to your dream employers. Remy looks for their openings when it searches.",
  avoid: "Saved to your leave-out list. Openings that name it in the company, the job title or the skills they require are hidden.",
  timeline: "Saved as when you want to start. Your plan will use it.",
  interests: "Saved. Your plan will use it.",
  goals: "Saved. Your plan will build on it.",
};

/** `saved` = the answer is in the target profile field (not just Remy's AI memory). */
export function setupReply(a: string, target: string | undefined, saved: boolean, toConfirm = false): string {
  if (!a) return "No problem, we can come back to that.";
  if (toConfirm) return "Got it. That was one of my suggestions, so I'll only use it once you confirm it's true (Home → Facts to approve).";
  if (isUnsure(a)) return target === "timeline" ? "No problem. You can add a start date in your profile any time."
    : target === "avoid" ? "No problem. You can add things to leave out in your profile any time."
    : target === "dreamEmployers" ? "That's fine. Save openings you like as you go, and Remy will learn from them."
    : "That's completely normal. My Path shows where your major can lead, and we'll figure it out together.";
  if (isNothing(a) && target === "avoid") return "Got it. Nothing added to your leave-out list.";
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
export const FALLBACK_QUESTION = { q: "What would make the next few months a win for you?", saveTo: "goals", options: [] as string[] };

/** Drops questions about fields the student skipped. If none are left, asks one goal question
 *  rather than none (no questions would wrongly read as "AI isn't available"). */
export function keepQuestions<T extends { q: string; saveTo?: string }>(qs: T[], skipped: string[]): (T | typeof FALLBACK_QUESTION)[] {
  const kept = qs.filter((x) => !skipped.includes(String(x.saveTo)) && !skipped.some((k) => ASKS[k]?.test(x.q)));
  return kept.length || !qs.length ? kept : [FALLBACK_QUESTION];
}

/** A tap on one of Remy's own answer options to a question about something on the resume ("What did you do
 *  best at Academy Sports?" → "Tracking sales and inventory"). Those words are Remy's, not the student's, so
 *  the answer is saved as a suggestion to confirm, never as a fact or a profile interest. Preference taps
 *  (roles, employers, start date, "people, numbers or ideas") and anything typed stay as they are. */
export function tappedResumeClaim(q: string, a: string, options: string[], target: string | undefined, resume: { orgs: string[]; roles: string[] }): boolean {
  if (target !== "interests" && target !== "goals") return false;
  if (!options.some((o) => norm(o).trim().toLowerCase() === norm(a).trim().toLowerCase())) return false;
  const clean = (x: string) => norm(x).toLowerCase().replace(/[^a-z0-9&'+-]+/g, " ").trim();
  const ql = ` ${clean(q)} `;
  // The AI shortens employer names ("Academy Sports" for "Academy Sports and Outdoors", "Chick-fil-A" for
  // "Chick-fil-A Southlake"): the whole name, the part before "+ , & | and", or its first two words count.
  // One word alone only when it looks like a brand ("Chick-fil-A", "H&M"), and a role only whole: "sales" or "Texas"
  // in a question is a preference, not a claim.
  const orgForms = (n: string) => {
    const w = clean(n).split(" ").filter((x) => x && !/^(the|a|an)$/.test(x));
    return [w.join(" "), clean(norm(n).split(/\s*[+,&|–—(]\s*|\s+-\s+|\s+and\s+/i)[0]), w.length > 2 ? w.slice(0, 2).join(" ") : "", /[-&\d]/.test(w[0] || "") ? w[0] : ""];
  };
  const forms = [...resume.orgs.flatMap(orgForms), ...resume.roles.map(clean)];
  // A one-word employer ("Target", "Apple") only counts written as a name, capitalized: "want to target first" is a preference.
  const asName = (f: string) => resume.orgs.some((o) => clean(o) === f) && new RegExp(`(^|[^A-Za-z])${f[0].toUpperCase()}${f.slice(1)}([^A-Za-z]|$)`).test(norm(q));
  return forms.some((f) => f.length >= 4 && (f.includes(" ") || /[-&\d]/.test(f) || asName(f)) && ql.includes(` ${f} `));
}
