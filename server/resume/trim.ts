// Keeps a student's openings list from growing forever. Every search adds up to 25 openings (each with up to 12 KB of
// posting text) and a workspace over 4 MB can't be saved, so old openings the student never touched are dropped.
// An opening is kept whenever anything else in the workspace mentions its id: saved, applied to, rated, hidden,
// a to-do, a calendar item, the tracker, a chat or AI log line. Openings typed in by hand always stay; ones imported
// from a link are kept while anything above refers to them, like Remy's own finds.
// Dropped links are remembered (droppedJobUrls) so the next search doesn't bring them back as "new".
import type { Job, Workspace } from "@shared/types";

export const OPENINGS_MAX_AGE_DAYS = 30;
export const OPENINGS_MAX_UNTOUCHED = 150;
const DROPPED_URLS_MAX = 1000;

const ageOf = (j: Job, now: number) => now - (Date.parse(j.foundAt || j.checkedAt || "") || now);

/** Ids of openings something in the workspace refers to. `refs` is the workspace to read references from:
 *  pass the latest stored copy, so an opening the student saved a moment ago counts. */
export function referencedJobIds(ws: Workspace, refs: Workspace = ws): Set<string> {
  const { jobs: _jobs, fits: _fits, ...rest } = refs;
  const text = JSON.stringify(rest);
  // Ids are long random strings ("j" + 12 hex), so a plain substring match also catches links like "?job=<id>".
  // Short ids (old sample data) must appear as a whole JSON string.
  return new Set(ws.jobs.map((j) => j.id).filter((id) => !!id && (id.length >= 8 ? text.includes(id) : text.includes(JSON.stringify(id)))));
}

/** Drops untouched, imported openings older than the age limit, then keeps only the newest ones up to the cap.
 *  Removes their fit verdicts too. Returns how many were dropped. Changes `ws` in place. */
export function trimOpenings(ws: Workspace, refs: Workspace = ws, now = Date.now()): number {
  const keep = referencedJobIds(ws, refs);
  const protectedJob = (j: Job) => keep.has(j.id) || j.origin !== "imported" || j.label === "Student provided";
  const untouched = ws.jobs.filter((j) => !protectedJob(j))
    .sort((a, b) => ageOf(a, now) - ageOf(b, now) || a.id.localeCompare(b.id));
  const drop = new Set(untouched.filter((j, i) => i >= OPENINGS_MAX_UNTOUCHED || ageOf(j, now) > OPENINGS_MAX_AGE_DAYS * 86_400_000).map((j) => j.id));
  if (!drop.size) return 0;
  const urls = ws.jobs.filter((j) => drop.has(j.id)).flatMap((j) => [j.applyUrl, j.sourceUrl]).filter(Boolean);
  ws.droppedJobUrls = [...new Set([...(ws.droppedJobUrls || []), ...urls])].slice(-DROPPED_URLS_MAX);
  ws.jobs = ws.jobs.filter((j) => !drop.has(j.id));
  ws.fits = Object.fromEntries(Object.entries(ws.fits || {}).filter(([id]) => !drop.has(id)));
  return drop.size;
}
