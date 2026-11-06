// Checked openings: one shared row per public posting Remy has found or re-checked, tagged by company,
// industry (the setup field chips) and career path (the My Path road), so the team can ask
// "which finance openings did Remy check this week?" without opening a student's workspace.
// Public postings only: no student id, rating or note is ever written here.
// Old rows are discarded: anything not seen or checked for OPENINGS_KEEP_DAYS days (default 30).
import type { Job, JobCheck } from "@shared/types";
import { FIELD_MAJORS } from "@shared/fields";
import { roadFor } from "@shared/roads";
import { orgKey } from "@shared/org";
import { q } from "./sql";

export const keepDays = () => {
  const n = Number(process.env.OPENINGS_KEEP_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 30;
};

// Employer directory words (server/data/employers.json "fields") → the setup field chip they mean.
// Used only when the title alone names no field ("Summer Intern").
const BOARD_FIELD: Record<string, string> = {
  finance: "Finance", quant: "Finance", economics: "Finance", insurance: "Finance", accounting: "Accounting",
  consulting: "Consulting", marketing: "Marketing", merchandising: "Marketing", retail: "Sales", sales: "Sales",
  business: "Business & management", operations: "Supply chain & operations", "supply chain": "Supply chain & operations",
  "real estate": "Real estate", tech: "Software & computer science", data: "Data & analytics", engineering: "Engineering",
  construction: "Architecture & construction", aviation: "Aviation", healthcare: "Healthcare & medicine", nursing: "Nursing",
  research: "Science & research", sustainability: "Environment & sustainability", energy: "Environment & sustainability",
  education: "Education & teaching", "social work": "Psychology & social work", legal: "Law & government", government: "Law & government",
  "public safety": "Public safety", design: "Art & design", entertainment: "Film, theater & music",
  communications: "Journalism & communications", media: "Journalism & communications", hospitality: "Hospitality & events", sports: "Sports & recreation",
};

/** The industry tag: the first setup field whose words appear in the title, else the employer's directory field. */
export function industryOf(title: string, boardFields: string[] = []): string {
  // Narrow labels before broad ones: "Investment banking" before "Finance", "Cybersecurity" before software.
  const order = ["Investment banking", "Cybersecurity", "Data & analytics", "Information systems & IT", ...Object.keys(FIELD_MAJORS)];
  const hit = [...new Set(order)].find((label) => FIELD_MAJORS[label]?.test(title));
  if (hit) return hit;
  for (const f of boardFields) if (BOARD_FIELD[f.toLowerCase()]) return BOARD_FIELD[f.toLowerCase()];
  return "";
}

/** The career path tag: the My Path road key for the title, else for the industry. Empty when no road really fits,
 *  for the same reason roadFor returns null: a wrong road is worse than none. */
export function careerPathOf(title: string, industry: string): string {
  return (roadFor(title) || (industry ? roadFor(industry) : null))?.key || "";
}

export type OpeningTags = { company: string; companyKey: string; industry: string; careerPath: string };
export function tagsOf(job: Pick<Job, "title" | "company">, boardFields: string[] = []): OpeningTags {
  const industry = industryOf(job.title, boardFields);
  return { company: job.company, companyKey: orgKey(job.company), industry, careerPath: careerPathOf(job.title, industry) };
}

const urlOf = (j: Pick<Job, "applyUrl" | "sourceUrl">) => (j.sourceUrl || j.applyUrl || "").trim();
// Student-written or sample openings never go in the shared table: only postings read from a public site.
const shareable = (j: Job) => j.origin === "imported" && j.label !== "Demo data" && j.label !== "Student provided" && /^https?:\/\//i.test(urlOf(j)) && j.kind !== "event";

/** Records openings Remy just found. Seen again → last_seen moves and times_seen counts up; tags are refreshed. */
export async function recordFound(jobs: Job[], boardFieldsByCompany: Record<string, string[]> = {}): Promise<number> {
  const rows = jobs.filter(shareable);
  for (const j of rows) {
    const t = tagsOf(j, boardFieldsByCompany[j.company] || []);
    await q(
      `INSERT INTO checked_openings (url, title, company, company_key, kind, location, industry, career_path, source_name, deadline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, company = EXCLUDED.company, company_key = EXCLUDED.company_key,
         kind = EXCLUDED.kind, location = EXCLUDED.location, industry = EXCLUDED.industry, career_path = EXCLUDED.career_path,
         source_name = EXCLUDED.source_name, deadline = EXCLUDED.deadline, last_seen = now(), times_seen = checked_openings.times_seen + 1`,
      [urlOf(j), j.title.slice(0, 300), j.company.slice(0, 200), t.companyKey, j.kind, j.location.slice(0, 200), t.industry, t.careerPath, j.sourceName.slice(0, 200), j.deadline || ""],
    );
  }
  return rows.length;
}

/** Records the result of a page check (still open, closed wording, unreachable). Adds the opening if it's new. */
export async function recordCheck(job: Job, check: JobCheck): Promise<void> {
  if (!shareable(job)) return;
  await recordFound([job]);
  await q("UPDATE checked_openings SET last_checked = $2, check_result = $3, http_status = $4 WHERE url = $1",
    [urlOf(job), check.at, check.result, check.httpStatus]);
}

/** Discards openings not seen or checked for `days` days. Returns how many were removed. */
export async function pruneOpenings(days = keepDays()): Promise<number> {
  const r = await q(
    `DELETE FROM checked_openings WHERE GREATEST(last_seen, COALESCE(last_checked, last_seen)) < now() - make_interval(days => $1::int) RETURNING url`,
    [days],
  );
  return r.length;
}

export type OpeningFilter = { company?: string; industry?: string; careerPath?: string; status?: "open" | "closed" | "unchecked"; limit?: number };
/** Openings by tag, newest first. "open" = the last check reached the page with no closed wording. */
export async function listOpenings(f: OpeningFilter = {}) {
  const where: string[] = [], params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
  if (f.company) add("company_key = ?", orgKey(f.company));
  if (f.industry) add("lower(industry) = lower(?)", f.industry);
  if (f.careerPath) add("career_path = ?", f.careerPath);
  if (f.status === "open") where.push("check_result = 'reachable'");
  if (f.status === "closed") where.push("check_result = 'closed-signal'");
  if (f.status === "unchecked") where.push("check_result IS NULL");
  params.push(Math.min(Math.max(f.limit || 100, 1), 500));
  return q(
    `SELECT url, title, company, kind, location, industry, career_path, source_name, deadline, first_seen, last_seen, times_seen, last_checked, check_result, http_status
     FROM checked_openings ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY last_seen DESC, url LIMIT $${params.length}`,
    params,
  );
}

/** Counts per industry and career path, for the owners' dashboard. */
export async function openingsSummary() {
  const [byIndustry, byPath, totals] = await Promise.all([
    q("SELECT industry, COUNT(*)::int AS n FROM checked_openings GROUP BY industry ORDER BY n DESC, industry"),
    q("SELECT career_path, COUNT(*)::int AS n FROM checked_openings GROUP BY career_path ORDER BY n DESC, career_path"),
    q(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE check_result = 'closed-signal')::int AS closed,
              COUNT(*) FILTER (WHERE check_result IS NULL)::int AS unchecked, COUNT(DISTINCT company_key)::int AS companies FROM checked_openings`),
  ]);
  return { ...totals[0], keepDays: keepDays(), byIndustry, byPath };
}
