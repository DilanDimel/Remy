import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Job, Task, Workspace } from "@shared/types";
import { dailyStreak, dayKey, streakDays, weekDots } from "@shared/daily";
import { remyLine } from "@shared/homeLine";
import { firstName } from "@shared/names";
import { daysFrom, nextAction } from "@shared/nextAction";
import { gettingStarted } from "@shared/progress";
import { offerFor, remyOffers } from "@shared/remyOffers";
import { InsiderCard } from "@/components/Insider";
import { Button, Group, Icon, Logo, Remy, Row, Screen, Sect, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { askRemy, go, openJobs, openResumeFix } from "@/lib/nav";
import { greeting, visibleJobs } from "@/lib/next";
import { useOwnerView, useRefreshAll, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

/** How long the one thing takes, from where its button goes (the website's etaFor). */
const etaFor = (link: string, interview: boolean) => interview ? "about 15 min" : link === "/resume?tab=base" ? "about 4 min · unlocks Tailor" : link.startsWith("/resume?tab=tailor") ? "about 5 min" : link.startsWith("/interview") ? "about 10 min" : link.startsWith("/opportunities") ? "about 2 min" : "";
const shortDate = (d: string) => new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Home: the website's Home (client/src/pages/Home.tsx) laid out for a phone. Remy's offer, the greeting with Remy's
 *  line, the streak, Remy's one thing (rules shared with the website in shared/nextAction.ts), what's coming up, and
 *  the openings that fit best. */
export default function Home() {
  const { ws, setWs, saveSettings } = useSession();
  const ownerView = useOwnerView();
  const refreshAll = useRefreshAll();
  const { jobs, fits, reload } = useJobs();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<string[]>([]); // offers answered, hidden before the server replies
  const [doneNow, setDoneNow] = useState<string[]>([]); // to-dos ticked here, kept in the list for a moment
  // "Since you were last here": the previous visit is read once per launch, and the new one saved.
  const since = useRef(ws?.settings.lastSeenAt || "").current;
  useEffect(() => { if (ws && (!since || Date.now() - Date.parse(since) > 30 * 60_000)) saveSettings({ lastSeenAt: new Date().toISOString() }).catch(() => {}); }, []);
  const next = useMemo(() => (ws ? nextAction(ws, jobs, fits, { ownerView }) : null), [ws, jobs, fits, ownerView]);
  if (!ws || !next) return null;

  const today = dayKey();
  const name = firstName(ws);
  const steps = gettingStarted(ws);
  const doneSteps = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done);
  const from = since || new Date(Date.now() - 7 * 864e5).toISOString();
  const newJobs = jobs.filter((j) => (j.foundAt || "") > from && !ws.hiddenJobIds.includes(j.id) && !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false).length;
  const deadlines = ws.calendar.filter((x) => x.kind === "Deadline" && (daysFrom(x.date) ?? -1) >= 0 && (daysFrom(x.date) ?? 99) <= 7).length;
  const pending = ws.applications.filter((a) => a.changes.some((x) => x.status === "pending")).length;
  const line = remyLine({ day: today, hour: new Date().getHours(), interviewSoon: !!next.interview, cheer: false, done: doneSteps, total: steps.length, newJobs, deadlines, pending });

  const days = streakDays(ws);
  const streak = dailyStreak(days);
  const dots = weekDots(days);
  const roundDone = (["openings", "role", "forecast"] as const).every((k) => ws.game?.days?.[today]?.includes(k));
  // Owner view only, like the website ({ownerView && <RemyOffer />} in client/src/App.tsx): /api/remy/act is owners-only too.
  const offer = ownerView ? offerFor(remyOffers(ws, today, new Date().getHours()).filter((o) => !gone.includes(o.id)), "/") : undefined;

  const todos = ws.tasks.filter((t) => !t.done || doneNow.includes(t.id)).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 3);
  // New openings only: one already kept or passed is in Jobs, not "for you" again. Most matched skills first, like the website.
  const fresh = visibleJobs(ws, jobs, fits).filter((j) => !ws.savedJobIds.includes(j.id) && !ws.jobFeedback?.[j.id]);
  const top = [...fresh].sort((a, b) => (fits[b.id]?.matched?.length || 0) - (fits[a.id]?.matched?.length || 0)).slice(0, 3);
  const rated = Object.values(ws.jobFeedback || {}).filter((f) => f.createdAt && dayKey(new Date(f.createdAt)) === today).length;

  const onRefresh = async () => { setRefreshing(true); await Promise.all([refreshAll(), reload()]); setRefreshing(false); };
  const run = async (f: () => Promise<void>) => { setErr(""); try { await f(); } catch (e: any) { setErr(e.message); } };
  const toggle = (t: Task) => run(async () => {
    if (!t.done) { success(); setDoneNow((d) => [...d, t.id]); setTimeout(() => setDoneNow((d) => d.filter((x) => x !== t.id)), 1500); }
    setWs(await api<Workspace>("PATCH", `/api/tasks/${t.id}`, { done: !t.done }));
  });
  // The interview prep plan: three to-dos due on the interview day (the website's addPrep).
  const addPrep = () => run(async () => {
    const iv = next.interview!;
    const who = iv.title.replace(/^interview( with)?:?\s*/i, "");
    const prep = [
      [`Research ${who}: what they do, recent news, the team`, "Ten minutes of reading gives you a better question to ask at the end."],
      ["Pick two true stories from your resume for this role", "One about a challenge, one about a result. Say what you did, not just the team."],
      ["Test your setup: link, camera, mic, quiet spot", "Or plan your route and arrive 10 minutes early if it's in person."],
    ].filter(([t]) => !ws.tasks.some((x) => x.title === t)).map(([title, why]) => ({ id: "t" + Math.random().toString(36).slice(2, 10), title, why, due: iv.date, category: "Prepare" as const, done: false, source: "Interview prep" }));
    if (prep.length) { setWs(await api<Workspace>("PUT", "/api/ws/tasks", { value: [...prep, ...ws.tasks] })); success(); }
    go("/progress?tab=todos", "Progress");
  });
  const openNext = () => {
    if (next.interview) return addPrep();
    const base = next.link.split("?")[0];
    // A plan step with no page of its own: Remy helps with it in chat.
    if (!next.link || base === "/path") return askRemy(`Help me with this: ${next.title}`);
    if (base === "/opportunities") return openJobs(fresh.length ? "new" : "kept");
    go(next.link, next.cta);
  };
  const doOffer = () => run(async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const w = await api<Workspace>("POST", "/api/remy/act", { action: offer.action, offerId: offer.id });
      setGone((g) => [...g, offer.id]); setWs(w); success();
      // "Let's fix them" starts the fixing (the website's startResumeFix in client/src/lib/remyDoes.ts): Resume opens
      // on Remy's fixes. Anything else he did shows in his chat, with Undo.
      const said = w.chat[w.chat.length - 1];
      if (said?.did?.some((d) => d.kind === "start" && d.ref === "resumeFix" && !d.undone)) return openResumeFix();
      router.push("/remy");
    } finally { setBusy(false); }
  });
  const notNow = () => { if (!offer) return; tap(); setGone((g) => [...g, offer.id]); saveSettings({ offersSeen: [...(ws.settings.offersSeen || []), offer.id].slice(-200) }).catch(() => {}); };
  const openJob = (j: Job) => { tap(); router.push({ pathname: "/job", params: { id: j.id } }); };

  const check = (t: Task) => (
    <Pressable testID="checkbox-task" accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={`Mark ${t.title} done`} onPress={() => toggle(t)} hitSlop={10}
      style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.done ? c.fox : c.line, backgroundColor: t.done ? c.fox : "transparent", alignItems: "center", justifyContent: "center" }}>
      {t.done && <Icon name="check" size={14} color={c.onFox} strokeWidth={3} />}
    </Pressable>
  );
  const dueChip = (d: string) => {
    const n = daysFrom(d);
    const late = n !== null && n < 0, close = n !== null && n <= 2;
    return <View style={{ borderRadius: radius.chip, paddingHorizontal: 9, height: 24, justifyContent: "center", backgroundColor: late ? c.errorBg : close ? c.amberBg : c.surface2 }}><Text style={{ fontFamily: font.bold, fontSize: 12, color: late ? c.error : close ? c.amber : c.mutedText }}>{n === 0 ? "Today" : n === 1 ? "Tomorrow" : shortDate(d)}</Text></View>;
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Remy reaches out first: one offer at most, with his face, a live dot and two answers. */}
      {offer && (
        <View testID="remy-offer" style={{ marginTop: 8, flexDirection: "row", gap: 12, backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1.5, borderColor: c.fox, padding: 14 }}>
          <Remy size={40} icon />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.error }} /><T kind="label">Remy noticed something</T></View>
            <T>{offer.text}</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button testID="button-offer-do" label={offer.label} onPress={doOffer} busy={busy} style={{ height: 40, paddingHorizontal: 14 }} />
              <Button testID="button-offer-not-now" kind="ghost" label="Not now" onPress={notNow} style={{ height: 40, paddingHorizontal: 14 }} />
            </View>
          </View>
        </View>
      )}

      <T kind="display" style={{ marginTop: offer ? 18 : 36 }}>{greeting()}{name ? `, ${name}` : ""}.</T>
      <T kind="muted" style={{ marginTop: 6, fontSize: 17, lineHeight: 24 }} numberOfLines={2}>{line}</T>

      {/* The streak: flame (orange once today's round is done), the number, the last seven days, and today's round. */}
      <Pressable testID="row-streak" onPress={() => { tap(); router.navigate("/path"); }} style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Icon name="flame" size={26} color={roundDone ? c.fox : c.faint} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{streak.days ? `${streak.days} day streak` : "Start a streak today"}<Text style={{ fontFamily: font.body, color: c.mutedText }}>{streak.days && streak.days >= streak.best ? " · your best yet" : streak.best ? ` · best ${streak.best}` : ""}</Text></Text>
          <View style={{ flexDirection: "row", gap: 5 }} accessibilityLabel="The last seven days">
            {dots.map((d) => <View key={d.key} style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: d.status === "done" ? c.fox : d.status === "freeze" ? c.blueBg : c.surface2, borderWidth: d.status === "today" ? 1.5 : 0, borderColor: c.fox }}><Text style={{ fontFamily: font.bold, fontSize: 9, color: d.status === "done" ? c.onFox : c.mutedText }}>{d.label}</Text></View>)}
          </View>
        </View>
        <Button testID="button-todays-round" kind={roundDone ? "ghost" : "ink"} label={roundDone ? "Done for today" : "Today's round"} onPress={() => go("/path?play=1", "Today's round")} style={{ height: 38, paddingHorizontal: 12 }} />
      </Pressable>

      {/* Remy's one thing: the page's one peach card. Remy beside his speech bubble, the button full width for the thumb. */}
      <View testID="card-one-thing" style={{ backgroundColor: c.foxSoft, borderRadius: radius.bubble, padding: 16, marginTop: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <View pointerEvents="none" style={{ marginBottom: -4 }}><Remy size={72} /></View>
          <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.bubble, borderBottomLeftRadius: 6, padding: 12 }}>
            <T kind="label">Remy says: your one thing right now</T>
            <T kind="h2" style={{ marginTop: 6 }}>{next.title}</T>
            {!!next.why && <T kind="small" style={{ marginTop: 4 }}>{next.why}</T>}
          </View>
        </View>
        <Button testID="button-next-action" label={next.cta} icon="arrow" onPress={openNext} style={{ marginTop: 14 }} flex />
        {!!etaFor(next.link, !!next.interview) && <T kind="small" style={{ textAlign: "center", marginTop: 8 }}>{etaFor(next.link, !!next.interview)}</T>}
      </View>
      {/* Getting started: a compact five-part bar and the current step (the website lists all five). */}
      {current && (
        <Pressable testID="button-getting-started" onPress={() => go(current.link, current.label)} style={{ marginTop: 12, marginHorizontal: 4, gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>{steps.map((s, i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: s.done ? c.fox : c.line }} />)}</View>
          <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.mutedText }}>Getting started {doneSteps} of {steps.length} · <Text style={{ color: c.ink }}>{current.label}</Text></Text>
        </Pressable>
      )}
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 10 }}>{err}</T>}
      <InsiderCard />

      <Sect title="Coming up" right={<Pressable testID="button-all-todos" hitSlop={8} onPress={() => { tap(); go("/progress?tab=todos", "Progress"); }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.foxDeep }}>All to-dos</Text></Pressable>} />
      <Group>
        {todos.length ? todos.map((t, i) => <Row key={t.id} first={i === 0} title={t.title} sub={t.why || t.category} left={check(t)} right={t.due ? dueChip(t.due) : undefined} onPress={t.link ? () => go(t.link!, t.title) : undefined} testID="row-task" />)
          : <>
            {/* No to-dos: today's quests from My Path instead of an empty card (the website's owners' Home). */}
            <Row first title="Keep or pass 3 openings" sub={`${Math.min(3, rated)}/3 today · counts toward your season`} onPress={() => openJobs("new")} testID="button-home-quest" />
            <Row title="Decode one job" sub={`${ws.game?.days?.[today]?.includes("role") ? "1/1" : "0/1"} today · counts toward your season`} onPress={() => go("/path?play=1", "Today's round")} testID="button-home-quest" />
          </>}
      </Group>

      {top.length > 0 && <>
        <Sect title="Openings for you" right={<Pressable testID="button-all-openings" hitSlop={8} onPress={() => { tap(); openJobs(fresh.length ? "new" : "kept"); }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.foxDeep }}>See all</Text></Pressable>} />
        <Group>
          {top.map((j, i) => {
            const n = fits[j.id]?.matched?.length || 0;
            // A real count of the posting's skills that are on the resume, never a score.
            return <Row key={j.id} first={i === 0} title={j.title} sub={[j.company, j.location].filter(Boolean).join(" · ")} left={<Logo company={j.company} url={j.applyUrl} size={36} />}
              right={n ? <Text style={{ fontFamily: font.semi, fontSize: 13, color: c.mutedText }}><Text style={{ fontFamily: font.display, fontSize: 16, color: c.ink }}>{n}</Text> {n === 1 ? "skill" : "skills"}</Text> : undefined}
              onPress={() => openJob(j)} testID="row-opening" />;
          })}
        </Group>
      </>}
    </Screen>
  );
}
