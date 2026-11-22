// Facts read from a student's own profile (LinkedIn PDF, Handshake…) keep the source's words. Live test Nov 19:
// LinkedIn's bare "Top Skills" list became "Proficient in Team Building, …"; LinkedIn never says how good anyone is.
const LEVEL = /\b(?:highly\s+|very\s+)?(proficient|skilled|experienced|expert|adept|fluent|advanced|strong|extensive|excellent|exceptional)(?:\s+(?:in|at|with))?\s+/gi;

/** The fact with any skill-level word removed that the source text itself doesn't use. */
export function noUpgrade(fact: string, source: string): string {
  const src = source.toLowerCase();
  const out = fact.replace(LEVEL, (all, word: string) => (new RegExp(`\\b${word.toLowerCase()}`).test(src) ? all : "")).replace(/\s{2,}/g, " ").trim();
  return out ? out[0].toUpperCase() + out.slice(1) : fact;
}
