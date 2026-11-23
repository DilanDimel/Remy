import OpenAI from "openai";
import { AsyncLocalStorage } from "node:async_hooks";
import { AI_SAFETY } from "./safety";

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
export const lastUsedModel = () => aiScope.getStore()?.model || lastModel || model();
// What the last AI call cost in US dollars, as OpenRouter reports it (other providers don't say).
// shortcut: one value for the whole process, so two calls finishing together can swap costs; per-request tracking if exact billing matters.
let lastSpend: number | undefined;
export const lastCost = () => { const st = aiScope.getStore(); return st ? st.spend : lastSpend; };
let lastSources: { url: string; title: string }[] = [];
/** Web pages the last answer cited (only web-search models like Perplexity Sonar return them). */
export const lastCitations = () => lastSources;
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
// Owners try new AI setups before students (redesign stage 1, Nov 21, 2026): while an owner's request runs, the
// default chain is OR_AI_CHAIN_OWNERS (e.g. Claude Haiku 5.5, then Gemini) and OpenRouter calls carry the privacy rules.
// Each web request runs in its own scope (routes.ts route()), which also holds the model and cost of that request's
// last AI call, so a student's records never name a model an owner's request used at the same moment (skeptic, Nov 21).
const aiScope = new AsyncLocalStorage<{ owner: boolean; model?: string; spend?: number; usage?: any }>();
/** Token counts of this request's last AI call (prompt, reasoning), for the owners' chat timing line. */
export const lastUsage = () => { const u = aiScope.getStore()?.usage; return u ? { tokensIn: u.prompt_tokens, cached: u.prompt_tokens_details?.cached_tokens, reasoning: u.completion_tokens_details?.reasoning_tokens } : undefined; };
export const runAiAs = <T>(owner: boolean, fn: () => Promise<T>) => aiScope.run({ owner }, fn);
export const inOwnerTrial = () => ownerTrial();
/** This request is an owner in owner view (owners-first checks outside the AI calls). */
export const inOwnerView = () => !!aiScope.getStore()?.owner;
const ownerTrial = () => !!aiScope.getStore()?.owner && !!process.env.OR_AI_CHAIN_OWNERS;
const defaultChain = () => (ownerTrial() ? process.env.OR_AI_CHAIN_OWNERS : process.env.OR_AI_CHAIN);
/** Student-data rules for OpenRouter (checked against its provider-routing docs, Nov 21): only zero-data-retention
 *  endpoints, no providers that may store prompts, and only the providers chosen per model family, with no fallback to
 *  others. Claude's zero-retention endpoint on OpenRouter is Amazon Bedrock; Gemini's are Google's own. */
export function privacyRouting(model: string): Record<string, unknown> {
  const order = model.startsWith("anthropic/") ? ["amazon-bedrock"] : model.startsWith("google/") ? ["google-ai-studio", "google-vertex"] : undefined;
  return { zdr: true, data_collection: "deny", ...(order ? { order, allow_fallbacks: false } : {}) };
}
const privacyOn = () => ownerTrial() || process.env.OR_AI_PRIVACY === "on";

function chain(spec = defaultChain()): { p: string; m: string; c: OpenAI }[] {
  return (spec || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => { const i = x.indexOf(":"); const p = x.slice(0, i); return { p, m: x.slice(i + 1), c: chainClient(p)! }; })
    .filter((x) => x.c);
}

function init() {
  if (client) return client;
  const ch = chain(process.env.OR_AI_CHAIN); // students' chain decides whether AI is on; owners' trial rides on top
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
  const trial = process.env.OR_AI_CHAIN_OWNERS ? chain(process.env.OR_AI_CHAIN_OWNERS)[0]?.m || "" : "";
  return { available: !!c && !failed, model: c ? model() : "", via: failed ? "Credentials rejected — needs setup" : via, ...(trial ? { ownerTrial: trial } : {}) };
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

/** Why the last reply ended ("stop", or "length" when it hit the token limit and was cut off). */
let lastFinish = "";
/** `chainSpec` overrides OR_AI_CHAIN for one call (e.g. a stronger model just for tailoring); if none of its providers is configured, the default chain is used. */
/** `onText`, when given, streams the reply: it is called with the whole text so far as each piece arrives (a retry or
 * the next model in the chain starts again from ""). Chat uses it to show Remy's answer as it is written. */
export async function aiText(system: string, user: string, maxTokens = 1200, chainSpec?: string, onText?: (soFar: string) => void): Promise<string> {
  lastFinish = ""; // set again from this call's reply, so a value from an earlier call is never read
  const c = init();
  if (!c) throw new AiUnavailable();
  const ch0 = (chainSpec && chain(chainSpec).length && chain(chainSpec)) || chain();
  if (ch0.length || provider() === "gemini" || provider() === "openrouter") {
    // Free-tier Gemini quotas are per model per day, and models sometimes return 503 "high demand".
    // Walk a chain of models: skip any that are out of quota (until the time Google reports), retry 503s once.
    const steps = ch0.length
      ? ch0
      : Array.from(new Set([model(), ...(process.env.OR_AI_FALLBACKS ?? (provider() === "openrouter" ? "" : GEMINI_FALLBACKS)).split(",").map((m) => m.trim()).filter(Boolean)])).map((m) => ({ p: provider(), m, c }));
    let lastErr: any;
    for (const { p, m, c } of steps) {
      const orr = p === "openrouter";
      // Owners' private-routing calls and students' plain calls keep separate "this model is failing" records, so a
      // failure under the owners' privacy rules never switches a model off for students (skeptic review, Nov 21).
      const mode = privacyOn() ? "#private" : "";
      const key = p + ":" + m + mode;
      const anyKey = p + ":*" + mode;
      if ((exhausted.get(key) || 0) > Date.now() || (exhausted.get(anyKey) || 0) > Date.now()) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const req = {
            model: m,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            // Thinking tokens count toward the limit; keep reasoning light and leave headroom.
            max_tokens: orr ? Math.max(1500, maxTokens * 2) : Math.max(2048, maxTokens * 3),
            // A streamed chat reply skips Claude's thinking: it held back the first word for ~5 s (Nov 23).
            ...(orr ? { ...(onText && /claude|anthropic/i.test(m) ? {} : { reasoning: { effort: "low" } }), usage: { include: true }, ...(privacyOn() ? { provider: privacyRouting(m) } : {}) } : { reasoning_effort: "low" }),
          };
          let r: any;
          let out = "";
          if (onText) {
            // Streamed: the same request, read piece by piece; usage and finish reason arrive with the last pieces.
            onText("");
            const s: any = await c.chat.completions.create({ ...req, stream: true } as any);
            let finish = "", usage: any, annotations: any[] = [];
            for await (const chunk of s) {
              const ch = chunk?.choices?.[0];
              const piece = ch?.delta?.content;
              if (typeof piece === "string" && piece) { out += piece; onText(out); }
              if (ch?.finish_reason) finish = String(ch.finish_reason);
              if (Array.isArray(ch?.delta?.annotations)) annotations = annotations.concat(ch.delta.annotations);
              if (chunk?.usage) usage = chunk.usage;
            }
            r = { choices: [{ finish_reason: finish, message: { content: out, annotations } }], usage };
          } else {
            r = await c.chat.completions.create(req as any);
            out = r.choices?.[0]?.message?.content ?? "";
          }
          lastFinish = String(r.choices?.[0]?.finish_reason || "");
          if (!out) throw Object.assign(new Error("The AI returned an empty response."), { status: 502 });
          lastModel = m;
          lastVia = PROVIDERS[p]?.label || "";
          lastSpend = typeof r.usage?.cost === "number" ? r.usage.cost : undefined;
          const scope = aiScope.getStore();
          if (scope) { scope.model = m; scope.spend = lastSpend; scope.usage = r.usage; }
          const ann = (r.choices?.[0]?.message?.annotations || []).filter((a: any) => a?.type === "url_citation").map((a: any) => ({ url: String(a.url_citation?.url || ""), title: String(a.url_citation?.title || "") }));
          lastSources = ann.length ? ann : (Array.isArray(r.citations) ? r.citations : []).map((u: any) => ({ url: String(u), title: "" }));
          return out;
        } catch (e: any) {
          lastErr = e;
          const st = Number(e?.status) || 0;
          // Which provider/model failed and why, so quota or key problems show up in the host's logs.
          console.warn(`AI ${p}:${m} failed — HTTP ${st || "?"}: ${String(e?.message || e).replace(/\s+/g, " ").slice(0, 220)}`);
          if (st === 400 && !ch0.length) throw e;
          if (st === 401 || st === 403 || st === 400) { exhausted.set(anyKey, Date.now() + 10 * 60_000); break; }
          if (st === 402) { exhausted.set(anyKey, Date.now() + 10 * 60_000); break; } // out of credits → next provider
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

export async function aiJson<T = any>(system: string, user: string, maxTokens = 3000, chainSpec?: string, onText?: (soFar: string) => void): Promise<T> {
  const sys = system + "\n\n" + AI_SAFETY + "\n\nRespond with a single JSON object only. No markdown, no commentary.";
  let last: unknown;
  let tokens = maxTokens;
  for (let i = 0; i < 2; i++) {
    let text = "";
    try {
      text = await aiText(sys, i === 0 ? user : user + "\n\nYour previous reply was not valid JSON. Return only the JSON object.", tokens, chainSpec, onText);
      return extractJson(text) as T;
    } catch (e) {
      if (e instanceof AiUnavailable) throw e;
      last = e;
      if (text) {
        // Live error, Nov 18: a plan failed twice with "not valid JSON" and nothing said why. Log how it ended (never
        // the content, which is about the student); a reply cut off at the limit gets twice the room on the retry.
        console.warn(`AI JSON unreadable: finish=${lastFinish || "?"} length=${text.length} endsWithBrace=${/\}\s*$/.test(text)}`);
        if (lastFinish === "length") tokens = maxTokens * 2;
      }
    }
  }
  throw last instanceof Error ? last : new Error("AI request failed");
}
