import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Job, Workspace } from "@shared/types";
import type { GameState } from "@shared/game";
import { CARD_LABEL, CARD_XP, dailyStreak, dayKey, streakDays, weekDots, withCard, type DailyCard } from "@shared/daily";
import { Button, Chip, Icon, Logo, Remy, T, success, tap } from "@/components/ui";
import { postingSkills } from "@shared/requirements";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { shortPlace } from "@/lib/next";
import { useOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Today's round, native (it opened the website's /path?play=1 before). Same cards, rules and saves as the website's
// Round in client/src/components/DailyPath.tsx: openings to keep or pass, "What's the job?" from O*NET duties, and
// "Higher or lower" from the BLS forecast. Nothing here is invented: every card comes from Remy's data.
type Occ = { soc: string; title: string; change: number; openings: number | null; wage: number | null; link: string };
type Future = { source: string; allJobsGrowth: number; fields: { growing: Occ[]; shrinking: Occ[] }[] };
type Duties = { duties: string[] };
const stateOf = (w: Workspace): GameState => w.game || { weeks: {} };
const money = (n: number) => "$" + n.toLocaleString("en-US");
// A stable pick for the day, so reopening shows the same card.
const seedOf = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const CARDS = ["openings", "role", "forecast"] as const;

export default function Round() {
  const { ws, setWs } = useSession();
  const { jobs, fits, loading } = useJobs();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const today = dayKey();
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [before] = useState(() => (ws ? dailyStreak(streakDays(ws)).days : 0));
  const [already] = useState(() => !!ws && CARDS.every((k) => stateOf(ws).days?.[today]?.includes(k)));
  // Reopened mid-round (tester, Nov 25): pick up at the first card not finished today.
  const [doneAtStart] = useState<string[]>(() => (ws && stateOf(ws).days?.[today]) || []);
  const [careers, setCareers] = useState<{ jobs: Occ[] }[] | null>(null);
  const [future, setFuture] = useState<Future | null>(null);
  const [pool, setPool] = useState<Job[] | null>(null);
  useEffect(() => {
    let live = true;
    api<{ jobs: Occ[] }[]>("GET", "/api/careers?field=").then((d) => live && setCareers(d), () => live && setCareers([]));
    api<Future>("GET", "/api/future?field=").then((d) => live && setFuture(d), () => live && setFuture({ source: "", allJobsGrowth: 0, fields: [] }));
    return () => { live = false; };
  }, []);
  // Openings Remy hasn't heard about yet, best fit first; fixed once loaded so a Keep doesn't reshuffle.
  useEffect(() => {
    if (!ws || loading || pool) return;
    setPool(jobs.filter((j) => j.kind !== "event" && !ws.hiddenJobIds.includes(j.id) && !ws.savedJobIds.includes(j.id) && !ws.jobFeedback?.[j.id] && !fits[j.id]?.excluded && !fits[j.id]?.closed)
      .sort((a, b) => (fits[b.id]?.score || 0) - (fits[a.id]?.score || 0)).slice(0, 4));
  }, [loading, ws, jobs]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ws) return null;
  const cards = (pool?.length ? ["openings", "role", "forecast"] as DailyCard[] : ["role", "forecast"] as DailyCard[]).filter((k) => !doneAtStart.includes(k));
  const finish = async (card: DailyCard, said: string) => {
    setLog((l) => [...l, said]);
    try { setWs(await api<Workspace>("PUT", "/api/ws/game", { value: withCard(stateOf(ws), card, today) })); } catch { /* the round still moves on */ }
    success(); setStep((n) => n + 1);
  };
  const close = () => { tap(); router.back(); };
  const done = already || step >= cards.length;
  const card = cards[step];
  const ready = pool && careers && future;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }} testID="daily-round">
      {!done && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Pressable testID="button-round-close" accessibilityLabel="Back" hitSlop={10} onPress={close}><Icon name="x" size={24} color={c.mutedText} /></Pressable>
          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.surface2, overflow: "hidden" }} accessibilityRole="progressbar">
            <View style={{ width: `${(step / cards.length) * 100}%`, height: 10, backgroundColor: c.fox }} />
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>{step + 1} of {cards.length}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
        {!ready ? (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingTop: 40, justifyContent: "center" }}><ActivityIndicator color={c.fox} /><T kind="muted">Dealing today's cards…</T></View>
        ) : done ? <Done before={before} log={log} onClose={close} />
          : card === "openings" ? <Openings jobs={pool} onDone={(s) => finish("openings", s)} />
          : card === "role" ? <RoleCard key={"role" + step} careers={careers} onDone={(s) => finish("role", s)} />
          : <Forecast future={future} onDone={(s) => finish("forecast", s)} />}
      </ScrollView>
    </View>
  );
}

function Kind({ card }: { card: DailyCard }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name={card === "openings" ? "jobs" : card === "role" ? "compass" : "trend"} size={15} color={c.foxDeep} /><T kind="label" style={{ color: c.foxDeep }}>{CARD_LABEL[card]} · about 1 minute</T></View>;
}

function Openings({ jobs, onDone }: { jobs: Job[]; onDone: (said: string) => void }) {
  const { fits, keep, pass } = useJobs();
  const { c } = useTheme();
  const [i, setI] = useState(0);
  const [kept, setKept] = useState(0);
  const [busy, setBusy] = useState(false);
  const j = jobs[i];
  const act = async (yes: boolean) => {
    if (!j || busy) return;
    setBusy(true); tap();
    try { await (yes ? keep(j) : pass(j)); if (yes) setKept((n) => n + 1); } catch { /* skip on to the next one */ }
    setBusy(false); setI((n) => n + 1);
  };
  if (!j) return (
    <View style={{ gap: 12 }}>
      <Kind card="openings" />
      <T kind="title">Sorted. You kept {kept}.</T>
      <Check text={`Kept openings are saved${kept ? ", with deadlines on your calendar when they have one" : ""}`} />
      <Check text="Your passes teach Remy what to stop showing you" />
      <Button testID="button-round-next" label="Next card" icon="arrow" flex onPress={() => onDone(kept ? `Kept ${kept} new opening${kept > 1 ? "s" : ""}` : `Sorted ${jobs.length} new openings`)} />
    </View>
  );
  const fit = fits[j.id], why = fit?.why;
  const skills = postingSkills(j.requirements).slice(0, 5);
  return (
    <View style={{ gap: 12 }}>
      <Kind card="openings" />
      <T kind="title">Keep the ones you'd really apply to</T>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 }} testID="round-job">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Logo company={j.company} url={j.applyUrl} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{j.company || "An employer"}</Text><T kind="small" numberOfLines={1}>{shortPlace(j.location)}</T></View>
        </View>
        <Text style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 24, color: c.ink }}>{j.title}</Text>
        {!!why && <T kind="small">{why}</T>}
        {/* Tester, Nov 25: why it fits belongs here, where the decision is made. The full opening is one tap away. */}
        {skills.length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} testID="round-skills">{skills.map((k) => <Chip key={k} text={fit?.matched?.includes(k) ? `✓ ${k}` : k} tone={fit?.matched?.includes(k) ? "live" : "plain"} />)}</View>}
        <Pressable testID="button-round-more" onPress={() => { tap(); router.push({ pathname: "/job", params: { id: j.id } }); }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.fox }}>Why it fits and more</Text></Pressable>
        {!!(j.applyUrl || j.sourceUrl) && <Pressable testID="link-round-posting" onPress={() => Linking.openURL((j.applyUrl || j.sourceUrl)!)}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.fox }}>See the posting</Text></Pressable>}
        <T kind="small" style={{ color: c.mutedText }}>{i + 1} of {jobs.length}</T>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button testID="round-pass" kind="ghost" label="Pass" flex disabled={busy} onPress={() => act(false)} style={{ flex: 1 }} />
        <Button testID="round-keep" label="Keep" flex disabled={busy} onPress={() => act(true)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function RoleCard({ careers, onDone }: { careers: { jobs: Occ[] }[]; onDone: (said: string) => void }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const known = new Set((stateOf(ws!).known || []).map((k) => k.toLowerCase()));
  // The quiz stays in the student's first field (their major's, the server sorts it first) when it has four jobs or more.
  const all = useMemo(() => [...new Map(((careers[0]?.jobs.length ?? 0) >= 4 ? careers.slice(0, 1) : careers).flatMap((x) => x.jobs).map((o) => [o.soc, o])).values()], [careers]);
  // New jobs first, starting at the day's pick; a job with no duties on file is skipped for the next one.
  const [order] = useState(() => { const fresh = all.filter((o) => !known.has(o.title.toLowerCase())); const list = fresh.length ? fresh : all; const k = seedOf(dayKey()) % Math.max(1, list.length); return [...list.slice(k), ...list.slice(0, k)]; });
  const [tries, setTries] = useState(0);
  const pick = order[tries];
  const [d, setD] = useState<Duties | null | "none">(null);
  const [ans, setAns] = useState<string | null>(null);
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (!pick) { setD("none"); return; }
    const next = () => (tries < Math.min(4, order.length - 1) ? setTries((t) => t + 1) : setD("none"));
    api<Duties>("GET", `/api/occupation/${encodeURIComponent(pick.soc)}`).then((x) => (x.duties.length ? setD(x) : next()), next);
  }, [pick?.soc]); // eslint-disable-line react-hooks/exhaustive-deps
  const opts = useMemo(() => { if (!pick) return []; const three = all.filter((o) => o.soc !== pick.soc).sort((a, b) => seedOf(a.soc + pick.soc) - seedOf(b.soc + pick.soc)).slice(0, 3); return [pick, ...three].sort((a, b) => seedOf(a.soc + "x") - seedOf(b.soc + "x")); }, [pick?.soc]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pick || d === "none") return <View style={{ gap: 12 }}><Kind card="role" /><T kind="title">No role to decode today</T><Button testID="button-role-next" label="Next card" flex onPress={() => onDone("")} /></View>;
  if (!d) return <View style={{ gap: 12 }}><Kind card="role" /><View style={{ flexDirection: "row", gap: 10 }}><ActivityIndicator color={c.fox} /><T kind="muted">Loading the duties…</T></View></View>;
  const clues = d.duties.slice(0, 3);
  const right = ans === pick.soc;
  const used = Math.min(shown, clues.length);
  const choose = (soc: string) => {
    if (ans) return;
    tap(); setAns(soc);
    const g = stateOf(ws!);
    api<Workspace>("PUT", "/api/ws/game", { value: { ...g, known: [...new Set([...(g.known || []), pick.title])] } }).then(setWs, () => {});
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
        <Remy size={64} />
        <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.bubble, borderBottomLeftRadius: 6, padding: 12, gap: 4 }}>
          <T kind="label" style={{ color: c.foxDeep }}>{ans ? (right ? `Right, on ${used} clue${used > 1 ? "s" : ""} · +${CARD_XP} XP` : `Not quite · +${CARD_XP} XP for playing`) : CARD_LABEL.role}</T>
          <T kind="h2">{ans ? `${right ? "" : "It's "}${pick.title}${right ? "!" : "."}` : "Someone does this all day. Who is it?"}</T>
          <T kind="small">{ans ? "Here's the job in numbers. It's now in your job collection." : "Guess on one clue, or flip another if you're stuck."}</T>
        </View>
      </View>
      {clues.map((t, i) => i < shown || ans ? (
        <View key={t} style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12, gap: 2 }}>
          <T kind="label">Clue {i + 1}{i >= shown ? " · bonus" : ""}</T><T>{t}</T>
        </View>
      ) : (
        <Pressable key={t} testID={`button-clue-${i + 1}`} disabled={i !== shown} onPress={() => { tap(); setShown(i + 1); }}
          style={{ borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: i === shown ? c.fox : c.line, padding: 12, flexDirection: "row", gap: 10, alignItems: "center", opacity: i === shown ? 1 : 0.6 }}>
          <Text style={{ fontFamily: font.display, fontSize: 20, color: c.fox }}>?</Text>
          <T kind="small" style={{ flex: 1 }}>Clue {i + 1} · {i === shown ? "Tap to show" : `Show clue ${i} first`}</T>
        </Pressable>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {opts.map((o, i) => {
          const isRight = ans && o.soc === pick.soc, isWrong = ans && o.soc === ans && !right;
          return (
            <Pressable key={o.soc} testID={`button-role-${i}`} disabled={!!ans} onPress={() => choose(o.soc)}
              style={{ flexBasis: "47%", flexGrow: 1, minHeight: 74, borderRadius: 14, borderWidth: 2, borderColor: isRight ? c.sage : isWrong ? c.error : c.line, backgroundColor: isRight ? c.sageBg : isWrong ? c.errorBg : c.surface, padding: 10, gap: 4, opacity: ans && !isRight && !isWrong ? 0.5 : 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.mutedText }}>{"ABCD"[i]}</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 14.5, lineHeight: 19, color: c.ink }}>{o.title}</Text>
              {!!o.wage && <T kind="small">{money(o.wage)}</T>}
            </Pressable>
          );
        })}
      </View>
      {ans ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {!!pick.wage && <Fact big={money(pick.wage)} small="median pay" />}
            {!!pick.openings && <Fact big={Math.round(pick.openings * 1000).toLocaleString("en-US")} small="openings a year" />}
            <Fact big={`${pick.change > 0 ? "+" : ""}${pick.change}%`} small="growth by 2035" />
          </View>
          <Button testID="button-role-next" label="Next card" icon="arrow" flex onPress={() => onDone(`Learned what ${pick.title.toLowerCase()} do`)} />
          <T kind="small" style={{ color: c.mutedText }}>Duties: O*NET, U.S. Department of Labor · numbers: BLS</T>
        </View>
      ) : <T kind="small" style={{ color: c.mutedText }}>Pick the job that does this. {used === 1 ? "Getting it on one clue is the real flex." : `You've seen ${used} of ${clues.length} clues.`}</T>}
    </View>
  );
}

function Forecast({ future, onDone }: { future: Future; onDone: (said: string) => void }) {
  const { c } = useTheme();
  const f0 = future.fields[0];
  const list = f0 ? [...f0.growing, ...f0.shrinking] : [];
  const [pick] = useState(() => list[seedOf(dayKey() + "f") % Math.max(1, list.length)]);
  const [ans, setAns] = useState<"up" | "down" | null>(null);
  if (!pick) return <View style={{ gap: 12 }}><Kind card="forecast" /><T kind="title">No forecast today</T><Button testID="button-round-finish" label="Finish" flex onPress={() => onDone("")} /></View>;
  const faster = pick.change > future.allJobsGrowth;
  const right = ans !== null && (ans === "up") === faster;
  const facts = [pick.wage ? `${money(pick.wage)} median pay` : "", pick.openings ? `about ${Math.round(pick.openings * 1000).toLocaleString("en-US")} openings a year` : "", `${pick.change > 0 ? "+" : ""}${pick.change}% by 2035`].filter(Boolean).join(" · ");
  const side = (label: string, value: string, tone?: "up" | "down") => (
    <View style={{ flex: 1, backgroundColor: tone === "up" ? c.sageBg : tone === "down" ? c.errorBg : c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12, alignItems: "center", gap: 2 }}>
      <T kind="small" numberOfLines={2} style={{ textAlign: "center" }}>{label}</T>
      <Text style={{ fontFamily: font.display, fontSize: 28, color: c.ink }}>{value}</Text>
      <T kind="small" style={{ color: c.mutedText }}>by 2035</T>
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <Kind card="forecast" />
      <T kind="title">{pick.title}: faster or slower growth than the average job?</T>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        {side("All U.S. jobs", `+${future.allJobsGrowth}%`)}
        <Text style={{ fontFamily: font.bold, color: c.mutedText }}>vs</Text>
        {side(pick.title, ans ? `${pick.change > 0 ? "+" : ""}${pick.change}%` : "?", ans ? (faster ? "up" : "down") : undefined)}
      </View>
      {!ans ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button testID="round-slower" kind="ghost" label="Slower" flex onPress={() => { tap(); setAns("down"); }} style={{ flex: 1 }} />
          <Button testID="round-faster" label="Faster" flex onPress={() => { tap(); setAns("up"); }} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ backgroundColor: right ? c.sageBg : c.surface2, borderRadius: radius.card, padding: 14, gap: 6 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: c.ink }}>{right ? "You called it." : "Not this time."} {faster ? `${pick.change > future.allJobsGrowth * 2 ? "More than twice" : "Faster than"} the average.` : pick.change < 0 ? "It's expected to shrink." : "Slower than the average."}</Text>
          <T kind="small">{facts}.</T>
          {!!future.source && <T kind="small" style={{ color: c.mutedText }}>{future.source}</T>}
          <Button testID="button-round-finish" label="Finish today's round" icon="arrow" flex onPress={() => onDone(`${pick.title}: ${pick.change > 0 ? "+" : ""}${pick.change}% by 2035`)} style={{ marginTop: 6 }} />
        </View>
      )}
    </View>
  );
}

function Done({ before, log, onClose }: { before: number; log: string[]; onClose: () => void }) {
  const { ws } = useSession();
  const owner = useOwnerView();
  const { c } = useTheme();
  const s = dailyStreak(streakDays(ws!)), dots = weekDots(streakDays(ws!), undefined, owner);
  const n = (stateOf(ws!).days?.[dayKey()] || []).length;
  return (
    <View style={{ gap: 14 }} testID="round-done">
      <View style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 20, alignItems: "center", gap: 6 }}>
        <Icon name="flame" size={56} color={c.fox} />
        <Text style={{ fontFamily: font.display, fontSize: 48, color: c.ink }}>{s.days}</Text>
        <T kind="muted" style={{ textAlign: "center" }}>{s.days > before ? (before ? "day streak, one more than this morning" : "day streak. It starts today.") : "day streak"}</T>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          {dots.map((d) => <View key={d.key} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: d.status === "done" ? c.fox : d.status === "freeze" ? c.blueBg : c.surface2 }}><Text style={{ fontFamily: font.bold, fontSize: 12, color: d.status === "done" ? c.onFox : c.mutedText }}>{d.label}</Text></View>)}
        </View>
        <T kind="small" style={{ textAlign: "center", marginTop: 6 }}>{s.freezes ? `You have ${s.freezes} freeze${s.freezes > 1 ? "s" : ""}: miss a day and your streak holds.` : "Every 7 days in a row earns a freeze that covers a missed day."}</T>
      </View>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 8 }}>
        <T kind="h2">What changed today</T>
        {log.filter(Boolean).map((l) => <Check key={l} text={l} />)}
        <Check text={`+${n * CARD_XP} XP toward your next level`} />
        <Button testID="button-round-done" label="Back to my path" icon="arrow" flex onPress={onClose} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

function Check({ text }: { text: string }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}><Icon name="check" size={16} color={c.sage} /><T kind="small" style={{ flex: 1 }}>{text}</T></View>;
}

function Fact({ big, small }: { big: string; small: string }) {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 10, gap: 2 }}><Text style={{ fontFamily: font.bold, fontSize: 17, color: c.ink }}>{big}</Text><T kind="small">{small}</T></View>;
}

