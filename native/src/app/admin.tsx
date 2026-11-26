import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FEATURES, releasesOf, type Release } from "@shared/features";
import { Button, Loading, Remy, Sect, Segmented, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { api } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { router } from "expo-router";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Owners' dashboard, native for what an owner does from a phone (it opened the website's /admin): this week at a glance,
// feature releases, "Let everyone in", errors and feedback to mark handled, and clock in/out. Board & calendar and System
// are their own screens (admin-team, admin-system). Same /api/admin calls as client/src/pages/Admin.tsx.
type Overview = { northWeek: number; northPrev: number; students: number; newWeek: number; activeWeek: number; activePrev: number; activeToday: number; openErrors: number; feedback: number; ai: { calls: number; failed: number; cost: number } };
type OpenError = { message: string; kind: string; place: string; times: number; students: number; last: string; detail: string };
type Errors = { open: OpenError[]; fixed: { message: string; kind: string }[]; feedback: { id: number; at: string; place: string; message: string; email: string }[] };
type Team = { me: string; clockedIn: string | null; hours: { member: string; hours: number; week: number }[]; tasks: { assignee: string | string[]; status: string }[] };
type Beta = { open: boolean };

const RELEASE_NAME: Record<Release, string> = { owners: "Owners", locked: "Locked", released: "Everyone" };
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : one + "s"}`;
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const greeting = () => { const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Chicago" })); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export default function Admin() {
  const { me } = useSession();
  const { config, reload: reloadConfig } = useConfig();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [o, setO] = useState<Overview | null>(null);
  const [e, setE] = useState<Errors | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [beta, setBeta] = useState<Beta | null>(null);
  const [view, setView] = useState<"errors" | "feedback">("errors");
  const [ask, setAsk] = useState<null | { key: string; state: Release } | { open: boolean }>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [said, setSaid] = useState("");
  const load = useCallback(() => {
    api<Overview>("GET", "/api/admin/overview").then(setO).catch((x) => setErr(x.message));
    api<Errors>("GET", "/api/admin/errors").then(setE).catch(() => {});
    api<Team>("GET", "/api/admin/team").then(setTeam).catch(() => {});
    api<Beta>("GET", "/api/admin/beta").then(setBeta).catch(() => {});
  }, []);
  useEffect(load, [load]);
  if (!me?.owner) return null;
  if (!o) return err ? <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}><T style={{ color: c.error }}>{err}</T></View> : <Loading />;
  const act = async (key: string, f: () => Promise<void>, ok?: string) => { tap(); setBusy(key); setErr(""); try { await f(); success(); if (ok) setSaid(ok); } catch (x: any) { setErr(x.message); } setBusy(""); };
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 } as const;
  const r = releasesOf(config?.features);
  const setRelease = (key: string, state: Release) => act("rel-" + key, async () => { await api("POST", "/api/admin/features", { key, state }); await reloadConfig(); setAsk(null); }, `${FEATURES.find((f) => f.key === key)!.label}: ${RELEASE_NAME[state]}`);
  const flip = (open: boolean) => act("open", async () => { setBeta(await api<Beta>("POST", "/api/admin/beta/open", { open })); setAsk(null); }, open ? "Remy is open to everyone" : "Back to invite-only");
  const fix = (message: string, kind: string) => act("fix-" + kind + message, async () => setE(await api<Errors>("POST", "/api/admin/errors/fix", { message, kind })), kind === "feedback" ? "Marked handled" : "Marked fixed. If it happens again, it comes back here.");
  const myTodos = team ? team.tasks.filter((t) => t.status !== "done" && ([] as string[]).concat(t.assignee).includes(team.me)).length : 0;
  const needs: [string, number][] = [["Open errors", o.openErrors], ["New feedback", o.feedback], ["Your to-dos", myTodos]];
  const open = needs.filter((n) => n[1]).length;
  const step = o.northWeek - o.northPrev;
  const first = (me.name || "").split(" ")[0];
  const myWeek = team?.hours.find((h) => h.member === team.me)?.week || 0;
  const confirmText = ask && "open" in ask
    ? (ask.open ? "Let everyone sign in right away? Anyone can create an account without applying, and everyone agrees to the updated beta terms once." : "Go back to invite-only? Only accepted emails and the team can sign in again. Their saved work stays.")
    : ask ? (FEATURES.find((f) => f.key === ask.key)!.path ? `Release ${FEATURES.find((f) => f.key === ask.key)!.label} to every student? They get the full working page right away.`
      : ask.key === "app" ? "Release the phone app to every student? Students who sign in to the app get in right away." : `Release ${FEATURES.find((f) => f.key === ask.key)!.label} to every student right away?`) : "";

  // The confirm sits where the owner tapped, not at the top of a long page.
  const confirmBox = !!ask && (
    <View testID="admin-confirm" style={{ gap: 8, borderTopWidth: 1, borderColor: c.line, paddingTop: 10 }}>
      <T kind="small" style={{ color: c.ink }}>{confirmText}</T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button testID="button-admin-confirm" label="Yes, do it" busy={!!busy} onPress={() => ("open" in ask ? flip(ask.open) : setRelease(ask.key, ask.state))} flex />
        <Button testID="button-admin-cancel" kind="ghost" label="Cancel" onPress={() => setAsk(null)} flex />
      </View>
    </View>
  );
  return (
    <ScrollView testID="admin-screen" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
      <T kind="title">{greeting()}{first ? `, ${first}` : ""}.</T>
      <T kind="muted"><Text style={{ fontFamily: font.bold, color: c.ink }}>{o.activeWeek === 0 ? "Quiet week so far: no student has opened Remy yet." : `${plural(o.activeWeek, "student")} opened Remy this week${o.newWeek ? `, ${o.newWeek} of them new` : ""}.`}</Text>{open ? ` ${open === 1 ? "One thing needs" : `${open} things need`} you.` : " Nothing needs you right now."}</T>
      {!!said && <T kind="small" style={{ color: c.sage }}>{said}</T>}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}

      <View testID="admin-hero" style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft, flexDirection: "row", alignItems: "center" }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Remy size={24} icon /><Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: c.foxDeep }}>North star this week</Text></View>
          <T kind="h2">{plural(o.northWeek, "student")} took a career step.</T>
          <T kind="small">{step > 0 ? `${step} more than last week` : step < 0 ? `${-step} fewer than last week` : "Same as last week"}.</T>
        </View>
        <Text style={{ fontFamily: font.display, fontSize: 44, color: c.fox }}>{o.northWeek}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[[o.activeWeek, "Active this week"], [o.students, "Students"], [o.activeToday, "Today"]].map(([n, l]) => (
          <View key={l} style={[card, { flex: 1, padding: 12, gap: 2 }]}><Text style={{ fontFamily: font.bold, fontSize: 22, color: c.ink }}>{n}</Text><T kind="small">{l}</T></View>))}
      </View>
      <View testID="admin-needs" style={card}>
        {needs.map(([l, n]) => <View key={l} style={{ flexDirection: "row", justifyContent: "space-between" }}><T style={{ color: n ? c.ink : c.mutedText }}>{l}</T><Text style={{ fontFamily: font.bold, fontSize: 16, color: n ? c.fox : c.mutedText }}>{n}</Text></View>)}
        <T kind="small">AI this week: {o.ai.calls} calls{o.ai.failed ? `, ${o.ai.failed} failed` : ""}{o.ai.cost ? `, about $${o.ai.cost.toFixed(2)}` : ""}.</T>
      </View>


      <Sect title="Who can sign in" />
      <View testID="admin-open" style={card}>
        <T style={{ fontFamily: font.semi }}>{beta ? (beta.open ? "Open to everyone" : "Invite-only") : "…"}</T>
        <T kind="small">{beta?.open ? "Anyone can create an account without applying." : "Only accepted emails and the team can sign in; everyone else sees the apply link."}</T>
        {beta && <Button testID="button-admin-open" kind="ghost" label={beta.open ? "Go back to invite-only" : "Let everyone in"} onPress={() => { tap(); setAsk({ open: !beta.open }); }} />}
        {ask && "open" in ask && confirmBox}
      </View>

      <Sect title="Feature releases" />
      <View testID="feature-releases" style={card}>
        <T kind="small">Changes reach students within a minute, with no app update. Switch to student view on More to preview.</T>
        {FEATURES.filter((f) => !f.follows).map((f) => (
          <View key={f.key} style={{ gap: 6, paddingTop: 6 }}>
            <T style={{ fontFamily: font.semi }}>{f.label}</T>
            <Segmented testID={`select-release-${f.key}`} value={r[f.key]!} options={(f.path ? ["owners", "locked", "released"] as Release[] : ["owners", "released"] as Release[]).map((k) => ({ key: k, label: RELEASE_NAME[k] }))}
              onChange={(state) => (state === "released" ? setAsk({ key: f.key, state }) : setRelease(f.key, state))} />
            {ask && "key" in ask && ask.key === f.key && confirmBox}
          </View>
        ))}
      </View>

      <Sect title="Errors and feedback" />
      <Segmented testID="errors-view" value={view} onChange={(v) => { tap(); setView(v); }} options={[{ key: "errors", label: `Errors ${e?.open.length ?? ""}` }, { key: "feedback", label: `Feedback ${e?.feedback.length ?? ""}` }]} />
      <View testID="errors-inbox" style={card}>
        {!e ? <T kind="small">Loading…</T> : view === "errors" ? (e.open.length ? e.open.slice(0, 15).map((x, i) => (
          <View key={x.kind + x.message} style={{ gap: 6, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
            <T style={{ fontFamily: font.semi }} numberOfLines={3}>{x.message}</T>
            <T kind="small">{x.kind === "browser" ? "Browser" : "Server"} · {x.place || "unknown page"} · {plural(x.times, "time")}{x.students ? `, ${plural(x.students, "student")}` : ""} · last {ago(x.last)}</T>
            <Button testID="button-error-fix" kind="ghost" label="Mark fixed" icon="check" busy={busy === "fix-" + x.kind + x.message} onPress={() => fix(x.message, x.kind)} style={{ alignSelf: "flex-start", height: 38, paddingHorizontal: 14 }} />
          </View>)) : <T kind="small">No open errors. Nothing students hit in the last 30 days is waiting on a fix.</T>)
        : (e.feedback.length ? e.feedback.slice(0, 15).map((x, i) => (
          <View key={x.id} style={{ gap: 6, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
            <T>{x.message}</T>
            <T kind="small">{x.email || "a student"} · {x.place || "somewhere in Remy"} · {ago(x.at)}</T>
            <Button testID="button-feedback-handled" kind="ghost" label="Handled" icon="check" busy={busy === "fix-feedback" + x.message} onPress={() => fix(x.message, "feedback")} style={{ alignSelf: "flex-start", height: 38, paddingHorizontal: 14 }} />
          </View>)) : <T kind="small">No new feedback. Notes from Send feedback and 👎 reasons land here.</T>)}
      </View>

      <Sect title="Your hours" />
      <View testID="admin-clock" style={card}>
        <T style={{ fontFamily: font.semi }}>{team?.clockedIn ? `Working since ${new Date(team.clockedIn).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : `${myWeek.toFixed(1)} hours this week`}</T>
        <Input testID="input-clock-note" value={note} onChangeText={setNote} placeholder={team?.clockedIn ? "What are you working on?" : "What are you working on? (optional)"} />
        {team && <Button testID="button-clock" kind={team.clockedIn ? "ghost" : "ink"} label={team.clockedIn ? "Clock out" : "Clock in"} busy={busy === "clock"}
          onPress={() => act("clock", async () => { setTeam(await api<Team>("POST", "/api/admin/clock", { action: team.clockedIn ? "out" : "in", note })); setNote(""); }, team.clockedIn ? "Clocked out" : "Clocked in")} flex />}
      </View>

      <View style={{ gap: 8 }}>
        <Button testID="button-admin-use" kind="ghost" label="Using Remy: the team's own use" icon="trend" onPress={() => { tap(); go("/admin?tab=team&view=use"); }} flex />
        <Button testID="button-admin-team" kind="ghost" icon="list" label="Board & calendar" onPress={() => { tap(); router.push("/admin-team"); }} flex />
        <Button testID="button-admin-system" kind="ghost" icon="zap" label="System" onPress={() => { tap(); router.push("/admin-system"); }} flex />
      </View>
    </ScrollView>
  );
}
