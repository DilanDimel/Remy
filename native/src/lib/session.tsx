import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Me, Workspace } from "@shared/types";
import { api, ApiError } from "./api";
import { useConfig } from "./config";
import { accessFor, canGoFor, ownersOnly, redesignFor, type Status } from "./rules";

type Session = {
  status: Status; me: Me | null; ws: Workspace | null; error: string;
  setWs: (w: Workspace) => void; refresh: () => Promise<void>; signedIn: (me: Me, ws: Workspace) => void; signOut: () => Promise<void>;
  /** Saves one workspace section (PUT /api/ws/:section) and keeps the answer. */
  saveSettings: (patch: Partial<Workspace["settings"]>) => Promise<void>;
};
const Ctx = createContext<Session>(null as unknown as Session);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ me: Me | null; workspace: Workspace | null }>("GET", "/api/me");
      setMe(r.me); setWs(r.workspace); setError("");
      setStatus(r.me ? "ready" : "signed-out");
    } catch (e: any) {
      setError(e.message);
      // Signed in but not on the beta list (the server answers 403 "beta"): the website's beta screen, not sign-in.
      if (e instanceof ApiError && e.code === "beta") { setStatus("beta-blocked"); return; }
      setStatus((s) => (s === "loading" ? "error" : s));
    }
  }, []);
  useEffect(() => {
    refresh();
    // An owner/student switch or a theme picked on the website shows up when the app comes back to the front.
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const signedIn = (m: Me, w: Workspace) => { setMe(m); setWs(w); setStatus("ready"); };
  // After sign-in the server answers with a plain Me (no owner flag), so ask again for the full one.
  const signedInFull = (m: Me, w: Workspace) => { signedIn(m, w); refresh(); };
  const signOut = async () => { try { await api("POST", "/api/auth/logout"); } catch {} setMe(null); setWs(null); setStatus("signed-out"); };
  const saveSettings = async (patch: Partial<Workspace["settings"]>) => {
    if (!ws) return;
    setWs({ ...ws, settings: { ...ws.settings, ...patch } }); // feels instant; the server's answer replaces it
    setWs(await api<Workspace>("PUT", "/api/ws/settings", { value: { ...ws.settings, ...patch } }));
  };

  return <Ctx.Provider value={{ status, me, ws, error, setWs, refresh, signedIn: signedInFull, signOut, saveSettings }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);

/** Owners in owner view only: unreleased features and owner tools (the website's useOwnersOnly()). */
export const useOwnersOnly = () => { const { me, ws } = useSession(); return ownersOnly(me, ws); };
/** Show the redesigned Remy (the website's useOwnerView()). */
export const useOwnerView = () => { const { me, ws } = useSession(); const { config } = useConfig(); return redesignFor(me, ws, config); };
/** A feature's state for this person, from Admin → Beta → Feature releases: "open", "locked" or "hidden". */
export const useAccess = () => { const { me, ws } = useSession(); const { config } = useConfig(); return (key: string) => accessFor(me, ws, config, key); };
/** Can this person open the page a link goes to (not a locked Interview or Community)? */
export const useCanGo = () => { const { me, ws } = useSession(); const { config } = useConfig(); return (link: string) => canGoFor(me, ws, config, link); };
/** Pull to refresh: the account and the feature releases together. */
export const useRefreshAll = () => { const { refresh } = useSession(); const { reload } = useConfig(); return () => Promise.all([refresh(), reload()]).then(() => {}); };
