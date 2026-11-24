import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Job } from "@shared/types";
import { Button, FitBadge, Group, Icon, Logo, Pill, Row, Screen, Sect, T, success, tap } from "@/components/ui";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { daysUntil, visibleJobs } from "@/lib/next";
import { useRefreshAll, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

type Filter = "new" | "kept";

/** "Ally Financial · Remote": the work format only when it adds something (not "Remote · Remote"). */
const placeLine = (j: Job) => [j.company, j.location, j.format && !(j.location || "").toLowerCase().includes(j.format.toLowerCase()) ? j.format : ""].filter(Boolean).join(" · ");

export default function Jobs() {
  const { ws } = useSession();
  const refreshAll = useRefreshAll();
  const { jobs, fits, loading, error, reload, keep, pass, undo } = useJobs();
  // Keep / Pass feel instant: the card goes at once, the server catches up, and Undo stays up for a few seconds.
  const [gone, setGone] = useState<Record<string, true>>({});
  const [last, setLast] = useState<{ job: Job; kept: boolean } | null>(null);
  // 8 seconds: the iPhone retest missed a 5-second Undo.
  useEffect(() => { if (!last) return; const t = setTimeout(() => setLast(null), 8000); return () => clearTimeout(t); }, [last]);
  // A Keep counts in Kept straight away, before the server answers.
  const [keptNow, setKeptNow] = useState<Record<string, true>>({});
  const { c } = useTheme();
  const [filter, setFilter] = useState<Filter>("new");
  // Opened from Today: on the tab that has the opening (a kept one is under Kept, not For you).
  const { show, at } = useLocalSearchParams<{ show?: string; at?: string }>();
  useEffect(() => { if (show === "new" || show === "kept") setFilter(show); }, [show, at]);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const all = useMemo(() => (ws ? visibleJobs(ws, jobs, fits) : []), [ws, jobs, fits]);
  if (!ws) return null;
  // Kept is every saved opening, like Progress counts them: one that closed or left the feed still shows (marked closed).
  const kept = [...new Set([...ws.savedJobIds, ...Object.keys(keptNow)])].map((id) => jobs.find((j) => j.id === id)).filter((j): j is Job => !!j);
  // Only a posting that really closed says so (one Remy marks not eligible already carries that badge), first so it isn't cut off.
  const closed = (j: Job) => !!fits[j.id]?.closed || (!!j.deadline && (daysUntil(j.deadline) ?? 0) < 0);
  const fresh = all.filter((j) => !gone[j.id] && !ws.savedJobIds.includes(j.id) && !ws.jobFeedback?.[j.id]);
  const shown = filter === "kept" ? kept : fresh;
  const onRefresh = async () => { setRefreshing(true); await Promise.all([reload(), refreshAll()]); setRefreshing(false); };
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

  return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ marginTop: 28 }}>Jobs</T>
      {filters}
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}
      {shown.length ? <>
        <Sect title={filter === "kept" ? "Kept" : `${shown.length} for you`} />
        <Group>
          {shown.slice(0, 40).map((j, i) => (
            <Row key={j.id} first={i === 0} title={j.title} sub={[filter === "kept" && closed(j) ? "Closed" : "", placeLine(j)].filter(Boolean).join(" · ")} left={<Logo company={j.company} url={j.applyUrl} size={40} />} onPress={() => open(j)} testID="row-opening"
              right={filter === "kept" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <FitBadge fit={fits[j.id]} />
                  <Pressable testID="button-unkeep" accessibilityLabel={`Remove ${j.title} from Kept`} hitSlop={6} onPress={() => unkeep(j)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={18} color={c.mutedText} /></Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable testID="button-pass" accessibilityLabel={`Pass on ${j.title}`} hitSlop={6} onPress={() => { tap(); decide(j, false); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={18} color={c.mutedText} /></Pressable>
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
}
