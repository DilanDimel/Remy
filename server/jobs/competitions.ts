import type { Job, Me, Workspace } from "@shared/types";
import { accessOf } from "@shared/features";
import { roadFor } from "@shared/roads";
import { aiJson } from "../ai/ai";
import { fetchPublic, htmlToText } from "../resume/parse";
import { uid } from "../platform/ids";
import { q } from "../platform/sql";
import * as admin from "../platform/admin";
import * as features from "../platform/features";
import { readBoardCache } from "./sources";
import { pageShowsDate } from "./conferences";

// Competition finder (owners first, Nov 24): case competitions, trading challenges, hackathons, pitch and design
// contests for the student's field, like the Bloomberg Global Trading Challenge. Built like the conference finder:
// once a month per field the researcher (live web) lists them, Remy opens each official page and keeps only the ones
// whose page shows the date it gives and says it's a competition. One search serves every student in that field.
const RESEARCH_MODEL = process.env.OR_RESEARCH_CHAIN || "openrouter:perplexity/sonar";
export const COMP_FRESH = 30 * 24 * 60 * 60_000;

export const COMP_KINDS = ["case", "trading", "hackathon", "pitch", "design", "research", "other"] as const;
type Kind = (typeof COMP_KINDS)[number];
/** What the researcher returns. `deadline` is the registration or entry deadline, `start` the competition itself. */
export type Comp = { name: string; organizer: string; kind: Kind; deadline: string; start: string; end: string; location: string; entry: "open" | "school"; url: string };

/** Well-known recurring competitions per field, given to the researcher as starting points only.
 *  Nothing here is listed unless the researcher finds its current official page and that page shows the dates. */
const KNOWN: [RegExp, string[]][] = [
  [/finance|investment|economics|financial|actuar|insurance|real estate/i, ["Bloomberg Global Trading Challenge", "CFA Institute Research Challenge", "Rotman International Trading Competition"]],
  [/accounting/i, ["Deloitte FanTAXtic case competition", "IMA Student Case Competition", "CFA Institute Research Challenge"]],
  [/actuar/i, ["Society of Actuaries student case study challenge"]],
  [/real estate/i, ["NAIOP University Challenge", "ULI Hines Student Competition"]],
  [/marketing|sales|advertis/i, ["AAF National Student Advertising Competition", "National Collegiate Sales Competition"]],
  [/supply chain/i, ["ASCM case competition"]],
  [/management|consult|business|entrepreneur|human resources/i, ["undergraduate case competitions run by business schools and consulting firms", "Hult Prize"]],
  [/entrepreneur/i, ["Hult Prize", "university business plan and pitch competitions open to all schools"]],
  [/tech|computer|information systems|software/i, ["Major League Hacking hackathons", "Microsoft Imagine Cup", "ICPC programming contest", "NASA Space Apps Challenge"]],
  [/engineering/i, ["SAE Collegiate Design Series", "ASCE Concrete Canoe and Student Steel Bridge", "AIChE Chem-E-Car", "NASA student design challenges"]],
  [/architecture/i, ["ACSA student design competitions"]],
  [/health|med|nurs|pharm|dental|vet/i, ["Emory Global Health Case Competition", "health care case competitions for undergraduates"]],
  [/law/i, ["American Mock Trial Association tournaments", "undergraduate moot court competitions"]],
];
export const knownFor = (field: string) => [...new Set(KNOWN.filter(([re]) => re.test(field)).flatMap(([, n]) => n))].slice(0, 6);

/** The page says it's a contest of some kind (not just a news story or a course). */
const COMPETITION_WORDS = /\b(competition|challenge|hackathon|contest|case comp|pitch|tournament|cup)\b/i;
const iso = (s: unknown) => (typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s) ? s : "");

async function search(field: string, today: string): Promise<Comp[]> {
  const known = knownFor(field);
  const out = await aiJson<{ competitions: Comp[] }>(
    "You find real, upcoming competitions college students can enter: case competitions, trading and investing challenges, hackathons, pitch and business plan contests, design and research challenges. Only list competitions whose current official page you found and that shows this year's dates or deadline. Never guess dates or links. Leave out contests only one university's own students can enter, high-school contests, and paid courses.",
    `Field: ${field}. Today is ${today}. List up to 8 competitions open to undergraduates in the United States (or worldwide) whose registration deadline or start is in the next 9 months.${known.length ? ` Check these first if they have a current edition: ${known.join("; ")}.` : ""} For each, "entry" is "school" when teams enter through their university (a professor, lab or club signs them up) and "open" when a student can sign up directly. Return {"competitions":[{"name":"","organizer":"","kind":"case|trading|hackathon|pitch|design|research|other","deadline":"YYYY-MM-DD or empty","start":"YYYY-MM-DD or empty","end":"YYYY-MM-DD or empty","location":"City, ST or Virtual","entry":"open|school","url":"official page"}]}`,
    1800, RESEARCH_MODEL,
  );
  const found = (out.competitions || []).filter((c) => c?.name && /^https:\/\//.test(c.url || "") && (iso(c.deadline) || iso(c.start)) > today);
  const kept: Comp[] = [];
  for (const c of found.slice(0, 8)) {
    try {
      const r = await fetchPublic(c.url);
      if (r.status >= 400) continue;
      const text = htmlToText(r.html);
      const deadline = iso(c.deadline) && pageShowsDate(text, c.deadline) ? c.deadline : "";
      const start = iso(c.start) && pageShowsDate(text, c.start) ? c.start : "";
      // Kept only when the official page shows at least one of the dates the researcher gave, and calls itself a contest.
      if ((!deadline && !start) || !COMPETITION_WORDS.test(text)) continue;
      kept.push({
        name: String(c.name).slice(0, 160), organizer: String(c.organizer || "").slice(0, 120),
        kind: COMP_KINDS.includes(c.kind) ? c.kind : "other", deadline, start, end: start && iso(c.end) >= start ? c.end : "",
        location: String(c.location || "").slice(0, 80), entry: c.entry === "school" ? "school" : "open", url: r.finalUrl || c.url,
      });
    } catch {}
  }
  return kept;
}

const KIND_WORDS: Record<Kind, string> = { case: "case competition", trading: "trading challenge", hackathon: "hackathon", pitch: "pitch competition", design: "design competition", research: "research challenge", other: "competition" };
const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** One found competition as an opening ("event", so the student's "Competitions" choice and the calendar handle it). */
export function compToJob(c: Comp, fieldLabel: string, now = new Date()): Job {
  const what = KIND_WORDS[c.kind] || "competition";
  const how = c.entry === "school"
    ? " Teams usually enter through their university, so ask your department, a professor or the related student club whether your school takes part."
    : "";
  return {
    id: uid("j"), kind: "event", title: c.name, company: c.organizer || c.name, location: c.location || "Not stated",
    format: /virtual|online/i.test(c.location) ? "Remote" : "In person",
    dates: c.start ? (c.end && c.end !== c.start ? `${fmt(c.start)} to ${fmt(c.end)}` : fmt(c.start)) : "",
    deadline: c.deadline,
    deadlineText: c.deadline ? `Sign up by ${fmt(c.deadline)}` : `Starts ${fmt(c.start)}. Check the page for the sign-up deadline`,
    eligibility: [], requirements: [],
    summary: `A ${what}${c.organizer ? ` by ${c.organizer}` : ""} for ${fieldLabel.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())} students. Competitions let you practice real work, add a result to your resume and meet recruiters.${how}`,
    applyUrl: c.url, sourceUrl: c.url, sourceName: "Competition found by Remy's researcher (dates checked on the official page)",
    label: "Live", checkedAt: now.toISOString(), foundAt: now.toISOString(), checks: [], origin: "imported",
  };
}

/** Upcoming competitions for the student's field, as event openings. Empty when Remy can't tell their field or AI is off. */
export async function competitionsFor(ws: Workspace, find = search): Promise<Job[]> {
  const p = ws.profile;
  const road = roadFor(p.major, p.path) || roadFor([p.targetRoles, p.interests].join(" "), p.path);
  if (!road) return [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const key = `competitions|${road.key}`;
  const hit = await readBoardCache(key).catch(() => undefined);
  let list = hit?.raws as Comp[] | undefined;
  if (!hit || Date.now() - new Date(hit.fetched_at).getTime() > COMP_FRESH) {
    try {
      list = await find(road.label, today);
      // An empty answer is saved too, so a field with nothing found isn't searched again for a month.
      await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", [key, JSON.stringify(list)]).catch(() => {});
    } catch {}
  }
  // Still open: the sign-up deadline (or, without one, the start) hasn't passed.
  return (list || []).filter((c) => (c.deadline || c.start) >= today).map((c) => compToJob(c, road.label));
}

/** Owners first: real owners in owner view, everyone once the `competitions` switch is released (Admin → Beta). */
export async function competitionsOpen(me: Pick<Me, "kind" | "email">, ws: Workspace): Promise<boolean> {
  const owner = ws.settings?.ownerView !== false && (await admin.isOwner(me).catch(() => false));
  return accessOf(await features.releases(), "competitions", owner) === "open";
}
