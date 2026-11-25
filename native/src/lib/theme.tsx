import { createContext, useContext, useEffect, type ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import { brand, dark as darkTokens, light as lightTokens, radius } from "./tokens";
import { themeOf } from "./rules";
import { useSession } from "./session";

// Remy's colours come only from tokens.ts, generated from the website's client/src/index.css ("paper, ink, one orange").
// A new colour goes in index.css first, then tokens.ts is regenerated. Two names are the app's own, both website values:
// onFox is the text on an orange button (white), onInk the text on an ink button (the website's --plum-ink).
export type Colors = Record<keyof typeof lightTokens | "onFox" | "onInk", string>;
/** Just above the tab bar: iOS's bar is about 49 pt over the home indicator, Android's Material bar about 80 dp. Remy's fox sits here, and toasts sit level with him. */
export const aboveTabs = (bottomInset: number) => bottomInset + (Platform.OS === "ios" ? 62 : 92);

const light: Colors = { ...lightTokens, onFox: brand.white, onInk: lightTokens.plumInk };
const dark: Colors = { ...darkTokens, onFox: brand.white, onInk: darkTokens.plumInk };

export { font } from "./tokens";
/** The website's button and input corner (10). */
export const BUTTON_RADIUS = radius.button;

export type ThemeChoice = "system" | "light" | "dark";

type Theme = { c: Colors; dark: boolean };
const Ctx = createContext<Theme>({ c: light, dark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const { ws } = useSession();
  const isDark = themeOf(ws?.settings, scheme === "dark") === "dark";
  const c = isDark ? dark : light;
  // The window behind every screen (and Android's navigation bar, drawn edge to edge) is the page colour.
  useEffect(() => { if (Platform.OS !== "web") SystemUI.setBackgroundColorAsync(c.bg).catch(() => {}); }, [c.bg]);
  return <Ctx.Provider value={{ c, dark: isDark }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
