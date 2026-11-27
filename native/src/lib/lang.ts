// Remy in the student's language (shared/i18n.ts), the website's client/src/lib/i18n.ts. Owners first: `languages`.
import { useEffect } from "react";
import { chosenLanguage, deviceLanguage, hasScreens, translate } from "@shared/i18n";
import { useAccess, useSession } from "./session";

/** The phone's language, if Remy speaks it ("en" otherwise). Intl needs no native module. */
export const myDevice = () => { try { return deviceLanguage([Intl.DateTimeFormat().resolvedOptions().locale]); } catch { return "en"; } };
export function useLang(): string {
  const { ws } = useSession();
  return useAccess()("languages") === "open" && ws ? chosenLanguage(ws.settings) : "en";
}
export function useT() {
  const code = useLang();
  const screens = hasScreens(code) ? code : "en";
  return (text: string, vars?: Record<string, string | number>) => translate(screens, text, vars);
}
/** Remembers the phone's language for "Match my device". */
export function useDeviceLanguage() {
  const { ws, saveSettings } = useSession();
  const open = useAccess()("languages") === "open";
  const device = myDevice();
  useEffect(() => { if (open && ws && ws.settings.deviceLanguage !== device) saveSettings({ deviceLanguage: device }).catch(() => {}); }, [open, device, ws?.settings.deviceLanguage]);
}
