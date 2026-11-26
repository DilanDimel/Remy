import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OwnerActivity } from "@shared/types";
import { Loading, Ring, Sect, T, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// "Using Remy" (Admin → Team & hours on the website): how much each owner uses Remy themselves, same rules for everyone.
// Owners only; the server counts a minute only while Remy is open and in use. Same /api/admin/activity as the website.
const hm = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim());
const DEVICE = { desktop: "Computer", phone: "Phone web", app: "App" } as const;
const seen = (iso: string | null) => {
  if (!iso) return "Not seen yet";
  const m = Math.round((Date.now() - +new Date(iso)) / 60_000);
  return m < 3 ? "Online now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export default function UsingRemy() {
  const { me } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [a, setA] = useState<OwnerActivity | null>(null);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState("");
  useEffect(() => { api<OwnerActivity>("GET", "/api/admin/activity").then(setA).catch((x) => setErr(x.message)); }, []);
  if (!me?.owner) return null;
  if (!a) return err ? <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}><T style={{ color: c.error }}>{err}</T></View> : <Loading />;
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 } as const;
  const daysOf = (p: OwnerActivity["people"][number]) => p.perDay.filter(Boolean).length;
  const met = a.people.filter((p) => daysOf(p) >= a.goalDays).length;
  const p = a.people.find((x) => x.email === pick) || a.people.find((x) => x.me) || a.people[0];
  const dayName = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" });
  const max = Math.max(1, ...(p?.perDay || [0]));
  const devTotal = p ? p.devices.desktop + p.devices.phone + p.devices.app : 0;

  return (
    <ScrollView testID="use-screen" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
      <T kind="muted"><Text style={{ fontFamily: font.bold, color: c.ink }}>{met} of {a.people.length} owners</Text> used Remy on {a.goalDays}+ days this week.</T>

      <View testID="use-people" style={card}>
        {a.people.map((x, i) => {
          const d = daysOf(x), step = x.minutes - x.prevMinutes, on = x.email === p?.email;
          return (
            <Pressable key={x.email} testID={`use-${x.email.split("@")[0]}`} onPress={() => { tap(); setPick(x.email); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderColor: c.line, opacity: on ? 1 : 0.85 }}>
              <Ring done={d} total={7} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontFamily: on ? font.bold : font.semi }} numberOfLines={1}>{x.name}</T>
                <T kind="small" numberOfLines={1}>{seen(x.lastSeen)}{x.lastDevice ? ` · ${DEVICE[x.lastDevice as keyof typeof DEVICE] || x.lastDevice}` : ""}</T>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: font.bold, fontSize: 16, color: d >= a.goalDays ? c.fox : c.ink }}>{hm(x.minutes)}</Text>
                <T kind="small">{step > 0 ? `+${hm(step)}` : step < 0 ? `−${hm(-step)}` : "same"} vs last wk</T>
              </View>
            </Pressable>
          );
        })}
      </View>

      {p && <>
        <Sect title={p.me ? "Your week" : `${p.name.split(" ")[0]}'s week`} />
        <View testID="use-detail" style={card}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[[hm(p.minutes), "Active"], [String(p.visits), "Visits"], [p.visits ? hm(Math.round(p.minutes / p.visits)) : "0m", "Per visit"]].map(([n, l]) => (
              <View key={l} style={{ flex: 1, gap: 2 }}><Text style={{ fontFamily: font.bold, fontSize: 20, color: c.ink }}>{n}</Text><T kind="small">{l}</T></View>))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 70 }}>
            {p.perDay.map((m, i) => (
              <View key={a.days[i]} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <View style={{ width: "100%", height: Math.max(3, (m / max) * 48), borderRadius: 4, backgroundColor: m ? c.fox : c.surface2 }} />
                <T kind="small">{dayName(a.days[i])}</T>
              </View>))}
          </View>
          {devTotal > 0 && <>
            <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: c.surface2 }}>
              {(["desktop", "phone", "app"] as const).map((k, i) => <View key={k} style={{ flex: p.devices[k], backgroundColor: [c.ink, c.fox, c.sage][i] }} />)}
            </View>
            <T kind="small">{(["desktop", "phone", "app"] as const).filter((k) => p.devices[k]).map((k) => `${DEVICE[k]} ${hm(p.devices[k])}`).join(" · ")}</T>
          </>}
          {!!p.areas.length && <T kind="small"><Text style={{ fontFamily: font.semi, color: c.ink }}>Most time on: </Text>{p.areas.slice(0, 3).map((x) => `${x.name} ${hm(x.minutes)}`).join(", ")}</T>}
          {!!p.did.length && <T kind="small"><Text style={{ fontFamily: font.semi, color: c.ink }}>Did this week: </Text>{p.did.map((x) => `${x.label} ×${x.n}`).join(", ")}</T>}
          {!!p.notOpened.length && <T kind="small"><Text style={{ fontFamily: font.semi, color: c.ink }}>Not opened in 30 days: </Text>{p.notOpened.join(", ")}</T>}
          {p.minutes > 0 && <T kind="small">Like a student {hm(p.minutes - p.dashboard)} · Owners' dashboard {hm(p.dashboard)}</T>}
        </View>
      </>}

      <T kind="small" style={{ color: c.mutedText }}>Same rules for everyone. Goal: {a.goalDays} days a week. Counts only while Remy is open and in use. No recordings, no typing, never students.</T>
    </ScrollView>
  );
}
