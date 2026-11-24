import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppConfig, Me, Workspace } from "@shared/types";
import { finishSupabaseRedirect } from "./supabase";
import { keepNewerJobFeedback } from "./jobFeedback";
import { apiResult } from "./signals";
import { saveFileNative } from "./native";

declare global {
  interface Window { __API_BASE__?: string; google?: any }
}
const raw = window.__API_BASE__ || "";
const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
// Perplexity hosting rewrites the sentinel at deploy time; anywhere else, call the same origin.
export const API_BASE = raw.startsWith("__PORT_") ? "" : raw;

export class ApiError extends Error {
  status: number;
  code?: string;
  /** The server's whole reply, for refusals that also send fresh data (e.g. the workspace). */
  body?: any;
  constructor(msg: string, status: number, code?: string, body?: any) {
    super(msg);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

// A request cut off because the page is reloading or closing isn't a Remy problem, so it isn't reported.
let leaving = false;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { leaving = true; });
  window.addEventListener("pageshow", () => { leaving = false; });
}

/** `onLine`, when given, reads a streamed answer (server/platform/stream.ts): each JSON line but the last goes to
 *  onLine; a line with `ws` is the result and one with `error` fails the call. A plain JSON answer works as usual. */
export async function api<T = any>(method: string, url: string, body?: unknown, onLine?: (line: any) => void): Promise<T> {
  if (API_BASE === "__UNRESOLVED__") throw new ApiError("Backend connection was not configured. Please reopen the app.", 0);
  const isForm = body instanceof FormData;
  const started = performance.now();
  const send = () => fetch(`${API_BASE}${url}`, {
    method,
    credentials: "same-origin",
    headers: body && !isForm ? { "Content-Type": "application/json" } : {},
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  let res: Response;
  try {
    res = await send();
  } catch (e) {
    // A blip (Wi-Fi, laptop waking up): a read is quietly tried once more. Writes aren't, so nothing saves twice.
    let retried: Response | null = null;
    if (method === "GET" && !leaving && navigator.onLine !== false) {
      await new Promise((r) => setTimeout(r, 800));
      retried = await send().catch(() => null);
    }
    if (!retried) {
      // Only a real failure reaches the owners' Errors page: not a page that's closing, not a device that's offline.
      if (!leaving && navigator.onLine !== false) apiResult(method, url, 0, performance.now() - started);
      throw e;
    }
    res = retried;
  }
  apiResult(method, url, res.status, performance.now() - started);
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    let code: string | undefined;
    let body: any;
    try {
      body = await res.json();
      msg = body.message || msg;
      code = body.code;
    } catch {}
    // Founding Cohort beta: the server turned this account (or a guest) away; the app signs out and says why.
    if (code === "beta") window.dispatchEvent(new CustomEvent("remy-beta", { detail: msg }));
    throw new ApiError(msg, res.status, code, body);
  }
  const ct = res.headers.get("content-type") || "";
  if (onLine && ct.includes("event-stream") && res.body) return readStream<T>(res.body, onLine);
  return (ct.includes("json") ? res.json() : res.blob()) as Promise<T>;
}

async function readStream<T>(body: ReadableStream<Uint8Array>, onLine: (line: any) => void): Promise<T> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "", done: T | undefined;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: !end });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let d: any;
      try { d = JSON.parse(line); } catch { continue; }
      if (d.error) throw new ApiError(String(d.error), 502);
      if (d.ws) done = d.ws as T;
      else onLine(d);
    }
    if (end) break;
  }
  if (!done) throw new ApiError("Remy's reply was cut off. Please try again.", 502);
  return done;
}

export async function download(url: string, fallbackName: string) {
  const res = await fetch(`${API_BASE}${url}`, { credentials: "same-origin" });
  if (!res.ok) {
    let msg = "Download failed.";
    try { msg = (await res.json()).message || msg; } catch {}
    throw new Error(msg);
  }
  const cd = res.headers.get("content-disposition") || "";
  const name = cd.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const blob = await res.blob();
  if (await saveFileNative(blob, name)) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

type Toast = { id: number; text: string; err?: boolean };
interface Store {
  config: AppConfig | null;
  me: Me | null;
  ws: Workspace | null;
  loading: boolean;
  setWs: (w: Workspace) => void;
  setSession: (me: Me | null, ws: Workspace | null) => void;
  save: <K extends string>(section: K, value: unknown) => Promise<Workspace>;
  refresh: () => Promise<void>;
  toast: (text: string, err?: boolean) => void;
  run: <T>(fn: () => Promise<T>, ok?: string) => Promise<T | undefined>;
  /** Light, dark or "system" (match the device). Visitors keep it in this browser; students also in their account. */
  theme: Theme;
  setTheme: (t: Theme) => Promise<void>;
  /** Why the last sign-in (or session) was turned away during the invite-only beta; null when it wasn't. */
  betaBlocked: string | null;
  clearBeta: () => void;
}
export type Theme = "system" | "light" | "dark";
const THEME_KEY = "remy.theme";
const readLocalTheme = (): Theme => { try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } };
const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);
/** Owner features show only in owner view: an owner can switch to seeing Remy exactly as a student does (Dilan, Nov 19). */
export function useOwnerView() {
  const store = useContext(Ctx); // null outside StoreProvider (public pages): never owner view there
  return !!store?.me?.owner && store.ws?.settings.ownerView !== false;
}

/** Setup steps 1–2 (resume, review) are "not far yet"; from step 3 on, they get the welcome-back screen instead. */
export const FAR_ENOUGH_STEP = 3;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const meRef = useRef<Me | null>(null); // callbacks made once still see the current account
  meRef.current = me;
  const [ws, setWsState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaBlocked, setBetaBlocked] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => { setBetaBlocked(String((e as CustomEvent).detail || "")); setMe(null); setWsState(null); };
    window.addEventListener("remy-beta", on);
    return () => window.removeEventListener("remy-beta", on);
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);

  const toast = useCallback((text: string, err?: boolean) => {
    const id = ++n.current;
    // The same message already on screen isn't shown twice (one failure can reach two handlers); it restarts its timer instead.
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), err ? 6000 : 3200);
  }, []);

  // When the data was last loaded, the build this tab runs, and saves in flight (a quiet refresh must not overwrite them).
  const lastLoad = useRef(Date.now());
  const build = useRef<string | undefined>(undefined);
  const saveSeq = useRef(0);
  const savingNow = useRef(0);
  const [updated, setUpdated] = useState(false);

  const refresh = useCallback(async () => {
    const c = await api<AppConfig>("GET", "/api/config");
    setConfig(c);
    build.current = c.build;
    lastLoad.current = Date.now();
    // Coming back from a Supabase sign-in or connector consent screen.
    try {
      const back = await finishSupabaseRedirect(c);
      if (back?.intent === "signin") await api("POST", "/api/auth/supabase", { accessToken: back.accessToken }).catch((e) => { if (e?.code !== "beta") throw e; });
      if (back?.intent === "connect-linkedin") {
        await api("POST", "/api/connect/linkedin", { accessToken: back.accessToken });
        toast("LinkedIn connected");
      }
      await back?.done();
    } catch (e: any) {
      toast(e?.message || "Sign-in didn't finish.", true);
    }
    const m = await api<{ me: Me | null; workspace: Workspace | null; beta?: { blocked: boolean; email: string } }>("GET", "/api/me");
    if (m.beta?.blocked) setBetaBlocked(`${m.beta.email || "This account"} isn't on Remy's beta tester list yet. Remy is invite-only during the beta: apply with the form, then sign in with this same email once you're accepted.`);
    setMe(m.me);
    setWsState(m.workspace);
  }, [toast]);

  useEffect(() => {
    refresh().catch((e) => toast(e.message, true)).finally(() => setLoading(false));
  }, [refresh, toast]);

  // A tab left open goes stale: when the student comes back (or every 15 minutes while it stays open), load again.
  // Only what changed is replaced, and never while a save is in flight, so nothing they're typing is lost.
  const softRefresh = useCallback(async () => {
    if (savingNow.current) return;
    const seq = saveSeq.current;
    lastLoad.current = Date.now();
    const c = await api<AppConfig>("GET", "/api/config").catch(() => null);
    if (c) {
      if (build.current && c.build && c.build !== build.current) setUpdated(true);
      setConfig((prev) => (prev && JSON.stringify(prev) === JSON.stringify(c) ? prev : c));
    }
    const m = await api<{ me: Me | null; workspace: Workspace | null }>("GET", "/api/me").catch(() => null);
    if (!m || seq !== saveSeq.current || savingNow.current) return;
    setMe((prev) => (JSON.stringify(prev) === JSON.stringify(m.me) ? prev : m.me));
    setWsState((prev) => {
      const next = m.workspace && prev ? keepNewerJobFeedback(prev, m.workspace, meRef.current?.id || null, m.me?.id || null) : m.workspace;
      if (!prev || !next) return next;
      // Keep every unchanged section as the same object, so forms showing it (Profile, setup review) aren't reset.
      let changed = false;
      const merged = { ...next } as Record<string, unknown>;
      for (const k of Object.keys(merged)) {
        const old = (prev as unknown as Record<string, unknown>)[k];
        if (JSON.stringify(old) === JSON.stringify(merged[k])) merged[k] = old;
        else changed = true;
      }
      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;
      return changed ? (merged as unknown as Workspace) : prev;
    });
  }, []);
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const onBack = () => { if (visible() && Date.now() - lastLoad.current > 5 * 60_000) softRefresh().catch(() => {}); };
    const t = setInterval(() => { if (visible() && Date.now() - lastLoad.current > 15 * 60_000) softRefresh().catch(() => {}); }, 60_000);
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onBack); window.removeEventListener("focus", onBack); };
  }, [softRefresh]);

  // Theme: the account's choice when signed in, else this browser's; "system" follows the device, live.
  const [localTheme, setLocalTheme] = useState<Theme>(readLocalTheme);
  // A new account starts on "system"; until the student picks a theme in the account, keep what they picked in this browser
  // (e.g. light on the home page stays light through sign-in and setup). A non-"system" theme without the flag is a real
  // pick saved before themeChosen existed (db.ts already turned unflagged "light" into "system").
  const theme: Theme = ws && (ws.settings.themeChosen || (ws.settings.theme && ws.settings.theme !== "system")) ? (ws.settings.theme as Theme) : localTheme;
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    // Inside the phone app the page matches the app's own light or dark look, which the app sets before load (native/src/app/web.tsx).
    const inApp = (window as { __remyAppTheme?: unknown }).__remyAppTheme;
    const apply = () => { document.documentElement.dataset.theme = inApp === "dark" || inApp === "light" ? inApp : theme === "system" ? (mq.matches ? "dark" : "light") : theme; };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // Save status everyone can see: "Saving…" only if it takes a moment, and a failed save keeps its value for Retry.
  const [saving, setSaving] = useState(0);
  const [failed, setFailed] = useState<{ section: string; value: unknown } | null>(null);
  const save = useCallback(async (section: string, value: unknown) => {
    setSaving((n) => n + 1);
    saveSeq.current++;
    savingNow.current++;
    try {
      const w = await api<Workspace>("PUT", `/api/ws/${section}`, { value });
      setWsState((prev) => keepNewerJobFeedback(prev, w, meRef.current?.id || null, meRef.current?.id || null)); // a slow save can't undo a newer like
      setFailed((f) => (f?.section === section ? null : f));
      return w;
    } catch (e) {
      setFailed({ section, value });
      throw e;
    } finally {
      setSaving((n) => n - 1);
      savingNow.current--;
    }
  }, []);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!saving) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 600);
    return () => clearTimeout(t);
  }, [saving]);
  const setTheme = useCallback(async (t: Theme) => {
    setLocalTheme(t);
    try { if (t === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch {}
    if (ws) await save("settings", { theme: t, themeChosen: true });
  }, [ws, save]);

  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string) => {
    try {
      const r = await fn();
      if (ok) toast(ok);
      return r;
    } catch (e: any) {
      if (e?.code !== "beta") toast(e?.message || "Something went wrong.", true); // the sign-in page explains a beta refusal
      return undefined;
    }
  }, [toast]);

  // Any workspace the app sets (an AI result, a search) is newer than a quiet refresh still on its way.
  const setWs = useCallback((w: Workspace) => { saveSeq.current++; setWsState((prev) => keepNewerJobFeedback(prev, w, meRef.current?.id || null, meRef.current?.id || null)); }, []);
  const value = useMemo<Store>(() => ({
    config, me, ws, loading, toast, refresh, save, run, theme, setTheme,
    setWs, betaBlocked, clearBeta: () => setBetaBlocked(null),
    setSession: (m, w) => { setMe(m); setWsState(w); if (m) setBetaBlocked(null); },
  }), [config, me, ws, loading, toast, refresh, save, run, theme, setTheme, setWs, betaBlocked]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {(failed || slow) && (
        <div className={"save-status" + (failed ? " err" : "")} role="status" data-testid="save-status">
          {failed && !saving ? <>Couldn't save your last change. <button onClick={() => save(failed.section, failed.value).catch(() => {})}>Retry</button></> : "Saving…"}
        </div>
      )}
      {updated && (
        <div className="save-status update-bar" role="status" data-testid="update-bar">
          Remy was updated. <button onClick={() => location.reload()} data-testid="button-reload">Reload</button>
        </div>
      )}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={"toast" + (t.err ? " err" : "")} data-testid="toast">{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}

export const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
  return isNaN(+dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
/** Calendar days from today to a date: today 0, tomorrow 1 (noon-to-noon, so daylight saving can't shift it). */
export const daysUntil = (d: string) => {
  if (!d) return null;
  const t = new Date(d.slice(0, 10) + "T12:00").getTime();
  return isNaN(t) ? null : Math.round((t - new Date(new Date().toLocaleDateString("en-CA") + "T12:00").getTime()) / 86_400_000);
};
export const rid = (p = "") => p + Math.random().toString(36).slice(2, 10);

/** Text someone is still typing, kept in this browser so a refresh or a closed tab doesn't lose it. */
export function useDraft(key: string) {
  const k = "remy.draft." + key;
  const [v, setV] = useState(() => { try { return localStorage.getItem(k) || ""; } catch { return ""; } });
  const set = useCallback((x: string) => { setV(x); try { if (x) localStorage.setItem(k, x); else localStorage.removeItem(k); } catch {} }, [k]);
  return [v, set] as const;
}
