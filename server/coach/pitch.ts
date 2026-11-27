// The 30-second pitch, written to be said out loud: four short parts (hello, what you study, one real experience,
// what you want next). A part that fails the honesty check or sounds like a cover letter is swapped for a plain,
// true sentence from the profile (or left out), instead of being cut mid-flow, which is what made pitches choppy.

export type PitchParts = { hello?: string; study?: string; story?: string; next?: string };
export type PitchProfile = { name: string; classYear: string; major: string; school: string; interests: string };

// Words that make a pitch sound written, not said. Narrow on purpose: "data-driven model", "dynamic pricing" and
// "Thrive Market" are real things a student did, not buzzwords.
export const BUZZ = /\b(passionate|passion for|leverag\w*|synerg\w*|results[- ]oriented|detail[- ]oriented|go-getter|spearhead\w*|utiliz\w*|esteemed|eager to contribute|valuable asset|hard-?working individual|(?:i'?m|i am) (?:a )?(?:very |highly )?(?:driven|dynamic|motivated))\b/i;
/** "Finance, Investment banking, Consulting" → "finance, investment banking and consulting". */
const listOf = (s: string) => { const xs = s.split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean).map((x) => (/^[A-Z]{2,}/.test(x) ? x : x.toLowerCase())); return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`; };

const sentence = (t: string) => { const x = t.replace(/\s+/g, " ").trim(); return !x ? "" : /[.!]$/.test(x) ? x : x.replace(/[?,;:]+$/, "") + "."; };

// A job title reads as a kind of role: "Public Affairs Intern" → "public affairs internships" (AI test, Nov 27:
// 31% of pitches ended "I'm interested in public affairs intern.").
const ROLE_END = /\b(intern|analyst|engineer|developer|designer|assistant|associate|specialist|coordinator|technician|consultant|representative|manager|accountant|scientist|nurse|teacher|apprentice|trainee)s?$/i;
const roleWords = (x: string) => (/\binterns?$/i.test(x) ? x.replace(/\binterns?$/i, (m) => (m[0] === "I" ? "Internships" : "internships")) : ROLE_END.test(x) ? `${x.replace(/s$/, "")} roles` : x);
/** Plain, true fallbacks built only from what the student told Remy. */
export function plainParts(p: PitchProfile): PitchParts {
  const year = p.classYear && !/^(other|not sure)/i.test(p.classYear) ? p.classYear.toLowerCase() : "";
  const study = p.major ? `I'm ${year ? `a ${year} ` : ""}studying ${p.major}${p.school ? ` at ${p.school}` : ""}.` : p.school ? `I'm a student at ${p.school}.` : "";
  return {
    hello: p.name ? `Hi, I'm ${p.name}.` : "Hi, nice to meet you.",
    study,
    // Setup asks which roles they're curious about, so "interested in", not "looking for".
    next: p.interests ? `I'm interested in ${listOf(p.interests.replace(/[.]+$/, "").split(/\s*[,;]\s*/).map(roleWords).join(", "))}.` : "",
  };
}

/** Joins the AI's parts, keeping each only if it's honest (ok) and spoken; otherwise the plain version or nothing.
 *  Returns "" without a real story: hello + major + interests alone is the generic pitch students don't want. */
export function assemblePitch(ai: PitchParts, ok: (s: string) => boolean, profile: PitchProfile): string {
  const plain = plainParts(profile);
  const pick = (k: keyof PitchParts) => {
    // Until the student has chosen which name Remy uses, the hello never names them, whatever the AI wrote.
    if (k === "hello" && !profile.name) return plain.hello!;
    const raw = String(ai[k] || "").slice(0, 400).trim();
    const x = sentence(raw);
    // Ending on a question reads like a script trick; the pitch ends on what they want.
    if (x && !/\?["”']?$/.test(raw) && !BUZZ.test(x) && ok(x)) return x;
    return plain[k] || "";
  };
  const parts = (["hello", "study", "story", "next"] as const).map((k) => [k, pick(k)] as const);
  if (!parts.find(([k]) => k === "story")![1]) return "";
  return parts.map(([, x]) => x).filter(Boolean).join(" ").slice(0, 1200);
}
