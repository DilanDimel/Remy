// Rate limits that survive restarts and deploys and hold across several servers: a counter per key per fixed window
// in the rate_limits table (migration 018). One statement per check. Expired rows are removed by the sweep.
// If the database can't be reached the check falls back to this process's memory, so a hiccup never locks people out.
import { q, q1 } from "./sql";

const memory = new Map<string, number[]>();
/** In-process sliding window: for high-volume, low-stakes floods (client error reports, public pages) and as the fallback. */
export function allowLocal(key: string, max: number, windowMs: number, now = Date.now()) {
  const list = (memory.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  memory.set(key, list);
  if (memory.size > 50_000) for (const k of memory.keys()) { memory.delete(k); if (memory.size <= 40_000) break; }
  return true;
}

/** True when `key` has had fewer than `max` allowed hits in the current window of `windowMs`, and counts this one. */
export async function allow(key: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const start = new Date(Math.floor(now / windowMs) * windowMs);
  const end = new Date(start.getTime() + windowMs);
  try {
    // Counts only allowed hits (never past max), like the old in-memory limiter; a new window starts the count over.
    const r = await q1(
      `INSERT INTO rate_limits (key, window_start, expires_at, hits) VALUES ($1, $2, $3, 1)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.window_start = EXCLUDED.window_start THEN LEAST(rate_limits.hits + 1, $4::int + 1) ELSE 1 END,
         window_start = EXCLUDED.window_start, expires_at = EXCLUDED.expires_at
       RETURNING hits`,
      [key.slice(0, 300), start.toISOString(), end.toISOString(), max],
    );
    return Number(r?.hits) <= max;
  } catch (e: any) {
    console.error("rate limit check fell back to memory:", e?.message);
    return allowLocal(key, max, windowMs, now);
  }
}

/** Run by the sweep. */
export async function cleanupLimits() {
  await q("DELETE FROM rate_limits WHERE expires_at < now()");
}
