import type { Job, Workspace } from "@shared/types";
import { roadFor } from "@shared/roads";
import { aiJson } from "../ai/ai";
import { fetchPublic, htmlToText } from "../resume/parse";
import { uid } from "../platform/ids";
import { q, q1 } from "../platform/sql";

/** Web-search model for conference research (was shared with the removed Agents tab). */
const RESEARCH_MODEL = process.env.OR_RESEARCH_CHAIN || "openrouter:perplexity/sonar";

// Conference finder: once a month per field, the researcher (Perplexity Sonar, live web) lists upcoming student
// conferences; Remy opens each page and keeps only the ones whose page shows the start date. One search serves every student.
export const CONF_FRESH = 30 * 24 * 60 * 60_000;
type Conf = { name: string; organizer: string; start: string; end: string; location: string; url: string };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** The page names the start date: "March 5", "Mar 5-7", "5 March", "3/5/2027" or "2027-03-05". */
export function pageShowsDate(text: string, start: string): boolean {
  const m = start.match(/^(\d{4})-(\d\d)-(\d\d)$/);
  if (!m) return false;
  const [y, mo, d] = [m[1], +m[2], +m[3]];
  const name = MONTHS[mo - 1], short = name.slice(0, 3);
  const t = text.toLowerCase();
  return new RegExp(`\\b(${name}|${short}\\.?)\\s+0?${d}\\b|\\b0?${d}(st|nd|rd|th)?\\s+(${name}|${short})\\b`).test(t)
    || t.includes(`${mo}/${d}/${y}`) || t.includes(`${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`) || t.includes(start);
}

async function search(field: string, today: string): Promise<Conf[]> {
  const out = await aiJson<{ conferences: Conf[] }>(
    "You find real, upcoming conferences, conventions and career fairs that college students can attend. Only list events whose official page you found and that show their dates. Never guess dates or links. Leave out career fairs a university runs for its own students, and continuing-education courses for working professionals.",
    `Field: ${field}. Today is ${today}. List up to 8 conferences or national career conventions open to college students from any school in this field in the United States in the next 9 months (Texas ones first, then national ones like professional-association conventions). Return {"conferences":[{"name":"","organizer":"","start":"YYYY-MM-DD","end":"YYYY-MM-DD","location":"City, ST or Virtual","url":"official event page"}]}`,
    1500, RESEARCH_MODEL,
  );
  // A university's own career fair is for its students only, so it's not listed even if the researcher returns one.
  const ownFair = (c: Conf) => /^https:\/\/[^/]*\.edu(\/|$)/i.test(c.url) && /fair|expo/i.test(c.name);
  const found = (out.conferences || []).filter((c) => /^https:\/\//.test(c?.url || "") && c.start > today && c.name && !ownFair(c) && !/prof-dev|continuing-ed|executive\./i.test(c.url));
  const kept: Conf[] = [];
  for (const c of found.slice(0, 8)) {
    try {
      const r = await fetchPublic(c.url);
      if (r.status < 400 && pageShowsDate(htmlToText(r.html), c.start))
        kept.push({ name: String(c.name).slice(0, 160), organizer: String(c.organizer || "").slice(0, 120), start: c.start, end: /^\d{4}-\d\d-\d\d$/.test(c.end) ? c.end : "", location: String(c.location || "").slice(0, 80), url: r.finalUrl || c.url });
    } catch {}
  }
  return kept;
}

/** Upcoming conferences for the student's field, as event openings. Empty when Remy can't tell their field or AI is off. */
export async function conferencesFor(ws: Workspace, find = search): Promise<Job[]> {
  const p = ws.profile;
  const road = roadFor(p.major, p.path) || roadFor([p.targetRoles, p.interests].join(" "), p.path);
  if (!road) return [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const key = `conferences|${road.key}`;
  const hit = await q1("SELECT raws, fetched_at FROM board_cache WHERE key = $1", [key]).catch(() => undefined);
  let list = hit?.raws as Conf[] | undefined;
  if (!hit || Date.now() - new Date(hit.fetched_at).getTime() > CONF_FRESH) {
    try {
      list = await find(road.label, today);
      // An empty answer is saved too, so a field with nothing found isn't searched again for a month.
      await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", [key, JSON.stringify(list)]).catch(() => {});
    } catch {}
  }
  const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (list || []).filter((c) => c.start >= today).map((c) => ({
    id: uid("j"), kind: "event", title: c.name, company: c.organizer || c.name, location: c.location || "Not stated",
    format: /virtual|online/i.test(c.location) ? "Remote" : "In person", dates: c.end && c.end !== c.start ? `${fmt(c.start)} to ${fmt(c.end)}` : fmt(c.start),
    deadline: "", deadlineText: `Starts ${fmt(c.start)}. Check the page for registration deadlines`, eligibility: [], requirements: [],
    summary: `A ${road.label.toLowerCase()} conference${c.organizer ? ` by ${c.organizer}` : ""}. Conferences are where students meet recruiters and learn about early programs.`,
    applyUrl: c.url, sourceUrl: c.url, sourceName: "Conference found by Remy's researcher (dates checked on the event page)",
    label: "Live", checkedAt: new Date().toISOString(), foundAt: new Date().toISOString(), checks: [], origin: "imported",
  }));
}
