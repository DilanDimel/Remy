// How Opportunities orders openings, shared so it can be tested (ranking council, Nov 19): the student's own places
// first, then "Worth relocating for" (their relocation answer), then other places; inside each group by fit plus what
// the student told Remy (goal words in the title, employers they saved or hid, "More like this" / "Not for me").
import type { Job, JobFit, JobRanking, Workspace } from "./types";

const GENERIC = /^(intern|interns|internship|internships|student|students|engineer|engineering|analyst|associate|assistant|summer|entry|level|role|roles|jobs?|work|program|career|careers|position|and|the|for|with)$/i;

export function openingRanker(w: Workspace, jobs: Job[], fits: Record<string, JobFit | undefined>, interest: Record<string, JobRanking | undefined> = {}, interestEnabled = true) {
  const regions = (w.profile.regions || "").trim();
  // Feedback loop: employers the student saved or applied to rise; ones they keep marking "Not interested" sink.
  const companyOf = (id: string) => jobs.find((j) => j.id === id)?.company;
  const liked = new Set([...w.savedJobIds, ...w.applications.map((a) => a.jobId)].map(companyOf));
  const hiddenBy = new Map<string | undefined, number>();
  for (const id of w.hiddenJobIds) if (!(interestEnabled && w.jobFeedback?.[id])) hiddenBy.set(companyOf(id), (hiddenBy.get(companyOf(id)) || 0) + 1); // a "Not for me" counts once, through its reason
  // The specific words of their goal ("mechanical") in a title outrank a same-field but different job ("electrical").
  const specific = [...new Set(`${w.profile.targetRoles} ${w.profile.major}`.toLowerCase().split(/[^a-z&]+/).filter((x) => x.length > 3 && !GENERIC.test(x)))];
  // No places chosen: openings in the student's own city or state come first.
  const home = regions ? [] : (w.profile.location || "").split(",").map((x) => x.trim()).filter((x) => x.length >= 2);
  const near = (j: Job) => home.some((h) => new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, "")}\\b`, "i").test(j.location));
  const rank = (j: Job) => (fits[j.id]?.score ?? 0) + (near(j) ? 6 : 0) + (liked.has(j.company) ? 8 : 0) - Math.min(3, hiddenBy.get(j.company) || 0) * 5
    + 10 * specific.filter((x) => new RegExp(`\\b${x}`, "i").test(j.title)).length
    + (interest[j.id]?.adjustment || 0); // the student's own "More like this" / "Not for me" (server-side, explained on the card)
  const group = (j: Job) => (!regions || fits[j.id]?.regionMatch !== false ? 0 : fits[j.id]?.relocate ? 1 : 2);
  /** Sort order: group, then pinned (e.g. "new" from Home), then rank, then the soonest deadline. */
  const compare = (pinned: (j: Job) => boolean = () => false) => (a: Job, b: Job) =>
    group(a) - group(b) || Number(pinned(b)) - Number(pinned(a)) || rank(b) - rank(a) || (a.deadline || "9999").localeCompare(b.deadline || "9999");
  return { rank, group, compare };
}
