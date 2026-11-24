import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Task, Workspace } from "@shared/types";
import { dailyStreak } from "@shared/daily";
import { Button, EmployerTile, FitBadge, Group, Icon, Remy, Row, Screen, Sect, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { askRemy, go, openJobs } from "@/lib/nav";
import { greeting, nextThing, visibleJobs } from "@/lib/next";
import { firstName } from "@shared/names";
import { useRefreshAll, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

export default function Home() {
  const { ws, setWs } = useSession();
  const refreshAll = useRefreshAll();
  const { jobs, fits, reload } = useJobs();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  if (!ws) return null;
  const next = nextThing(ws, jobs, fits);
  const streak = dailyStreak(ws.game || { days: {} });
  const open = ws.tasks.filter((t) => !t.done).length; // the same count as Progress → To-dos
  const todos = ws.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 4);
  // New openings only: one already kept or passed is in Jobs, not "for you" again.
  const top = visibleJobs(ws, jobs, fits).filter((j) => !ws.savedJobIds.includes(j.id) && !ws.jobFeedback?.[j.id]).slice(0, 3);
  const onRefresh = async () => { setRefreshing(true); await Promise.all([refreshAll(), reload()]); setRefreshing(false); };
  const toggle = async (t: Task) => { if (!t.done) success(); setWs(await api<Workspace>("PATCH", `/api/tasks/${t.id}`, { done: !t.done })); };
  const name = firstName(ws);
  // A plan step like "Ask TCU's international office…" has no page of its own: Remy helps with it in chat.
  // Kept openings aren't in Jobs → For you, so an opening (or "browse openings" when For you is empty) opens where it is.
  const isKept = (id: string) => ws.savedJobIds.includes(id);
  const freshLeft = visibleJobs(ws, jobs, fits).some((j) => !isKept(j.id) && !ws.jobFeedback?.[j.id]);
  // An opening opens Remy's page for it, not the Jobs list at wherever it was last scrolled.
  const openJob = (id: string) => { tap(); go(`/opportunities?id=${encodeURIComponent(id)}`, "Opportunities"); };
  const base = next.path.split("?")[0];
  const openNext = () => (base === "/path" ? askRemy(`Help me with this: ${next.title}`) : base === "jobs" || base === "/opportunities" ? openJobs(freshLeft ? "new" : "kept") : go(next.path, next.cta));

  const check = (t: Task) => (
    <Pressable testID="checkbox-task" accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={`Mark ${t.title} done`} onPress={() => toggle(t)} hitSlop={10}
      style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.done ? c.fox : c.line, backgroundColor: t.done ? c.fox : "transparent", alignItems: "center", justifyContent: "center" }}>
      {t.done && <Icon name="check" size={14} color={c.onFox} strokeWidth={3} />}
    </Pressable>
  );

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", height: 44 }}>
        <Pressable testID="button-streak" accessibilityLabel={streak.days ? `${streak.days} day streak` : "Start a streak today"} onPress={() => { tap(); go("path"); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
          <Icon name="flame" size={18} color={streak.days ? c.fox : c.faint} /><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>{streak.days || "Start today"}</Text>
        </Pressable>
      </View>
      <T kind="display" style={{ marginTop: 4 }}>{greeting()}{name ? `, ${name}` : ""}.</T>
      <T kind="muted" style={{ marginTop: 4 }}>{date}{open ? ` · ${open} to-do${open === 1 ? "" : "s"} open` : ""}</T>
      {/* Remy's one-thing card: the page's one peach card, with Remy beside it (the website's Home). */}
      <View style={{ backgroundColor: c.foxSoft, borderRadius: radius.bubble, padding: 18, marginTop: 18, flexDirection: "row", gap: 12 }} testID="card-one-thing">
        <View style={{ flex: 1 }}>
          <T kind="label">Your one thing right now</T>
          <T kind="h2" style={{ marginTop: 6, fontSize: 20, lineHeight: 25 }}>{next.title}</T>
          <T kind="muted" style={{ marginTop: 4 }}>{next.why}</T>
          <Button testID="button-next-action" label={next.cta} icon="arrow" onPress={openNext} style={{ marginTop: 14 }} />
        </View>
        <View style={{ justifyContent: "flex-end" }} pointerEvents="none"><Remy size={76} /></View>
      </View>
      <Sect title="This week" />
      <Group>
        {todos.length ? todos.map((t, i) => <Row key={t.id} first={i === 0} title={t.title} sub={t.due ? `Due ${t.due.slice(5).replace("-", "/")}` : t.category} left={check(t)} onPress={t.link ? () => go(t.link!, t.title) : undefined} testID="row-task" />)
          : <Row first title="No open to-dos" sub="Your path can suggest a few." />}
      </Group>
      {top.length > 0 && <>
        <Sect title="Openings for you" right={<Pressable testID="button-all-openings" hitSlop={8} onPress={() => { tap(); openJobs(freshLeft ? "new" : "kept"); }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.foxDeep }}>See all</Text></Pressable>} />
        <Group>{top.map((j, i) => <Row key={j.id} first={i === 0} title={j.title} sub={`${j.company}${j.location ? ` · ${j.location}` : ""}`} left={<EmployerTile name={j.company} size={36} />} right={<FitBadge fit={fits[j.id]} />} onPress={() => openJob(j.id)} testID="row-opening" />)}</Group>
      </>}
    </Screen>
  );
}
