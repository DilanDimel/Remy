import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, Text, useWindowDimensions, View } from "react-native";
import type { Job } from "@shared/types";
import { Button, EmployerTile, FitBadge, Group, Icon, Pill, Row, Screen, Sect, T, success, tap } from "@/components/ui";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { visibleJobs } from "@/lib/next";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

type Filter = "new" | "kept";

/** "Ally Financial · Remote": the work format only when it adds something (not "Remote · Remote"). */
const placeLine = (j: Job) => [j.company, j.location, j.format && !(j.location || "").toLowerCase().includes(j.format.toLowerCase()) ? j.format : ""].filter(Boolean).join(" · ");
/** The deadline chip says it's about the deadline: "Not stated on the board…" alone read like a mystery tag. */
const deadlineLabel = (t: string) => (/deadline|due|apply by|closes|starts/i.test(t) ? t : /^not stated/i.test(t) ? "Deadline not stated" : `Deadline: ${t}`);

export default function Jobs() {
  const { ws } = useSession();
  const { jobs, fits, loading, error, reload, keep, pass, undo } = useJobs();
  // Keep / Pass feel instant: the card goes at once, the server catches up, and Undo stays up for a few seconds.
  const [gone, setGone] = useState<Record<string, true>>({});
  const [last, setLast] = useState<{ job: Job; kept: boolean } | null>(null);
  // 8 seconds: the iPhone retest missed a 5-second Undo.
  useEffect(() => { if (!last) return; const t = setTimeout(() => setLast(null), 8000); return () => clearTimeout(t); }, [last]);
  // A Keep counts in Kept straight away, before the server answers.
  const [keptNow, setKeptNow] = useState<Record<string, true>>({});
  const { c, look } = useTheme();
  const [filter, setFilter] = useState<Filter>("new");
  // Opened from Today: on the tab that has the opening (a kept one is under Kept, not For you).
  const { show, at } = useLocalSearchParams<{ show?: string; at?: string }>();
  useEffect(() => { if (show === "new" || show === "kept") setFilter(show); }, [show, at]);
  const [listMode, setListMode] = useState(false);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const all = useMemo(() => (ws ? visibleJobs(ws, jobs, fits) : []), [ws, jobs, fits]);
  if (!ws) return null;
  // Kept is every saved opening, like Progress counts them: one that closed or left the feed still shows (marked closed).
  const kept = [...new Set([...ws.savedJobIds, ...Object.keys(keptNow)])].map((id) => jobs.find((j) => j.id === id)).filter((j): j is Job => !!j);
  const closed = (j: Job) => !all.some((x) => x.id === j.id);
  const fresh = all.filter((j) => !gone[j.id] && !ws.savedJobIds.includes(j.id) && !ws.jobFeedback?.[j.id]);
  const shown = filter === "kept" ? kept : fresh;
  const onRefresh = async () => { setRefreshing(true); await reload(); setRefreshing(false); };
  const decide = async (j: Job, yes: boolean) => {
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
  // Kept → remove: the same undo as after a Keep, so the opening goes back to For you.
  const unkeep = async (j: Job) => {
    tap(); setErr("");
    try { await undo(j, true); setGone(({ [j.id]: _, ...g }) => g); setKeptNow(({ [j.id]: _, ...n }) => n); } catch (e: any) { setErr(e.message); }
  };
  const toast = last && (
    <View style={{ position: "absolute", left: 16, right: 16, bottom: 104, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.ink, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 }} testID="toast-undo">
      <Text style={{ flex: 1, fontFamily: font.semi, fontSize: 14.5, color: c.onInk }} numberOfLines={1}>{last.kept ? "Kept" : "Passed"} · {last.job.title}</Text>
      <Pressable testID="button-undo-decision" hitSlop={10} onPress={takeBack}><Text style={{ fontFamily: font.bold, fontSize: 14.5, color: c.fox }}>Undo</Text></Pressable>
    </View>
  );
  // Remy's page for the opening (why it fits, tailor, track), with the employer's posting one tap further.
  const open = (j: Job) => { tap(); go(`/opportunities?id=${encodeURIComponent(j.id)}`, "Opportunities"); };

  const filters = (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      <Pill testID="filter-new" label={`For you · ${fresh.length}`} on={filter === "new"} onPress={() => setFilter("new")} />
      <Pill testID="filter-kept" label={`Kept · ${kept.length}`} on={filter === "kept"} onPress={() => setFilter("kept")} />
    </View>
  );
  const empty = (
    <View style={{ paddingVertical: 50, alignItems: "center", gap: 8 }}>
      <T kind="h2">{loading ? "Finding openings…" : filter === "kept" ? "Nothing kept yet" : "You're all caught up"}</T>
      <T kind="muted" style={{ textAlign: "center" }}>{error || (filter === "kept" ? "Keep openings you like and they'll wait here." : "Remy checks employers' sites every few hours. Pull down to check now.")}</T>
      {!loading && !error && filter === "new" && kept.length > 0 && <Button testID="button-see-kept" label={`See your ${kept.length} kept`} icon="arrow" onPress={() => setFilter("kept")} style={{ marginTop: 12, alignSelf: "center" }} />}
    </View>
  );

  if (look === "calm" || listMode || filter === "kept") return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {look === "calm" ? <T kind="display" style={{ fontSize: 34, marginTop: 28 }}>Jobs</T> : <Header c={c} onToggle={() => setListMode(false)} listMode />}
      {filters}
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}
      {shown.length ? <>
        <Sect title={filter === "kept" ? "Kept" : `${shown.length} for you`} />
        <Group>
          {shown.slice(0, 40).map((j, i) => (
            <Row key={j.id} first={i === 0} title={j.title} sub={[j.company, j.location, filter === "kept" && closed(j) ? "closed" : ""].filter(Boolean).join(" · ")} left={<EmployerTile name={j.company} size={40} />} onPress={() => open(j)} testID="row-opening"
              right={filter === "kept" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <FitBadge fit={fits[j.id]} />
                  <Pressable testID="button-unkeep" accessibilityLabel={`Remove ${j.title} from Kept`} hitSlop={6} onPress={() => unkeep(j)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={18} color={c.muted} /></Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable testID="button-pass" accessibilityLabel={`Pass on ${j.title}`} hitSlop={6} onPress={() => { tap(); decide(j, false); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={18} color={c.muted} /></Pressable>
                  <Pressable testID="button-keep" accessibilityLabel={`Keep ${j.title}`} hitSlop={6} onPress={() => { success(); decide(j, true); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Icon name="heart" size={18} color={c.foxDeep} /></Pressable>
                </View>
              )} />
          ))}
        </Group>
      </> : empty}
    </Screen>
    {toast}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Header c={c} onToggle={() => setListMode(true)} />
      {filters}
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}
      {shown.length ? <Deck key={shown[0].id} jobs={shown} onDecide={decide} onOpen={open} /> : empty}
    </Screen>
    {toast}
    </View>
  );
}

function Header({ c, onToggle, listMode }: { c: ReturnType<typeof useTheme>["c"]; onToggle: () => void; listMode?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 44 }}>
      <Text style={{ fontFamily: font.display, fontSize: 17, color: c.ink }}>Jobs</Text>
      <Pressable testID="button-toggle-list" accessibilityLabel={listMode ? "Show cards" : "Show list"} onPress={() => { tap(); onToggle(); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
        <Icon name={listMode ? "cards" : "list"} size={16} /><Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.ink }}>{listMode ? "Cards" : "List"}</Text>
      </Pressable>
    </View>
  );
}

/** One opening at a time: swipe right to keep, left to pass (or use the buttons). */
function Deck({ jobs, onDecide, onOpen }: { jobs: Job[]; onDecide: (j: Job, yes: boolean) => void; onOpen: (j: Job) => void }) {
  const { c } = useTheme();
  const { fits } = useJobs();
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const j = jobs[0];
  const f = fits[j.id];
  const fly = (yes: boolean) => {
    yes ? success() : tap();
    Animated.timing(x, { toValue: (yes ? 1 : -1) * width * 1.3, duration: 220, useNativeDriver: false }).start(() => onDecide(j, yes));
  };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 110 || g.vx > 0.8) fly(true);
      else if (g.dx < -110 || g.vx < -0.8) fly(false);
      else Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 6 }).start();
    },
  })).current;
  const rotate = x.interpolate({ inputRange: [-width, 0, width], outputRange: ["-14deg", "0deg", "14deg"] });
  const keepO = x.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: "clamp" });
  const passO = x.interpolate({ inputRange: [-100, 0], outputRange: [1, 0], extrapolate: "clamp" });
  const card = { backgroundColor: c.surface, borderRadius: 28, borderWidth: 1, borderColor: c.line, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 4 } as const;
  return (
    <View style={{ marginTop: 20 }}>
      <View>
        {jobs[2] && <View style={[card, { position: "absolute", left: 16, right: 16, top: 16, bottom: 8, transform: [{ rotate: "3deg" }], opacity: 0.55 }]} />}
        {jobs[1] && <View style={[card, { position: "absolute", left: 8, right: 8, top: 8, bottom: 4, transform: [{ rotate: "-2deg" }], opacity: 0.85 }]} />}
        <Animated.View {...pan.panHandlers} style={[card, { minHeight: 462, padding: 20, transform: [{ translateX: x }, { rotate }] }]} testID="card-opening">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}><EmployerTile name={j.company} size={50} /><FitBadge fit={f} /></View>
          <T kind="title" style={{ marginTop: 16 }} numberOfLines={3}>{j.title}</T>
          <T kind="muted" style={{ marginTop: 4 }} numberOfLines={2}>{placeLine(j)}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
            {!!j.deadlineText && <Pill label={deadlineLabel(j.deadlineText)} />}
            {(f?.matched || []).slice(0, 3).map((m) => <Pill key={m} label={m} />)}
          </View>
          {!!f?.why && (
            <View style={{ backgroundColor: c.foxSoft, borderRadius: 18, padding: 14, marginTop: 16 }}>
              <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 20, color: c.ink }} numberOfLines={5}><Text style={{ fontFamily: font.bold, color: c.foxDeep }}>Why Remy picked it: </Text>{f.why}</Text>
            </View>
          )}
          <View style={{ flexGrow: 1, minHeight: 16 }} />
          <View style={{ gap: 10, marginTop: 8 }}>
            <Pressable testID="button-open-posting" onPress={() => onOpen(j)} style={{ alignSelf: "center", paddingVertical: 6 }}><Text style={{ fontFamily: font.semi, fontSize: 14, color: c.muted, textDecorationLine: "underline" }}>See the posting</Text></Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button testID="button-pass" kind="ghost" label="Pass" onPress={() => fly(false)} flex style={{ flex: 1 }} />
              <Button testID="button-keep" kind="fox" label="Keep" onPress={() => fly(true)} flex style={{ flex: 1 }} />
            </View>
          </View>
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 26, left: 22, opacity: keepO, transform: [{ rotate: "-12deg" }], borderWidth: 3, borderColor: c.fox, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: font.display, fontSize: 20, color: c.fox }}>KEEP</Text></Animated.View>
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 26, right: 22, opacity: passO, transform: [{ rotate: "12deg" }], borderWidth: 3, borderColor: c.faint, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: font.display, fontSize: 20, color: c.faint }}>PASS</Text></Animated.View>
        </Animated.View>
      </View>
      <T kind="small" style={{ textAlign: "center", marginTop: 10 }}>Swipe right to keep · left to pass · {jobs.length} left</T>
    </View>
  );
}
