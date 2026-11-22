// "Future of your field": official 10-year job projections (BLS 2025–35) and how much of each job's
// work AI tools can speed up (Eloundou et al. 2023), for the career fields the student named.
import fs from "node:fs";
import path from "node:path";
import type { Workspace } from "@shared/types";
import { FIELD_SEARCH, FIELD_TITLES } from "./fit";

type Occ = { t: string; soc: string; emp: number | null; chg: number | null; open: number | null; wage: number | null; edu: string; ooh: string; ai?: number };
const DATA = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "server", "data", "projections.json"), "utf8")) as { source: string; occupations: Occ[] };
// Growth of all U.S. jobs over the same ten years, the line between "faster" and "slower" than average.
export const ALL_JOBS_GROWTH = 3.5;

// Remy's career fields (server/jobs/fit.ts) → Standard Occupational Classification code prefixes.
const FIELD_SOC: Record<string, string[]> = {
  finance: ["13-2", "11-3031"],
  quantitative: ["15-2", "13-2041", "13-2051"],
  marketing: ["11-2021", "11-2032", "13-1161", "27-3031"],
  sales: ["41-", "11-2022"],
  business: ["11-1", "11-3", "13-1"],
  consulting: ["13-1111", "13-1161", "15-2031", "13-1199"],
  "human resources": ["11-3111", "11-3121", "13-1071", "13-1141", "13-1151"],
  data: ["15-2041", "15-2051", "15-2031", "15-1211", "15-1243", "13-1161"],
  "information systems": ["15-1211", "15-1212", "15-1244", "15-1299", "11-3021", "13-1111", "15-2051", "15-2041"],
  software: ["15-1"],
  engineering: ["17-2", "17-3"],
  construction: ["17-1", "11-9021", "47-1", "13-1051"],
  operations: ["11-3071", "13-1081", "13-1082", "11-3013", "43-5", "53-1"],
  aviation: ["53-2", "49-3011", "49-2091"],
  "real estate": ["41-902", "11-9141", "13-2023"],
  healthcare: ["29-1", "29-2", "31-", "11-9111"],
  nursing: ["29-1141", "29-1151", "29-1161", "29-1171", "29-2061", "31-1131"],
  "social work": ["21-1", "19-3033", "19-3034", "19-3039"],
  research: ["19-1", "19-2", "19-4"],
  sustainability: ["19-1031", "19-2041", "19-4042", "17-2081", "45-", "11-9013", "47-2231", "49-9081"],
  education: ["25-"],
  legal: ["23-", "13-1041", "19-3094"],
  "public safety": ["33-", "29-2042", "29-2043", "43-5031"],
  design: ["27-1"],
  entertainment: ["27-2", "27-4"],
  communications: ["27-3"],
  hospitality: ["11-9051", "11-9081", "13-1121", "35-1", "43-4081"],
  sports: ["27-202", "39-9031", "29-9091"],
  nonprofit: ["11-9151", "11-2033", "13-1131", "21-1"],
};

export type FutureOcc = { soc: string; title: string; change: number; openings: number | null; wage: number | null; education: string; aiShare: number | null; link: string };
export type FutureField = { field: string; growing: FutureOcc[]; shrinking: FutureOcc[]; total: number; fasterThanAverage: number };

const view = (o: Occ): FutureOcc => ({ soc: o.soc, title: o.t, change: o.chg ?? 0, openings: o.open, wage: o.wage, education: o.edu, aiShare: o.ai ?? null, link: o.ooh });

export function futureFor(ws: Workspace): { source: string; allJobsGrowth: number; fields: FutureField[] } {
  const wants = [ws.profile.targetRoles, ws.profile.major, ws.profile.interests].join(" ");
  // The student's own major comes first (Path shows the first field open and the others folded).
  const major = ws.profile.major || "";
  const fields = FIELD_SEARCH.map((f, k) => ({ f, k })).filter(({ k }) => FIELD_TITLES[k][0].test(wants))
    .sort((a, b) => Number(FIELD_TITLES[b.k][0].test(major)) - Number(FIELD_TITLES[a.k][0].test(major))).map(({ f }) => f).slice(0, 3);
  return {
    source: DATA.source,
    allJobsGrowth: ALL_JOBS_GROWTH,
    fields: fields.map((field) => {
      const prefixes = FIELD_SOC[field] || [];
      // Jobs with at least 5,000 people in them, so a tiny occupation's big percentage doesn't lead.
      const occs = DATA.occupations.filter((o) => o.chg != null && (o.emp ?? 0) >= 5 && prefixes.some((p) => o.soc.startsWith(p)));
      const byChange = [...occs].sort((a, b) => (b.chg ?? 0) - (a.chg ?? 0));
      return {
        field,
        growing: byChange.filter((o) => (o.chg ?? 0) > 0).slice(0, 5).map(view),
        shrinking: byChange.filter((o) => (o.chg ?? 0) < 0).reverse().slice(0, 3).map(view),
        total: occs.length,
        fasterThanAverage: occs.filter((o) => (o.chg ?? 0) > ALL_JOBS_GROWTH).length,
      };
    }),
  };
}

// "Not sure what to do with my major": the jobs that hire the most people in each of the student's
// fields (or a field they browse), from the same official projections. No AI call.
export type CareerOptions = { field: string; jobs: FutureOcc[] }[];
const fieldsIn = (text: string) => FIELD_SEARCH.filter((_, k) => FIELD_TITLES[k][0].test(text));
export function careersFor(ws: Workspace, browse = ""): CareerOptions {
  const fields = fieldsIn(browse || [ws.profile.major, ws.profile.minors, ws.profile.targetRoles, ws.profile.interests].join(" ")).slice(0, 4);
  return fields.map((field) => {
    const prefixes = FIELD_SOC[field] || [];
    const occs = DATA.occupations.filter((o) => (o.emp ?? 0) >= 5 && o.open != null && prefixes.some((p) => o.soc.startsWith(p)));
    return { field, jobs: occs.sort((a, b) => (b.open ?? 0) - (a.open ?? 0)).slice(0, 6).map(view) };
  }).filter((f) => f.jobs.length);
}

/** The official occupation a job title the student typed most likely means, if there is a clear one. */
export function officialFor(title: string): FutureOcc | null {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter((w) => w.length > 2).map((w) => w.replace(/ies$/, "y").replace(/s$/, ""));
  const want = words(title);
  if (!want.length) return null;
  let best: Occ | null = null, bestScore = 0;
  for (const o of DATA.occupations) {
    const have = new Set(words(o.t));
    const hit = want.filter((w) => have.has(w)).length;
    // Every word the student typed has to appear, and fewer extra words is a closer match.
    const score = hit === want.length ? 10 - Math.min(9, have.size - hit) : 0;
    if (score > bestScore) { best = o; bestScore = score; }
  }
  return best ? view(best) : null;
}

// "What's the job?": the job's most important duties in the Labor Department's own words (O*NET 31.0, CC BY 4.0) and one sentence
// from the government's job guide on why it's growing or shrinking (BLS Occupational Outlook Handbook). Quoted as
// published, never rewritten, no AI call. Data files from Julio's forecast work (Nov 2026).
type Tasks = { publication: { version: string; attribution: string; licenseUrl: string }; occupations: Record<string, { title: string; items: { text: string; importance?: number }[] }> };
type Outlook = Record<string, { quote: string; url: string; retrievedAt: string }>;
const read = <T,>(file: string) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "server", "data", file), "utf8")) as T;
const TASKS = read<Tasks>("onet-tasks.json");
const OUTLOOK = read<Outlook>("bls-published-outlook.json");
// A quote older than this may no longer match the live guide, so it's left out rather than shown stale.
const OUTLOOK_MAX_AGE_DAYS = 400;
// One sentence can't carry a shrinking job's story: for jobs projected to shrink, the guide's "still needed" sentence
// sat beside the number and read as the opposite (skeptic review, Nov 21), so only growing jobs show a quote.
// A sentence that leans on the one before it ("However, …", "In addition, …") is left out too.
const LEANS_ON_PREVIOUS = /^(however|in addition|additionally|moreover|furthermore|also|but|although|still|yet)\b/i;

export type OccupationDetails = {
  soc: string; title: string;
  // ranked: the tasks O*NET rates most important; false when O*NET hasn't rated this job's tasks (shown as examples).
  duties: string[]; ranked: boolean; dutiesSource: { label: string; url: string; attribution: string; licenseUrl: string } | null;
  outlook: { quote: string; url: string } | null;
};

export function occupationDetails(soc: string, now = Date.now()): OccupationDetails | null {
  if (!/^\d{2}-\d{4}$/.test(soc)) return null;
  const occ = DATA.occupations.find((o) => o.soc === soc);
  if (!occ) return null;
  const t = TASKS.occupations[soc];
  const o = OUTLOOK[soc];
  const age = o ? (now - Date.parse(o.retrievedAt)) / 86_400_000 : NaN;
  return {
    soc, title: occ.t,
    duties: t ? t.items.map((i) => i.text).filter(Boolean).slice(0, 5) : [],
    ranked: !!t && t.items.length > 0 && t.items.every((i) => typeof i.importance === "number"),
    dutiesSource: t ? { label: `O*NET ${TASKS.publication.version}, U.S. Department of Labor`, url: `https://www.onetonline.org/link/details/${soc}.00#Tasks`, attribution: TASKS.publication.attribution, licenseUrl: TASKS.publication.licenseUrl } : null,
    outlook: o && age >= 0 && age <= OUTLOOK_MAX_AGE_DAYS && (occ.chg ?? 0) > 0 && !LEANS_ON_PREVIOUS.test(o.quote.trim()) ? { quote: o.quote, url: o.url } : null,
  };
}
