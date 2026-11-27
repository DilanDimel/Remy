import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Swipeable, { SwipeDirection } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { Job, JobFit } from "@shared/types";
import { shortTitle } from "@shared/org";
import { Button, Chip, FitBadge, Icon, Loading, Logo, Pill, Screen, Sect, T, success, tap } from "@/components/ui";
import { useJobs } from "@/lib/jobs";
import { Tracker } from "../progress";
import { go } from "@/lib/nav";
import { jobPay } from "@/lib/pay";
import { deadlineChip, jobsLine, kindLabel, passedJobs, shortPlace, upcomingEvents, visibleJobs } from "@/lib/next";
import { useRefreshAll, useSession } from "@/lib/session";
import { BUTTON_RADIUS, aboveTabs, font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// "kept" shows as Saved and "applied" is the applications board, like the website's For you / Saved / Applied (#427).
type Filter = "new" | "kept" | "applied" | "passed" | "events";
// Cards drawn at a time; "Show more" adds this many again (the list used to stop at 40 with no way to see the rest).
const PAGE = 40;

/** One opening, like the website's job card: logo, "company · kind", title, place, chips, and why it fits. */
export function JobCard({ j, fit, children, onPress }: { j: Job; fit?: JobFit; children?: React.ReactNode; onPress?: () => void }) {
  const { c } = useTheme();
  const due = deadlineChip(j.deadline);
  const pay = jobPay(j);
  return (
    <Pressable testID="card-job" onPress={onPress} accessibilityRole="button" accessibilityLabel={`${j.title}, ${j.company}`}
      style={({ pressed }) => ({ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10, opacity: pressed ? 0.92 : 1 })}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Logo company={j.company} url={j.applyUrl} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.semi, fontSize: 13, color: c.mutedText }}>{j.company} · {kindLabel[j.kind]}</Text>
          <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 16.5, lineHeight: 21, color: c.ink }}>{shortTitle(j.title, j.company)}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.body, fontSize: 13.5, color: c.mutedText }}>{shortPlace(j.location)}{j.dates ? ` · ${j.dates}` : ""}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Chip text={j.label} tone={j.label === "Live" ? "live" : "plain"} testID={`label-${j.label.replace(/\s/g, "-").toLowerCase()}`} />
        <FitBadge fit={fit} />
        {due && <Chip text={due.text} tone={due.tone} testID="chip-deadline" />}
      </View>
      {j.kind !== "event" && <Text testID="text-job-pay" style={{ fontFamily: pay ? font.bold : font.body, fontSize: 14.5, color: pay ? c.ink : c.mutedText }}>{pay ? `Pay: ${pay}` : "Pay not listed"}</Text>}
      {!!fit?.why && <Text numberOfLines={3} style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.ink }}><Text style={{ fontFamily: font.bold }}>Why it fits you: </Text>{fit.why}</Text>}
      {children}
    </Pressable>
  );
}

export default function Jobs() {
  const { ws } = useSession();
  const refreshAll = useRefreshAll();
  const { jobs, fits, loading, error, reload, keep, pass, undo } = useJobs();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  // Keep / Pass feel instant: the card goes at once, the server catches up, and Undo stays up for a few seconds.
  const [gone, setGone] = useState<Record<string, true>>({});
  const [last, setLast] = useState<{ job: Job; kept: boolean } | null>(null);
  // 8 seconds: the iPhone retest missed a 5-second Undo.
  useEffect(() => { if (!last) return; const t = setTimeout(() => setLast(null), 8000); return () => clearTimeout(t); }, [last]);
  // A Keep counts in Kept straight away, before the server answers.
  const [keptNow, setKeptNow] = useState<Record<string, true>>({});
  const [filter, setFilter] = useState<Filter>("new");
  const [leaving, setLeaving] = useState<Record<string, true>>({});
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [filter]);
  // Opened from Today: on the tab that has the opening (a kept one is under Kept, not For you).
  const { show, at } = useLocalSearchParams<{ show?: string; at?: string }>();
  useEffect(() => { if (show === "new" || show === "kept" || show === "applied" || show === "passed" || show === "events") setFilter(show); }, [show, at]);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const all = useMemo(() => (ws ? visibleJobs(ws, jobs, fits) : []), [ws, jobs, fits]);
  const events = useMemo(() => (ws ? upcomingEvents(ws, jobs, fits) : []), [ws, jobs, fits]);
  if (!ws) return <Loading />;
  // Kept is every saved opening, like Progress counts them: one that closed or left the feed still shows (marked closed).
  const kept = [...new Set([...ws.savedJobIds, ...Object.keys(keptNow)])].map((id) => jobs.find((j) => j.id === id)).filter((j): j is Job => !!j && !leaving[j.id]);
  // A Pass counts in Passed straight away; only a card being brought back leaves it.
  const passed = [...passedJobs(ws, jobs).filter((j) => !leaving[j.id]), ...(last && !last.kept && !ws.hiddenJobIds.includes(last.job.id) ? [last.job] : [])];
  const fresh = all.filter((j) => !gone[j.id] && !ws.savedJobIds.includes(j.id) && !ws.jobFeedback?.[j.id]);
  const shown = filter === "kept" ? kept : filter === "passed" ? passed : filter === "events" ? events : fresh;
  const onRefresh = async () => { setRefreshing(true); await Promise.all([reload(), refreshAll()]); setRefreshing(false); };
  const decide = async (j: Job, yes: boolean) => {
    if (yes) success(); else tap();
    setErr(""); setGone((g) => ({ ...g, [j.id]: true })); setLast({ job: j, kept: yes });
    if (yes) setKeptNow((k) => ({ ...k, [j.id]: true }));
    try { await (yes ? keep(j) : pass(j)); }
    catch (e: any) { setErr(e.message); setLast(null); setGone(({ [j.id]: _, ...g }) => g); setKeptNow(({ [j.id]: _, ...k }) => k); }
  };
  const takeBack = async () => {
    if (!last) return;
    const { job, kept: k } = last; tap(); setLast(null);
    try { await undo(job, k); setGone(({ [job.id]: _, ...g }) => g); setKeptNow(({ [job.id]: _, ...n }) => n); } catch (e: any) { setErr(e.message); }
  };
  // Kept → remove, Passed → bring back: the same undo as after a Keep or Pass, so the opening goes back to For you.
  const restore = async (j: Job, wasKept: boolean) => {
    tap(); setErr(""); setLeaving((l) => ({ ...l, [j.id]: true }));
    try { await undo(j, wasKept); setKeptNow(({ [j.id]: _, ...n }) => n); setGone(({ [j.id]: _, ...g }) => g); } catch (e: any) { setErr(e.message); }
    setLeaving(({ [j.id]: _, ...l }) => l);
  };
  const open = (j: Job) => { tap(); router.push({ pathname: "/job", params: { id: j.id } }); };

  const toast = last && (
    <View style={{ position: "absolute", left: 16, right: 84, bottom: aboveTabs(insets.bottom), flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.ink, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 }} testID="toast-undo">
      {/* Handoff 09's words: "Kept. See kept" and "Passed. Undo" (Undo works after Keep too). */}
      <Text style={{ flex: 1, fontFamily: font.semi, fontSize: 14.5, color: c.onInk }} numberOfLines={1}>{last.kept ? "Saved." : "Passed."}</Text>
      {last.kept && <Pressable testID="button-see-kept" hitSlop={10} onPress={() => { tap(); setFilter("kept"); }}><Text style={{ fontFamily: font.bold, fontSize: 14.5, color: c.onInk }}>See saved</Text></Pressable>}
      <Pressable testID="button-undo-decision" hitSlop={10} onPress={takeBack}><Text style={{ fontFamily: font.bold, fontSize: 14.5, color: c.fox }}>Undo</Text></Pressable>
    </View>
  );
  const small = (label: string, onPress: () => void, testID: string, ink?: boolean) => (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} hitSlop={4}
      style={({ pressed }) => ({ flex: 1, height: 42, borderRadius: BUTTON_RADIUS, backgroundColor: ink ? c.ink : c.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
      <Text style={{ fontFamily: font.bold, fontSize: 15, color: ink ? c.onInk : c.ink }}>{label}</Text>
    </Pressable>
  );
  // Swiping is a shortcut for the same two buttons: right keeps, left passes.
  const side = (label: string, bg: string, fg: string, icon: "heart" | "x", left: boolean) => () => (
    <View style={{ width: 96, justifyContent: "center", alignItems: left ? "flex-start" : "flex-end", paddingHorizontal: 18 }}>
      <View style={{ alignItems: "center", gap: 4 }}><View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={20} color={fg} /></View><Text style={{ fontFamily: font.bold, fontSize: 12.5, color: c.mutedText }}>{label}</Text></View>
    </View>
  );

  const filters = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      <Pill testID="filter-new" label={`For you · ${fresh.length}`} on={filter === "new"} onPress={() => setFilter("new")} />
      <Pill testID="filter-kept" label={`Saved · ${kept.length}`} on={filter === "kept"} onPress={() => setFilter("kept")} />
      <Pill testID="filter-applied" label={`Applied · ${ws.tracker.length}`} on={filter === "applied"} onPress={() => setFilter("applied")} />
      <Pill testID="filter-passed" label={`Passed · ${passed.length}`} on={filter === "passed"} onPress={() => setFilter("passed")} />
      {/* Events and competitions, like the website's Events filter (the app used to drop them). */}
      {events.length > 0 && <Pill testID="filter-events" label={`Events · ${events.length}`} on={filter === "events"} onPress={() => setFilter("events")} />}
    </ScrollView>
  );
  const empty = (
    <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
      <T kind="h2">{loading ? "Finding openings…" : filter === "kept" ? "Nothing saved yet" : filter === "passed" ? "Nothing passed" : filter === "events" ? "No events right now" : "You're all caught up"}</T>
      <T kind="muted" style={{ textAlign: "center" }}>{error || (filter === "kept" ? "Keep openings you like and they'll wait here as Saved." : filter === "passed" ? "Openings you pass on wait here in case you change your mind." : filter === "events" ? "Career fairs, info sessions and competitions show up here when Remy finds them." : "Remy checks employers' sites every few hours. Pull down to check now.")}</T>
      {!loading && !error && filter === "new" && kept.length > 0 && <Button testID="button-see-kept" label={`See your ${kept.length} saved`} icon="arrow" onPress={() => setFilter("kept")} style={{ marginTop: 12, alignSelf: "center" }} />}
    </View>
  );
  const line = filter === "new" ? jobsLine(fresh, fits) : "";

  return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ marginTop: 8 }}>Opportunities</T>
      {!!line && <T kind="muted" style={{ marginTop: 4 }}>{line}</T>}
      {filters}
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}
      {filter === "applied" ? <View style={{ marginTop: 8 }}><Tracker ws={ws} /></View> : shown.length ? <>
        <Sect title={filter === "kept" ? "Saved" : filter === "passed" ? "Passed" : filter === "events" ? "Events and competitions" : `${shown.length} for you`} />
        <View style={{ gap: 12 }}>
          {shown.slice(0, limit).map((j) => {
            const card = (
              <JobCard key={j.id} j={j} fit={fits[j.id]} onPress={() => open(j)}>
                {filter === "new" && j.kind !== "event" && <View style={{ flexDirection: "row", gap: 8 }}>
                  {small("Keep", () => decide(j, true), "button-keep", true)}
                  {small("Pass", () => decide(j, false), "button-pass")}
                </View>}
                {filter === "kept" && <View style={{ flexDirection: "row", gap: 8 }}>
                  {small("Tailor resume", () => { tap(); go(`/resume?tab=tailor&job=${encodeURIComponent(j.id)}&go=1`, "Tailor resume"); }, "button-tailor-kept", true)}
                  {small("Remove", () => restore(j, true), "button-unkeep")}
                </View>}
                {filter === "passed" && <View style={{ flexDirection: "row" }}>{small("Bring it back", () => restore(j, false), "button-unpass")}</View>}
              </JobCard>
            );
            return filter === "new" && j.kind !== "event" ? (
              // dragOffsetFromRight must be negative: #442 set +30, which made the swipe grab every touch on Android and hold the scroll.
              <Swipeable key={j.id} friction={2} leftThreshold={80} rightThreshold={80} dragOffsetFromLeft={24} dragOffsetFromRight={-24} overshootLeft={false} overshootRight={false}
                renderLeftActions={side("Keep", c.foxSoft, c.foxDeep, "heart", true)} renderRightActions={side("Pass", c.surface2, c.mutedText, "x", false)}
                onSwipeableOpen={(dir) => decide(j, dir === SwipeDirection.RIGHT)}>
                {card}
              </Swipeable>
            ) : card;
          })}
        </View>
        {shown.length > limit && <Button testID="button-show-more" kind="ghost" label={`Show ${Math.min(PAGE, shown.length - limit)} more`} onPress={() => setLimit((n) => n + PAGE)} style={{ marginTop: 12 }} flex />}
      </> : empty}
    </Screen>
    {toast}
    </View>
  );
}
