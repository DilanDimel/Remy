import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Workspace } from "@shared/types";
import { postingSkills } from "@shared/requirements";
import { Button, Chip, FitBadge, Logo, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { jobPay } from "@/lib/pay";
import { deadlineChip, kindLabel, shortPlace } from "@/lib/next";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

const rid = (p = "") => p + Math.random().toString(36).slice(2, 10);

/** One opening in full, the website's expanded job card: why it fits, what they look for, then Tailor / See the posting / Keep. */
export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ws, setWs } = useSession();
  const { jobs, fits, keep, pass } = useJobs();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const j = jobs.find((x) => x.id === id);
  if (!ws || !j) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}><Stack.Screen options={{ title: "Opening" }} /><T kind="muted">This opening isn't in your list any more.</T></View>;
  const fit = fits[j.id];
  const due = deadlineChip(j.deadline);
  const pay = jobPay(j);
  const showPay = j.kind !== "event"; // everyone, like the website
  const saved = ws.savedJobIds.includes(j.id);
  const decided = saved || !!ws.jobFeedback?.[j.id];
  const skills = postingSkills(j.requirements).slice(0, 6);
  const gaps = (fit?.gaps || []).filter((g) => !skills.some((k) => k.toLowerCase() === g.toLowerCase()));
  const url = j.applyUrl || j.sourceUrl;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const tracked = ws.tracker.find((t) => t.jobId === j.id) || ws.tracker.find((t) => !t.jobId && same(t.company, j.company) && same(t.role, j.title));

  const run = async (what: string, f: () => Promise<unknown>) => {
    setBusy(what); setErr("");
    try { await f(); } catch (e: any) { setErr(e.message); }
    setBusy("");
  };
  // Like the website's Apply: open the employer's page, then ask right away "Did you apply?" (the browser resolves when closed).
  const apply = async () => {
    tap();
    await WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
    if (j.kind !== "event" && (!tracked || tracked.status === "Saved")) setAsk(true);
  };
  const markApplied = () => run("applied", async () => {
    const ev = { id: rid("ev"), at: new Date().toISOString(), status: "Applied" as const, source: "Manual (asked after Apply)" };
    const value = tracked
      ? ws.tracker.map((t) => (t.id === tracked.id ? { ...t, status: "Applied" as const, jobId: t.jobId || j.id, events: [...t.events, ev] } : t))
      : [{ id: rid("tr"), company: j.company, role: j.title, jobId: j.id, status: "Applied" as const, notes: "", events: [ev] }, ...ws.tracker];
    setWs(await api<Workspace>("PUT", "/api/ws/tracker", { value }));
    success(); setAsk(false);
  });
  const why = fit && fit.eligibility !== "unknown" ? (fit.eligibility === "unlikely" ? "Why not: " : fit.checked && !fit.hidden ? "Why you qualify: " : "Eligibility: ") : "";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: j.company }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Logo company={j.company} url={j.applyUrl} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.mutedText }}>{j.company} · {kindLabel[j.kind]}</Text>
            <Text style={{ fontFamily: font.display, fontSize: 22, lineHeight: 27, color: c.ink }} testID="text-job-title">{j.title}</Text>
          </View>
        </View>
        <T kind="muted">{shortPlace(j.location)}{j.format && !(j.location || "").toLowerCase().includes(j.format.toLowerCase()) ? ` · ${j.format}` : ""}{j.dates ? ` · ${j.dates}` : ""}</T>
        {showPay && <T kind={pay ? "body" : "muted"} style={pay ? { fontFamily: font.bold } : undefined}>{pay ? `Pay: ${pay}` : "Pay not listed"}</T>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Chip text={j.label} tone={j.label === "Live" ? "live" : "plain"} />
          <FitBadge fit={fit} />
          {due && <Chip text={due.text} tone={due.tone} />}
        </View>

        {j.kind !== "event" && <Button testID="button-tailor-job" label="Tailor my resume" icon="arrow" flex onPress={() => go(`/resume?tab=tailor&job=${encodeURIComponent(j.id)}&go=1`, "Tailor resume")} />}
        {!!url && <Button testID="link-apply" kind="ghost" label={j.kind === "event" ? "Register" : "See the posting"} flex onPress={apply} />}
        {ask && (
          <View testID="ask-applied" style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 }}>
            <T kind="h2">Did you apply?</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button testID="button-applied-yes" label="Yes, I applied" busy={busy === "applied"} onPress={markApplied} />
              <Button testID="button-applied-not-yet" kind="ghost" label="Not yet" onPress={() => setAsk(false)} />
            </View>
          </View>
        )}
        {j.kind !== "event" && !decided && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button testID="button-keep" label="Keep" flex style={{ flex: 1 }} busy={busy === "keep"} onPress={() => run("keep", async () => { await keep(j); success(); })} />
            <Button testID="button-pass" kind="ghost" label="Pass" flex style={{ flex: 1 }} busy={busy === "pass"} onPress={() => run("pass", async () => { await pass(j); router.back(); })} />
          </View>
        )}
        {saved && <T kind="small" style={{ color: c.sage }}>Kept. It waits under Kept on Jobs.</T>}
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}

        {!!fit?.why && <Text style={{ fontFamily: font.body, fontSize: 15, lineHeight: 22, color: c.ink }}><Text style={{ fontFamily: font.bold }}>Why it fits you: </Text>{fit.why}</Text>}
        {!!why && <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.mutedText }}><Text style={{ fontFamily: font.bold }}>{why}</Text>{fit!.eligibilityNote}</Text>}
        {skills.length > 0 && (
          <View style={{ gap: 8 }} testID="job-keywords">
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: c.mutedText }}>Looking for</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {skills.map((k) => <Chip key={k} text={fit?.matched.includes(k) ? `✓ ${k}` : k} tone={fit?.matched.includes(k) ? "live" : "plain"} />)}
            </View>
          </View>
        )}
        {/* Only gaps the "Looking for" chips above don't already show. */}
        {gaps.length > 0 && <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.mutedText }}><Text style={{ fontFamily: font.bold }}>Gaps: </Text>{gaps.slice(0, 3).join("; ")}</Text>}
        {!!j.summary && <T>{j.summary}</T>}
        <View style={{ gap: 4 }}>
          {/* Hidden when the board gives no date ("Not stated…"; handoff 09: hide empty fields). A rolling deadline still shows. */}
          {!!j.deadlineText && !/^not stated/i.test(j.deadlineText) && <T kind="small"><Text style={{ fontFamily: font.bold }}>Deadline: </Text>{j.deadlineText}</T>}
          {!!j.sourceUrl && <Pressable testID="link-source" onPress={() => WebBrowser.openBrowserAsync(j.sourceUrl).catch(() => {})}><T kind="small"><Text style={{ fontFamily: font.bold }}>Source: </Text><Text style={{ color: c.fox }}>{j.sourceName || "Posting"}</Text></T></Pressable>}
        </View>
      </ScrollView>
    </View>
  );
}
