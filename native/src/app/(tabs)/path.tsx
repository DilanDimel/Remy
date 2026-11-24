import { useState } from "react";
import { View } from "react-native";
import { dailyStreak, dayKey } from "@shared/daily";
import { Button, Card, Group, Icon, Ring, Row, Screen, Sect, T, type IconName } from "@/components/ui";
import { askRemy, go } from "@/lib/nav";
import { useRefreshAll, useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

// A stop opens where it lives on My Path (steps and skills are in the Skills panel); a semester isn't on My Path, so Remy helps plan it.
type Stop = { key: string; title: string; sub: string; icon: IconName; path?: string; ask?: string };

export default function PathTab() {
  const { ws } = useSession();
  const refresh = useRefreshAll();
  const { c } = useTheme();
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

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ marginTop: 28 }}>My Path</T>
      <T kind="muted">{career?.title || "Your direction"}</T>
      <Card style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 16 }} onPress={() => go("/path?play=1", "Today's round")} testID="card-round">
        <Ring done={streak.days} total={Math.max(7, streak.best)} />
        <View style={{ flex: 1 }}><T kind="h2" style={{ fontSize: 17 }}>{streak.days ? `Day ${streak.days} streak` : "Start a streak"}</T><T kind="small">{roundDone ? "Today's round is done." : "Today's round takes about 3 minutes."}</T></View>
        <Icon name="chev" size={18} color={c.faint} />
      </Card>
      <Sect title="Up next" />
      <Group>{stops.map((s, i) => <Row key={s.key} first={i === 0} title={s.title} sub={s.sub} left={<Icon name={s.icon} color={i === 0 ? c.fox : c.mutedText} />} onPress={() => openStop(s)} testID="row-path-step" />)}</Group>
    </Screen>
  );
}
