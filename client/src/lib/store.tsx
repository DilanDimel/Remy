import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppConfig, Me, Workspace } from "@shared/types";

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
}
const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

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
    const [c, m] = await Promise.all([api<AppConfig>("GET", "/api/config"), api<{ me: Me | null; workspace: Workspace | null }>("GET", "/api/me")]);
    setConfig(c);
    setMe(m.me);
    setWsState(m.workspace);
  }, []);

  useEffect(() => {
    refresh().catch((e) => toast(e.message, true)).finally(() => setLoading(false));
  }, [refresh, toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = ws?.settings.theme === "dark" ? "dark" : "light";
  }, [ws?.settings.theme]);

  const save = useCallback(async (section: string, value: unknown) => {
    const w = await api<Workspace>("PUT", `/api/ws/${section}`, { value });
    setWsState(w);
    return w;
  }, []);

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
    config, me, ws, loading, toast, refresh, save, run,
    setWs: setWsState,
    setSession: (m, w) => { setMe(m); setWsState(w); },
  }), [config, me, ws, loading, toast, refresh, save, run]);

  return (
    <Ctx.Provider value={value}>
      {children}
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
export const daysUntil = (d: string) => {
  if (!d) return null;
  const t = new Date(d + "T23:59:00").getTime();
  return Math.ceil((t - Date.now()) / 86_400_000);
};
export const rid = (p = "") => p + Math.random().toString(36).slice(2, 10);
