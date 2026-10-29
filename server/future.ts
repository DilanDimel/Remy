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

// Remy's career fields (server/fit.ts) → Standard Occupational Classification code prefixes.
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

export type FutureOcc = { title: string; change: number; openings: number | null; wage: number | null; education: string; aiShare: number | null; link: string };
export type FutureField = { field: string; growing: FutureOcc[]; shrinking: FutureOcc[]; total: number; fasterThanAverage: number };

const view = (o: Occ): FutureOcc => ({ title: o.t, change: o.chg ?? 0, openings: o.open, wage: o.wage, education: o.edu, aiShare: o.ai ?? null, link: o.ooh });

export function futureFor(ws: Workspace): { source: string; allJobsGrowth: number; fields: FutureField[] } {
  const wants = [ws.profile.targetRoles, ws.profile.major, ws.profile.interests].join(" ");
  const fields = FIELD_SEARCH.filter((_, k) => FIELD_TITLES[k][0].test(wants)).slice(0, 3);
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
