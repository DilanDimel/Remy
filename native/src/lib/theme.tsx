import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

// Remy's colours, copied from the tokens in client/src/index.css ("paper, ink, one orange").
// Keep the two in step: a new colour goes in index.css first.
const light = {
  bg: "#fafaf8", paper: "#fbf7f2", surface: "#ffffff", surface2: "#f5f4f1", ink: "#161616", muted: "#5f5f5f", faint: "#8a8a85",
  line: "#e3e1dc", fox: "#e86a2a", foxDeep: "#c2410c", foxSoft: "#fdecdf", onFox: "#ffffff", onInk: "#ffffff",
  sage: "#15803d", sageBg: "#dcfce7", road: "#e7e0d6", nodeShadow: "#e3ddd4", foxShadow: "#9a3412", error: "#b42318",
};
const dark: typeof light = {
  bg: "#111111", paper: "#161616", surface: "#1c1c1c", surface2: "#181818", ink: "#f5f5f3", muted: "#a8a8a3", faint: "#85857f",
  line: "#2c2c2a", fox: "#e86a2a", foxDeep: "#ff8a4c", foxSoft: "#3a2216", onFox: "#ffffff", onInk: "#161616",
  sage: "#4ade80", sageBg: "#123321", road: "#2c2a27", nodeShadow: "#000000", foxShadow: "#9a3412", error: "#f97066",
};
export type Colors = typeof light;

/** The two looks Dilan is trying side by side (Nov 22): A "calm" (Apple-style lists) and B "soul" (Remy's personality). */
export type Look = "calm" | "soul";

export const font = {
  display: "PlusJakartaSans_800ExtraBold",
  bold: "PlusJakartaSans_700Bold",
  semi: "PlusJakartaSans_600SemiBold",
  body: "PlusJakartaSans_500Medium",
  regular: "PlusJakartaSans_400Regular",
};
/** Same corner as the website's buttons (Dilan, Nov 22: not fully round). */
export const BUTTON_RADIUS = 12;

type Theme = { c: Colors; dark: boolean; look: Look; setLook: (l: Look) => void };
const Ctx = createContext<Theme>({ c: light, dark: false, look: "soul", setLook: () => {} });
const KEY = "remy.look";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [look, setLookState] = useState<Look>("soul");
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v === "calm" || v === "soul") setLookState(v); }).catch(() => {}); }, []);
  const setLook = (l: Look) => { setLookState(l); AsyncStorage.setItem(KEY, l).catch(() => {}); };
  const isDark = scheme === "dark";
  const base = isDark ? dark : light;
  // Calm uses the plain app background; Soul the warm paper.
  const c = look === "soul" ? base : { ...base, paper: base.bg };
  return <Ctx.Provider value={{ c, dark: isDark, look, setLook }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
