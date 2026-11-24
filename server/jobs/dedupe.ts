import type { Job } from "@shared/types";

// The same posting reached through two employer names ("Raytheon (RTX)" and "RTX (Raytheon)") showed twice in For you.
// Key: the employer's words in any order, plus the title and the first city. Words like Inc or The don't count.
const words = (s: string) => (s || "").toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/).filter((w) => w && !/^(inc|llc|llp|ltd|corp|corporation|company|co|the)$/.test(w));
export const postingKey = (j: Pick<Job, "company" | "title" | "location">) =>
  [[...new Set(words(j.company))].sort().join(" "), words(j.title).join(" "), words((j.location || "").split(";")[0]).join(" ")].join("|");

/** Openings with a duplicate dropped. The one the student already acted on (kept, passed, hidden) stays; otherwise the first. */
export function dropDuplicatePostings(jobs: Job[], acted: (id: string) => boolean): Job[] {
  const pick = new Map<string, Job>();
  for (const j of jobs) {
    const k = postingKey(j), had = pick.get(k);
    if (!had || (!acted(had.id) && acted(j.id))) pick.set(k, j);
  }
  const keep = new Set([...pick.values()].map((j) => j.id));
  return jobs.filter((j) => keep.has(j.id) || acted(j.id)); // never hide one the student acted on
}
