import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { GIVE_UP, POKES, SPIN, TAPS, dateLine, pick, timeLine } from "@shared/officeLines";
import { tap } from "@/components/ui";
import { OFFICE_DAY, OFFICE_NIGHT } from "./officeSvg";
import { font, useTheme } from "@/lib/theme";

// Where each thing sits in the 860 × 420 room (top-left x, y, width, height; y counted from the viewBox top at 40).
// Measured from the exported drawing; the night room has the moon where the day room has the sun.
const SPOTS: Record<string, [number, number, number, number]> = {
  window: [544, 48, 252, 168], skyline: [570, 128, 180, 80], books: [40, 112, 200, 76], cert: [56, 226, 40, 42],
  resume: [282, 70, 92, 116], pins: [404, 150, 136, 64], chair: [398, 228, 114, 100], desk: [310, 334, 320, 72],
  plant: [328, 252, 50, 82], lamp: [370, 288, 44, 46], laptop: [470, 288, 120, 46], briefcase: [60, 374, 86, 72],
};
const SKY: [number, number, number, number] = [586, 66, 44, 44];
const REMY: [number, number, number, number] = [622, 160, 116, 190];
// Smaller things first, so a tap on the lamp isn't caught by the desk under it.
const ORDER = ["window", "skyline", "desk", "books", "chair", "resume", "pins", "briefcase", "plant", "laptop", "lamp", "cert"];

const clockTime = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const lineFor = (k: string) => pick(TAPS[k] || [""]).replace("{time}", clockTime());
const opening = () => { const now = new Date(); return dateLine(now) || timeLine(now.getHours(), now.getDay()); };

/** Remy's office, as on the website's My Path: day in light theme, night in dark. Tap a thing and Remy says a line about
 *  it; tap Remy and he answers back. The room is a static drawing for now (handoff 04); it fills from the edges on a phone,
 *  centred on the desk, and pans sideways to the shelf and the window. */
export function Office() {
  const { c, dark } = useTheme();
  const { width } = useWindowDimensions();
  // About 16:10 on a phone (the room is 860:420), never taller than the whole room.
  const h = Math.min(width * 10 / 16, width * 420 / 860 * 1.6, 300);
  const k = h / 420, w = 860 * k;
  // Start on the desk and Remy by the window; the shelf is a swipe to the left.
  const start = Math.max(0, Math.min(w - width, 560 * k - width / 2));
  const scroll = useRef<any>(null);
  const [said, setSaid] = useState(opening);
  const pokes = useRef({ n: 0, t: 0 });
  const say = (line: string) => { tap(); setSaid(line); };
  const poke = () => {
    const now = Date.now(), p = pokes.current;
    p.n = now - p.t < 1500 ? p.n + 1 : 1; p.t = now;
    say(p.n >= 10 ? GIVE_UP : p.n === 5 ? SPIN : pick(POKES));
  };
  const box = ([x, y, bw, bh]: [number, number, number, number]) => ({ position: "absolute" as const, left: x * k, top: (y - 40) * k, width: bw * k, height: bh * k });

  return (
    <View testID="path-office">
      <View style={{ marginHorizontal: -16, height: h, backgroundColor: c.roomWall }}>
        <ScrollView ref={scroll} horizontal contentOffset={{ x: start, y: 0 }} onContentSizeChange={() => scroll.current?.scrollTo({ x: start, animated: false })} showsHorizontalScrollIndicator={false} bounces={false}>
          <View style={{ width: w, height: h }}>
            <SvgXml xml={dark ? OFFICE_NIGHT : OFFICE_DAY} width={w} height={h} />
            {ORDER.map((key) => <Pressable key={key} testID={`office-${key}`} accessibilityLabel={key} onPress={() => say(lineFor(key))} style={box(SPOTS[key]!)} />)}
            <Pressable testID={`office-${dark ? "moon" : "sun"}`} accessibilityLabel={dark ? "moon" : "sun"} onPress={() => say(lineFor(dark ? "moon" : "sun"))} style={box(SKY)} />
            <Pressable testID="office-remy" accessibilityLabel="Remy" onPress={poke} style={box(REMY)} />
          </View>
        </ScrollView>
      </View>
      <View style={{ alignItems: "flex-end", paddingRight: 40 }}>
        <View style={{ width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: c.line, marginTop: 6 }} />
      </View>
      <View testID="office-bubble" accessibilityLiveRegion="polite" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.6, color: c.fox, marginBottom: 2 }}>REMY</Text>
        <Text style={{ fontFamily: font.body, fontSize: 15, lineHeight: 21, color: c.ink }}>{said}</Text>
      </View>
    </View>
  );
}
