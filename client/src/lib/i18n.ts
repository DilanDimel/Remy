// Remy in the student's language (shared/i18n.ts). Owners first: the `languages` switch in Admin → Beta.
import { useEffect } from "react";
import { chosenLanguage, deviceLanguage, hasScreens, translate } from "@shared/i18n";
import { useAccess } from "../components/ComingSoon";
import { useStore } from "./store";

/** The language Remy talks in for this person ("en" until the feature is open for them). */
export function useLang(): string {
  const { ws } = useStore();
  const open = useAccess()("languages") === "open";
  return open && ws ? chosenLanguage(ws.settings) : "en";
}
/** t("Home") → "Inicio" when the student's language has screens; English otherwise. */
export function useT() {
  const code = useLang();
  const screens = hasScreens(code) ? code : "en";
  return (text: string, vars?: Record<string, string | number>) => translate(screens, text, vars);
}
/** The device's language, if Remy speaks it ("en" otherwise). */
export const myDevice = () => (typeof navigator === "undefined" ? "en" : deviceLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
/** Remembers the device's language for "Match my device", and labels the page with the language it's shown in. */
export function useDeviceLanguage() {
  const { ws, save } = useStore();
  const open = useAccess()("languages") === "open";
  const code = useLang();
  const device = myDevice();
  useEffect(() => {
    if (open && ws && ws.settings.deviceLanguage !== device) save("settings", { deviceLanguage: device });
  }, [open, device, ws?.settings.deviceLanguage]);
  useEffect(() => { document.documentElement.lang = hasScreens(code) ? code : "en"; }, [code]);
  return device;
}
