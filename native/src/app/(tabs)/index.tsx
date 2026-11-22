import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { Task, Workspace } from "@shared/types";
import { gettingStarted } from "@shared/progress";
import { dailyStreak } from "@shared/daily";
import { Button, Card, EmployerTile, FitBadge, Group, Icon, Row, Screen, Sect, T, success, tap, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { firstName, greeting, nextThing, visibleJobs } from "@/lib/next";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";

const linkIcon = (link: string): IconName => link.includes("opportunit") ? "jobs" : link.includes("interview") ? "chat" : link.includes("community") ? "you" : "doc";

export default function Today() {
  const { ws, setWs, refresh } = useSession();
  const { jobs, fits, reload } = useJobs();
  const { c, look } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  if (!ws) return null;
  const next = nextThing(ws, jobs, fits);
  const steps = gettingStarted(ws);
  const done = steps.filter((s) => s.done).length;
  const streak = dailyStreak(ws.game || { days: {} });
  const todos = ws.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 4);
  const top = visibleJobs(ws, jobs, fits).slice(0, 3);
  const onRefresh = async () => { setRefreshing(true); await Promise.all([refresh(), reload()]); setRefreshing(false); };
  const toggle = async (t: Task) => { if (!t.done) success(); setWs(await api<Workspace>("PATCH", `/api/tasks/${t.id}`, { done: !t.done })); };
  const name = firstName(ws);

  const check = (t: Task) => (
    <Pressable testID="checkbox-task" accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={`Mark ${t.title} done`} onPress={() => toggle(t)} hitSlop={10}
      style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.done ? c.fox : c.line, backgroundColor: t.done ? c.fox : "transparent", alignItems: "center", justifyContent: "center" }}>
      {t.done && <Icon name="check" size={14} color={c.onFox} strokeWidth={3} />}
    </Pressable>
  );

  if (look === "calm") return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ fontSize: 34, marginTop: 28 }}>Today</T>
      <T kind="muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · {done} of {steps.length} steps done</T>
      <Card style={{ marginTop: 18 }}>
        <T kind="label">Your one thing right now</T>
        <T kind="h2" style={{ marginTop: 6, fontSize: 20 }}>{next.title}</T>
        <T kind="muted" style={{ marginTop: 4 }}>{next.why}</T>
        <Button testID="button-next-action" label={next.cta} onPress={() => go(next.path, next.cta)} style={{ marginTop: 14 }} flex />
      </Card>
      <Sect title="This week" />
      <Group>
        {todos.length ? todos.map((t, i) => <Row key={t.id} first={i === 0} title={t.title} sub={t.due ? `Due ${t.due.slice(5).replace("-", "/")}` : t.category} left={check(t)} onPress={t.link ? () => go(t.link!, t.title) : undefined} testID="row-task" />)
          : <Row first title="No open to-dos" sub="Your path can suggest a few." />}
      </Group>
      {top.length > 0 && <>
        <Sect title="Openings for you" />
        <Group>{top.map((j, i) => <Row key={j.id} first={i === 0} title={j.title} sub={`${j.company} · ${j.location}`} left={<EmployerTile name={j.company} size={32} />} right={<FitBadge score={fits[j.id]?.score} />} onPress={() => go("jobs")} testID="row-opening" />)}</Group>
      </>}
    </Screen>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 44 }}>
        <Text style={{ fontFamily: font.display, fontSize: 17, color: c.ink }}>Remy</Text>
        <Pressable testID="button-streak" onPress={() => { tap(); go("path"); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
          <Icon name="flame" size={18} color={c.fox} /><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>{streak.days}</Text>
        </Pressable>
      </View>
      <T kind="display" style={{ marginTop: 12 }}>{greeting()}{name ? `,\n${name}` : ""}.</T>
      <View style={{ backgroundColor: c.foxSoft, borderRadius: 28, padding: 20, marginTop: 18, overflow: "hidden" }}>
        <T kind="label">Remy says · your one thing</T>
        <T kind="title" style={{ marginTop: 8, maxWidth: 280 }}>{next.title}</T>
        <T kind="muted" style={{ marginTop: 6, maxWidth: 260 }}>{next.why}</T>
        <Button testID="button-next-action" label={next.cta} icon="arrow" onPress={() => go(next.path, next.cta)} style={{ marginTop: 16 }} />
        <View style={{ position: "absolute", right: -18, bottom: -18, opacity: 0.16 }} pointerEvents="none"><Icon name={linkIcon(next.path)} size={120} color={c.foxDeep} strokeWidth={1.4} /></View>
      </View>
      <Sect title="Getting started" right={<Text style={{ fontFamily: font.bold, fontSize: 14, color: c.foxDeep }}>{done} of {steps.length}</Text>} />
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>{steps.map((s, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: s.done ? c.fox : c.road }} />)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
        {steps.filter((s) => !s.done).map((s) => (
          <Card key={s.label} onPress={() => go(s.link, s.label)} style={{ width: 156 }} testID="card-getting-started">
            <View style={{ width: 36, height: 36, borderRadius: BUTTON_RADIUS, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Icon name={linkIcon(s.link)} size={20} color={c.foxDeep} /></View>
            <Text style={{ fontFamily: font.bold, fontSize: 15, lineHeight: 19, color: c.ink, marginTop: 10 }}>{s.label}</Text>
          </Card>
        ))}
      </ScrollView>
      <Sect title="This week" />
      <View style={{ gap: 8 }}>
        {todos.length ? todos.map((t) => (
          <Card key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
            {check(t)}
            <Pressable style={{ flex: 1 }} disabled={!t.link} onPress={() => go(t.link!, t.title)}><T numberOfLines={2} style={{ fontFamily: font.semi }}>{t.title}</T>{!!t.why && <T kind="small" numberOfLines={1}>{t.why}</T>}</Pressable>
          </Card>
        )) : <T kind="muted">Nothing due. Nice.</T>}
      </View>
    </Screen>
  );
}
