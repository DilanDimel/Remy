import OpenAI from "openai";

// AI provider resolution, in order:
// 1. A user-supplied OpenAI key routed through the hosting credential proxy
//    (OR_AI_URL_ENV / OR_AI_TOKEN_ENV name the env vars that hold the proxy URL and token).
// 2. Standard OpenAI env vars (OPENAI_API_KEY / OPENAI_BASE_URL), which the
//    preview host injects for its built-in model access.
// If neither exists, AI features report "Needs setup" instead of faking output.

let client: OpenAI | null = null;
let via = "none";
let lastModel = "";
let lastVia = "";
const exhausted = new Map<string, number>();
const GEMINI_FALLBACKS = "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest,gemini-2.5-flash-lite";
export const lastUsedModel = () => lastModel || model();
// "gemini" uses Google's OpenAI-compatible Chat Completions endpoint.
const provider = () => (process.env.OR_AI_PROVIDER || "openai").toLowerCase();

// Multi-provider chain, e.g. OR_AI_CHAIN="openrouter:google/gemini-3.8-flash,openrouter:openai/gpt-5-mini,gemini:gemini-3.8-flash"
// Each provider reads its credential-proxy env vars (set by the host when the key is attached).
const PROVIDERS: Record<string, { url: string; token: string; path: string; label: string; directKey: string; directBase: string }> = {
  openrouter: { url: "CUSTOM_CRED_OPENROUTER_AI_URL", token: "CUSTOM_CRED_OPENROUTER_AI_PROXY_AUTH_KEY", path: "/api/v1", label: "OpenRouter", directKey: "OPENROUTER_API_KEY", directBase: "https://openrouter.ai/api/v1" },
  gemini: { url: "CUSTOM_CRED_GENERATIVELANGUAGE_GOOGLEAPIS_COM_URL", token: "CUSTOM_CRED_GENERATIVELANGUAGE_GOOGLEAPIS_COM_PROXY_AUTH_KEY", path: "/v1beta/openai", label: "Google Gemini", directKey: "GEMINI_API_KEY", directBase: "https://generativelanguage.googleapis.com/v1beta/openai" },
  muse: { url: "", token: "", path: "", label: "Meta Muse", directKey: "META_API_KEY", directBase: process.env.META_API_BASE || "" },
};
const chainClients = new Map<string, OpenAI>();
function chainClient(p: string) {
  if (chainClients.has(p)) return chainClients.get(p)!;
  const cfg = PROVIDERS[p];
  if (!cfg) return null;
  // Outside Perplexity hosting: plain API keys from environment variables.
  if (!(cfg.url && process.env[cfg.url] && process.env[cfg.token])) {
    if (!process.env[cfg.directKey] || !cfg.directBase) return null;
    const c = new OpenAI({ baseURL: cfg.directBase, apiKey: process.env[cfg.directKey]! });
    chainClients.set(p, c);
    return c;
  }
  const base = process.env[cfg.url]!.replace(/\/$/, "");
  const c = new OpenAI({ baseURL: base.includes(cfg.path) ? base : base + cfg.path, apiKey: "proxy-injected", defaultHeaders: { "x-api-key": process.env[cfg.token]! } });
  chainClients.set(p, c);
  return c;
}
function chain(): { p: string; m: string; c: OpenAI }[] {
  return (process.env.OR_AI_CHAIN || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => { const i = x.indexOf(":"); const p = x.slice(0, i); return { p, m: x.slice(i + 1), c: chainClient(p)! }; })
    .filter((x) => x.c);
}

function init() {
  if (client) return client;
  const ch = chain();
  if (ch.length) {
    client = ch[0].c;
    via = Array.from(new Set(ch.map((x) => PROVIDERS[x.p].label))).join(" → ");
    return client;
  }
  const urlVar = process.env.OR_AI_URL_ENV;
  const tokenVar = process.env.OR_AI_TOKEN_ENV;
  if (urlVar && tokenVar && process.env[urlVar] && process.env[tokenVar]) {
    const base = process.env[urlVar]!.replace(/\/$/, "");
    const gem = provider() === "gemini";
    const orr = provider() === "openrouter";
    client = new OpenAI({
      baseURL: gem ? (base.includes("/v1beta/openai") ? base : base + "/v1beta/openai") : orr ? (base.includes("/api/v1") ? base : base + "/api/v1") : base.endsWith("/v1") ? base : base + "/v1",
      apiKey: "proxy-injected",
      defaultHeaders: { "x-api-key": process.env[tokenVar]! },
    });
    via = gem ? "Your Google Gemini key" : orr ? "Your OpenRouter key" : "Your OpenAI key";
  } else if (provider() === "gemini" && process.env.GEMINI_API_KEY) {
    client = new OpenAI({ baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: process.env.GEMINI_API_KEY });
    via = "Your Google Gemini key";
  } else if (process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL) {
    client = new OpenAI();
    via = process.env.OR_AI_VIA || "Hosted model access";
  }
  return client;
}

let authFailedAt = 0;
export function markAiAuthFailure(failed: boolean) {
  authFailedAt = failed ? Date.now() : 0;
}
export function aiStatus() {
  const c = init();
  const failed = authFailedAt > 0;
  return { available: !!c && !failed, model: c ? model() : "", via: failed ? "Credentials rejected — needs setup" : via };
}
export function model() {
  const ch = chain();
  if (ch.length) return ch[0].m;
  return process.env.OR_AI_MODEL || (provider() === "gemini" ? "gemini-3.8-flash" : provider() === "openrouter" ? "openai/gpt-5-mini" : "gpt_5_1");
}

export class AiUnavailable extends Error {
  status = 503;
  constructor() {
    super("AI is not configured on this server yet (Needs setup).");
  }
}

// Free models often return almost-JSON: trailing commas, comments, smart quotes.
// Repair those before giving up, so one stray comma doesn't fail a whole request.
function repairJson(s: string) {
  return s
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
}
function extractJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?/im, "").replace(/```\s*$/m, "").trim();
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  const body = s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned;
  for (const candidate of [cleaned, body, repairJson(body)]) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new Error("AI response was not valid JSON");
}

export async function aiText(system: string, user: string, maxTokens = 1200): Promise<string> {
  const c = init();
  if (!c) throw new AiUnavailable();
  const ch0 = chain();
  if (ch0.length || provider() === "gemini" || provider() === "openrouter") {
    // Free-tier Gemini quotas are per model per day, and models sometimes return 503 "high demand".
    // Walk a chain of models: skip any that are out of quota (until the time Google reports), retry 503s once.
    const steps = ch0.length
      ? ch0
      : Array.from(new Set([model(), ...(process.env.OR_AI_FALLBACKS ?? (provider() === "openrouter" ? "" : GEMINI_FALLBACKS)).split(",").map((m) => m.trim()).filter(Boolean)])).map((m) => ({ p: provider(), m, c }));
    let lastErr: any;
    for (const { p, m, c } of steps) {
      const orr = p === "openrouter";
      const key = p + ":" + m;
      if ((exhausted.get(key) || 0) > Date.now() || (exhausted.get(p + ":*") || 0) > Date.now()) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r: any = await c.chat.completions.create({
            model: m,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            // Thinking tokens count toward the limit; keep reasoning light and leave headroom.
            max_tokens: orr ? Math.max(1500, maxTokens * 2) : Math.max(2048, maxTokens * 3),
            ...(orr ? { reasoning: { effort: "low" } } : { reasoning_effort: "low" }),
          } as any);
          const out = r.choices?.[0]?.message?.content ?? "";
          if (!out) throw Object.assign(new Error("The AI returned an empty response."), { status: 502 });
          lastModel = m;
          lastVia = PROVIDERS[p]?.label || "";
          return out;
        } catch (e: any) {
          lastErr = e;
          const st = Number(e?.status) || 0;
          if (st === 400 && !ch0.length) throw e;
          if (st === 401 || st === 403 || st === 400) { exhausted.set(p + ":*", Date.now() + 10 * 60_000); break; }
          if (st === 402) { exhausted.set(p + ":*", Date.now() + 10 * 60_000); break; } // out of credits → next provider
          if (st === 429) {
            const msg = String(e?.message || "") + JSON.stringify(e?.error || "");
            const h = /retry in (?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s/.exec(msg);
            const ms = h ? ((+(h[1] || 0) * 60 + +(h[2] || 0)) * 60 + +h[3]) * 1000 : 60_000;
            exhausted.set(key, Date.now() + ms);
            break;
          }
          if (st === 404) { exhausted.set(key, Date.now() + 24 * 3600_000); break; }
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastErr || Object.assign(new Error("All AI models are at their daily limit."), { status: 429 });
  }
  const res: any = await c.responses.create({
    model: model(),
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_output_tokens: maxTokens,
  } as any);
  const out = res.output_text ?? "";
  if (!out) throw new Error("The AI returned an empty response.");
  return out;
}

export async function aiJson<T = any>(system: string, user: string, maxTokens = 3000): Promise<T> {
  const sys = system + "\n\nRespond with a single JSON object only. No markdown, no commentary.";
  let last: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const text = await aiText(sys, i === 0 ? user : user + "\n\nYour previous reply was not valid JSON. Return only the JSON object.", maxTokens);
      return extractJson(text) as T;
    } catch (e) {
      if (e instanceof AiUnavailable) throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("AI request failed");
}
