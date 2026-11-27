// Remy's private team library: what the team knows beyond Slack and the public repo (calendar, meeting summaries,
// project files, memory notes, the facts card), pushed by the lead AI's nightly sync through POST /api/team/library
// with its key (REMY_AI_KEY). The repo is public, so none of this lives in it: rows in team_library, files sealed in R2.
// Two tiers: "team" (anyone on the team, in channels too) and "dilan" (only in Dilan's own DMs with Remy).
import { q } from "./sql";
import { r2Store } from "./r2";

export type Tier = "team" | "dilan";
export type Item = {
  id: string; title: string; body?: string; url?: string; tier: Tier; pinned?: boolean;
  starts_at?: string | null; channel?: string | null; hash?: string;
  file_name?: string | null; file?: { type: string; b64: string } | null;
};
export type Found = { id: string; source: string; title: string; body: string; url: string; tier: Tier; file_name: string | null; starts_at: string | null; updated_at: string };

const MAX_FILE = 5 * 1024 * 1024;
// R2 signs the raw path, and ":" would need escaping, so swap it for "~" (never in an id, so no clashes).
const fileKey = (id: string) => `library/${id.replace(/:/g, "~")}`;

/** Checks one pushed item; the reason it's refused, or "". */
export function badItem(it: any): string {
  if (!it || typeof it.id !== "string" || !/^[\w.:/-]{1,200}$/.test(it.id)) return "id: 1-200 letters, digits, . : / - _";
  if (typeof it.title !== "string" || !it.title.trim() || it.title.length > 300) return `${it.id}: title 1-300 characters`;
  if (it.body != null && (typeof it.body !== "string" || it.body.length > 60_000)) return `${it.id}: body up to 60,000 characters`;
  if (it.tier !== "team" && it.tier !== "dilan") return `${it.id}: tier must be "team" or "dilan"`;
  if (it.starts_at != null && Number.isNaN(Date.parse(it.starts_at))) return `${it.id}: starts_at must be a date`;
  if (it.file && (typeof it.file.b64 !== "string" || Buffer.byteLength(it.file.b64, "base64") > MAX_FILE)) return `${it.id}: file up to 5 MB, base64`;
  if (it.file && !it.file_name) return `${it.id}: a file needs file_name`;
  return "";
}

/** Saves one source's items. replace: the list is the whole source, so items no longer in it are removed (and their files). */
export async function putItems(source: string, items: Item[], replace = false): Promise<{ saved: number; removed: number }> {
  const store = r2Store();
  for (const it of items) {
    // A file without its bytes keeps the one already stored (the sender saw the same hash in GET /api/team/library).
    if (it.file) {
      if (!store) throw new Error("file storage (R2) isn't set up on this server");
      await store.put(fileKey(it.id), { name: it.file_name, type: it.file.type || "application/octet-stream", b64: it.file.b64 });
    }
    await q(
      `INSERT INTO team_library (id, source, title, body, url, tier, pinned, starts_at, channel, file_name, hash, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       ON CONFLICT (id) DO UPDATE SET source = EXCLUDED.source, title = EXCLUDED.title, body = EXCLUDED.body, url = EXCLUDED.url,
         tier = EXCLUDED.tier, pinned = EXCLUDED.pinned, channel = EXCLUDED.channel, file_name = EXCLUDED.file_name, hash = EXCLUDED.hash,
         reminded_at = CASE WHEN team_library.starts_at IS DISTINCT FROM EXCLUDED.starts_at THEN NULL ELSE team_library.reminded_at END,
         starts_at = EXCLUDED.starts_at, updated_at = now()`,
      [it.id, source, it.title.trim(), it.body || "", it.url || "", it.tier, !!it.pinned, it.starts_at || null, it.channel || null, it.file_name || null, it.hash || ""],
    );
  }
  let removed = 0;
  if (replace) {
    const gone = await q("SELECT id, file_name FROM team_library WHERE source = $1 AND NOT (id = ANY($2))", [source, items.map((i) => i.id)]);
    for (const g of gone) if (g.file_name && store) await store.del(fileKey(g.id)).catch(() => {});
    if (gone.length) await q("DELETE FROM team_library WHERE id = ANY($1)", [gone.map((g) => g.id)]);
    removed = gone.length;
  }
  return { saved: items.length, removed };
}

/** What the sync needs to skip unchanged items: id, source, hash. */
export const listItems = () => q("SELECT id, source, hash, updated_at FROM team_library ORDER BY source, id");

/** The pinned items plus the best matches for the question's words, only from the tiers allowed here. */
export async function search(question: string, tiers: Tier[], limit = 12): Promise<Found[]> {
  const words = Array.from(new Set(question.toLowerCase().match(/[a-z0-9]{2,}/g) || [])).slice(0, 12);
  const cols = "id, source, title, body, url, tier, file_name, starts_at, updated_at";
  const pinned = await q(`SELECT ${cols} FROM team_library WHERE pinned AND tier = ANY($1) ORDER BY starts_at NULLS FIRST, title LIMIT 20`, [tiers]);
  // OR of the words, so "my LLC document" still finds "LLC certificate of filing"; ranked by how well each matches.
  const hits = words.length ? await q(
    `SELECT ${cols} FROM team_library, to_tsquery('english', $1) query
     WHERE NOT pinned AND tier = ANY($2) AND tsv @@ query ORDER BY ts_rank(tsv, query) DESC, updated_at DESC LIMIT $3`,
    [words.join(" | "), tiers, limit]) : [];
  // Long notes outrank short file entries ("remy fox"), so files come along too, ranked by their title first.
  const files = words.length ? await q(
    `SELECT ${cols} FROM team_library, to_tsquery('english', $1) query
     WHERE NOT pinned AND file_name IS NOT NULL AND tier = ANY($2) AND tsv @@ query AND NOT (id = ANY($3))
     ORDER BY ts_rank(to_tsvector('english', title), query) DESC, ts_rank(tsv, query) DESC LIMIT 4`, [words.join(" | "), tiers, hits.map((h: any) => h.id)]) : [];
  return [...pinned, ...hits, ...files] as Found[];
}

/** One item's file, only when its tier is allowed here. */
export async function fileFor(id: string, tiers: Tier[]): Promise<{ name: string; type: string; data: Buffer } | null> {
  const row = (await q("SELECT file_name FROM team_library WHERE id = $1 AND tier = ANY($2) AND file_name IS NOT NULL", [id, tiers]))[0];
  const f = row && (await r2Store()?.get(fileKey(id)));
  return f ? { name: row.file_name, type: f.type, data: Buffer.from(f.b64, "base64") } : null;
}

/** Team calendar items starting within the next hour that haven't had their reminder; the caller marks each one sent. */
export const dueReminders = (now = new Date()) => q(
  `SELECT id, title, url, starts_at, channel FROM team_library
   WHERE tier = 'team' AND reminded_at IS NULL AND starts_at > $1 AND starts_at <= $2 ORDER BY starts_at`,
  [now.toISOString(), new Date(now.getTime() + 65 * 60_000).toISOString()]);
export const markReminded = (id: string) => q("UPDATE team_library SET reminded_at = now() WHERE id = $1", [id]);
