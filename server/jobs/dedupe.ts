import type { Job } from "@shared/types";

// The same posting reached through two employer names ("Raytheon (RTX)" and "RTX (Raytheon)") showed twice in For you,
// and so did one written as "springdale, Arkansas, United States of America" beside "US-AR-SPRINGDALE-BLDG 1 ~ 275 E Robinson Ave".
// Same posting: the employer's words in any order and the same title, in places that share a town name.
// Words like Inc or The don't count, and neither do countries, states, street words or numbers.
const words = (s: string) => (s || "").toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/).filter((w) => w && !/^(inc|llc|llp|ltd|corp|corporation|company|co|the)$/.test(w));
const STATES = "alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada hampshire jersey mexico york carolina dakota ohio oklahoma oregon pennsylvania rhode island tennessee texas utah vermont virginia washington west wisconsin wyoming district columbia";
const FILLER = new Set([...STATES.split(" "), ..."new north south united states america usa of and bldg building suite ste floor fl st street ave avenue rd road blvd dr drive way ln lane hq campus office site e w n s ne nw se sw".split(" ")]);
/** The town words of a posting's first location: "Tucson, AZ" → tucson. Empty when it names no town (just "United States"). */
export const placeWords = (location: string) => new Set(words((location || "").split(";")[0]).filter((w) => w.length > 2 && !/\d/.test(w) && !FILLER.has(w)));
export const postingKey = (j: Pick<Job, "company" | "title">) => [[...new Set(words(j.company))].sort().join(" "), words(j.title).join(" ")].join("|");
/** Two locations are the same place when they share a town name, or when neither names one. */
const samePlace = (a: Set<string>, b: Set<string>) => (!a.size && !b.size) || [...a].some((w) => b.has(w));

/** Openings with a duplicate dropped. The one the student already acted on (kept, passed, hidden) stays; otherwise the first. */
export function dropDuplicatePostings(jobs: Job[], acted: (id: string) => boolean): Job[] {
  const groups = new Map<string, { at: Set<string>; job: Job }[]>();
  for (const j of jobs) {
    const k = postingKey(j), at = placeWords(j.location), list = groups.get(k) || [];
    const had = list.find((g) => samePlace(g.at, at));
    if (!had) list.push({ at, job: j });
    else if (!acted(had.job.id) && acted(j.id)) had.job = j;
    groups.set(k, list);
  }
  const keep = new Set([...groups.values()].flat().map((g) => g.job.id));
  return jobs.filter((j) => keep.has(j.id) || acted(j.id)); // never hide one the student acted on
}
