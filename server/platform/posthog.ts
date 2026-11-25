// PostHog analytics for the website (client/src/lib/analytics.ts). The project key is public by design (it can only
// send events), so it has a default; set POSTHOG_KEY="" in Render to switch analytics off without a deploy of code.
const DEFAULT_KEY = "phc_wkAVtzPkfCLrJbTHYLRQ6ZjvzEGF2ZkduR5kye2VEg4S";

export function posthogConfig(env: Record<string, string | undefined> = process.env): { key: string; host: string } | null {
  const key = env.POSTHOG_KEY ?? DEFAULT_KEY;
  return key ? { key, host: env.POSTHOG_HOST || "https://us.i.posthog.com" } : null;
}
