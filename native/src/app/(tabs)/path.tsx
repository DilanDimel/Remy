import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { dailyStreak, dayKey } from "@shared/daily";
import { Button, Card, Group, Icon, Ring, Row, Screen, Sect, T, tap, type IconName } from "@/components/ui";
import { askRemy, go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

// A stop opens where it lives on My Path (steps and skills are in the Skills panel); a semester isn't on My Path, so Remy helps plan it.
type Stop = { key: string; title: string; sub: string; icon: IconName; path?: string; ask?: string };

export default function PathTab() {
  const { ws, refresh } = useSession();
  const { c, look } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  if (!ws) return null;
  const plan = ws.plan;
  const career = plan?.careers.find((x) => x.id === plan.chosenCareerId) || plan?.careers[0];
  const streak = dailyStreak(ws.game || { days: {} });
  const roundDone = (["openings", "role", "forecast"] as const).every((k) => ws.game?.days?.[dayKey()]?.includes(k));
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };
  const openStop = (s: Stop) => (s.ask ? askRemy(s.ask) : go(s.path || "/path", "My Path", { page: true }));
  // The road: today's round first, then the plan's steps for the chosen career, its skills and the next terms.
  const stops: Stop[] = [
    ...(career?.steps || []).slice(0, 5).map((s, i) => ({ key: "s" + i, title: s, sub: "Step", icon: "flag" as IconName, path: "/path?side=skills" })),
    ...(plan?.skills || []).slice(0, 2).map((s) => ({ key: s.id, title: s.name, sub: s.type === "certification" ? "Certification" : s.type === "course" ? "Course" : "Skill", icon: "trend" as IconName, path: s.type === "certification" ? "/path?side=certs" : "/path?side=skills" })),
    ...(plan?.academic || []).slice(0, 2).map((a) => ({ key: a.id, title: a.term, sub: "Your semester", icon: "book" as IconName, ask: `Help me plan my ${a.term} semester` })),
  ];

  if (!plan) return (
    <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 12 }}>
      <T kind="display">Your path</T>
      <T kind="muted">Remy builds it from your resume and what you want: the roles that fit, the steps to get there, and a 3-minute round each day.</T>
      <Button testID="button-build-path" label="Build my path" icon="arrow" onPress={() => go("/path", "My Path", { page: true })} flex />
    </Screen>
  );

  if (look === "calm") return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ fontSize: 34, marginTop: 28 }}>Path</T>
      <T kind="muted">{career?.title || "Your direction"}</T>
      <Card style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 16 }} onPress={() => go("/path?play=1", "Today's round")} testID="card-round">
        <Ring done={streak.days} total={Math.max(7, streak.best)} />
        <View style={{ flex: 1 }}><T kind="h2" style={{ fontSize: 17 }}>{streak.days ? `Day ${streak.days} streak` : "Start a streak"}</T><T kind="small">{roundDone ? "Today's round is done." : "Today's round takes about 3 minutes."}</T></View>
        <Icon name="chev" size={18} color={c.faint} />
      </Card>
      <Sect title="Up next" />
      <Group>{stops.map((s, i) => <Row key={s.key} first={i === 0} title={s.title} sub={s.sub} left={<Icon name={s.icon} color={i === 0 ? c.fox : c.muted} />} onPress={() => openStop(s)} testID="row-path-step" />)}</Group>
    </Screen>
  );

  const xs = [0, 46, -50, 18, -30, 40, -12];
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 44 }}>
        <Text style={{ fontFamily: font.display, fontSize: 17, color: c.ink }}>My Path</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
          <Icon name="flame" size={18} color={c.fox} /><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>{streak.days} {streak.days === 1 ? "day" : "days"}</Text>
        </View>
      </View>
      <View style={{ backgroundColor: c.ink, borderRadius: 22, padding: 16, marginTop: 8, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.semi, fontSize: 11.5, letterSpacing: 0.8, textTransform: "uppercase", color: c.onInk, opacity: 0.7 }}>Heading to</Text>
          <Text style={{ fontFamily: font.bold, fontSize: 17, color: c.onInk }} numberOfLines={1}>{career?.title || "Your direction"}</Text>
        </View>
        <Text style={{ fontFamily: font.display, fontSize: 22, color: c.onInk }}>{stops.length}<Text style={{ fontSize: 14, opacity: 0.55 }}> stops</Text></Text>
      </View>
      <View style={{ marginTop: 26 }}>
        <Svg width="100%" height={stops.length * 150 + 160} viewBox={`0 0 350 ${stops.length * 150 + 160}`} style={{ position: "absolute", top: 40 }} preserveAspectRatio="none">
          <SvgPath d={`M175 0 ${stops.map((_, i) => `S ${175 + xs[(i + 1) % xs.length] * 2} ${i * 150 + 75}, ${175 + xs[(i + 1) % xs.length]} ${(i + 1) * 150}`).join(" ")}`} fill="none" stroke={c.road} strokeWidth={10} strokeLinecap="round" strokeDasharray="2 18" />
        </Svg>
        <View style={{ alignItems: "center", marginBottom: 26 }}>
          <View style={{ backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 }}><Text style={{ fontFamily: font.display, fontSize: 12, letterSpacing: 0.6, color: c.foxDeep }}>{roundDone ? "DONE TODAY" : "TODAY · 3 MIN"}</Text></View>
          <Pressable testID="button-todays-round" accessibilityRole="button" accessibilityLabel="Today's round" onPress={() => { tap(); go("/path?play=1", "Today's round"); }}
            style={({ pressed }) => ({ width: 88, height: 88, borderRadius: 44, backgroundColor: roundDone ? c.ink : c.fox, alignItems: "center", justifyContent: "center", shadowColor: c.foxShadow, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: pressed ? 2 : 6 }, elevation: 4, transform: [{ translateY: pressed ? 4 : 0 }] })}>
            <Icon name={roundDone ? "check" : "compass"} size={36} color={c.onFox} />
          </Pressable>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink, marginTop: 12 }}>Today's round</Text>
        </View>
        {stops.map((s, i) => (
          <View key={s.key} style={{ alignItems: "center", marginBottom: 26, transform: [{ translateX: xs[(i + 1) % xs.length] }] }}>
            <Pressable testID="button-path-stop" accessibilityRole="button" onPress={() => { tap(); openStop(s); }}
              style={({ pressed }) => ({ width: 74, height: 74, borderRadius: 37, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", shadowColor: c.nodeShadow, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: pressed ? 2 : 6 }, elevation: 3, transform: [{ translateY: pressed ? 4 : 0 }] })}>
              <Icon name={s.icon} size={26} />
            </Pressable>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink, textAlign: "center", marginTop: 12, maxWidth: 240 }} numberOfLines={3}>{s.title}</Text>
            <Text style={{ fontFamily: font.semi, fontSize: 11, letterSpacing: 0.6, color: c.faint, textTransform: "uppercase", marginTop: 2 }}>{s.sub}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
