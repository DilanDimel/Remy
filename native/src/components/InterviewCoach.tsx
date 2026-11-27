import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Workspace } from "@shared/types";
import { drillsLeft, pickProfile, practiced, STAR_PARTS, starParts, WEEKLY_DRILLS, type Drill } from "@shared/interview";
import { CHECKS, COMMON, coachDone, isReady, KINDS, LESSON_NEXT, LESSON_TITLE, LESSONS, pitchParts, shortQ, STAR_LEGEND, starExample, STEPS, type Lesson, type Step } from "@shared/interviewCoach";
import { jobQuestions } from "@shared/jobInterview";
import { BANK, bankField, fieldLabel } from "@shared/questionBank";
import { PROFILES } from "@shared/interviewRubric";
import { hospitalFirst } from "@shared/employer";
import { Button, Group, Icon, Remy, Row, T, success, tap } from "@/components/ui";
import { AskRemyRow } from "@/components/AskRemyRow";
import { HearIt } from "@/components/HearIt";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// The interview coach, native (client/src/components/InterviewCoach.tsx; owners first, Nov 27): Learn, Build, Practice
// and Mock interviews, any step any time. Lesson words live in shared/interviewCoach.ts so both teach the same thing.
// Build opens the app's prep kit (app/prep.tsx); Mock interviews is app/interview.tsx's own mock.
type AnswerBox = (p: { initial: string; onSend: (text: string, secs: number, fillers: number) => Promise<void>; skip: () => void; stop: () => void; last: boolean }) => React.ReactElement;
const open = (s: Step | null) => { tap(); router.setParams({ step: s || "" } as any); };

function useCard() {
  const { c } = useTheme();
  return { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 } as const;
}
const kick = (c: ReturnType<typeof useTheme>["c"]) => ({ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" as const, color: c.foxDeep });

export function Stepper({ step }: { step: Step | null }) {
  const { ws } = useSession();
  const { c } = useTheme();
  const done = coachDone(ws!);
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 6 }}>
      {STEPS.map((s, i) => { const on = step === s.id; return (
        <Pressable key={s.id} testID={`coach-step-${s.id}`} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => open(s.id)}
          style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.line, backgroundColor: c.surface }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: done[s.id] ? c.sageBg : on ? c.fox : c.surface2 }}>
            {done[s.id] ? <Icon name="check" size={14} color={c.sage} /> : <Text style={{ fontFamily: font.bold, fontSize: 12, color: on ? c.onFox : c.ink }}>{i + 1}</Text>}
          </View>
          <Text style={{ fontFamily: font.semi, fontSize: 12, lineHeight: 15, color: c.ink, textAlign: "center" }}>{s.label}</Text>
        </Pressable>); })}
    </View>
  );
}

export function Coach({ step, Answer }: { step: Step | null; Answer: AnswerBox }) {
  return <>
    <Stepper step={step} />
    {!step && <Home />}
    {step === "learn" && <Learn />}
    {step === "build" && <Build />}
    {step === "practice" && <Practice Answer={Answer} />}
  </>;
}

function Home() {
  const w = useSession().ws!;
  const { c } = useTheme();
  const card = useCard();
  const done = coachDone(w);
  const next = STEPS.find((s) => !done[s.id]) || STEPS[3];
  const what: Record<Step, [string, string, string]> = {
    learn: ["Three lessons, about 4 minutes", "What interviewers really ask, the STAR way to tell a story, and the 30-second pitch. Each ends with one quick check.", "Start lesson 1"],
    build: ["Your 30-second pitch and 4 stories, from your resume", "I draft only from facts on your resume and ask you for the parts I can't know. You change any words.", "Build my pitch"],
    practice: ["Practice the questions you'll get", "One question at a time: what everyone gets asked, then your field, then your saved postings. One fix after each answer.", "Practice a question"],
    mock: ["A mock interview for each company", "I interview you like the company would, from its posting, then give you a scorecard.", "Pick a company"],
  };
  const [h, p, b] = what[next.id];
  const ready = (w.stories || []).filter(isReady).length, mocks = (w.interviews || []).filter((x) => x.finishedAt).length, learned = (w.coach?.learned || []).length;
  const rows: [string, string, boolean][] = [
    ["Lessons", `${learned} of 3`, learned >= 3], ["30-second pitch", w.pitch?.text ? "Ready" : "Not yet", !!w.pitch?.text],
    ["Interview stories", `${ready} of 4 ready`, ready >= 4], ["Practice answers", `${(w.drills || []).filter(practiced).length} with all four parts`, done.practice],
    ["Mock interviews", mocks ? `${mocks} done` : "None yet", mocks > 0],
  ];
  return <>
    <View testID="coach-next" style={card}>
      <Text style={kick(c)}>Up next · Step {STEPS.indexOf(next) + 1}, {next.label}</Text>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Remy size={56} icon /><T kind="h2" style={{ flex: 1 }}>{h}</T></View>
      <T kind="small">{p}</T>
      <Button testID="button-coach-next" label={b} icon="arrow" onPress={() => open(next.id)} flex />
    </View>
    <View testID="coach-built" style={card}>
      <T kind="label">What you've built</T>
      {rows.map(([a, v, ok]) => <View key={a} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><T kind="small" style={{ color: c.ink }}>{a}</T><T kind="small" style={{ fontFamily: font.bold, color: ok ? c.sage : c.mutedText }}>{v}</T></View>)}
    </View>
    <AskRemyRow asks={["What happens in a real interview?", "Where should I start?"]} />
  </>;
}

function Learn() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const card = useCard();
  const w = ws!;
  const learned = w.coach?.learned || [];
  const [at, setAt] = useState(Math.max(0, LESSONS.findIndex((l) => !learned.includes(l))));
  const [pick, setPick] = useState<number | null>(null);
  const lesson: Lesson = LESSONS[at];
  const check = CHECKS[lesson];
  const major = w.profile.major || w.profile.targetRoles;
  const choose = async (i: number) => {
    tap(); setPick(i);
    if (i !== check.right || learned.includes(lesson)) return;
    success();
    try { setWs(await api<Workspace>("PUT", "/api/ws/coach", { value: { learned: [...learned, lesson] } })); } catch { /* the lesson still reads as passed on screen */ }
  };
  const move = (n: number) => { tap(); setPick(null); if (n >= LESSONS.length) open("build"); else setAt(n); };
  const tint = [c.blueBg, c.lav, c.amberBg, c.sageBg];
  const ok = pick === check.right || (pick === null && learned.includes(lesson));
  const [who, ...lines] = starExample(major);
  const parts = pitchParts(major, w.profile.classYear);
  return (
    <View testID={`lesson-${lesson}`} style={card}>
      <Text style={kick(c)}>Step 1 · Learn · Lesson {at + 1} of 3</Text>
      <T kind="h2">{LESSON_TITLE[lesson]}</T>
      {lesson === "asks" && KINDS.map(([t, e, k]) => (
        <View key={t} style={{ backgroundColor: c.surface2, borderRadius: 14, padding: 12, gap: 4 }}>
          <T style={{ fontFamily: font.bold }}>{t}</T><T kind="small" style={{ color: c.ink }}>{e}</T><T kind="small"><Text style={{ fontFamily: font.bold }}>It checks:</Text> {k}</T>
        </View>))}
      {lesson === "star" && <>
        <T kind="small">The interviewer asks: <Text style={{ fontFamily: font.bold, color: c.ink }}>“Tell me about a time you solved a problem.”</Text> Example from {who}.</T>
        {lines.map((t, i) => (
          <Pressable key={i} testID={`star-line-${i}`} accessibilityRole="button" onPress={() => choose(i)}
            style={{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: tint[i], borderRadius: 12, padding: 12, borderWidth: 2, borderColor: pick === i ? (i === 3 ? c.sage : c.error) : "transparent" }}>
            <Text style={{ fontFamily: font.bold, color: c.ink, width: 14 }}>{"STAR"[i]}</Text><T kind="small" style={{ flex: 1, color: c.ink }}>{t}</T>
          </Pressable>))}
        {STAR_LEGEND.map(([l, t]) => <T key={l} kind="small"><Text style={{ fontFamily: font.bold, color: c.ink }}>{l}</Text>  {t}</T>)}
      </>}
      {lesson === "pitch" && <>
        {parts.map(([l, t]) => <View key={l} style={{ gap: 2, borderBottomWidth: 1, borderColor: c.line, paddingBottom: 8 }}><T kind="small" style={{ fontFamily: font.bold }}>{l}</T><T style={{ color: c.ink }}>{t}</T></View>)}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><HearIt text={parts.map((p) => p[1]).join(" ")} testID="button-hear-pitch" /><T kind="small" style={{ flex: 1 }}>An example. You'll build yours from your resume next.</T></View>
      </>}
      <View testID="lesson-check" style={{ backgroundColor: c.foxSoft, borderRadius: 14, padding: 12, gap: 8 }}>
        <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>Quick check.</Text> {check.q}</T>
        {check.opts.map((o, i) => <Button key={o} testID={`check-${i}`} kind={pick === i && i === check.right ? "ink" : "ghost"} label={o} onPress={() => choose(i)} flex />)}
        {pick !== null && <T kind="small" style={{ color: c.ink }}>{pick === check.right ? `Yes. ${check.why}` : "Not quite. Try another one."}</T>}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {at > 0 && <Button testID="button-lesson-back" kind="ghost" label="Back" onPress={() => move(at - 1)} />}
        <Button testID="button-lesson-next" kind={ok ? "ink" : "ghost"} label={LESSON_NEXT[at]} icon="arrow" onPress={() => move(at + 1)} flex />
      </View>
    </View>
  );
}

function Build() {
  const w = useSession().ws!;
  const { c } = useTheme();
  const card = useCard();
  const ready = (w.stories || []).filter(isReady).length;
  return <>
    <View testID="coach-build" style={card}>
      <Text style={kick(c)}>Step 2 · Build</Text>
      <T kind="h2">Your pitch first, then your stories</T>
      <T kind="small">I only use facts from your resume and ask you for the rest. 4 stories answer most “tell me about a time” questions.</T>
    </View>
    <Group>
      <Row first testID="build-tab-pitch" title="30-second pitch" sub={w.pitch?.text ? "Ready" : "Start here"} onPress={() => router.push({ pathname: "/prep", params: { tab: "pitch" } } as any)} />
      <Row testID="build-tab-stories" title="Interview stories" sub={`${ready} of 4 ready`} onPress={() => router.push({ pathname: "/prep", params: { tab: "stories" } } as any)} />
    </Group>
    {!!w.pitch?.text && ready >= 4 && <Button testID="button-build-next" label="Next: practice" icon="arrow" onPress={() => open("practice")} flex />}
  </>;
}

function Practice({ Answer }: { Answer: AnswerBox }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const card = useCard();
  const w = ws!;
  // The website's useInterviewJobs, short: openings they're applying to, then the ones they kept.
  const ids = [...new Set([...w.applications.map((a) => a.jobId), ...w.savedJobIds])];
  const jobs = ids.map((id) => w.jobs.find((j) => j.id === id)).filter((j): j is NonNullable<typeof j> => !!j && j.kind !== "event").map(hospitalFirst);
  const [pickJob, setPickJob] = useState(0);
  const job = jobs[pickJob];
  const profile = job ? pickProfile(job) : "generic";
  const field = job ? bankField(job.title, profile) : "generic";
  const groups = [
    { label: "Everyone gets asked", qs: COMMON.slice(0, 5).map((x) => x.q) },
    ...(field !== "generic" ? [{ label: `For ${fieldLabel(field, PROFILES[profile].label)} roles`, qs: BANK[field].filter((b) => b.kind === "story").slice(0, 3).map((b) => b.q) }] : []),
    ...(job ? [{ label: `From ${job.company}'s posting`, qs: jobQuestions(job, w.resume?.doc).slice(1, -1).slice(0, 4).map((x) => x.q) }] : []),
  ].filter((g) => g.qs.length);
  const all = [...new Set(groups.flatMap((g) => g.qs))];
  const [q, setQ] = useState(all[0] || "");
  const [take, setTake] = useState(false);
  const [list, setList] = useState(false);
  const [err, setErr] = useState("");
  const drill = (w.drills || []).find((d) => d.q === q);
  const nextQ = () => { setQ(all[(all.indexOf(q) + 1) % all.length]); setTake(false); };
  return <>
    <View style={card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text style={[kick(c), { flex: 1 }]}>Practice · {drillsLeft(w.drills)} of {WEEKLY_DRILLS} rated answers left this week</Text>
        <HearIt text={q} testID="button-read-aloud" />
      </View>
      <Text testID="practice-q" style={{ fontFamily: font.display, fontSize: 22, lineHeight: 28, color: c.ink }}>“{q}”</Text>
      <Button testID="button-practice-list" kind="ghost" label={list ? "Close the list" : "Pick another question"} onPress={() => { tap(); setList(!list); }} flex />
      {list && <>
        {jobs.length > 1 && <Button testID="select-practice-job" kind="ghost" label={`For ${job.company} · change`} onPress={() => { setPickJob((pickJob + 1) % jobs.length); }} flex />}
        {groups.map((g) => <View key={g.label} style={{ gap: 4 }}><T kind="label">{g.label}</T>
          <Group>{g.qs.map((x, i) => { const d = (w.drills || []).find((y) => y.q === x); return (
            <Row key={x} first={i === 0} testID="practice-question" title={shortQ(x)} right={d && practiced(d) ? <Icon name="check" size={18} color={c.sage} /> : x === q ? <Icon name="arrow" size={16} color={c.fox} /> : undefined}
              onPress={() => { setQ(x); setTake(false); setList(false); }} />); })}</Group></View>)}
      </>}
      {!take && <Answer key={q + (drill?.at || "")} initial="" last={false} skip={nextQ} stop={() => open(null)} onSend={async (text, secs, fillers) => {
        setErr("");
        try { setWs(await api<Workspace>("POST", "/api/interviews/drill", { q, text, secs, fillers, jobId: job?.id })); success(); setTake(true); } catch (e: any) { setErr(e.message); }
      }} />}
      {take && drill && <T kind="small">You said{drill.secs ? ` (${drill.secs} seconds)` : ""}: “{drill.text.length > 220 ? drill.text.slice(0, 220) + "…" : drill.text}”</T>}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    </View>
    {take && drill ? <DrillTake d={drill} again={() => setTake(false)} next={nextQ} /> : (
      <View testID="practice-listen" style={card}>
        <T kind="label">I listen for all four parts</T>
        <Meter parts={STAR_PARTS.map(([id, label]) => ({ id, label, state: "missing" as const }))} plain />
        <T kind="small">Hear all four and this question gets a check. About a minute is plenty.</T>
      </View>)}
  </>;
}

function Meter({ parts, plain }: { parts: { id: string; label: string; state: "heard" | "thin" | "missing" }[]; plain?: boolean }) {
  const { c } = useTheme();
  return (
    <View testID="star-meter" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {parts.map((p) => <View key={p.id} style={{ flexBasis: "47%", flexGrow: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, backgroundColor: p.state === "heard" ? c.sageBg : p.state === "thin" ? c.amberBg : "transparent", borderWidth: p.state === "missing" ? 1 : 0, borderColor: c.line, borderStyle: "dashed" }}>
        <Text style={{ fontFamily: font.bold, fontSize: 12, color: p.state === "heard" ? c.sage : p.state === "thin" ? c.amber : c.mutedText }}>{p.label}{plain ? "" : p.state === "heard" ? " ✓" : p.state === "thin" ? " · thin" : " · missing"}</Text>
      </View>)}
    </View>
  );
}

function DrillTake({ d, again, next }: { d: Drill; again: () => void; next: () => void }) {
  const { c } = useTheme();
  const card = useCard();
  return (
    <View testID="practice-take" style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><T style={{ fontFamily: font.bold }}>What I heard</T><T kind="small">{d.secs ? `${d.secs} s · ` : ""}{d.fillers} filler word{d.fillers === 1 ? "" : "s"}{d.tries > 1 ? ` · try ${d.tries}` : ""}</T></View>
      {d.ratings.length > 0 && <Meter parts={starParts(d.ratings)} />}
      {d.landed && <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>What landed:</Text> “{d.landed.quote}” {d.landed.why}</T>}
      {d.sharpen && <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>One fix:</Text> {d.sharpen.title}{d.sharpen.example ? ` Try: “${d.sharpen.example}”` : ""}</T>}
      {!d.ratings.length && !d.sharpen && <T kind="small">Saved. I couldn't rate this one, but a longer answer with one real example gives me more to go on.</T>}
      <Button testID="button-drill-again" label="Try again" icon="undo" onPress={again} flex />
      <Button testID="button-drill-next" kind="ghost" label="Next question" onPress={next} flex />
    </View>
  );
}
