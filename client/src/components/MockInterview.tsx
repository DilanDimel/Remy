// Owners (Nov 23, Julio's interview coach in Remy): Remy designs a mock interview from the posting and your own resume,
// stories and pitch, asks one question at a time, and rates each answer against the scoring guide with your own words
// as proof (server/coach/interview.ts, shared/interview.ts). "Coach me as we go" shows Remy's take after each answer;
// "Like the real thing" saves it all for the scorecard. Stories, pitch and the question list stay as the prep kit.
import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square, Volume2 } from "lucide-react";
import type { Workspace } from "@shared/types";
import { CRITERIA } from "@shared/interviewRubric";
import { LEVEL_WORD, listenFor, pickProfile, scoreInterview, weeklyLeft, WEEKLY_AI_INTERVIEWS, type Interview, type IvAnswer, type IvMode } from "@shared/interview";
import { jobQuestions } from "@shared/jobInterview";
import { STORY_PARTS } from "@shared/stories";
import { speechFeedback } from "@shared/speech";
import { micProblem } from "../lib/voice";
import { api, useStore } from "../lib/store";
import { replaceRoute, useRoute } from "../lib/router";
import { useInterviewJobs, JobInterview } from "./JobInterview";
import { StoryDeck } from "./StoryDeck";
import { PitchCard } from "./PitchCard";
import { QuickRate } from "./QuickRate";
import { Remy, Spinner } from "./common";

const KIND: Record<string, string> = { warmup: "Warm-up", posting: "From the posting", resume: "Your resume", work_sample: "Work sample", pressure: "Pressure", yours: "Your turn" };
const short = (t: string) => t.split(/ [-–(]|, /)[0];
type View = { id: string; qi: number; fb: boolean } | null;

export function MockInterview() {
  const { ws, setWs, run } = useStore();
  const w = ws!;
  const { mine, jobs: listed } = useInterviewJobs();
  // An opening picked from its card (/interview?job=<id>) joins the list even if it isn't saved.
  const [extra, setExtra] = useState("");
  const xj = extra && !listed.some((j) => j.id === extra) ? ws!.jobs.find((j) => j.id === extra) : undefined;
  const jobs = xj ? [xj, ...listed] : listed;
  const [pick, setPick] = useState("");
  const [mode, setMode] = useState<IvMode>("coach");
  const [view, setView] = useState<View>(null);
  const [busy, setBusy] = useState(false);
  const [kit, setKit] = useState<"stories" | "pitch" | "questions" | null>(location.hash === "#story-deck" ? "stories" : null); // Home links to /interview#story-deck
  const job = jobs.find((j) => j.id === pick) || jobs[0];
  const ivs = w.interviews || [];
  const iv = view ? ivs.find((x) => x.id === view.id) : undefined;
  const left = weeklyLeft(ivs);
  // A planned, not yet finished practice for this opening (from today) is picked up again instead of planning a new one.
  const planned = job ? [...ivs].reverse().find((x) => x.jobId === job.id && !x.finishedAt && Date.now() - Date.parse(x.startedAt) < 864e5) : undefined;

  const plan = async (jobId = job?.id) => {
    if (!jobId) return;
    setBusy(true);
    const next = await run(() => api<Workspace>("POST", "/api/interviews", { jobId, mode }));
    setBusy(false);
    if (next) setWs(next); // stays on the plan screen: the planned questions show with "Start the interview"
  };
  // Remy started it from chat or an offer ("give me a mock interview for Deloitte"): /interview?start=1&job=<id>.
  const { query } = useRoute();
  const start = query.get("start") === "1";
  const asked = query.get("job") || (start ? "*" : "");
  useEffect(() => {
    if (!asked) return;
    const known = asked !== "*" && w.jobs.some((j) => j.id === asked && j.kind !== "event");
    if (known) setExtra(asked);
    const id = known ? asked : job?.id;
    // Only Remy's "start" link plans right away; a card's link just picks the opening.
    if (id) { setPick(id); if (start) void plan(id); }
    replaceRoute("/interview");
  }, [asked]);

  if (iv && view) return <Room iv={iv} view={view} setView={setView} />;

  const stories = w.stories || [];
  const ready = stories.filter((s) => STORY_PARTS.every((p) => s[p]));
  const tracked = w.tracker.find((t) => t.status === "Interview");
  const last = [...ivs].reverse().find((x) => x.finishedAt);
  const profile = job ? pickProfile(job) : "generic";
  const kitTiles: { id: "stories" | "pitch" | "questions"; n: string; label: string; act: string }[] = [
    { id: "stories", n: stories.length ? `${ready.length} of ${stories.length} ready for “tell me about a time”` : "Your answers to “tell me about a time”", label: "Stories", act: !stories.length ? "Find my stories" : ready.length < stories.length ? "Finish one" : "Review" },
    { id: "pitch", n: w.pitch?.text ? "Ready · it's your warm-up answer" : "Not written yet · your warm-up answer", label: "30-second pitch", act: w.pitch?.text ? "Practice" : "Write it" },
    { id: "questions", n: `${job ? jobQuestions(job, w.resume?.doc).length : 0} from this posting, with your resume line for each`, label: "Questions to expect", act: "See them" },
  ];
  return (
    <div className="ivc" data-testid="mock-interview">
      <Head say={<><b>{tracked ? `You have an interview with ${tracked.company}.` : job ? `Your ${job.company} interview could come any week.` : "Interviews come fast once you apply."}</b> {job ? "I'll build this one from their posting and your resume, so it feels like the real thing." : "Save an opening and I'll interview you for it."}</>} left={left} />
      {!job ? (
        <section className="ivc-card stack-sm">
          <span className="ivc-kick">Mock interview</span>
          <h2 className="ivc-h2">Save an opening and I'll interview you for it</h2>
          <p className="small muted">I plan the questions from the posting itself, so the practice matches the real thing.</p>
        </section>
      ) : (
        <div className="ivc-grid">
          <section className="ivc-card">
            <div className="ivc-seat">
              <div className="ivc-fox"><Remy size={78} mood="think" /><small>Remy · your interviewer</small></div>
              <div className="stack-sm" style={{ minWidth: 0, gap: 6 }}>
                <span className="ivc-kick">Mock interview · {job.company} · {short(job.title)}</span>
                <h2 className="ivc-h2">I'll interview you like {job.company} would</h2>
                {jobs.length > 1 && (
                  <select className="input" style={{ width: "100%", minWidth: 0 }} value={job.id} onChange={(e) => setPick(e.target.value)} aria-label="Opening to interview for" data-testid="select-mock-job">
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.company}: {j.title}</option>)}
                  </select>
                )}
                {planned ? (
                  <>
                    <p className="xs muted" style={{ margin: 0 }}>{planned.questions.length} questions, about {Math.round(planned.questions.length * 1.8)} minutes. You answer out loud or type.</p>
                    <ol className="ivc-plan" data-testid="mock-plan">{planned.questions.map((x, i) => <li key={i}><small>{KIND[x.kind]}</small><span>{x.q}{x.table && <em>I'll hand you a short practice table, made up for this exercise</em>}</span></li>)}</ol>
                  </>
                ) : (
                  <p className="small" style={{ margin: 0 }} data-testid="mock-plan-pending">
                    {!mine.length ? "This is your top match until you save or apply to an opening. " : ""}
                    I'll write 6 to 8 questions from {job.company}'s posting and your own resume{ready.length ? ", stories" : ""}{w.pitch?.text ? " and pitch" : ""}, including a short work task if the job calls for one.
                  </p>
                )}
              </div>
            </div>
          </section>
          <div className="ivc-side">
            <section className="ivc-card">
              <p className="ivc-label">How should I run it?</p>
              <div className="ivc-modes" role="radiogroup" aria-label="Interview style">
                {([["coach", "Coach me as we go", "A quick take after each answer, then the next question."], ["real", "Like the real thing", "Remy asks out loud, no hints. Your scorecard comes at the end."]] as const).map(([m, t, d]) => (
                  <button key={m} role="radio" aria-checked={mode === m} className={"ivc-mode" + (mode === m ? " on" : "")} onClick={() => setMode(m)} data-testid={`mode-${m}`}><i /><span><b>{t}</b><span>{d}</span></span></button>
                ))}
              </div>
            </section>
            <section className="ivc-card ivc-hide-short">
              <p className="ivc-label">What I'll listen for{profile !== "generic" ? ` in a ${CRITERIA_LABEL(profile)} interview` : ""}</p>
              <div className="ivc-listen">{listenFor(profile).map((x, i) => <div key={x.label} className="ivc-sk"><span>{x.label}</span><small>{i === 0 && x.weight > 17 ? "biggest part" : "big part"}</small><span className="w"><b style={{ width: `${Math.min(95, x.weight * 3)}%` }} /></span></div>)}</div>
              <p className="xs muted" style={{ margin: "8px 0 0" }}>I never grade your accent, nerves or how you look.</p>
            </section>
            <div className="row" style={{ gap: 8 }}>
              {planned
                ? <button className="btn btn-primary" onClick={() => setView({ id: planned.id, qi: planned.answers.length ? Math.min(planned.questions.length - 1, Math.max(...planned.answers.map((a) => a.qi)) + 1) : 0, fb: false })} data-testid="button-start-mock"><Mic size={16} /> {planned.answers.length ? "Pick up where you left off" : "Start the interview"}</button>
                : <button className="btn btn-primary" onClick={() => plan()} disabled={busy} data-testid="button-plan-mock">{busy ? <Spinner /> : <Mic size={16} />} {busy ? "Writing your questions…" : "Plan my interview"}</button>}
              <span className="xs muted ivc-hide-phone">{planned ? (planned.source === "ai" ? "Remy rates each answer" : "Questions from the posting · no rating") : left ? `Uses 1 of your ${left} left` : "AI interviews are used up this week: questions from the posting, no rating"}</span>
            </div>
          </div>
        </div>
      )}
      <div className={"ivc-prep" + (planned ? " ivc-hide-phone" : "")} data-testid="interview-kit">
        {kitTiles.map((t) => (
          <div key={t.id} className={kit === t.id ? "on" : ""}><span><b>{t.label}</b><small>{t.n}</small></span>
            <button className="ivc-link" aria-expanded={kit === t.id} onClick={() => setKit(kit === t.id ? null : t.id)} data-testid={`kit-${t.id}`}>{kit === t.id ? "Close" : `${t.act} →`}</button></div>
        ))}
        {last && !kit && <div><span><b>Last practice</b><small>{new Date(last.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {last.company} · {scoreInterview(last).answered} of {last.questions.length} answered</small></span>
          <button className="ivc-link" onClick={() => setView({ id: last.id, qi: last.questions.length, fb: false })} data-testid="button-last-practice">See it →</button></div>}
      </div>
      {kit === "stories" && <StoryDeck />}
      {kit === "pitch" && <PitchCard />}
      {kit === "questions" && <JobInterview />}
    </div>
  );
}
const CRITERIA_LABEL = (p: string) => ({ banking: "banking", sales: "sales", quant: "quant", software: "software", design: "design", marketing: "marketing", cybersecurity: "security", consulting: "consulting", investment_research: "investing", accounting: "accounting", legal: "legal", manufacturing: "manufacturing", aerospace: "engineering", research: "research", healthcare: "clinical", education: "teaching", hospitality: "hospitality", public_policy: "policy" } as Record<string, string>)[p] || "job";

function Head({ say, left }: { say: React.ReactNode; left: number }) {
  return (
    <div className="ivc-head">
      <div style={{ minWidth: 0 }}><h1>Interview</h1><p className="ivc-say" data-testid="interview-line">{say}</p></div>
      <span className="ivc-quota" title="Mock interviews Remy designs and rates" data-testid="interview-quota">{Array.from({ length: WEEKLY_AI_INTERVIEWS }, (_, i) => <i key={i} className={i < left ? "" : "o"} />)}{left} of {WEEKLY_AI_INTERVIEWS} AI interviews left this week</span>
    </div>
  );
}

/** One practice: the question, your answer, Remy's take, and the scorecard at the end. */
function Room({ iv, view, setView }: { iv: Interview; view: NonNullable<View>; setView: (v: View) => void }) {
  const { ws, setWs, run } = useStore();
  const n = iv.questions.length;
  if (view.qi < 0) view = { ...view, qi: 0 };
  if (view.qi >= n) return <Scorecard iv={iv} again={() => setView(null)} practice={(qi, fb) => setView({ id: iv.id, qi, fb: !!fb })} />;
  const q = iv.questions[view.qi];
  const a = iv.answers.find((x) => x.qi === view.qi);
  const go = async (qi: number) => {
    if (qi >= n) { const next = await run(() => api<Workspace>("POST", `/api/interviews/${iv.id}/finish`)); if (next) setWs(next); }
    setView({ id: iv.id, qi, fb: false });
  };
  const head = view.fb && a
    ? <><b>{a.landed ? "Good. Here's my take." : "Answer saved."}</b> {a.sharpen ? "One fix and this answer is ready for the real thing." : "On to the next one when you're ready."}</>
    : <><b>Question {view.qi + 1} of {n}.</b> Take your time. Nothing is sent until you say so.</>;
  return (
    <div className="ivc" data-testid="mock-interview">
      <Head say={head} left={weeklyLeft(ws!.interviews)} />
      {view.fb && a ? <Take iv={iv} a={a} retry={() => setView({ ...view, fb: false })} next={() => go(view.qi + 1)} /> : (
        <section className="ivc-card" data-testid="mock-room">
          <div className="ivc-bar" aria-label={`Question ${view.qi + 1} of ${n}`}>{iv.questions.map((_, i) => <i key={i} className={i < view.qi ? "d" : i === view.qi ? "on" : ""} />)}</div>
          <div className="ivc-seat">
            <div className="ivc-fox"><Remy size={76} mood={a ? "happy" : "think"} /><small>Remy · interviewer</small></div>
            <div className="ivc-q">
              <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "nowrap" }}>
                <span className="ivc-kick">{KIND[q.kind]}{q.from ? ` · ${q.kind === "resume" ? "your line" : "from the posting"}: “${q.from}”` : ""}</span>
                <ReadAloud text={q.q} auto={iv.mode === "real"} />
              </div>
              <p className="ivc-ask" data-testid="mock-question">“{q.q}”</p>
              {q.table && <div className="ivc-material"><b>Practice material</b> <span className="xs muted">· made up for this exercise</span>
                <table><tbody>{q.table.map((r, i) => <tr key={i}>{r.map((c, k) => (i === 0 ? <th key={k}>{c}</th> : <td key={k}>{c}</td>))}</tr>)}</tbody></table></div>}
              <Answer key={`${iv.id}-${view.qi}-${a?.at || ""}`} initial={a?.text || ""} hint={iv.mode === "coach" ? q.hint : undefined} onSend={async (text, secs, fillers) => {
                const next = await run(() => api<Workspace>("POST", `/api/interviews/${iv.id}/answer`, { qi: view.qi, text, secs, fillers }));
                if (!next) return;
                setWs(next);
                if (iv.mode === "coach") setView({ ...view, fb: true }); else await go(view.qi + 1);
              }} skip={() => go(view.qi + 1)} stop={() => setView(null)} last={view.qi === n - 1} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const Speech = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

/** Say it or type it; what Remy heard stays editable, and nothing is sent until "Send my answer". */
function Answer({ initial, hint, onSend, skip, stop, last }: { initial: string; hint?: string; onSend: (text: string, secs: number, fillers: number) => Promise<void>; skip: () => void; stop: () => void; last: boolean }) {
  const [text, setText] = useState(initial);
  const [on, setOn] = useState(false);
  const [secs, setSecs] = useState(0);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const rec = useRef<any>(null);
  const base = useRef("");
  useEffect(() => { if (!on) return; const t = setTimeout(() => setSecs((s) => s + 1), 1000); return () => clearTimeout(t); }, [on, secs]);
  useEffect(() => () => { rec.current?.abort(); }, []);
  const listen = () => {
    if (on) { rec.current?.stop(); rec.current = null; setOn(false); return; }
    setOn(true); setProblem(null);
    if (!Speech) return;
    window.speechSynthesis?.cancel(); // don't transcribe Remy reading the question
    base.current = text ? text.trim() + " " : "";
    const r = new Speech();
    r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => setText(base.current + [...e.results].map((x: any) => x[0].transcript).join(" "));
    r.onerror = (e: any) => setProblem(micProblem(e.error));
    r.onend = () => setOn(false);
    rec.current = r;
    try { r.start(); } catch { setOn(false); rec.current = null; }
  };
  const fillers = speechFeedback(text, secs || 1).fillers.length;
  const send = async () => { rec.current?.stop(); setOn(false); setSending(true); await onSend(text.trim(), secs, fillers); setSending(false); };
  return (
    <div className="stack-sm" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className={"ivc-label" + (text && !problem ? " ivc-hide-phone" : "")} style={{ margin: 0 }} role={problem ? "alert" : undefined} data-testid="answer-mic-status">{problem ? problem : text ? "Here's what I heard. Fix anything I got wrong, then send it." : Speech ? "Tap the mic and answer out loud, or type." : "Type your answer (this browser can't hear you)."}</span>
        {(on || secs > 0) && <span className="ivc-live" data-testid="answer-timer">{on && <span className="ivc-wave" aria-hidden="true"><i /><i /><i /></span>}{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}{text ? ` · ${fillers} filler word${fillers === 1 ? "" : "s"}` : ""}</span>}
      </div>
      <textarea className="ivc-ans" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer…" aria-label="Your answer" data-testid="input-mock-answer" />
      <div className="row ivc-acts" style={{ gap: 8 }}>
        <button className="btn btn-primary" onClick={send} disabled={!text.trim() || sending} data-testid="button-send-answer">{sending ? <><Spinner /> Remy's listening back…</> : <>Send my answer →</>}</button>
        <button className={"btn " + (on ? "btn-secondary" : "btn-ghost")} onClick={listen} aria-label={on ? "Stop listening" : "Answer out loud"} data-testid="button-answer-mic">{on ? <><Square size={14} /> Stop</> : <><Mic size={14} /> <span className={text ? "ivc-hide-phone" : ""}>{text ? "Say more" : "Answer out loud"}</span></>}</button>
        <button className="btn btn-ghost" onClick={skip} data-testid="button-mock-next">{last ? "Finish" : "Skip"}</button>
        <button className="btn btn-ghost ivc-hide-phone" onClick={stop} data-testid="button-mock-stop">End</button>
        {hint && <span className="xs muted ivc-hint" data-testid="mock-hint">Hint: {hint}</span>}
      </div>
    </div>
  );
}

/** Reads the question out loud with the browser's voice (nothing leaves the browser beyond what it does itself). */
function ReadAloud({ text, auto }: { text: string; auto?: boolean }) {
  const ok = typeof window !== "undefined" && "speechSynthesis" in window;
  const { toast } = useStore();
  const [playing, setPlaying] = useState(false);
  const say = (fromClick: boolean) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 0.98;
    u.onstart = () => setPlaying(true);
    u.onend = () => setPlaying(false);
    // "interrupted"/"canceled" is us stopping it; an auto read the browser blocks before any click just stays quiet.
    u.onerror = (e) => { setPlaying(false); if (fromClick && e.error !== "interrupted" && e.error !== "canceled") toast("Your browser couldn't read this out loud. Check your sound is on, or try Chrome or Edge.", true); };
    speechSynthesis.speak(u);
  };
  // "Like the real thing": the interviewer asks out loud, as in Julio's voice interview. Stops when the question changes.
  useEffect(() => { if (!ok || !auto) return; say(false); return () => { speechSynthesis.cancel(); setPlaying(false); }; }, [text, auto]);
  useEffect(() => () => { if (ok) speechSynthesis.cancel(); }, []);
  if (!ok) return null;
  const stop = () => { speechSynthesis.cancel(); setPlaying(false); };
  return <button className="btn btn-ghost btn-sm" style={{ flex: "none" }} onClick={() => (playing ? stop() : say(true))} aria-pressed={playing} data-testid="button-read-aloud">{playing ? <><Square size={14} /> Stop</> : <><Volume2 size={14} /> Hear it</>}</button>;
}

/** Remy's take on one answer (coach mode): what landed, one fix, and what he heard per skill. */
function Take({ iv, a, retry, next }: { iv: Interview; a: IvAnswer; retry: () => void; next: () => void }) {
  const q = iv.questions[a.qi];
  const ids = [...new Set([...q.criteria, ...a.ratings.map((r) => r.criterion)])].slice(0, 5);
  return (
    <div className="ivc-grid" style={{ alignItems: "start" }}>
      <section className="ivc-card ivc-peach" data-testid="mock-tip">
        <div className="ivc-seat">
          <div className="ivc-fox"><Remy size={70} mood="happy" /><small>Remy</small></div>
          <div className="stack-sm" style={{ minWidth: 0, gap: 10 }}>
            <span className="ivc-kick">My take on question {a.qi + 1} · {KIND[q.kind].toLowerCase()}</span>
            {a.landed && <div><p className="ivc-label" style={{ marginBottom: 4 }}>What landed</p><p className="ivc-quote">“{a.landed.quote}”</p><p className="small" style={{ margin: "6px 0 0" }}>{a.landed.why}</p></div>}
            {a.sharpen && <div><p className="ivc-label" style={{ marginBottom: 4 }}>Sharpen this</p><p className="small" style={{ margin: 0 }}><b>{a.sharpen.title}</b>{a.sharpen.example ? ` “${a.sharpen.example}”` : ""}</p></div>}
            {!a.landed && !a.sharpen && <p className="small" style={{ margin: 0 }}>{iv.source === "ai" ? "I couldn't rate this one, but it's saved. A longer answer with one real example gives me more to go on." : `Saved. ${a.secs ? `${a.secs} seconds, ` : ""}${a.fillers} filler word${a.fillers === 1 ? "" : "s"}. My ratings need AI, which isn't on for this practice.`}</p>}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-primary" onClick={retry} data-testid="button-mock-retry"><RotateCcw size={14} /> Try it again{a.sharpen ? " with that" : ""}</button>
              <button className="btn btn-ghost" onClick={next} data-testid="button-mock-next">{a.qi === iv.questions.length - 1 ? "See my scorecard" : "Next question"} →</button>
            </div>
          </div>
        </div>
      </section>
      <section className="ivc-card ivc-hide-short">
        <p className="ivc-label">What I heard in this answer</p>
        <div className="ivc-checks">{ids.map((id) => {
          const r = a.ratings.find((x) => x.criterion === id);
          return (
            <div key={id} className={"ivc-check" + (r ? "" : " none")}>
              <span>{CRITERIA[id].label}</span>
              {r ? <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}><span className="ivc-dots">{[1, 2, 3, 4].map((l) => <i key={l} className={l <= r.level ? "f" : ""} />)}</span><b className={"ivc-lvl l" + r.level}>{LEVEL_WORD[r.level]}</b></span> : <b className="ivc-lvl">Not heard yet</b>}
              <small>{r ? r.note || `“${r.quote}”` : "Another question covers this. It's not a low score."}</small>
            </div>
          );
        })}</div>
        <p className="xs muted" style={{ margin: "8px 0 0" }}>Every rating points to words you actually said.</p>
      </section>
    </div>
  );
}

function Scorecard({ iv, again, practice }: { iv: Interview; again: () => void; practice: (qi: number, fb?: boolean) => void }) {
  const { ws } = useStore();
  const sc = scoreInterview(iv);
  const runs = (ws!.interviews || []).filter((x) => x.finishedAt && x.jobId === iv.jobId).slice(-6);
  const prev = runs.filter((x) => x.startedAt < iv.startedAt).map((x) => scoreInterview(x).overall).filter((x): x is number => x !== null).pop();
  const ready = sc.dims.filter((d) => !d.expert && d.level >= 3).length, counted = sc.dims.filter((d) => !d.expert).length;
  const strongest = [...sc.dims].filter((d) => d.score !== null).sort((x, y) => y.score! - x.score!)[0];
  return (
    <div className="ivc" data-testid="mock-score">
      <Head say={<><b>{sc.answered ? `${sc.overall !== null && sc.overall >= 60 ? "Solid run" : "Good practice"} for ${iv.company}.` : "Nothing answered yet."}</b> {strongest ? `${strongest.label} is your strongest part.` : ""} {sc.next ? "One skill to work on before the real one." : ""}</>} left={weeklyLeft(ws!.interviews)} />
      <div className="ivc-grid">
        <section className="ivc-card stack-sm" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap", gap: 12 }}>
            <div style={{ minWidth: 0 }}><span className="ivc-kick">Scorecard · {iv.company} · {short(iv.title)} · {iv.mode === "coach" ? "coached" : "like the real thing"}</span>
              <h2 className="ivc-h2">{sc.answered} of {iv.questions.length} answered.{iv.source === "ai" && sc.answered ? ` Ready on ${ready} of ${counted} skills.` : ""}</h2></div>
            {iv.source === "ai" && <div className={sc.overall === null ? "ivc-hide-phone" : ""} style={{ textAlign: "right", flex: "none" }}><span className="ivc-big" data-testid="mock-overall">{sc.overall ?? "–"}</span><div className="xs muted ivc-hide-phone">{sc.overall === null ? "overall once every skill is heard" : prev !== undefined ? `overall · ${sc.overall >= prev ? "up" : "down"} ${Math.abs(sc.overall - prev)} from last time` : "overall"}</div></div>}
          </div>
          {iv.source === "ai" && <div className="ivc-score">{sc.dims.map((d) => (
            <div key={d.dim} className="ivc-sb"><span>{d.label}</span><small>{d.score === null ? "Not heard yet" : LEVEL_WORD[d.level]}{d.expert && d.score !== null ? " · my read" : ""}</small><span className="w"><b className={d.level >= 3 ? "hi" : "lo"} style={{ width: `${d.score === null ? 0 : Math.max(6, d.score)}%` }} /></span></div>
          ))}</div>}
          <div className="ivc-tiles ivc-hide-phone">
            <div className="ivc-tile"><b>{sc.avgSecs ? `${sc.avgSecs}s` : "–"}</b><span>Average answer</span></div>
            <div className="ivc-tile"><b>{sc.fillers}</b><span>Filler words</span></div>
            <div className="ivc-tile"><b>{iv.retries}</b><span>Answers redone</span></div>
          </div>
        </section>
        <div className="ivc-side">
          {sc.next && iv.source === "ai" ? (
            <section className="ivc-card ivc-peach stack-sm" data-testid="mock-next-step">
              <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}><Remy size={40} mood="happy" /><span className="ivc-kick">Your one thing for next time</span></div>
              <p className="small" style={{ margin: 0 }}><b>{sc.next.level === null ? `I haven't heard “${sc.next.label.toLowerCase()}” yet.` : `${sc.next.label} was ${LEVEL_WORD[sc.next.level].toLowerCase()}.`}</b> {sc.next.tip}</p>
              <div className="row"><button className="btn btn-primary btn-sm" onClick={() => practice(sc.next!.qi)} data-testid="button-practice-one"><Mic size={14} /> Practice just that one</button></div>
            </section>
          ) : (
            <section className="ivc-card ivc-peach stack-sm" data-testid="mock-next-step">
              <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}><Remy size={40} mood="happy" /><span className="ivc-kick">Next</span></div>
              <p className="small" style={{ margin: 0 }}>{sc.answered < iv.questions.length ? "Answer the ones you skipped. Those are the questions that surprise you in the real interview." : "Turn hints off and do it once more before the real thing."}</p>
            </section>
          )}
          {sc.best && <section className="ivc-card ivc-hide-phone"><p className="ivc-label">Your best line</p><p className="ivc-quote">“{sc.best.quote}”</p></section>}
          <section className="ivc-card">
            <div className="row ivc-hide-phone" style={{ justifyContent: "space-between" }}><p className="ivc-label" style={{ margin: 0 }}>Your practices for {iv.company}</p><span className="xs muted">{runs.length} so far</span></div>
            {runs.length > 1 && <div className="ivc-spark ivc-hide-phone" aria-hidden="true">{runs.map((x) => <i key={x.id} className={x.id === iv.id ? "n" : ""} style={{ height: `${Math.max(12, scoreInterview(x).overall ?? 12)}%` }} />)}</div>}
            <div className="row ivc-again" style={{ gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={again} data-testid="button-mock-again"><RotateCcw size={14} /> Run it again</button>
              <button className="btn btn-ghost btn-sm" onClick={() => practice(0, iv.mode === "coach" && iv.answers.some((a) => a.qi === 0))} data-testid="button-mock-plan">See every answer</button>
            </div>
            {sc.answered > 0 && <QuickRate place="mock" id={"mock:" + iv.id} label="Was this practice useful?" />}
          </section>
        </div>
      </div>
    </div>
  );
}
