// Owners (Interview rethink, Nov 22): the Interview tab is a mock interview Remy runs, not three stacked cards.
// Remy picks the opening, plans the rounds from its posting, asks one question at a time, hints with your own
// resume line or story, listens (PracticeOutLoud) and ends with a short scorecard. Stories, pitch and the full
// question list are the prep kit underneath, opened one at a time.
import { useState } from "react";
import { Mic, RotateCcw } from "lucide-react";
import type { Story } from "@shared/types";
import { jobQuestions } from "@shared/jobInterview";
import { STORY_PARTS, storyFor } from "@shared/stories";
import { useStore } from "../lib/store";
import { useInterviewJobs, JobInterview } from "./JobInterview";
import { PracticeOutLoud, type PracticeResult } from "./PracticeOutLoud";
import { StoryDeck } from "./StoryDeck";
import { PitchCard } from "./PitchCard";
import { Remy } from "./common";

type Round = { kind: string; q: string; hint?: string; line?: string; story?: Story; tip: string; goal: [number, number] };

export function MockInterview() {
  const { ws } = useStore();
  const w = ws!;
  const { mine, jobs } = useInterviewJobs();
  const [pick, setPick] = useState("");
  const [step, setStep] = useState(-1); // -1: Remy's plan; rounds.length: scorecard
  const [results, setResults] = useState<(PracticeResult | null)[]>([]);
  const [hints, setHints] = useState(true);
  const [kit, setKit] = useState<"stories" | "pitch" | "questions" | null>(location.hash === "#story-deck" ? "stories" : null) // Home links to /interview#story-deck;
  const job = jobs.find((j) => j.id === pick) || jobs[0];
  const stories = w.stories || [];
  const ready = stories.filter((s) => STORY_PARTS.every((p) => s[p]));
  const iv = w.tracker.find((t) => t.status === "Interview");

  const rounds: Round[] = !job ? [] : [
    { kind: "Warm-up", q: "Tell me about yourself.", hint: w.pitch?.text ? "Start from your pitch, then add why this role." : "Who you are, one real thing you did, and why this role.", line: w.pitch?.text, tip: "Keep it under a minute and end on why you're here.", goal: [45, 90] },
    ...jobQuestions(job, w.resume?.doc).slice(0, -1).slice(0, 4).map((x) => ({ kind: "From the posting", q: x.q, hint: x.why, line: x.line, story: storyFor(x.q + " " + x.why, ready), tip: x.tip, goal: [45, 120] as [number, number] })),
    { kind: "Your turn", q: `What questions do you have for us?`, hint: "Ask two. For example:", line: `What does a strong first month look like in this role? · What do people in this role usually work on at ${job.company}?`, tip: "Never say \"No, I'm good.\" Asking shows you care about the job.", goal: [20, 60] },
  ];
  const r = rounds[step];
  const done = results.filter(Boolean) as PracticeResult[];
  const start = () => { setResults([]); setStep(0); };

  const kitTiles: { id: "stories" | "pitch" | "questions"; n: string; label: string; c: string }[] = [
    { id: "stories", n: stories.length ? `${ready.length} of ${stories.length} ready` : "none yet", label: "Stories", c: "a" },
    { id: "pitch", n: w.pitch?.text ? "ready" : "to write", label: "Pitch", c: "b" },
    { id: "questions", n: String(job ? jobQuestions(job, w.resume?.doc).length : 0), label: "Questions", c: "c" },
  ];

  return (
    <div className="stack-lg">
      <section className="op-card mi-room stack-sm" data-testid="mock-interview">
        {!job ? (
          <>
            <span className="op-kick">Mock interview</span>
            <h2 className="iv-title">Save an opening and I'll interview you for it</h2>
            <p className="small muted">I plan the questions from the posting itself, so the practice matches the real thing.</p>
          </>
        ) : step < 0 ? (
          <>
            <span className="op-kick">Mock interview · {job.company}</span>
            <h2 className="iv-title">I'll be your interviewer for {job.title.split(/ [-–(]|, /)[0]}</h2>
            <p className="small">{iv ? `You have a real interview with ${iv.company}, so this is a dress rehearsal. ` : !mine.length ? "This is your top match until you save or apply to an opening. " : ""}{rounds.length} questions, about {Math.round(rounds.reduce((a, x) => a + x.goal[0] + 20, 0) / 60)} minutes. Answer out loud, like it's real.</p>
            {jobs.length > 1 && (
              <label className="xs muted row" style={{ gap: 6 }}>Interview for
                <select className="input" style={{ width: "auto", maxWidth: "min(360px, 100%)", minWidth: 0 }} value={job.id} onChange={(e) => setPick(e.target.value)} aria-label="Opening to interview for" data-testid="select-mock-job">
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.company}: {j.title}</option>)}
                </select>
              </label>
            )}
            <ol className="mi-plan" data-testid="mock-plan">{rounds.map((x, i) => <li key={i}><small>{x.kind}</small><span>{x.q}</span></li>)}</ol>
            {(stories.length === 0 || !w.pitch?.text) && (
              <p className="small mi-note" data-testid="mock-prep-note">
                {stories.length === 0 ? "You have no stories yet, so I'll hint with lines from your resume. " : ""}{!w.pitch?.text ? "No pitch yet: the warm-up is a good first try at one." : ""}
                {" "}<button className="btn btn-ghost btn-sm" style={{ padding: "0 6px", height: "auto" }} onClick={() => setKit(stories.length === 0 ? "stories" : "pitch")} data-testid="button-mock-prep">Prep first</button>
              </p>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-primary" onClick={start} data-testid="button-start-mock"><Mic size={16} /> Start the interview</button>
              <label className="xs row" style={{ gap: 6 }}><input type="checkbox" checked={!hints} onChange={(e) => setHints(!e.target.checked)} data-testid="toggle-mock-hints" /> No hints, like the real thing</label>
            </div>
          </>
        ) : r ? (
          <>
            <div className="mi-bar" aria-label={`Question ${step + 1} of ${rounds.length}`}>{rounds.map((_, i) => <i key={i} className={i < step ? "d" : i === step ? "on" : ""} />)}</div>
            <span className="op-kick">{r.kind} · Question {step + 1} of {rounds.length}</span>
            <div className="mi-seat">
              <div className="mi-remy"><Remy size={76} mood={results[step] ? "happy" : "think"} /><small>Remy · interviewer</small></div>
              <div className="stack-sm" style={{ minWidth: 0 }}>
            <p className="mi-ask" data-testid="mock-question">“{r.q}”</p>
            {hints && <div className="mi-hint stack-sm" data-testid="mock-hint">
              {r.hint && <span className="small">{r.hint}</span>}
              {r.story && <span className="small">Tell your story: <b>{r.story.title}</b></span>}
              {r.line && <span className="small muted">{r.kind === "Warm-up" ? "Your pitch" : r.kind === "Your turn" ? "" : "Your line"}{r.kind === "Your turn" ? "" : ": "}“{r.line}”</span>}
            </div>}
            <PracticeOutLoud key={`${job!.id}-${step}`} goal={r.goal} label="Answer out loud" primary script={r.kind === "Warm-up" ? w.pitch?.text || "" : ""} onDone={(x) => setResults((a) => { const n = [...a]; n[step] = x; return n; })} />
            {results[step] && <span className="small" data-testid="mock-tip"><b>Remy:</b> {r.tip}</span>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className={"btn btn-sm " + (results[step] ? "btn-primary" : "btn-ghost")} onClick={() => setStep(step + 1)} data-testid="button-mock-next">{step === rounds.length - 1 ? "Finish" : results[step] ? "Next question" : "Skip"} →</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep(-1)} data-testid="button-mock-stop">End interview</button>
            </div>
          </>
        ) : (
          <>
            <span className="op-kick">Your scorecard · {job.company}</span>
            <h2 className="iv-title">{done.length === rounds.length ? "You answered every question." : `You answered ${done.length} of ${rounds.length}.`}</h2>
            <div className="op-tiles mi-score" data-testid="mock-score">
              <div className="op-tile"><b>{done.length}/{rounds.length}</b><span>Answered</span></div>
              <div className="op-tile"><b>{done.length ? Math.round(done.reduce((a, x) => a + x.secs, 0) / done.length) + "s" : "–"}</b><span>Average answer</span></div>
              <div className="op-tile"><b>{done.reduce((a, x) => a + x.fillers, 0)}</b><span>Filler words</span></div>
            </div>
            <p className="small" data-testid="mock-next-step">{nextStep(rounds, results, ready.length, !!w.pitch?.text)}</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={start} data-testid="button-mock-again"><RotateCcw size={14} /> Run it again</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep(-1)} data-testid="button-mock-plan">Back to the plan</button>
            </div>
          </>
        )}
      </section>

      <section className="stack-sm" data-testid="interview-kit">
        <div className="row-between" style={{ gap: 8 }}><h3>Prep before you practice</h3></div>
        <div className="mi-seg" role="tablist" aria-label="Prep">{kitTiles.map((t) => (
          <button key={t.id} role="tab" aria-selected={kit === t.id} className={kit === t.id ? "on" : ""} onClick={() => setKit(kit === t.id ? null : t.id)} data-testid={`kit-${t.id}`}>{t.label} <em>{t.n}</em></button>
        ))}</div>
        {!kit && <p className="small muted" data-testid="kit-hint">Stories are your answers to “tell me about a time”. The pitch is your warm-up. Questions shows everything this opening may ask.</p>}
        {kit === "stories" && <StoryDeck />}
        {kit === "pitch" && <PitchCard />}
        {kit === "questions" && <JobInterview />}
      </section>
    </div>
  );
}

/** Remy's one thing to work on, from what actually happened in the run. */
function nextStep(rounds: Round[], res: (PracticeResult | null)[], readyStories: number, pitch: boolean) {
  const skipped = rounds.findIndex((_, i) => !res[i]);
  const long = rounds.findIndex((x, i) => res[i] && res[i]!.secs > x.goal[1]);
  const short = rounds.findIndex((x, i) => res[i] && res[i]!.secs < x.goal[0]);
  const fill = res.reduce((a, x) => a + (x?.fillers || 0), 0);
  if (skipped >= 0) return `Next: answer “${rounds[skipped].q}” Skipped questions are the ones that surprise you in the real interview.`;
  if (long >= 0) return `Next: “${rounds[long].q}” ran long. Say the result in your first two sentences, then stop.`;
  if (short >= 0) return `Next: “${rounds[short].q}” was short. Add what you did and what changed.`;
  if (fill > 4) return "Next: you used several filler words. A short pause sounds more confident than “um”.";
  if (!readyStories) return "Next: build your stories in the prep kit, so every “tell me about a time” has a real answer.";
  if (!pitch) return "Next: save your pitch in the prep kit, so the warm-up starts strong.";
  return "Solid run. Turn hints off and do it once more before the real thing.";
}
