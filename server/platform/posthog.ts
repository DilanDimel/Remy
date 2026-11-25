// PostHog analytics for the website (client/src/lib/analytics.ts). The project key is public by design (it can only
// send events), so it has a default; set POSTHOG_KEY="" in Render to switch analytics off without a deploy of code.
const DEFAULT_KEY = "phc_wkAVtzPkfCLrJbTHYLRQ6ZjvzEGF2ZkduR5kye2VEg4S";

export function posthogConfig(env: Record<string, string | undefined> = process.env): { key: string; host: string } | null {
  const key = env.POSTHOG_KEY ?? DEFAULT_KEY;
  return key ? { key, host: env.POSTHOG_HOST || "https://us.i.posthog.com" } : null;
}

/** Who an AI call is for (set per request in routes.ts route()); null = don't report (guests, Do Not Track). */
export type AiTracking = { distinctId: string; feature: string } | null;

/** One finished AI call as a PostHog LLM-analytics event. Numbers only: never the prompt or the answer (resumes). */
export function aiEvent(t: AiTracking, call: { model: string; provider: string; ms: number; usage?: any; streamed: boolean }) {
  if (!t) return null;
  const u = call.usage || {};
  return {
    event: "$ai_generation",
    distinct_id: t.distinctId,
    properties: {
      $ai_model: call.model, $ai_provider: call.provider, $ai_latency: call.ms / 1000, $ai_stream: call.streamed,
      $ai_input_tokens: u.prompt_tokens, $ai_output_tokens: u.completion_tokens,
      $ai_cache_read_input_tokens: u.prompt_tokens_details?.cached_tokens, $ai_reasoning_tokens: u.completion_tokens_details?.reasoning_tokens,
      $ai_total_cost_usd: typeof u.cost === "number" ? u.cost : undefined,
      $ai_span_name: t.feature, feature: t.feature,
    },
  };
}

/** Fire-and-forget send from the server; production only, so tests and local runs never report. */
export function capture(e: { event: string; distinct_id: string; properties: Record<string, unknown> } | null) {
  const cfg = posthogConfig();
  if (!e || !cfg || process.env.NODE_ENV !== "production") return;
  fetch(cfg.host + "/i/v0/e/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: cfg.key, ...e }), signal: AbortSignal.timeout(5000) }).catch(() => {});
}
