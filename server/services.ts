// Owners' dashboard → Services: is the server healthy, which version is live, recent deploys (Render), and how much
// AI money is left (OpenRouter). Read-only. Uses only keys Remy already has, plus an optional RENDER_API_KEY.
import { q1 } from "./sql";

const started = Date.now();

/** This server process: version, uptime, memory. Render sets RENDER_GIT_COMMIT and RENDER_INSTANCE_ID itself. */
export function serverNow() {
  const m = process.memoryUsage();
  return {
    commit: (process.env.RENDER_GIT_COMMIT || "").slice(0, 7), branch: process.env.RENDER_GIT_BRANCH || "",
    instance: process.env.RENDER_INSTANCE_ID || "", startedAt: new Date(started).toISOString(),
    uptimeMin: Math.round((Date.now() - started) / 60_000), memoryMb: Math.round(m.rss / 1048576), memoryLimitMb: Number(process.env.MEMORY_LIMIT_MB) || 512, node: process.version,
  };
}

/** Errors in the last 24 hours, so a bad deploy shows up next to the deploy list. */
export async function recentErrors() {
  return q1(`SELECT COUNT(*) FILTER (WHERE kind = 'server')::int AS server, COUNT(*) FILTER (WHERE kind = 'browser')::int AS browser
             FROM error_reports WHERE at > now() - interval '24 hours'`);
}

/** Last deploys from Render's API, only when an owner set RENDER_API_KEY (Render keys can change the whole account,
 *  so it's optional). Without it, the version and start time above still show when a deploy happened. */
export async function renderDeploys() {
  const key = process.env.RENDER_API_KEY, svc = process.env.RENDER_SERVICE_ID;
  if (!key || !svc) return { available: false as const };
  try {
    const r = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(svc)}/deploys?limit=6`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { available: true as const, error: `Render answered ${r.status}` };
    const rows = (await r.json()) as any[];
    return {
      available: true as const,
      deploys: rows.map((x) => x.deploy || x).map((d: any) => ({ status: String(d.status || ""), createdAt: d.createdAt || null, finishedAt: d.finishedAt || null, message: String(d.commit?.message || "").split("\n")[0].slice(0, 120), commit: String(d.commit?.id || "").slice(0, 7) })),
    };
  } catch (e: any) {
    return { available: true as const, error: "Couldn't reach Render" };
  }
}

/** The OpenRouter key's own usage and limit (GET /api/v1/key works with Remy's normal key). The account's total
 *  balance needs a management key, which Remy deliberately doesn't hold. */
export async function openRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { available: false as const };
  for (const path of ["/api/v1/key", "/api/v1/auth/key"]) {
    try {
      const r = await fetch(`https://openrouter.ai${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const d = ((await r.json()) as any)?.data || {};
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      return {
        available: true as const, label: String(d.label || ""), freeTier: !!d.is_free_tier,
        usage: num(d.usage), limit: num(d.limit), remaining: num(d.limit_remaining),
        usageDaily: num(d.usage_daily), usageWeekly: num(d.usage_weekly), usageMonthly: num(d.usage_monthly),
      };
    } catch {}
  }
  return { available: true as const, error: "Couldn't reach OpenRouter" };
}
