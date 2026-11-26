// Every U.S. metro area, so a student who says "Columbus, OH" or "Atlanta" gets openings in Dublin, OH or Marietta, GA,
// not only ones whose location spells their city (the 11,041-resume test, Nov 26, 2026). Census data, no network:
// server/data/us-metros.json (see SOURCES.md). Principal cities stand on their own ("Atlanta"); a suburb counts only
// with its state ("Dublin, OH"), because small town names repeat across states (Dublin, CA; Marietta, OH).
import fs from "node:fs";
import path from "node:path";

type Metro = { title: string; principal: Map<string, Set<string>>; places: Map<string, Set<string>> };
const ROWS: [string, string[], string[]][] = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "server", "data", "us-metros.json"), "utf8"));
const index = (list: string[]) => { const m = new Map<string, Set<string>>(); for (const x of list) { const [c, st] = x.split("|"); if (!m.has(c)) m.set(c, new Set()); m.get(c)!.add(st); } return m; };
const METROS: Metro[] = ROWS.map(([title, principal, other]) => ({ title, principal: index(principal), places: index([...principal, ...other]) }));
// "St. Louis" / "Saint Louis", "Ft. Worth": spelled the Census way before looking up.
export const placeKey = (s: string) => s.toLowerCase().replace(/\bst\.?\s/g, "st. ").replace(/\bsaint\s/g, "st. ").replace(/\bft\.?\s/g, "fort ").replace(/\bmt\.?\s/g, "mount ").replace(/\s+/g, " ").trim();
const keyOf = (s: string) => placeKey(s).replace(/^st\. /, "saint ");
const has = (m: Map<string, Set<string>>, city: string, st?: string) => { const k = m.get(placeKey(city)) || m.get(keyOf(city)); return !!k && (!st || k.has(st)); };

/** The metros a place the student named belongs to: "Columbus, OH" → Columbus OH; "Columbus" alone → every metro whose
 *  main city is Columbus (OH, GA, IN). A suburb needs its state ("Plano, TX"). Unknown places → []. */
const named = new Map<string, Metro[]>();
export function metrosNamed(city: string, st?: string): Metro[] {
  const c = city.trim();
  if (c.length < 3) return [];
  // Asked for every posting a search reads (thousands), so each answer is kept; there are only so many places.
  const k = `${c}|${st || ""}`;
  let hit = named.get(k);
  if (!hit) { hit = METROS.filter((m) => has(m.principal, c, st) || (!!st && has(m.places, c, st))); if (named.size < 5000) named.set(k, hit); }
  return hit;
}

/** True when a posting's location is in one of these metros: a principal city by name, or any place with its state. */
export function locationInMetros(location: string, metros: Metro[]): boolean {
  if (!metros.length) return false;
  // "Dublin, OH; Remote" → ["Dublin, OH", "Remote"]; each part is "city, ST[, extra]" or "City ST" (Workday "US-OH-Dublin" is tidied earlier).
  for (const part of location.split(/\s*[;|·]\s*|\s+\/\s+|\s+or\s+/i)) {
    const m = part.match(/^\s*([A-Za-z.' -]+?)\s*,\s*([A-Z]{2})\b/) || part.match(/^\s*([A-Za-z.' -]+?)\s+([A-Z]{2})\s*$/);
    if (m && metros.some((x) => has(x.places, m[1], m[2]))) return true;
    // No state given: only a metro's main city counts ("Atlanta", "Columbus - Main Campus").
    if (!/,\s*[A-Z]{2}\b/.test(part)) {
      const words = placeKey(part.replace(/[-–(].*$/, ""));
      if (words && metros.some((x) => x.principal.has(words))) return true;
    }
  }
  return false;
}
