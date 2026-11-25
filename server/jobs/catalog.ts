// Remy's employer catalog: about 80,000 companies' public job boards (Greenhouse, Lever, Ashby, Workable, Recruitee,
// SmartRecruiters, Workday, Oracle, BambooHR, Breezy, JazzHR, Paylocity, Rippling), read a 24th at a time on each hourly sweep, so every board is read about once a day.
// Only US postings with a student-level title are kept, with their text, so a search needs no extra reads.
// Each part is one sealed file in the R2 bucket (catalog/part-N); a search reads them from memory. Nothing touches
// Supabase, which keeps the free plan's data transfer flat however many employers Remy reads.
// Board list: StoreSignal ATS job boards directory (CC BY 4.0), see server/data/SOURCES.md, plus the boards in
// Stapply's open company lists (storage.stapply.ai), fetched weekly into R2 and never copied into the repo.
import fs from "node:fs";
import path from "node:path";
import { htmlToText } from "../resume/parse";
import { r2Store } from "../platform/r2";
import { inUS } from "./fit";
import { fetchBoard, studentTitle, withDetail, type Raw } from "./sources";

type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "recruitee" | "smartrecruiters" | "workday" | "oracle" | "bamboohr" | "breezy" | "jazzhr" | "paylocity" | "rippling";
export type CatalogBoard = { ats: Ats; slug: string; company: string };
export const PARTS = 24;
/** Text kept per posting: enough for its requirements and summary (an opening keeps up to 12,000 when saved). */
const TEXT_MAX = 4000; // about 42,000 boards' openings stay in memory on a 512 MB server
/** Full-posting reads per board for title-only systems, so one huge board can't eat the hour. */
const DETAILS_PER_BOARD = 12;
/** Openings kept per board, so one giant employer can't fill the catalog. */
const PER_BOARD = 12;

export const CATALOG: CatalogBoard[] = fs.readFileSync(path.resolve(process.cwd(), "server", "data", "catalog-boards.tsv"), "utf8")
  .split("\n").filter(Boolean).map((line) => { const [ats, slug, company] = line.split("\t"); return { ats: ats as Ats, slug, company: company || slug }; });

/** A board's part, from its system and id, so it stays put as the list grows. */
export const partOf = (b: CatalogBoard) => {
  let h = 0;
  for (const c of `${b.ats}:${b.slug.toLowerCase()}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % PARTS;
};

const sub = (s: string) => (/^[a-z0-9][a-z0-9-]*$/i.test(s) ? s : null);
// Stapply's per-system company lists (name,slug,url). Each row's url gives the board in the form Remy's readers take.
const STAPPLY = "https://storage.stapply.ai/jobs/v1";
const STAPPLY_ATS: Record<Ats, (slug: string, url: string) => string | null> = {
  greenhouse: (s) => s, lever: (s) => s, ashby: (s) => s, workable: (s) => s, recruitee: (s) => s, smartrecruiters: (s) => s,
  // https://23andme.wd5.myworkdayjobs.com/en-US/23 → "23andme|wd5|23"
  workday: (_, u) => { const m = u.match(/^https:\/\/([^./]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/); return m ? `${m[1]}|${m[2]}|${m[3]}` : null; },
  // https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX → "ebwg.fa.us2.oraclecloud.com|CX"
  oracle: (_, u) => { const m = u.match(/^https:\/\/([^/]+\.oraclecloud\.com)\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/?#]+)/); return m ? `${m[1]}|${m[2]}` : null; },
  // Mid-size employers: subdomains (bamboohr, breezy, jazzhr's applytojob), a Rippling board name, a Paylocity company GUID.
  bamboohr: sub, breezy: sub, jazzhr: sub, rippling: sub,
  paylocity: (s) => (/^[0-9a-f-]{36}$/i.test(s) ? s : null),
};

/** Rows of a CSV with quoted fields. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const getText = async (url: string) => {
  const r = await fetch(url, { headers: { "User-Agent": "RemyBot/1.0 (student career assistant)" }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};
/** Boards from Stapply's lists for the systems Remy reads. A system whose list fails is skipped. */
export async function stapplyBoards(get = getText): Promise<CatalogBoard[]> {
  const out: CatalogBoard[] = [];
  for (const ats of Object.keys(STAPPLY_ATS) as Ats[]) {
    try {
      for (const [name, slug, url] of csvRows(await get(`${STAPPLY}/${ats}/companies.csv`)).slice(1)) {
        const board = slug && STAPPLY_ATS[ats](slug, url || "");
        if (board) out.push({ ats, slug: board, company: (name || "").trim() || board });
      }
    } catch (e) { console.warn(`catalog: Stapply ${ats} list failed: ${(e as Error).message}`); }
  }
  return out;
}

// Every board: the repo's list, then the fetched ones it doesn't already have.
let extra: { at: string; boards: CatalogBoard[] } | null = null;
const LIST_EVERY = 7 * 24 * 60 * 60_000;
const key = (b: CatalogBoard) => `${b.ats}:${b.slug.toLowerCase()}`;
export function allBoards(): CatalogBoard[] {
  if (!extra?.boards.length) return CATALOG;
  const seen = new Set(CATALOG.map(key));
  return [...CATALOG, ...extra.boards.filter((b) => !seen.has(key(b)) && !!seen.add(key(b)))];
}
async function loadExtra(store: NonNullable<ReturnType<typeof r2Store>>, list: (() => Promise<CatalogBoard[]>) | null = stapplyBoards) {
  extra ||= ((await store.get("catalog/boards").catch(() => null)) as typeof extra) || { at: "", boards: [] };
  if (list && !(Date.now() - Date.parse(extra.at || "") < LIST_EVERY)) { // never fetched: NaN, so due
    const boards = await list();
    // A fetch that came back short (an outage) keeps the old list.
    if (boards.length && boards.length > extra.boards.length / 2) { extra = { at: new Date().toISOString(), boards }; await store.put("catalog/boards", extra); }
  }
}

async function getJson(url: string) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "RemyBot/1.0 (student career assistant)" }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
// Paylocity, JazzHR and Rippling serve their boards as web pages, which answer a browser's user agent.
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
async function getPage(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": BROWSER }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
/** A posting page's schema.org JobPosting description (Breezy, Paylocity). */
export function ldDescription(html: string): string {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try { const d = [JSON.parse(m[1])].flat().find((x: any) => x?.["@type"] === "JobPosting"); if (d?.description) return htmlToText(String(d.description)); } catch {}
  }
  return "";
}
/** A JazzHR board page's postings: link, title and place. */
export function jazzList(html: string): { url: string; title: string; location: string }[] {
  return [...html.matchAll(/<a href="(https:\/\/[^"]+\.applytojob\.com\/apply\/[^"]+)">\s*([^<]+?)\s*<\/a>\s*<\/h3>\s*<ul[^>]*>\s*(?:<li><i class='fa fa-map-marker'><\/i>([^<]*)<\/li>)?/g)]
    .map((m) => ({ url: m[1], title: htmlToText(m[2]), location: htmlToText(m[3] || "") }));
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
  const slug = encodeURIComponent(b.slug);
  if (b.ats === "bamboohr") {
    const j = await getJson(`https://${slug}.bamboohr.com/careers/list`);
    return (j.result || []).map((x: any): Raw => ({
      title: String(x.jobOpeningName || "").trim(), location: [[x.location?.city, x.location?.state].filter(Boolean).join(", "), x.isRemote ? "Remote" : ""].filter(Boolean).join(" · "),
      url: `https://${slug}.bamboohr.com/careers/${x.id}`, text: "",
      detail: async () => { const d = (await getJson(`https://${slug}.bamboohr.com/careers/${x.id}/detail`)).result?.jobOpening || {}; return { text: htmlToText(String(d.description || "")) }; },
    }));
  }
  if (b.ats === "breezy") {
    const j = await getJson(`https://${slug}.breezy.hr/json`);
    return (Array.isArray(j) ? j : []).map((x: any): Raw => ({
      title: String(x.name || ""), location: [x.location?.name, x.location?.is_remote && x.location?.country?.id === "US" ? "Remote" : ""].filter(Boolean).join(" · "),
      url: String(x.url || ""), text: "", posted: x.published_date, detail: async () => ({ text: ldDescription(await getPage(String(x.url))) }),
    }));
  }
  if (b.ats === "paylocity") {
    const m = (await getPage(`https://recruiting.paylocity.com/Recruiting/Jobs/All/${slug}`)).match(/window\.pageData = (\{.*\});\s*$/m);
    return ((m ? JSON.parse(m[1]).Jobs : []) || []).filter((x: any) => !x.IsInternal).map((x: any): Raw => {
      const url = `https://recruiting.paylocity.com/Recruiting/Jobs/Details/${x.JobId}`;
      const l = x.JobLocation || {};
      return { title: String(x.JobTitle || ""), location: [l.City, l.State, l.Country].filter(Boolean).join(", ") || String(x.LocationName || ""), url, text: "", posted: x.PublishedDate, detail: async () => ({ text: ldDescription(await getPage(url)) }) };
    });
  }
  if (b.ats === "jazzhr") {
    return jazzList(await getPage(`https://${slug}.applytojob.com/apply`)).map((x): Raw => ({
      ...x, text: "",
      detail: async () => { const h = await getPage(x.url); const i = h.indexOf('id="job-description"'); return { text: i < 0 ? "" : htmlToText(h.slice(i + 21, i + 40_000).split(/<div[^>]+id="resumator-|<form/)[0]) }; },
    }));
  }
  if (b.ats === "rippling") {
    const items: any[] = [];
    for (let page = 0; page < 5; page++) { // a few hundred roles at most; big boards list newest first
      const j = await getJson(`https://ats.rippling.com/api/v2/board/${slug}/jobs?page=${page}`);
      items.push(...(j.items || []));
      if (page + 1 >= (j.totalPages || 0)) break;
    }
    return items.map((x: any): Raw => ({
      title: String(x.name || ""), location: (x.locations || []).map((l: any) => l.name).filter(Boolean).join("; "), url: String(x.url || ""), text: "",
      detail: async () => {
        const m = (await getPage(String(x.url))).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        return { text: m ? htmlToText(String(JSON.parse(m[1]).props?.pageProps?.apiData?.jobPost?.description?.role || "")) : "" };
      },
    }));
  }
  return withDetail(await read({ ats: b.ats as Parameters<typeof read>[0]["ats"], slug: b.slug, company: b.company }, ""));
}

/** The postings a board adds to the catalog: US, student-level title, a link, with text (read now if needed). */
export async function keep(b: CatalogBoard, raws: Raw[]): Promise<Raw[]> {
  const out: Raw[] = [];
  let details = 0;
  for (const r of raws) {
    if (out.length >= PER_BOARD) break;
    if (!r.url || !(r.student || studentTitle(r.title)) || !inUS(r.location)) continue;
    if (!r.text && r.detail) {
      if (details++ >= DETAILS_PER_BOARD) continue;
      try { const d = await r.detail(); r.text = d.text; if (d.location) r.location = d.location; } catch { continue; }
    }
    out.push({ title: r.title, location: r.location, url: r.url, text: (r.text || "").slice(0, TEXT_MAX), posted: r.posted, deadline: r.deadline, company: r.company || b.company, ats: b.ats });
  }
  return out;
}

export type PartStats = { at: string; boards: number; reached: number; postings: number; kept: number; texas?: number };
const TEXAS = /\b(TX|Texas)\b/;
export type Meta = { parts: Record<string, PartStats> };

/** Reads every board in one part. Workable and Paylocity turn fast bursts away (HTTP 429), so each of them gets its own
 *  lane, one board at a time. */
const SLOW: Ats[] = ["workable", "paylocity"];
export async function readPart(p: number, boards = CATALOG, read = readBoard, pause: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const mine = boards.filter((b) => partOf(b) === p);
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
  const queue = mine.filter((b) => !SLOW.includes(b.ats));
  let i = 0;
  const worker = async () => { while (i < queue.length) await one(queue[i++]); };
  // 4 boards at a time: gentle on each system, and the hour has room for it.
  const slow = SLOW.map(async (ats) => { for (const b of mine.filter((x) => x.ats === ats)) { await one(b); await pause(1500); } });
  await Promise.all([...Array.from({ length: 4 }, worker), ...slow]);
  return { kept, stats: { at: new Date().toISOString(), boards: mine.length, reached, postings, kept: kept.length, texas: kept.filter((r) => TEXAS.test(r.location)).length } as PartStats };
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
let ticking = false;
export async function catalogTick(store = r2Store(), read = readBoard, pause?: (ms: number) => Promise<unknown>, list?: () => Promise<CatalogBoard[]>): Promise<PartStats | null> {
  if (!store || ticking) return null; // a part can outlast the hour; the next sweep must not read it again
  ticking = true;
  try { return await tick(store, read, pause, list); } finally { ticking = false; }
}
async function tick(store: NonNullable<ReturnType<typeof r2Store>>, read: typeof readBoard, pause?: (ms: number) => Promise<unknown>, list?: () => Promise<CatalogBoard[]>) {
  await loadExtra(store, list).catch((e) => console.warn(`catalog: board list: ${(e as Error).message}`));
  const m = await loadMeta(store, true);
  const p = Array.from({ length: PARTS }, (_, k) => k).sort((a, z) => (m.parts[a]?.at || "").localeCompare(m.parts[z]?.at || ""))[0];
  if (Date.now() - Date.parse(m.parts[p]?.at || "") < 20 * 60 * 60_000) return null;
  const { kept, stats } = await readPart(p, allBoards(), read, pause);
  // A part where most boards failed (an outage on our side) keeps its last good copy and is tried again next hour.
  if (stats.reached < stats.boards / 3) { console.warn(`catalog: part ${p} reached only ${stats.reached}/${stats.boards}, kept the old copy`); return null; }
  await store.put(`catalog/part-${p}`, kept);
  m.parts[p] = stats;
  await store.put("catalog/meta", m);
  parts.set(p, { at: stats.at, raws: kept });
  console.log(`catalog: part ${p} kept ${stats.kept} (${stats.texas} in Texas) from ${stats.reached}/${stats.boards} boards; memory ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
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
  await loadExtra(store, null).catch(() => {}); // the count only; the sweep does the fetching
  const all = Object.values(m.parts);
  return {
    employers: allBoards().length,
    partsRead: all.length,
    reached: all.reduce((n, s) => n + s.reached, 0),
    postings: all.reduce((n, s) => n + s.postings, 0),
    studentLevel: all.reduce((n, s) => n + s.kept, 0),
    texas: all.reduce((n, s) => n + (s.texas || 0), 0),
    oldest: all.map((s) => s.at).sort()[0] || null,
  };
}

/** Tests only. */
export const resetCatalog = () => { parts.clear(); meta = null; metaAt = 0; loading = null; extra = null; ticking = false; };
