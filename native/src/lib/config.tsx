import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { AppConfig } from "@shared/types";
import { api } from "./api";

// The server's /api/config: feature releases (Admin → Beta → Feature releases), beta access and terms, AI status.
// Loaded at start, when the app comes back to the front and on pull to refresh, so a release on the website shows up
// in the app within one refresh, with no app update (the server caches it for about 30 seconds).
type Config = { config: AppConfig | null; reload: () => Promise<void> };
const Ctx = createContext<Config>({ config: null, reload: async () => {} });

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const reload = useCallback(() => api<AppConfig>("GET", "/api/config").then(setConfig).catch(() => {}), []);
  useEffect(() => {
    reload();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") reload(); });
    return () => sub.remove();
  }, [reload]);
  return <Ctx.Provider value={{ config, reload }}>{children}</Ctx.Provider>;
}
export const useConfig = () => useContext(Ctx);
