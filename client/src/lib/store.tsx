import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppConfig, Me, Workspace } from "@shared/types";
import { finishSupabaseRedirect } from "./supabase";

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
  constructor(msg: string, status: number, code?: string) {
    super(msg);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  if (API_BASE === "__UNRESOLVED__") throw new ApiError("Backend connection was not configured. Please reopen the app.", 0);
  const isForm = body instanceof FormData;
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    credentials: "same-origin",
    headers: body && !isForm ? { "Content-Type": "application/json" } : {},
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    let code: string | undefined;
    try {
      const j = await res.json();
      msg = j.message || msg;
      code = j.code;
    } catch {}
    throw new ApiError(msg, res.status, code);
  }
  const ct = res.headers.get("content-type") || "";
  return (ct.includes("json") ? res.json() : res.blob()) as Promise<T>;
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
}
export type Theme = "system" | "light" | "dark";
const THEME_KEY = "remy.theme";
const readLocalTheme = (): Theme => { try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } };
const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

/** Setup steps 1–2 (resume, review) are "not far yet"; from step 3 on, they get the welcome-back screen instead. */
export const FAR_ENOUGH_STEP = 3;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ws, setWsState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);

  const toast = useCallback((text: string, err?: boolean) => {
    const id = ++n.current;
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), err ? 6000 : 3200);
  }, []);

  const refresh = useCallback(async () => {
    const c = await api<AppConfig>("GET", "/api/config");
    setConfig(c);
    // Coming back from a Supabase sign-in or connector consent screen.
    try {
      const back = await finishSupabaseRedirect(c);
      if (back?.intent === "signin") await api("POST", "/api/auth/supabase", { accessToken: back.accessToken });
      if (back?.intent === "connect-linkedin") {
        await api("POST", "/api/connect/linkedin", { accessToken: back.accessToken });
        toast("LinkedIn connected");
      }
      await back?.done();
    } catch (e: any) {
      toast(e?.message || "Sign-in didn't finish.", true);
    }
    const m = await api<{ me: Me | null; workspace: Workspace | null }>("GET", "/api/me");
    setMe(m.me);
    setWsState(m.workspace);
  }, [toast]);

  useEffect(() => {
    refresh().catch((e) => toast(e.message, true)).finally(() => setLoading(false));
  }, [refresh, toast]);

  // Theme: the account's choice when signed in, else this browser's; "system" follows the device, live.
  const [localTheme, setLocalTheme] = useState<Theme>(readLocalTheme);
  const theme: Theme = (ws?.settings.theme as Theme) || localTheme;
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? (mq.matches ? "dark" : "light") : theme; };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // Save status everyone can see: "Saving…" only if it takes a moment, and a failed save keeps its value for Retry.
  const [saving, setSaving] = useState(0);
  const [failed, setFailed] = useState<{ section: string; value: unknown } | null>(null);
  const save = useCallback(async (section: string, value: unknown) => {
    setSaving((n) => n + 1);
    try {
      const w = await api<Workspace>("PUT", `/api/ws/${section}`, { value });
      setWsState(w);
      setFailed((f) => (f?.section === section ? null : f));
      return w;
    } catch (e) {
      setFailed({ section, value });
      throw e;
    } finally {
      setSaving((n) => n - 1);
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
      toast(e?.message || "Something went wrong.", true);
      return undefined;
    }
  }, [toast]);

  const value = useMemo<Store>(() => ({
    config, me, ws, loading, toast, refresh, save, run, theme, setTheme,
    setWs: setWsState,
    setSession: (m, w) => { setMe(m); setWsState(w); },
  }), [config, me, ws, loading, toast, refresh, save, run, theme, setTheme]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {(failed || slow) && (
        <div className={"save-status" + (failed ? " err" : "")} role="status" data-testid="save-status">
          {failed && !saving ? <>Couldn't save your last change. <button onClick={() => save(failed.section, failed.value).catch(() => {})}>Retry</button></> : "Saving…"}
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
