import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Pill, T, tap } from "@/components/ui";
import { shift } from "@/lib/clock";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const label = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** The weekly career time, as the website's CareerTime.tsx: any day, any time (5-minute steps), or none. No picker dependency. */
export function CareerTime({ intro = false }: { intro?: boolean }) {
  const { ws, saveSettings } = useSession();
  const { c } = useTheme();
  const saved = ws?.settings.careerTime ?? null;
  // Taps change it here at once; one save after the taps stop, so quick taps never race each other.
  const [ct, setCt] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => setCt(saved), [saved?.day, saved?.time]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!ws) return null;
  const set = (v: { day: number; time: string } | null) => { setCt(v); clearTimeout(timer.current); timer.current = setTimeout(() => saveSettings({ careerTime: v }), 600); };
  const step = (min: number, id: string) => (
    <Pressable testID={id} hitSlop={6} disabled={!ct} onPress={() => { tap(); ct && set({ day: ct.day, time: shift(ct.time, min) }); }}
      style={{ minWidth: 44, height: 40, borderRadius: 20, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", opacity: ct ? 1 : 0.4 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>{min > 0 ? "+" : "−"}{Math.abs(min) >= 60 ? `${Math.abs(min) / 60}h` : `${Math.abs(min)}m`}</Text>
    </Pressable>
  );
  return (
    <View testID="career-time" style={{ gap: 10 }}>
      {intro && <T kind="small">A set time each week makes it easier to follow through than waiting for a reminder. 45 minutes is plenty. It shows on your Remy calendar.</T>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {DAYS.map((d, i) => <Pill key={d} label={d} on={ct?.day === i} onPress={() => set(ct?.day === i ? null : { day: i, time: ct?.time || "19:00" })} testID={`pill-career-day-${i}`} />)}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {step(-60, "button-career-hour-down")}{step(-5, "button-career-min-down")}
        <Text testID="text-career-time" style={{ flex: 1, textAlign: "center", fontFamily: font.bold, fontSize: 18, color: ct ? c.ink : c.faint }}>{ct ? label(ct.time) : "Pick a day"}</Text>
        {step(5, "button-career-min-up")}{step(60, "button-career-hour-up")}
      </View>
    </View>
  );
}
