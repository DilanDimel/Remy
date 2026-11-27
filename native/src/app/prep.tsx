import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Story, StoryPart, Workspace } from "@shared/types";
import { otherExperience, STORY_ASK, STORY_PARTS } from "@shared/stories";
import { fieldExample } from "@shared/fields";
import { jobQuestions } from "@shared/jobInterview";
import { hospitalFirst } from "@shared/employer";
import { Button, Group, Icon, Remy, Row, Segmented, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { AskRemyRow } from "@/components/AskRemyRow";
import { HearIt } from "@/components/HearIt";
import { api } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { useJobs } from "@/lib/jobs";
import { useOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// The interview prep kit, native (it opened the website's /interview): interview stories (client/src/components/StoryDeck.tsx,
// Remy asks one question at a time for the parts the resume doesn't say), the 30-second pitch (PitchCard.tsx) and the
// questions a saved opening will likely ask (JobInterview.tsx). The website's "practice out loud" listens with the
// browser's speech recognition; here a timer shows the length against the goal, and Hear it reads the words back.
const LABEL: Record<StoryPart, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };
type Tab = "stories" | "pitch" | "questions";

export default function Prep() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { ws } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>((["stories", "pitch", "questions"] as Tab[]).includes(params.tab as Tab) ? (params.tab as Tab) : "stories");
  if (!ws) return null;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView testID="interview-kit" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
        <AskRemyRow asks={["How do I answer “tell me about yourself”?", "What should I ask the interviewer?"]} />
        <Segmented testID="kit-tab" value={tab} onChange={(t) => { tap(); setTab(t); }} options={[{ key: "stories", label: "Stories" }, { key: "pitch", label: "Pitch" }, { key: "questions", label: "Questions" }]} />
        {tab === "stories" ? <Stories /> : tab === "pitch" ? <Pitch /> : <Questions />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useCard() {
  const { c } = useTheme();
  return { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 } as const;
}

/** Time yourself: the length against the goal, in place of the website's listening practice. */
function Timer({ goal, label = "Time yourself", text }: { goal: [number, number]; label?: string; text?: string }) {
  const { c } = useTheme();
  const [start, setStart] = useState(0);
  const [secs, setSecs] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => { if (!start) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [start]);
  const live = start ? Math.round((now - start) / 1000) : 0;
  const shown = start ? live : secs;
  const verdict = secs === null || start ? "" : secs < goal[0] ? `A bit short: aim for ${goal[0]} to ${goal[1]} seconds.` : secs > goal[1] ? `A bit long: aim for ${goal[0]} to ${goal[1]} seconds.` : "Right length. Nice.";
  return (
    <View testID="practice-timer" style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Button testID="button-practice" kind={start ? "ink" : "ghost"} label={start ? "Stop" : label} icon={start ? undefined : "chat"} onPress={() => { tap(); if (start) { setSecs(Math.round((Date.now() - start) / 1000)); setStart(0); } else { setNow(Date.now()); setStart(Date.now()); } }} style={{ height: 40, paddingHorizontal: 16 }} />
        {shown !== null && <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.ink }}>{Math.floor(shown / 60)}:{String(shown % 60).padStart(2, "0")}</Text>}
        {!!text && <HearIt text={text} testID="button-practice-hear" />}
      </View>
      {!!verdict && <T kind="small" style={{ color: secs! >= goal[0] && secs! <= goal[1] ? c.sage : c.ink }}>{verdict}</T>}
      {!start && secs === null && <T kind="small">Say it out loud, the way you would to an interviewer. Aim for {goal[0]} to {goal[1]} seconds.</T>}
    </View>
  );
}

const doneCount = (st: Story) => STORY_PARTS.filter((p) => st[p]).length;

function Stories() {
  const { ws, setWs } = useSession();
  const { config } = useConfig();
  const owner = useOwnerView();
  const { c } = useTheme();
  const card = useCard();
  const stories = ws!.stories || [];
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [check, setCheck] = useState<{ key: string; text: string; other: string } | null>(null);
  const [err, setErr] = useState("");
  const all = stories.flatMap((st) => STORY_PARTS.filter((p) => !st[p]).map((part) => ({ st, part })));
  const key = (q: { st: Story; part: StoryPart }) => `${q.st.id}:${q.part}`;
  const order = [...all.filter((q) => q.st.id === focus), ...all.filter((q) => q.st.id !== focus)];
  const next = order.find((q) => !skipped.includes(key(q)));
  const nextKey = next ? key(next) : "";
  useEffect(() => { setText(""); setCheck(null); }, [nextKey]); // a draft never lands in another story
  const make = async () => { tap(); setBusy(true); setErr(""); try { setWs(await api<Workspace>("POST", "/api/ai/stories")); setSkipped([]); success(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const answer = async (skip: boolean, sure = false) => {
    if (!next || sending) return;
    tap();
    if (skip) { setSkipped((s) => [...s, key(next)]); return; }
    const other = sure ? undefined : otherExperience(text, next.st, next.part, ws!.resume?.doc);
    if (other) { setCheck({ key: key(next), text, other }); return; }
    setSending(true); setErr("");
    try { setWs(await api<Workspace>("POST", `/api/stories/${next.st.id}/part`, { part: next.part, text })); success(); setText(""); } catch (e: any) { setErr(e.message); }
    setSending(false);
  };
  const ready = stories.filter((st) => doneCount(st) === 4).length;
  const shown = stories.find((st) => st.id === open);
  return <>
    <View testID="story-deck" style={card}>
      <T kind="h2">Interview stories</T>
      <T kind="small">Interviewers ask “Tell me about a time when…”. Remy finds moments on your resume and asks a few short questions, so each becomes a one-minute story: what was going on, what you had to do, what you did, and what changed.</T>
      {stories.length > 0 && <T kind="small" style={{ color: c.ink, fontFamily: font.semi }}>{ready} of {stories.length} ready{all.length ? ` · ${all.length} question${all.length === 1 ? "" : "s"} left` : ""}</T>}
      <Button testID="button-make-stories" kind={stories.length ? "ghost" : "ink"} label={busy ? "Finding moments in your resume…" : stories.length ? "Rebuild (your answers are kept)" : "Build my interview stories"} icon="zap" busy={busy} disabled={!config?.ai.available} onPress={make} flex />
      {!config?.ai.available && <T kind="small">Remy's writing is resting right now. Try again in a little while.</T>}
      {!stories.length && owner && <View style={{ backgroundColor: c.surface2, borderRadius: 12, padding: 12, gap: 4 }}>
        <T style={{ fontFamily: font.semi }}>“Tell me about a time you led a team.”</T>
        {[["S", "A campus club needed a student ambassador program."], ["T", "I was asked to recruit the first 10 ambassadors."], ["A", "I ran two info sessions and a referral sign-up sheet."], ["R", "14 students joined, and the program runs again this spring."]].map(([k, v]) => <T key={k} kind="small"><Text style={{ fontFamily: font.bold, color: c.fox }}>{k} </Text>{v}</T>)}
      </View>}
    </View>
    {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}

    {stories.length > 0 && <View testID="story-thread" style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Remy size={36} icon /><Text style={{ flex: 1, fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: c.foxDeep }}>{next ? `${LABEL[next.part]} · ${next.st.title}` : "Remy"}</Text></View>
      {next ? <>
        <T style={{ fontFamily: font.semi }}>{next.st.asks?.[next.part] || STORY_ASK[next.part]}</T>
        <Input testID="input-story-answer" value={text} onChangeText={setText} placeholder="Type your answer in your own words…" multiline style={{ minHeight: 80 }} />
        {check && check.key === nextKey && check.text === text && <View testID="story-other-experience" style={{ gap: 8 }}>
          <T kind="small" style={{ color: c.ink }}>This sounds like your {check.other} experience. Is it about “{next.st.title}”? A story mixing two experiences is hard to tell in an interview.</T>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button testID="button-story-same" label="Yes, save it" onPress={() => answer(false, true)} flex />
            <Button testID="button-story-fix" kind="ghost" label="Let me fix it" onPress={() => setCheck(null)} flex />
          </View>
        </View>}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button testID="button-story-skip" kind="ghost" label="Skip" onPress={() => answer(true)} disabled={sending} flex />
          <Button testID="button-story-send" label="Send" busy={sending} disabled={text.trim().length < 8} onPress={() => answer(false)} flex />
        </View>
      </> : all.length ? <>
        <T kind="small">You skipped the rest for now.</T>
        <Button testID="button-ask-again" kind="ghost" label="Ask me again" onPress={() => setSkipped([])} />
      </> : <T kind="small" style={{ color: c.ink }}>All your stories have four parts. Open one below and tell it out loud.</T>}
    </View>}

    {stories.length > 0 && <Group>{stories.map((st, i) => { const n = doneCount(st); return (
      <Row key={st.id} first={i === 0} title={st.title} sub={n === 4 ? "Ready" : `${n} of 4 parts`} testID="story-card"
        right={n === 4 ? <Icon name="check" size={18} color={c.sage} /> : undefined}
        onPress={() => { tap(); setOpen(open === st.id ? null : st.id); if (n < 4) { setFocus(st.id); setSkipped((s) => s.filter((k) => !k.startsWith(st.id + ":"))); } }} />); })}</Group>}
    {shown && <StoryView st={shown} />}
  </>;
}

function StoryView({ st }: { st: Story }) {
  const card = useCard();
  const done = doneCount(st) === 4;
  return (
    <View testID="story-view" style={card}>
      <T kind="h2">{st.title}</T>
      {STORY_PARTS.map((p) => st[p] ? <PartRow key={p} st={st} part={p} /> : <T key={p} kind="small"><Text style={{ fontFamily: font.bold }}>{LABEL[p]}: </Text>Remy will ask you this above.</T>)}
      {done ? <Timer goal={[60, 120]} label="Tell it out loud" text={STORY_PARTS.map((p) => st[p]).join(" ")} /> : <T kind="small">Answer the rest above, then practice it out loud.</T>}
    </View>
  );
}

function PartRow({ st, part }: { st: Story; part: StoryPart }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [other, setOther] = useState<{ text: string; label: string } | null>(null);
  const [err, setErr] = useState("");
  const mine = !!st.mine?.includes(part);
  const save = async (value: string) => { tap(); setErr(""); try { setWs(await api<Workspace>("POST", `/api/stories/${st.id}/part`, { part, text: value })); setEditing(false); setText(""); } catch (e: any) { setErr(e.message); } };
  if (!editing) return (
    <View testID={`story-${part}`} style={{ gap: 2 }}>
      <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>{LABEL[part]}: </Text>{st[part]}</T>
      {mine && <Pressable testID={`button-edit-${part}`} onPress={() => { setText(st[part]); setEditing(true); }}><T kind="small" style={{ color: c.fox, fontFamily: font.bold }}>Your words · Edit</T></Pressable>}
    </View>
  );
  const sure = other?.text === text;
  return (
    <View style={{ gap: 6 }}>
      <Input testID={`input-story-${part}`} label={LABEL[part]} value={text} onChangeText={setText} multiline />
      {sure && <T kind="small" style={{ color: c.ink }}>This sounds like your {other!.label} experience. If it's really about “{st.title}”, press Yes, save it.</T>}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button testID={`button-save-${part}`} label={sure ? "Yes, save it" : "Save"} disabled={text.trim().length < 8} onPress={() => { const o = sure ? undefined : otherExperience(text, st, part, ws!.resume?.doc); if (o) setOther({ text, label: o }); else void save(text); }} flex />
        <Button testID={`button-cancel-${part}`} kind="ghost" label="Cancel" onPress={() => setEditing(false)} flex />
      </View>
      {mine && <Button testID={`button-clear-${part}`} kind="ghost" label="Clear my words" onPress={() => save("")} />}
    </View>
  );
}

function Pitch() {
  const { ws, setWs } = useSession();
  const { config } = useConfig();
  const owner = useOwnerView();
  const { c } = useTheme();
  const card = useCard();
  const w = ws!;
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState(w.pitch?.text || "");
  const [err, setErr] = useState("");
  useEffect(() => { setText(w.pitch?.text || ""); }, [w.pitch?.at]);
  const ex = fieldExample(w.profile.major || w.profile.targetRoles);
  const year = (w.profile.classYear || "").toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const make = async () => { tap(); setBusy(true); setErr(""); try { setWs(await api<Workspace>("POST", "/api/ai/pitch")); success(); } catch (e: any) { setErr(e.message); } setBusy(false); };
  const save = async () => { tap(); setSaving(true); setErr(""); try { setWs(await api<Workspace>("PUT", "/api/ws/pitch", { value: { text, at: new Date().toISOString() } })); success(); } catch (e: any) { setErr(e.message); } setSaving(false); };
  return (
    <View testID="pitch-card" style={card}>
      <T kind="h2">Your 30-second pitch</T>
      <T kind="small">For career fairs and coffee chats: hello, what you study, one real thing you did, what you want next. Remy writes it to be said out loud, using only facts from your resume and profile. Change any words so it sounds like you.</T>
      {owner && !w.pitch && !text && <View testID="pitch-example" style={{ backgroundColor: c.surface2, borderRadius: 12, padding: 12 }}>
        <T kind="small" style={{ color: c.ink }}>“Hi, I'm Jordan, a {[ex.subject, year].filter(Boolean).join(" ") || "student"}. This fall I {ex.did}. I'm looking for a {year === "senior" ? "full-time role" : "summer internship"}{ex.subject ? ` in ${ex.subject}` : ""}.”</T>
      </View>}
      <Button testID="button-make-pitch" kind={w.pitch ? "ghost" : "ink"} label={busy ? "Writing your pitch…" : w.pitch ? "Write it again" : "Draft my pitch"} icon="zap" busy={busy} disabled={!config?.ai.available} onPress={make} flex />
      {(w.pitch || text) ? <>
        <Input testID="input-pitch" value={text} onChangeText={setText} multiline maxLength={1200} style={{ minHeight: 140 }} accessibilityLabel="Your pitch" />
        <T kind="small" style={{ color: words > 90 ? c.foxDeep : c.mutedText }}>{words} words · about {Math.round(words / 2.5)} seconds spoken{words > 90 ? ", a bit long" : ""}</T>
        {!/\b(interested in|looking for|hoping to|want to|I'd love to|next (summer|year)|this summer)\b/i.test(text) && <T kind="small" style={{ color: c.foxDeep }}>Your pitch doesn't say what you want next. Add a line yourself, or add the roles you're interested in on your profile and write it again.</T>}
        <Button testID="button-save-pitch" kind="ghost" label="Save" busy={saving} disabled={text === (w.pitch?.text || "")} onPress={save} />
        <Timer goal={[25, 35]} text={text} />
      </> : null}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    </View>
  );
}

function Questions() {
  const { ws } = useSession();
  const { jobs: all, fits } = useJobs();
  const owner = useOwnerView();
  const { c } = useTheme();
  const card = useCard();
  const w = ws!;
  // The website's useInterviewJobs: applying first, then kept, else the best fits.
  const ids = [...new Set([...[...w.applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => a.jobId), ...w.savedJobIds])];
  const mine = ids.map((id) => w.jobs.find((j) => j.id === id)).filter((j): j is NonNullable<typeof j> => !!j && j.kind !== "event").map((j) => (owner ? hospitalFirst(j) : j));
  const best = all.filter((j) => j.kind !== "event" && !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false).sort((x, y) => (fits[y.id]?.score ?? 0) - (fits[x.id]?.score ?? 0)).slice(0, 8);
  const jobs = mine.length ? mine : best;
  const [pick, setPick] = useState("");
  const [picking, setPicking] = useState(false);
  const [i, setI] = useState(0);
  const job = jobs.find((j) => j.id === pick) || jobs[0];
  if (!job) return <View testID="job-interview" style={card}><T kind="h2">Questions for your next interview</T><T kind="small">Save an opening or start tailoring for one, and Remy lists the questions that job is likely to ask, from its own posting.</T></View>;
  const qs = jobQuestions(job, w.resume?.doc);
  const q = qs[Math.min(i, qs.length - 1)];
  return <>
    <View testID="job-interview" style={card}>
      <T kind="h2">Questions {job.company} will likely ask</T>
      <T kind="small">{!mine.length && "Top match for you until you save or tailor for an opening. "}Picked from the {job.title} posting. Answer out loud with your real stories.</T>
      {jobs.length > 1 && <Pressable testID="select-interview-job" accessibilityRole="button" onPress={() => { tap(); setPicking(!picking); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12 }}>
        <View style={{ flex: 1 }}><T kind="small">Opening</T><T style={{ fontFamily: font.semi }} numberOfLines={1}>{job.company}: {job.title}</T></View>
        <T kind="small" style={{ color: c.foxDeep, fontFamily: font.bold }}>{picking ? "Close" : "Change"}</T>
      </Pressable>}
      {picking && <Group>{jobs.map((j, n) => <Row key={j.id} first={n === 0} title={j.company} sub={j.title} testID="row-interview-job" right={j.id === job.id ? <Icon name="check" size={18} color={c.fox} /> : undefined} onPress={() => { tap(); setPick(j.id); setI(0); setPicking(false); }} />)}</Group>}
    </View>
    {q && <View testID="job-question-open" style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]}>
      <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: c.foxDeep }}>Question {Math.min(i, qs.length - 1) + 1} of {qs.length}</Text>
      <Text style={{ fontFamily: font.display, fontSize: 21, lineHeight: 27, color: c.ink }}>{q.q}</Text>
      <T kind="small">{q.why}</T>
      {!!q.line && <T kind="small" style={{ color: c.ink }}>Your line: “{q.line}”</T>}
      <T kind="small" style={{ color: c.ink }}>{q.tip}</T>
      <Timer key={q.q} goal={[45, 120]} label="Answer out loud" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {i > 0 && <Button testID="button-prev-question" kind="ghost" label="Back" onPress={() => { tap(); setI(i - 1); }} flex />}
        {i < qs.length - 1 && <Button testID="button-next-question" label="Next question" icon="arrow" onPress={() => { tap(); setI(i + 1); }} flex />}
      </View>
    </View>}
  </>;
}
