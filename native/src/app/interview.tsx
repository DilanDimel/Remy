import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Workspace } from "@shared/types";
import { CRITERIA } from "@shared/interviewRubric";
import { LEVEL_WORD, listenFor, pickProfile, scoreInterview, weeklyLeft, WEEKLY_AI_INTERVIEWS, type Interview, type IvAnswer, type IvMode } from "@shared/interview";
import { hospitalFirst } from "@shared/employer";
import { speechFeedback } from "@shared/speech";
import { STORY_PARTS } from "@shared/stories";
import { Button, Group, Icon, Remy, Row, Segmented, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { HearIt, canSpeak, hush, say } from "@/components/HearIt";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { useOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Mock interview, native (it opened the website's /interview; client/src/components/MockInterview.tsx): Remy plans
// questions from the posting and the student's resume (POST /api/interviews), asks one at a time, rates each answer
// with their own words as proof, and ends on a scorecard. Answers are typed here; the website's mic needs the
// browser's speech recognition. The prep kit (stories, pitch, questions) is app/prep.tsx.
const KIND: Record<string, string> = { warmup: "Warm-up", posting: "From the posting", resume: "Your resume", work_sample: "Work sample", pressure: "Pressure", yours: "Your turn" };
const short = (t: string) => t.split(/ [-–(]|, /)[0];
type View_ = { id: string; qi: number; fb: boolean } | null;

export default function InterviewScreen() {
  const { ws } = useSession();
  const owner = useOwnerView();
  // Before the redesign the website's Interview page is the story deck and pitch: the app's prep kit.
  if (ws && !owner) return <Redirect href={"/prep" as any} />;
  return ws ? <Mock /> : null;
}

function useCard() {
  const { c } = useTheme();
  return { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 } as const;
}

function Mock() {
  const { ws, setWs } = useSession();
  const { jobs: all, fits } = useJobs();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const card = useCard();
  const params = useLocalSearchParams<{ job?: string; start?: string }>();
  const w = ws!;
  // The website's useInterviewJobs: openings they're applying to, then the ones they kept, else the best fits.
  const ids = [...new Set([...[...w.applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => a.jobId), ...w.savedJobIds])];
  const mine = ids.map((id) => w.jobs.find((j) => j.id === id)).filter((j): j is NonNullable<typeof j> => !!j && j.kind !== "event").map(hospitalFirst);
  const best = all.filter((j) => j.kind !== "event" && !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false).sort((x, y) => (fits[y.id]?.score ?? 0) - (fits[x.id]?.score ?? 0)).slice(0, 8);
  const asked = params.job ? w.jobs.find((j) => j.id === params.job && j.kind !== "event") : undefined;
  const listed = mine.length ? mine : best;
  const jobs = asked && !listed.some((j) => j.id === asked.id) ? [asked, ...listed] : listed;
  const [pick, setPick] = useState(asked?.id || "");
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<IvMode>("coach");
  const [view, setView] = useState<View_>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const job = jobs.find((j) => j.id === pick) || jobs[0];
  const ivs = w.interviews || [];
  const iv = view ? ivs.find((x) => x.id === view.id) : undefined;
  const left = weeklyLeft(ivs);
  const planned = job ? [...ivs].reverse().find((x) => x.jobId === job.id && !x.finishedAt && Date.now() - Date.parse(x.startedAt) < 864e5) : undefined;
  const plan = async (jobId = job?.id) => {
    if (!jobId) return;
    tap(); setBusy(true); setErr("");
    try { setWs(await api<Workspace>("POST", "/api/interviews", { jobId, mode })); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  // Remy's "give me a mock interview" link plans right away (/interview?start=1&job=…).
  useEffect(() => { if (params.start === "1" && job && !planned) void plan(job.id); }, []);

  const scroll = (children: React.ReactNode) => (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView testID="mock-interview" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
        <Quota left={left} />
        {children}
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (iv && view) return scroll(<Room iv={iv} view={view} setView={setView} setErr={setErr} />);

  const tracked = w.tracker.find((t) => t.status === "Interview");
  const last = [...ivs].reverse().find((x) => x.finishedAt);
  const profile = job ? pickProfile(job) : "generic";
  const ready = (w.stories || []).filter((s) => STORY_PARTS.every((p) => s[p])).length;
  return scroll(<>
    <T kind="muted"><Text style={{ fontFamily: font.bold, color: c.ink }}>{tracked ? `You have an interview with ${tracked.company}.` : job ? `Your ${job.company} interview could come any week.` : "Interviews come fast once you apply."}</Text> {job ? "I'll build this one from their posting and your resume, so it feels like the real thing." : "Save an opening and I'll interview you for it."}</T>
    {!job ? (
      <View style={card}><T kind="h2">Save an opening and I'll interview you for it</T><T kind="small">I plan the questions from the posting itself, so the practice matches the real thing.</T>
        <Button testID="button-mock-find-jobs" label="Find openings" icon="arrow" onPress={() => go("jobs")} /></View>
    ) : <>
      <View style={card}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Remy size={56} icon />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={kick(c)}>Mock interview · {short(job.title)}</Text>
            <T kind="h2">I'll interview you like {job.company} would</T>
          </View>
        </View>
        {jobs.length > 1 && <Pressable testID="select-mock-job" accessibilityRole="button" onPress={() => { tap(); setPicking(!picking); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12 }}>
          <View style={{ flex: 1 }}><T kind="small">Opening</T><T style={{ fontFamily: font.semi }} numberOfLines={1}>{job.company}: {short(job.title)}</T></View>
          <T kind="small" style={{ color: c.foxDeep, fontFamily: font.bold }}>{picking ? "Close" : "Change"}</T>
        </Pressable>}
        {picking && <Group>{jobs.map((j, i) => <Row key={j.id} first={i === 0} title={j.company} sub={j.title} testID="row-mock-job"
          right={j.id === job.id ? <Icon name="check" size={18} color={c.fox} /> : undefined} onPress={() => { tap(); setPick(j.id); setPicking(false); }} />)}</Group>}
        {planned ? <>
          <T kind="small">{planned.questions.length} questions, about {Math.round(planned.questions.length * 1.8)} minutes. You type your answers.</T>
          <View testID="mock-plan" style={{ gap: 8 }}>{planned.questions.map((x, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ fontFamily: font.bold, color: c.mutedText, width: 18 }}>{i + 1}</Text>
              <View style={{ flex: 1 }}><Text style={kick(c)}>{KIND[x.kind]}</Text><T kind="small" style={{ color: c.ink }}>{x.q}</T></View>
            </View>))}</View>
        </> : <T kind="small">{!mine.length ? "This is your top match until you save or apply to an opening. " : ""}I'll write 6 to 8 questions from {job.company}'s posting and your own resume{ready ? ", stories" : ""}{w.pitch?.text ? " and pitch" : ""}, including a short work task if the job calls for one.</T>}
      </View>
      {!planned && <View style={card}>
        <Text style={kick(c)}>How should I run it?</Text>
        <Segmented testID="mock-mode" value={mode} onChange={(m) => { tap(); setMode(m); }} options={[{ key: "coach", label: "Coach me" }, { key: "real", label: "Real thing" }]} />
        <T kind="small">{mode === "coach" ? "A quick take after each answer, then the next question." : "Remy asks out loud, no hints. Your scorecard comes at the end."}</T>
      </View>}
      {!planned && <View style={card}>
        <Text style={kick(c)}>What I'll listen for</Text>
        {listenFor(profile).map((x, i) => (
          <View key={x.label} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T kind="small" style={{ color: c.ink, fontFamily: font.semi }}>{x.label}</T><T kind="small">{i === 0 && x.weight > 17 ? "biggest part" : "big part"}</T></View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2 }}><View style={{ width: `${Math.min(95, x.weight * 3)}%`, height: 6, borderRadius: 3, backgroundColor: c.fox }} /></View>
          </View>))}
        <T kind="small">I never grade your accent, nerves or how you look.</T>
      </View>}
      {planned
        ? <Button testID="button-start-mock" label={planned.answers.length ? "Pick up where you left off" : "Start the interview"} icon="arrow" flex
            onPress={() => { tap(); setView({ id: planned.id, qi: planned.answers.length ? Math.min(planned.questions.length - 1, Math.max(...planned.answers.map((a) => a.qi)) + 1) : 0, fb: false }); }} />
        : <Button testID="button-plan-mock" label={busy ? "Writing your questions…" : "Plan my interview"} icon="arrow" busy={busy} onPress={() => plan()} flex />}
      <T kind="small" style={{ textAlign: "center" }}>{planned ? (planned.source === "ai" ? "Remy rates each answer" : "Questions from the posting · no rating") : left ? `Uses 1 of your ${left} left this week` : "AI interviews are used up this week: questions from the posting, no rating"}</T>
    </>}
    {last && <Button testID="button-last-practice" kind="ghost" label={`Last practice: ${last.company} · see it`} onPress={() => setView({ id: last.id, qi: last.questions.length, fb: false })} />}
    <Button testID="button-interview-kit" kind="ghost" label="Stories, pitch and questions to expect" onPress={() => router.push("/prep" as any)} />
  </>);
}

const kick = (c: ReturnType<typeof useTheme>["c"]) => ({ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" as const, color: c.foxDeep });

function Quota({ left }: { left: number }) {
  const { c } = useTheme();
  return (
    <View testID="interview-quota" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {Array.from({ length: WEEKLY_AI_INTERVIEWS }, (_, i) => <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i < left ? c.fox : c.line }} />)}
      <T kind="small">{left} of {WEEKLY_AI_INTERVIEWS} AI interviews left this week</T>
    </View>
  );
}

/** One practice: the question, the answer, Remy's take, and the scorecard at the end. */
function Room({ iv, view, setView, setErr }: { iv: Interview; view: NonNullable<View_>; setView: (v: View_) => void; setErr: (s: string) => void }) {
  const { setWs } = useSession();
  const { c } = useTheme();
  const card = useCard();
  const n = iv.questions.length;
  const qi = Math.max(0, view.qi);
  const real = iv.mode === "real";
  const q = iv.questions[qi];
  // "Like the real thing": the interviewer asks out loud. Stops when the question changes or the screen closes.
  useEffect(() => { if (!real || !q || view.fb || !canSpeak()) return; say(q.q, () => {}).catch(() => {}); return () => hush(); }, [qi, view.fb]);
  if (qi >= n) return <Scorecard iv={iv} again={() => setView(null)} practice={(i, fb) => setView({ id: iv.id, qi: i, fb: !!fb })} />;
  const a = iv.answers.find((x) => x.qi === qi);
  const next = async (to: number) => {
    setErr("");
    if (to >= n) { try { setWs(await api<Workspace>("POST", `/api/interviews/${iv.id}/finish`)); } catch (e: any) { setErr(e.message); return; } }
    setView({ id: iv.id, qi: to, fb: false });
  };
  if (view.fb && a) return <Take iv={iv} a={a} retry={() => setView({ ...view, fb: false })} next={() => next(qi + 1)} />;
  return (
    <View testID="mock-room" style={card}>
      <View accessibilityLabel={`Question ${qi + 1} of ${n}`} style={{ flexDirection: "row", gap: 4 }}>{iv.questions.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < qi ? c.sage : i === qi ? c.fox : c.line }} />)}</View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text style={[kick(c), { flex: 1 }]} numberOfLines={2}>{KIND[q.kind]} · {qi + 1} of {n}</Text>
        <HearIt text={q.q} testID="button-read-aloud" />
      </View>
      {!!q.from && <T kind="small">{q.kind === "resume" ? "Your line" : "From the posting"}: “{q.from}”</T>}
      <Text testID="mock-question" style={{ fontFamily: font.display, fontSize: 22, lineHeight: 28, color: c.ink }}>“{q.q}”</Text>
      {q.table && <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: "hidden" }}>
        <T kind="small" style={{ padding: 8 }}>Practice material · made up for this exercise</T>
        {q.table.map((r, i) => <View key={i} style={{ flexDirection: "row", borderTopWidth: 1, borderColor: c.line, backgroundColor: i === 0 ? c.surface2 : undefined }}>
          {r.map((cell, k) => <Text key={k} style={{ flex: 1, padding: 6, fontFamily: i === 0 ? font.bold : font.body, fontSize: 12.5, color: c.ink }}>{cell}</Text>)}</View>)}
      </View>}
      <Answer key={`${iv.id}-${qi}-${a?.at || ""}`} initial={a?.text || ""} hint={real ? undefined : q.hint} last={qi === n - 1}
        onSend={async (text, secs, fillers) => {
          setErr("");
          try { setWs(await api<Workspace>("POST", `/api/interviews/${iv.id}/answer`, { qi, text, secs, fillers })); } catch (e: any) { setErr(e.message); return; }
          success();
          if (real) await next(qi + 1); else setView({ ...view, qi, fb: true });
        }} skip={() => next(qi + 1)} stop={() => setView(null)} />
    </View>
  );
}

/** Type the answer; nothing is sent until "Send my answer". The clock starts at the first letter, like the mic's timer. */
function Answer({ initial, hint, onSend, skip, stop, last }: { initial: string; hint?: string; onSend: (text: string, secs: number, fillers: number) => Promise<void>; skip: () => void; stop: () => void; last: boolean }) {
  const [text, setText] = useState(initial);
  const [t0, setT0] = useState(0);
  const [sending, setSending] = useState(false);
  const send = async () => {
    const secs = t0 ? Math.round((Date.now() - t0) / 1000) : 0;
    setSending(true); await onSend(text.trim(), secs, speechFeedback(text, secs || 1).fillers.length); setSending(false);
  };
  return (
    <View style={{ gap: 10 }}>
      <Input testID="input-mock-answer" value={text} onChangeText={(v) => { if (!t0) setT0(Date.now()); setText(v); }} placeholder="Your answer…" multiline style={{ minHeight: 120 }} accessibilityLabel="Your answer" />
      {!!hint && <T kind="small">Hint: {hint}</T>}
      <Button testID="button-send-answer" label={sending ? "Remy's listening back…" : "Send my answer"} icon="arrow" busy={sending} disabled={!text.trim()} onPress={send} flex />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button testID="button-mock-next" kind="ghost" label={last ? "Finish" : "Skip"} onPress={skip} flex />
        <Button testID="button-mock-stop" kind="ghost" label="End" onPress={stop} flex />
      </View>
    </View>
  );
}

/** Remy's take on one answer (coach mode): what landed, one fix, and what he heard per skill. */
function Take({ iv, a, retry, next }: { iv: Interview; a: IvAnswer; retry: () => void; next: () => void }) {
  const { c } = useTheme();
  const card = useCard();
  const q = iv.questions[a.qi];
  const ids = [...new Set([...q.criteria, ...a.ratings.map((r) => r.criterion)])].slice(0, 5);
  return <>
    <View testID="mock-tip" style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Remy size={40} icon /><Text style={[kick(c), { flex: 1 }]}>My take on question {a.qi + 1}</Text></View>
      {a.landed && <View style={{ gap: 4 }}><T kind="label">What landed</T><T style={{ fontFamily: font.semi }}>“{a.landed.quote}”</T><T kind="small">{a.landed.why}</T></View>}
      {a.sharpen && <View style={{ gap: 4 }}><T kind="label">Sharpen this</T><T kind="small"><Text style={{ fontFamily: font.bold, color: c.ink }}>{a.sharpen.title}</Text>{a.sharpen.example ? ` “${a.sharpen.example}”` : ""}</T></View>}
      {!a.landed && !a.sharpen && <T kind="small">{iv.source === "ai" ? "I couldn't rate this one, but it's saved. A longer answer with one real example gives me more to go on." : `Saved. ${a.secs ? `${a.secs} seconds, ` : ""}${a.fillers} filler word${a.fillers === 1 ? "" : "s"}. My ratings need AI, which isn't on for this practice.`}</T>}
      <Button testID="button-mock-next" label={a.qi === iv.questions.length - 1 ? "See my scorecard" : "Next question"} icon="arrow" onPress={next} flex />
      <Button testID="button-mock-retry" kind="ghost" label={`Try it again${a.sharpen ? " with that" : ""}`} icon="undo" onPress={retry} flex />
    </View>
    {iv.source === "ai" && <View style={card}>
      <T kind="label">What I heard in this answer</T>
      {ids.map((id) => { const r = a.ratings.find((x) => x.criterion === id); return (
        <View key={id} style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><T kind="small" style={{ flex: 1, color: c.ink, fontFamily: font.semi }}>{CRITERIA[id].label}</T><T kind="small" style={{ fontFamily: font.bold, color: r && r.level >= 3 ? c.sage : c.mutedText }}>{r ? LEVEL_WORD[r.level] : "Not heard yet"}</T></View>
          <T kind="small">{r ? r.note || `“${r.quote}”` : "Another question covers this. It's not a low score."}</T>
        </View>); })}
      <T kind="small">Every rating points to words you actually said.</T>
    </View>}
  </>;
}

function Scorecard({ iv, again, practice }: { iv: Interview; again: () => void; practice: (qi: number, fb?: boolean) => void }) {
  const { ws } = useSession();
  const { c } = useTheme();
  const card = useCard();
  const sc = scoreInterview(iv);
  const runs = (ws!.interviews || []).filter((x) => x.finishedAt && x.jobId === iv.jobId);
  const prev = runs.filter((x) => x.startedAt < iv.startedAt).map((x) => scoreInterview(x).overall).filter((x): x is number => x !== null).pop();
  const ready = sc.dims.filter((d) => !d.expert && d.level >= 3).length, counted = sc.dims.filter((d) => !d.expert).length;
  const strongest = [...sc.dims].filter((d) => d.score !== null).sort((x, y) => y.score! - x.score!)[0];
  return <View testID="mock-score" style={{ gap: 14 }}>
    <T kind="muted"><Text style={{ fontFamily: font.bold, color: c.ink }}>{sc.answered ? `${sc.overall !== null && sc.overall >= 60 ? "Solid run" : "Good practice"} for ${iv.company}.` : "Nothing answered yet."}</Text> {strongest ? `${strongest.label} is your strongest part.` : ""}</T>
    <View style={card}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={kick(c)}>Scorecard · {short(iv.title)}</Text>
          <T kind="h2">{sc.answered} of {iv.questions.length} answered.{iv.source === "ai" && sc.answered ? ` Ready on ${ready} of ${counted} skills.` : ""}</T></View>
        {iv.source === "ai" && sc.overall !== null && <View style={{ alignItems: "flex-end" }}><Text testID="mock-overall" style={{ fontFamily: font.display, fontSize: 40, color: c.fox }}>{sc.overall}</Text>
          {prev !== undefined && <T kind="small">{sc.overall >= prev ? "up" : "down"} {Math.abs(sc.overall - prev)}</T>}</View>}
      </View>
      {iv.source === "ai" && sc.dims.map((d) => (
        <View key={d.dim} style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T kind="small" style={{ color: c.ink, fontFamily: font.semi }}>{d.label}</T><T kind="small">{d.score === null ? "Not heard yet" : LEVEL_WORD[d.level]}</T></View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2 }}><View style={{ width: `${d.score === null ? 0 : Math.max(6, d.score)}%`, height: 6, borderRadius: 3, backgroundColor: d.level >= 3 ? c.sage : c.fox }} /></View>
        </View>))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[[sc.avgSecs ? `${sc.avgSecs}s` : "–", "Average answer"], [String(sc.fillers), "Filler words"], [String(iv.retries), "Redone"]].map(([v, l]) => (
          <View key={l} style={{ flex: 1, backgroundColor: c.surface2, borderRadius: 12, padding: 10 }}><Text style={{ fontFamily: font.bold, fontSize: 17, color: c.ink }}>{v}</Text><T kind="small">{l}</T></View>))}
      </View>
    </View>
    <View testID="mock-next-step" style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Remy size={36} icon /><Text style={kick(c)}>{sc.next && iv.source === "ai" ? "Your one thing for next time" : "Next"}</Text></View>
      {sc.next && iv.source === "ai" ? <>
        <T kind="small"><Text style={{ fontFamily: font.bold, color: c.ink }}>{sc.next.level === null ? `I haven't heard “${sc.next.label.toLowerCase()}” yet.` : `${sc.next.label} was ${LEVEL_WORD[sc.next.level].toLowerCase()}.`}</Text> {sc.next.tip}</T>
        <Button testID="button-practice-one" label="Practice just that one" icon="arrow" onPress={() => practice(sc.next!.qi)} flex />
      </> : <T kind="small">{sc.answered < iv.questions.length ? "Answer the ones you skipped. Those are the questions that surprise you in the real interview." : "Turn hints off and do it once more before the real thing."}</T>}
    </View>
    {sc.best && <View style={card}><T kind="label">Your best line</T><T style={{ fontFamily: font.semi }}>“{sc.best.quote}”</T></View>}
    <Button testID="button-mock-again" label="Run it again" icon="undo" onPress={again} flex />
    <Button testID="button-mock-plan" kind="ghost" label="See every answer" onPress={() => practice(0, iv.mode === "coach" && iv.answers.some((a) => a.qi === 0))} flex />
  </View>;
}
