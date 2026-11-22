import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import type { JobFit } from "@shared/types";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, SvgXml } from "react-native-svg";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { FOX_SVG } from "./foxSvg";

export const tap = () => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); };
export const success = () => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

/** A tab's page: scrolls, pulls to refresh, and leaves room for the status bar and the tab bar. */
export function Screen({ children, refreshing, onRefresh, scroll = true, style }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 110 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top + 8 }, style]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={[pad, style]} contentInsetAdjustmentBehavior="never"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.fox} /> : undefined}>
        {children}
      </ScrollView>
      {/* Content scrolls under a paper-coloured band, not under the bare clock and battery. */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: c.paper, opacity: 0.96 }} />
    </View>
  );
}

export function T({ children, style, kind = "body", numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; kind?: "display" | "title" | "h2" | "body" | "small" | "label" | "muted"; numberOfLines?: number }) {
  const { c } = useTheme();
  const k: Record<string, TextStyle> = {
    display: { fontFamily: font.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.6, color: c.ink },
    title: { fontFamily: font.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.3, color: c.ink },
    h2: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: c.ink },
    body: { fontFamily: font.body, fontSize: 16, lineHeight: 22, color: c.ink },
    small: { fontFamily: font.body, fontSize: 13.5, lineHeight: 18, color: c.muted },
    muted: { fontFamily: font.body, fontSize: 15, lineHeight: 21, color: c.muted },
    label: { fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.8, textTransform: "uppercase", color: c.foxDeep },
  };
  return <Text style={[k[kind], style]} numberOfLines={numberOfLines}>{children}</Text>;
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const { c, dark } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: 22, padding: 16, borderWidth: dark ? StyleSheet.hairlineWidth : 0, borderColor: c.line, shadowColor: "#000", shadowOpacity: dark ? 0 : 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 };
  if (!onPress) return <View style={[base, style]} testID={testID}>{children}</View>;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [base, style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]} testID={testID} accessibilityRole="button">{children}</Pressable>;
}

export function Button({ label, onPress, kind = "ink", icon, busy, style, testID, flex }: { label: string; onPress: () => void; kind?: "ink" | "fox" | "ghost"; icon?: IconName; busy?: boolean; style?: StyleProp<ViewStyle>; testID: string; flex?: boolean }) {
  const { c } = useTheme();
  const bg = kind === "ink" ? c.ink : kind === "fox" ? c.fox : c.surface2;
  const fg = kind === "ink" ? c.onInk : kind === "fox" ? c.onFox : c.ink;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [{ height: 50, borderRadius: BUTTON_RADIUS, backgroundColor: bg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, alignSelf: flex ? "stretch" : "flex-start", opacity: pressed || busy ? 0.8 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <><Text style={{ fontFamily: font.bold, fontSize: 16, color: fg }}>{label}</Text>{icon && <Icon name={icon} size={18} color={fg} />}</>}
    </Pressable>
  );
}

export function Pill({ label, on, onPress, testID }: { label: string; on?: boolean; onPress?: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress ? () => { tap(); onPress(); } : undefined} disabled={!onPress}
      style={{ minHeight: 32, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16, backgroundColor: on ? c.ink : c.surface2, justifyContent: "center", maxWidth: "100%" }}>
      <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: on ? c.onInk : c.ink }}>{label}</Text>
    </Pressable>
  );
}

/** The same outcome chip as the website's Opportunities page (eligChip). The fit score is an internal
 * ranking (it can pass 100 or go below 0), so it is never shown as a percentage. */
export function FitBadge({ fit }: { fit?: JobFit }) {
  const { c } = useTheme();
  if (!fit) return null;
  const [label, bad] = fit.closed ? ["Closed", true] : fit.eligibility === "unlikely" ? ["Not eligible", true] : fit.checked && fit.eligibility !== "unknown" && !fit.hidden ? ["You qualify", false] : [null, false];
  if (!label) return null;
  return <View style={{ backgroundColor: bad ? c.surface2 : c.sageBg, borderRadius: 14, paddingHorizontal: 10, height: 28, justifyContent: "center" }}><Text style={{ fontFamily: font.bold, fontSize: 13, color: bad ? c.muted : c.sage }}>{label}</Text></View>;
}

/** Chat text with **bold** shown as bold instead of raw asterisks. */
export function RichText({ text, style, boldStyle }: { text: string; style?: StyleProp<TextStyle>; boldStyle?: StyleProp<TextStyle> }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <Text selectable style={style}>{parts.map((p, i) => (i % 2 ? <Text key={i} style={[{ fontFamily: font.bold }, boldStyle]}>{p}</Text> : p))}</Text>;
}

export function Fox({ size = 40 }: { size?: number }) {
  return <SvgXml xml={FOX_SVG} width={size} height={size * 84 / 72} />;
}

/** The employer's first letter on a coloured tile, since postings rarely come with a logo. */
export function EmployerTile({ name, size = 44 }: { name: string; size?: number }) {
  const { c } = useTheme();
  const tones = [c.ink, c.foxDeep, c.sage, c.muted];
  const tone = tones[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % tones.length];
  return <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: tone, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: font.display, fontSize: size * 0.4, color: c.surface }}>{(name.trim()[0] || "?").toUpperCase()}</Text></View>;
}

export function Loading() {
  const { c } = useTheme();
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.paper }}><ActivityIndicator color={c.fox} /></View>;
}

export function Sect({ title, right }: { title: string; right?: ReactNode }) {
  const { c, look } = useTheme();
  if (look === "calm") return <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24, marginBottom: 8, marginHorizontal: 4 }}><Text style={{ fontFamily: font.semi, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase", color: c.muted }}>{title}</Text>{right}</View>;
  return <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 26, marginBottom: 10 }}><T kind="h2">{title}</T>{right}</View>;
}

/** A grouped list row, iOS-settings style (used by the calm look and by the You tab). */
export function Row({ title, sub, left, right, onPress, first, testID }: { title: string; sub?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void; first?: boolean; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} disabled={!onPress} onPress={onPress ? () => { tap(); onPress(); } : undefined} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: pressed ? c.surface2 : c.surface })}>
      {!first && <View style={{ position: "absolute", top: 0, left: left ? 52 : 16, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />}
      {left}
      <View style={{ flex: 1 }}><T numberOfLines={2}>{title}</T>{!!sub && <T kind="small" numberOfLines={1}>{sub}</T>}</View>
      {right ?? (onPress ? <Icon name="chev" size={18} color={c.faint} /> : null)}
    </Pressable>
  );
}
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, dark } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: 22, overflow: "hidden", borderWidth: dark ? StyleSheet.hairlineWidth : 0, borderColor: c.line }, style]}>{children}</View>;
}

export type IconName = "arrow" | "chev" | "check" | "flame" | "doc" | "jobs" | "chat" | "you" | "book" | "flag" | "trend" | "compass" | "x" | "heart" | "up" | "undo" | "plus" | "list" | "cards";
const paths: Record<IconName, string> = {
  arrow: "M5 12h14M13 6l6 6-6 6", chev: "M9 6l6 6-6 6", check: "M5 12l5 5 9-10",
  flame: "M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-3 0-5 0-7z",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6", jobs: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", chat: "M4 5h16v11H9l-5 4z",
  you: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6", book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5",
  flag: "M5 21V4h11l-2 4 2 4H5", trend: "M3 17l6-6 4 4 8-8M15 7h6v6", compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  x: "M6 6l12 12M18 6L6 18", heart: "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z", up: "M12 19V5M6 11l6-6 6 6",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", plus: "M12 5v14M5 12h14", list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  cards: "M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2z",
};
export function Icon({ name, size = 22, color, strokeWidth = 1.9 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const { c } = useTheme();
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || c.ink} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><Path d={paths[name]} /></Svg>;
}
export function Ring({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const { c } = useTheme();
  const r = size / 2 - 5, len = 2 * Math.PI * r, frac = total ? done / total : 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}><Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface2} strokeWidth={7} fill="none" /><Circle cx={size / 2} cy={size / 2} r={r} stroke={c.fox} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={len * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></Svg>
      <Text style={{ fontFamily: font.display, fontSize: 14, color: c.ink }}>{done}/{total}</Text>
    </View>
  );
}

