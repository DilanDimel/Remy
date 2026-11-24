// Feature releases (shared/features.ts): owners' choices live in site_settings key "features" as JSON, so a release
// flips from Admin → Beta without a deploy. Short cache, like open access.
import { FEATURES, RELEASES, releasesOf, type Release, type Releases } from "@shared/features";
import { q } from "./sql";

let cache = { at: 0, r: releasesOf({}) };
export async function releases(): Promise<Releases> {
  if (Date.now() - cache.at <= 30_000) return cache.r;
  const row = (await q("SELECT value FROM site_settings WHERE key = 'features'"))[0];
  let saved: unknown = {};
  try { saved = row ? JSON.parse(String(row.value)) : {}; } catch { /* a bad row falls back to the defaults */ }
  cache = { at: Date.now(), r: releasesOf(saved) };
  return cache.r;
}
export async function setRelease(by: string, key: string, state: string): Promise<Releases> {
  if (!FEATURES.some((f) => f.key === key)) throw Object.assign(new Error("No feature called that."), { status: 400 });
  if (!RELEASES.includes(state as Release)) throw Object.assign(new Error("Say owners, locked or released."), { status: 400 });
  const next = { ...(await releases()), [key]: state as Release };
  cache = { at: 0, r: next };
  await q(`INSERT INTO site_settings (key, value, updated_by) VALUES ('features', $1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [JSON.stringify(next), by]);
  cache = { at: Date.now(), r: next };
  return next;
}
