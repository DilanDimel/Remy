import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Me, Workspace } from "@shared/types";
import { api } from "./api";

type Status = "loading" | "signed-out" | "ready" | "error";
type Session = {
  status: Status; me: Me | null; ws: Workspace | null; error: string;
  setWs: (w: Workspace) => void; refresh: () => Promise<void>; signedIn: (me: Me, ws: Workspace) => void; signOut: () => Promise<void>;
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
      setError(e.message); setStatus((s) => (s === "loading" ? "error" : s));
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const signedIn = (m: Me, w: Workspace) => { setMe(m); setWs(w); setStatus("ready"); };
  // After sign-in the server answers with a plain Me (no owner flag), so ask again for the full one.
  const signedInFull = (m: Me, w: Workspace) => { signedIn(m, w); refresh(); };
  const signOut = async () => { try { await api("POST", "/api/auth/logout"); } catch {} setMe(null); setWs(null); setStatus("signed-out"); };

  return <Ctx.Provider value={{ status, me, ws, error, setWs, refresh, signedIn: signedInFull, signOut }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);

/** Owners see the new app; everyone else is told it's coming (owners-only until the team releases it). */
export function isOwnerView(me: Me | null, ws: Workspace | null) {
  return !!me?.owner && ws?.settings.ownerView !== false;
}
