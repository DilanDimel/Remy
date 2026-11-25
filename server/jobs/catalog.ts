// Remy's employer catalog: about 15,600 companies' public job boards (Greenhouse, Lever, Ashby, Workable, Recruitee,
// SmartRecruiters), read a 24th at a time on each hourly sweep, so every board is read about once a day.
// Only US postings with a student-level title are kept, with their text, so a search needs no extra reads.
// Each part is one sealed file in the R2 bucket (catalog/part-N); a search reads them from memory. Nothing touches
// Supabase, which keeps the free plan's data transfer flat however many employers Remy reads.
// Board list: StoreSignal ATS job boards directory (CC BY 4.0), see server/data/SOURCES.md.
import fs from "node:fs";
import path from "node:path";
import { htmlToText } from "../resume/parse";
import { r2Store } from "../platform/r2";
import { inUS } from "./fit";
import { fetchBoard, studentTitle, withDetail, type Raw } from "./sources";

type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "recruitee" | "smartrecruiters";
export type CatalogBoard = { ats: Ats; slug: string; company: string };
export const PARTS = 24;
/** Text kept per posting: enough for its requirements and summary (an opening keeps up to 12,000 when saved). */
const TEXT_MAX = 6000;
/** Full-posting reads per board for title-only systems, so one huge board can't eat the hour. */
const DETAILS_PER_BOARD = 12;

export const CATALOG: CatalogBoard[] = fs.readFileSync(path.resolve(process.cwd(), "server", "data", "catalog-boards.tsv"), "utf8")
  .split("\n").filter(Boolean).map((line) => { const [ats, slug, company] = line.split("\t"); return { ats: ats as Ats, slug, company: company || slug }; });

export const partOf = (i: number) => i % PARTS;

async function getJson(url: string) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "RemyBot/1.0 (student career assistant)" }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** One board's postings. Greenhouse is listed without descriptions (some boards have thousands of roles) and only
 *  the kept postings' text is read; the others come through the readers every employer already uses. */
export async function readBoard(b: CatalogBoard, read = fetchBoard): Promise<Raw[]> {
  if (b.ats === "greenhouse") {
    const j = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.slug)}/jobs`);
    return (j.jobs || []).map((x: any): Raw => ({
      title: String(x.title || ""), location: String(x.location?.name || ""), url: String(x.absolute_url || ""), text: "", posted: x.updated_at,
      detail: async () => ({ text: htmlToText(String((await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.slug)}/jobs/${x.id}`)).content || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")) }),
    }));
  }
  return withDetail(await read({ ats: b.ats, slug: b.slug, company: b.company }, ""));
}

/** The postings a board adds to the catalog: US, student-level title, a link, with text (read now if needed). */
export async function keep(b: CatalogBoard, raws: Raw[]): Promise<Raw[]> {
  const out: Raw[] = [];
  let details = 0;
  for (const r of raws) {
    if (!r.url || !(r.student || studentTitle(r.title)) || !inUS(r.location)) continue;
    if (!r.text && r.detail) {
      if (details++ >= DETAILS_PER_BOARD) continue;
      try { const d = await r.detail(); r.text = d.text; if (d.location) r.location = d.location; } catch { continue; }
    }
    out.push({ title: r.title, location: r.location, url: r.url, text: (r.text || "").slice(0, TEXT_MAX), posted: r.posted, deadline: r.deadline, company: r.company || b.company, ats: b.ats });
  }
  return out;
}

export type PartStats = { at: string; boards: number; reached: number; postings: number; kept: number };
export type Meta = { parts: Record<string, PartStats> };

/** Reads every board in one part. Workable turns fast bursts away (HTTP 429), so its boards go one at a time. */
export async function readPart(p: number, boards = CATALOG, read = readBoard, pause: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const mine = boards.filter((_, i) => partOf(i) === p);
  const kept: Raw[] = [];
  let reached = 0, postings = 0;
  const one = async (b: CatalogBoard) => {
    try {
      const raws = await read(b);
      reached++;
      postings += raws.length;
      kept.push(...(await keep(b, raws)));
    } catch {}
  };
  const queue = mine.filter((b) => b.ats !== "workable");
  let i = 0;
  const worker = async () => { while (i < queue.length) await one(queue[i++]); };
  // 4 boards at a time: gentle on each system, and the hour has room for it.
  const slow = (async () => { for (const b of mine.filter((x) => x.ats === "workable")) { await one(b); await pause(1500); } })();
  await Promise.all([...Array.from({ length: 4 }, worker), slow]);
  return { kept, stats: { at: new Date().toISOString(), boards: mine.length, reached, postings, kept: kept.length } as PartStats };
}

// In memory: each part as last loaded, with the time it was read. Refreshed when the catalog's meta says a part is newer.
const parts = new Map<number, { at: string; raws: Raw[] }>();
let meta: Meta | null = null;
let metaAt = 0;
const META_EVERY = 10 * 60_000;

async function loadMeta(store: NonNullable<ReturnType<typeof r2Store>>, force = false) {
  if (force || !meta || Date.now() - metaAt > META_EVERY) { meta = ((await store.get("catalog/meta").catch(() => null)) as Meta | null) || { parts: {} }; metaAt = Date.now(); }
  return meta;
}

/** Run by the sweep: reads the part read longest ago (a missed hour is caught up), unless it was read in the last
 *  20 hours. One part per run. Returns its stats, or null when nothing was due or R2 isn't set up. */
export async function catalogTick(store = r2Store(), read = readBoard, pause?: (ms: number) => Promise<unknown>): Promise<PartStats | null> {
  if (!store) return null;
  const m = await loadMeta(store, true);
  const p = Array.from({ length: PARTS }, (_, k) => k).sort((a, z) => (m.parts[a]?.at || "").localeCompare(m.parts[z]?.at || ""))[0];
  if (Date.now() - Date.parse(m.parts[p]?.at || "") < 20 * 60 * 60_000) return null;
  const { kept, stats } = await readPart(p, CATALOG, read, pause);
  // A part where most boards failed (an outage on our side) keeps its last good copy and is tried again next hour.
  if (stats.reached < stats.boards / 3) { console.warn(`catalog: part ${p} reached only ${stats.reached}/${stats.boards}, kept the old copy`); return null; }
  await store.put(`catalog/part-${p}`, kept);
  m.parts[p] = stats;
  await store.put("catalog/meta", m);
  parts.set(p, { at: stats.at, raws: kept });
  return stats;
}

/** Every catalog posting, for a search. Parts are downloaded once and again only after they're re-read (about daily),
 *  in the background: a search never waits for the download (the first ones after a deploy just get fewer).
 *  Empty when R2 isn't set up or nothing has been read yet. */
let loading: Promise<void> | null = null;
export async function catalogPostings(store = r2Store(), wait = false): Promise<Raw[]> {
  if (!store) return [];
  loading ||= (async () => {
    const m = await loadMeta(store);
    for (const [k, s] of Object.entries(m.parts)) {
      const p = Number(k);
      if (parts.get(p)?.at === s.at) continue;
      const raws = await store.get(`catalog/part-${p}`).catch(() => null);
      if (Array.isArray(raws)) parts.set(p, { at: s.at, raws });
    }
  })().catch(() => {}).finally(() => { loading = null; });
  if (wait) await loading;
  return [...parts.values()].flatMap((x) => x.raws);
}

/** For the owners' Openings page: how far the catalog reaches. */
export async function catalogStats(store = r2Store()) {
  if (!store) return null;
  const m = await loadMeta(store);
  const all = Object.values(m.parts);
  return {
    employers: CATALOG.length,
    partsRead: all.length,
    reached: all.reduce((n, s) => n + s.reached, 0),
    postings: all.reduce((n, s) => n + s.postings, 0),
    studentLevel: all.reduce((n, s) => n + s.kept, 0),
    oldest: all.map((s) => s.at).sort()[0] || null,
  };
}

/** Tests only. */
export const resetCatalog = () => { parts.clear(); meta = null; metaAt = 0; loading = null; };
