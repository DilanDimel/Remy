// Automatic signals from students' browsers (client/src/lib/signals.ts), so the owners see problems without anyone
// pressing "Send feedback": page visits, rage clicks and one-tap ratings are counted per day (no student id);
// errors go to the Errors page like any other.
import { q } from "./sql";

const NAME = /^(page|rage|rate):[\w/:.\- ]{1,85}$/;
const centralDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/** Adds a batch of event names to today's counts. Unknown shapes are dropped. Returns how many were counted. */
export async function countEvents(names: unknown): Promise<number> {
  if (!Array.isArray(names)) return 0;
  const tally = new Map<string, number>();
  for (const n of names.slice(0, 200)) if (typeof n === "string" && NAME.test(n)) tally.set(n, (tally.get(n) || 0) + 1);
  const day = centralDay();
  for (const [name, n] of tally) {
    await q("INSERT INTO usage_events (day, name, n) VALUES ($1, $2, $3) ON CONFLICT (day, name) DO UPDATE SET n = usage_events.n + EXCLUDED.n", [day, name, n]);
  }
  return [...tally.values()].reduce((a, b) => a + b, 0);
}

/** The last `days` days: most-visited pages, rage clicks (likely broken buttons) and 👍/👎 per feature. */
export async function signalsReport(days = 7) {
  const since = new Date(Date.now() - days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const rows = await q("SELECT name, SUM(n)::int AS n FROM usage_events WHERE day >= $1 GROUP BY name ORDER BY n DESC", [since]);
  const pick = (prefix: string) => rows.filter((r) => String(r.name).startsWith(prefix)).map((r) => ({ name: String(r.name).slice(prefix.length), n: Number(r.n) }));
  const ratings = new Map<string, { up: number; down: number }>();
  for (const r of pick("rate:")) {
    const [place, dir] = [r.name.replace(/:(up|down)$/, ""), r.name.endsWith(":up") ? "up" : "down"];
    const x = ratings.get(place) || { up: 0, down: 0 };
    x[dir as "up" | "down"] += r.n;
    ratings.set(place, x);
  }
  return { days, pages: pick("page:").slice(0, 15), rage: pick("rage:").slice(0, 15), ratings: [...ratings].map(([place, v]) => ({ place, ...v })) };
}
