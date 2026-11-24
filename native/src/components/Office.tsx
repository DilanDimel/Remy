import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { GIVE_UP, POKES, QUOTES, SPIN, TAPS, dateLine, pick, timeLine } from "@shared/officeLines";
import { OFFICE, rankOf, unlockedOutfits, xpOf } from "@shared/game";
import { pinColor, topPins } from "@shared/pins";
import { rareOwned } from "@shared/chest";
import { dailyStreak, streakDays } from "@shared/daily";
import type { Workspace } from "@shared/types";
import type { OfficeSpot } from "@shared/officeSteps";
import { tap } from "@/components/ui";
import { OUTFITS, type Outfit } from "./scholarSvg";
import { roomXml, type RoomState } from "./officeRoom";
import { font, useTheme, type Colors } from "@/lib/theme";

// Where each thing sits in the 860 × 420 room (top-left x, y, width, height; y counted from the viewBox top at 40).
const SPOTS: Record<string, [number, number, number, number]> = {
  window: [544, 48, 252, 168], skyline: [570, 128, 180, 80], books: [40, 112, 200, 76], cert: [56, 226, 40, 42],
  resume: [282, 86, 92, 116], pins: [404, 150, 136, 64], chair: [398, 228, 114, 100], desk: [310, 334, 320, 72],
  plant: [328, 252, 50, 82], laptop: [470, 288, 120, 46], briefcase: [60, 374, 86, 72],
};
// Things that are only there once earned (level items, chest finds, streak milestones).
const EARNED: Record<string, [number, number, number, number]> = {
  lamp: [370, 282, 46, 52], clock: [798, 64, 40, 40], mug: [598, 302, 24, 32], globe: [724, 358, 62, 80], painting: [410, 50, 70, 54],
  trophy: [134, 228, 40, 40], bigplant: [794, 336, 60, 106], photo: [796, 120, 52, 64], bonsai: [184, 230, 44, 38],
  pennant: [494, 74, 48, 62], goldmug: [736, 182, 26, 24], record: [670, 364, 80, 40],
};
const SKY: [number, number, number, number] = [586, 66, 44, 44];
// Remy at his desk, as the website seats him (PathBoard.tsx SPOTS.desk, scale 0.62 of his 200 × 222 drawing).
const FOX_S = 0.62;
const FOX: [number, number, number, number] = [455 - 100 * FOX_S, 208 - 8 * FOX_S, 200 * FOX_S, 222 * FOX_S];
// Smaller things first, so a tap on the lamp isn't caught by the desk under it.
const ORDER = ["window", "skyline", "desk", "books", "chair", "resume", "pins", "briefcase", "plant", "laptop", "cert"];

// Remy's office guide (the website's PathBoard.tsx SPOT_BADGE / SPOT_GLOW): where each step's number sits and what
// glows, centred at x, y in room units. The filing cabinet is his notes on you.
const SPOT_BADGE: Record<OfficeSpot, [number, number]> = { computer: [596, 288], frame: [282, 140], notes: [706, 262] };
const SPOT_GLOW: Record<OfficeSpot, [number, number, number, number]> = { computer: [544, 312, 110, 62], frame: [328, 144, 104, 128], notes: [673, 304, 76, 106] };
const NOTES: [number, number, number, number] = [642, 256, 62, 96];
const SPOT_OF: Record<string, OfficeSpot> = { laptop: "computer", resume: "frame", notes: "notes" };
export type OfficeMark = { spot: OfficeSpot; n: number; on: boolean };

const clockTime = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const lineFor = (k: string) => pick(TAPS[k] || [""]).replace("{time}", clockTime());
const opening = () => { const now = new Date(); return dateLine(now) || timeLine(now.getHours(), now.getDay()); };
const VARS: Record<string, keyof Colors> = { "var(--fox)": "fox", "var(--fox-deep)": "foxDeep", "var(--faint)": "faint", "var(--amber)": "amber" };

/** The room's state from the workspace, the same fields the website's office reads (PathBoard.tsx). The certificate
 *  shows once a "Look into: …" credential to-do is done, which is when the website marks that stop done. */
export function roomState(ws: Workspace, c: Colors, night: boolean, now: Date): RoomState & { outfit: Outfit; nextItem?: [string, string, number] } {
  const g: NonNullable<Workspace["game"]> = ws.game || { weeks: {} };
  const lv = rankOf(xpOf(ws, g), g.bestRank);
  const owned = unlockedOutfits(g.bestRank || lv.n, ws.profile.classYear);
  const outfit = (g.outfit && owned.includes(g.outfit) && g.outfit in OUTFITS ? g.outfit : "suit") as Outfit;
  const streak = dailyStreak(streakDays(ws));
  return {
    night, level: lv.n, now, outfit,
    items: OFFICE.filter(([, , l]) => l <= lv.n).map(([k]) => k),
    nextItem: OFFICE.find(([, , l]) => l > lv.n),
    books: Math.min(8, (g.known || []).length),
    resume: !!ws.resume, applied: ws.applications.length > 0,
    cert: ws.tasks.some((t) => t.done && /^Look into: /.test(t.title)),
    pins: topPins(ws, 8).map((p) => c[VARS[pinColor(p) || ""] || "fox"]),
    rare: rareOwned(g), streakDays: streak.days, streakBest: streak.best,
  };
}

/** Remy's office, as on the website's My Path, drawn from the student's own progress: day in light theme, night in dark;
 *  books, pins, the framed resume, level items and chest finds appear as they're earned, and empty slots show dashed.
 *  Tap a thing and Remy says a line about it; tap Remy and he answers back; left alone, he shares a quote now and then.
 *  The room fills from the edges on a phone, centred on the desk, and pans sideways to the shelf and the window. */
export function Office({ ws, guide }: { ws: Workspace; guide?: { marks: OfficeMark[]; onSpot: (spot: OfficeSpot) => void } }) {
  const { c, dark } = useTheme();
  const { width } = useWindowDimensions();
  // The clock on the wall tells the real time.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const s = useMemo(() => ({ ...roomState(ws, c, dark, now), notes: !!guide }), [ws, c, dark, now, !!guide]);
  const back = useMemo(() => roomXml(s, c, "back"), [s, c]);
  const front = useMemo(() => roomXml(s, c, "front"), [s, c]);
  // About 16:10 on a phone (the room is 860:420), never taller than the whole room.
  const h = Math.min(width * 10 / 16, width * 420 / 860 * 1.6, 300);
  const k = h / 420, w = 860 * k;
  const start = Math.max(0, Math.min(w - width, 560 * k - width / 2));
  const scroll = useRef<any>(null);
  // With the guide on, his banner above the room does the talking; this bubble shows only after a tap.
  const [said, setSaid] = useState(() => (guide ? "" : opening()));
  const pokes = useRef({ n: 0, t: 0 });
  const guideRef = useRef(false); guideRef.current = !!guide?.marks.length;
  const last = useRef(Date.now());
  const say = (line: string) => { tap(); last.current = Date.now(); setSaid(line); };
  // With the guide on, his computer, the resume frame and the filing cabinet do their step instead of a line.
  const tapThing = (key: string) => { const sp = SPOT_OF[key]; if (guide && sp) { tap(); return guide.onSpot(sp); } say(lineFor(key)); };
  const poke = () => {
    const t = Date.now(), p = pokes.current;
    p.n = t - p.t < 1500 ? p.n + 1 : 1; p.t = t;
    say(p.n >= 10 ? GIVE_UP : p.n === 5 ? SPIN : pick(POKES));
  };
  // Left alone for a while, he leans back and shares a quote (the website's idle quotes).
  useEffect(() => {
    const t = setInterval(() => { if (!guideRef.current && Date.now() - last.current > 45000) { last.current = Date.now(); const q = pick(QUOTES); setSaid(`"${q.q}" (${q.by})`); } }, 15000);
    return () => clearInterval(t);
  }, []);
  // He breathes, gently, unless the phone asks for less motion.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
    }).catch(() => {});
    return () => loop?.stop();
  }, [breath]);
  const box = ([x, y, bw, bh]: [number, number, number, number]) => ({ position: "absolute" as const, left: x * k, top: (y - 40) * k, width: bw * k, height: bh * k });
  const earned = Object.keys(EARNED).filter((key) => s.items.includes(key) || s.rare.has(key) || (key === "photo" && s.streakBest >= 30));
  const [fx, fy, fw, fh] = FOX;

  return (
    <View testID="path-office">
      <View style={{ marginHorizontal: -16, height: h, backgroundColor: c.roomWall }}>
        <ScrollView ref={scroll} horizontal contentOffset={{ x: start, y: 0 }} onContentSizeChange={() => scroll.current?.scrollTo({ x: start, animated: false })} showsHorizontalScrollIndicator={false} bounces={false}>
          <View style={{ width: w, height: h }}>
            <SvgXml xml={back} width={w} height={h} />
            <Animated.View pointerEvents="none" style={{ position: "absolute", left: fx * k, top: (fy - 40) * k, width: fw * k, height: fh * k,
              transform: [{ translateY: fh * k / 2 }, { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }, { translateY: -fh * k / 2 }] }}>
              <SvgXml xml={OUTFITS[s.outfit]} width={fw * k} height={fh * k} />
            </Animated.View>
            <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}><SvgXml xml={front} width={w} height={h} /></View>
            {ORDER.map((key) => <Pressable key={key} testID={`office-${key}`} accessibilityLabel={key} onPress={() => tapThing(key)} style={box(SPOTS[key]!)} />)}
            {guide && <Pressable testID="office-notes" accessibilityRole="button" accessibilityLabel="My notes on you" onPress={() => tapThing("notes")} style={box(NOTES)} />}
            <Pressable testID="office-remy" accessibilityLabel="Remy" onPress={poke} style={box([fx + 8, fy, fw - 16, 334 - fy])} />
            {earned.map((key) => <Pressable key={key} testID={`office-${key}`} accessibilityLabel={key} onPress={() => say(lineFor(key))} style={box(EARNED[key]!)} />)}
            {guide?.marks.filter((m) => m.on).map((m) => { const [x, y, gw, gh] = SPOT_GLOW[m.spot];
              return <View key={"g" + m.spot} pointerEvents="none" style={{ position: "absolute", left: (x - gw / 2) * k, top: (y - 40 - gh / 2) * k, width: gw * k, height: gh * k, borderRadius: 12, borderWidth: 3, borderColor: c.fox }} />; })}
            {guide?.marks.map((m) => { const [x, y] = SPOT_BADGE[m.spot];
              return (
                <Pressable key={m.spot} testID={`office-num-${m.spot}`} accessibilityRole="button" accessibilityLabel={`Step ${m.n}`} hitSlop={8} onPress={() => { tap(); guide.onSpot(m.spot); }}
                  style={{ position: "absolute", left: x * k - 13, top: (y - 40) * k - 13, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 2, backgroundColor: m.on ? c.fox : c.surface, borderColor: m.on ? c.surface : c.fox }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color: m.on ? c.onFox : c.foxDeep }}>{m.n}</Text>
                </Pressable>); })}
            <Pressable testID={`office-${dark ? "moon" : "sun"}`} accessibilityLabel={dark ? "moon" : "sun"} onPress={() => say(lineFor(dark ? "moon" : "sun"))} style={box(SKY)} />
          </View>
        </ScrollView>
      </View>
      {!!said && <>
      {/* The bubble's tail points up at Remy, wherever the room starts scrolled. */}
      <View style={{ paddingLeft: Math.max(8, 455 * k - start - 16 - 9), marginTop: 6 }}>
        <View style={{ width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: c.line }} />
      </View>
      <View testID="office-bubble" accessibilityLiveRegion="polite" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.6, color: c.fox, marginBottom: 2 }}>REMY</Text>
        <Text style={{ fontFamily: font.body, fontSize: 15, lineHeight: 21, color: c.ink }}>{said}</Text>
      </View>
      </>}
      {!guide && <Text testID="office-next" style={{ fontFamily: font.semi, fontSize: 12.5, color: c.mutedText, marginTop: 6, marginHorizontal: 4 }}>{s.nextItem ? `Level ${s.nextItem[2]} adds a ${s.nextItem[1].toLowerCase()} to the office.` : "The office is fully furnished."}</Text>}
    </View>
  );
}
