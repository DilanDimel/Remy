// Interview coach (owners first, Dilan Nov 27: "like a teacher teaching you"): four steps in a teacher's order,
// one thing on screen at a time. Learn (3 lessons, no AI), Build (pitch, then stories), Practice (one question at a
// time with Remy's take and Try again), Mock interviews (today's room and scorecard). Students can jump to any step;
// Remy always says what's next. Proposal + mockups: project files interview-coach-nov27/interview-coach.html.
import { useState } from "react";
import { Check, Volume2 } from "lucide-react";
import type { Workspace } from "@shared/types";
import { drillsLeft, pickProfile, practiced, STAR_PARTS, starParts, WEEKLY_DRILLS, type Drill } from "@shared/interview";
import { jobQuestions } from "@shared/jobInterview";
import { BANK, bankField, fieldLabel } from "@shared/questionBank";
import { PROFILES } from "@shared/interviewRubric";
import { CHECKS, COMMON, coachDone, coverage, interviewPlan, isReady, KINDS, localDay, pitchSlots, spoken, LESSON_NEXT, LESSON_TITLE, LESSONS, pitchParts, shortQ, STAR_LEGEND, starExample, STEPS, type Lesson, type Step } from "@shared/interviewCoach";
import { api, useStore } from "../lib/store";
import { go, useRoute } from "../lib/router";
import { hush, say } from "../lib/voice";
import { Remy } from "./common";
import { RemyAskInline } from "./RemyAskInline";
import { firstName } from "@shared/names";
import { StoryDeck } from "./StoryDeck";
import { Answer, MockInterview } from "./MockInterview";
import { useInterviewJobs } from "./JobInterview";

export function InterviewCoach() {
  const { ws } = useStore();
  const w = ws!;
  const { query } = useRoute();
  const step = (STEPS.find((s) => s.id === query.get("step"))?.id) || null;
  const learned = w.coach?.learned || [];
  const ready = (w.stories || []).filter(isReady).length;
  const drills = w.drills || [];
  const mocks = (w.interviews || []).filter((x) => x.finishedAt).length;
  const done = coachDone(w);
  const open = (s: Step) => go(`/interview?step=${s}`);
  if (step === "mock") return <MockInterview top={<><Stepper step="mock" done={done} open={open} /><PlanCard /></>} />;
  return (
    <div className="ivc ivco" data-testid="interview-coach">
      <div className="ivc-head"><div style={{ minWidth: 0 }}><h1>Interview</h1><p className="ivc-say" data-testid="interview-line">{line(step, done, w)}</p></div></div>
      <Stepper step={step} done={done} open={open} />
      {!step && <Home done={done} open={open} learned={learned.length} ready={ready} drills={drills} mocks={mocks} />}
      {step === "learn" && <Learn learned={learned} next={() => open("build")} />}
      {step === "build" && <Build next={() => open("practice")} />}
      {step === "practice" && <Practice />}
    </div>
  );
}

function line(step: Step | null, done: Record<Step, boolean>, w: Workspace) {
  const next = STEPS.find((s) => !done[s.id]);
  if (step === "learn") return <><b>Three short lessons.</b> What interviewers ask, how to tell a story, and your 30-second pitch.</>;
  if (step === "build") return <><b>Your pitch first, then your stories.</b> I only use facts from your resume and ask you for the rest.</>;
  if (step === "practice") return <><b>One question at a time.</b> Answer out loud, see what I heard, fix one thing, try again.</>;
  if (!next) return <><b>You've done every step.</b> Keep a mock going before each real interview.</>;
  return <><b>{next.id === "learn" ? "Let's start with how interviews work." : `Next: ${next.label.toLowerCase()}.`}</b> {w.tracker.some((t) => t.status === "Interview") ? "You have an interview coming, so let's get you ready." : "Jump to any step you like."}</>;
}

function Stepper({ step, done, open }: { step: Step | null; done: Record<Step, boolean>; open: (s: Step) => void }) {
  return (
    <nav className="ivco-steps" aria-label="Interview steps">
      {STEPS.map((s, i) => (
        <button key={s.id} className={"ivco-st" + (step === s.id ? " on" : "") + (done[s.id] ? " done" : "")} aria-current={step === s.id ? "step" : undefined} onClick={() => open(s.id)} data-testid={`coach-step-${s.id}`}>
          <span className="n">{done[s.id] ? <Check size={14} /> : i + 1}</span><span style={{ minWidth: 0 }}><b>{s.label}</b><small>{done[s.id] ? "Done" : s.sub}</small></span>
        </button>
      ))}
    </nav>
  );
}

function Home({ done, open, learned, ready, drills, mocks }: { done: Record<Step, boolean>; open: (s: Step) => void; learned: number; ready: number; drills: Drill[]; mocks: number }) {
  const w = useStore().ws!;
  const next = STEPS.find((s) => !done[s.id]) || STEPS[3];
  const what: Record<Step, [string, string, string]> = {
    learn: ["Three lessons, about 4 minutes", "What interviewers really ask, the STAR way to tell a story, and the 30-second pitch. Each ends with one quick check.", "Start lesson 1"],
    build: ["Your 30-second pitch and 4 stories, from your resume", "I draft only from facts on your resume and ask you for the parts I can't know. You change any words.", "Build my pitch"],
    practice: ["Practice the questions you'll get", "One question at a time: what everyone gets asked, then your field, then your saved postings. One fix after each answer.", "Practice a question"],
    mock: ["A mock interview for each company", "I interview you like the company would, from its posting, then give you a scorecard.", "Pick a company"],
  };
  const [h, p, b] = what[next.id];
  const rows: [string, string, boolean][] = [
    ["Lessons", `${learned} of 3`, learned >= 3], ["30-second pitch", w.pitch?.text ? "Ready" : "Not yet", !!w.pitch?.text],
    ["Interview stories", `${ready} of 4 ready`, ready >= 4], ["Practice answers", `${drills.filter(practiced).length} with all four parts`, done.practice],
    ["Mock interviews", mocks ? `${mocks} done` : "None yet", mocks > 0],
  ];
  return (
    <>
      <PlanCard />
      <div className="ivco-home">
        <section className="ivc-card ivco-next" data-testid="coach-next">
          <span className="ivc-kick">Up next · Step {STEPS.indexOf(next) + 1}, {next.label}</span>
          <div className="ivco-next-row"><Remy size={112} mood="happy" /><div style={{ minWidth: 0 }}><h2 className="ivc-h2">{h}</h2><p className="muted" style={{ margin: 0 }}>{p}</p></div></div>
          <div className="row" style={{ gap: 8 }}><button className="btn btn-primary" onClick={() => open(next.id)} data-testid="button-coach-next">{b}</button></div>
        </section>
        <section className="ivc-card" data-testid="coach-built">
          <p className="ivc-label">What you've built</p>
          {rows.map(([a, v, ok]) => <div key={a} className="ivco-rd"><span>{a}</span><b className={ok ? "ok" : ""}>{v}</b></div>)}
        </section>
      </div>
      <RemyAskInline page="Interview" placeholder="Ask Remy about interviews…" starters={["What happens in a real interview?", "Where should I start?"]} />
    </>
  );
}

// ---------- Learn ----------
function Learn({ learned, next }: { learned: Lesson[]; next: () => void }) {
  const { ws, save } = useStore();
  const [at, setAt] = useState(Math.max(0, LESSONS.findIndex((l) => !learned.includes(l))));
  const [pick, setPick] = useState<number | null>(null);
  const lesson = LESSONS[at];
  const major = ws!.profile.major || ws!.profile.targetRoles;
  const pass = async () => { if (!learned.includes(lesson)) await save("coach", { learned: [...learned, lesson] }).catch(() => {}); };
  const choose = (i: number, right: number) => { setPick(i); if (i === right) void pass(); };
  const move = (n: number) => { setPick(null); hush(); if (n >= LESSONS.length) next(); else setAt(n); };
  const check = CHECKS[lesson];
  let body: React.ReactNode;
  if (lesson === "asks") {
    body = <div className="ivco-kinds">{KINDS.map(([t, e, c]) => (
      <div key={t} className="ivco-kind"><b>{t}</b><span className="small">{e}</span><small><b>It checks:</b> {c}</small></div>))}</div>;
  } else if (lesson === "star") {
    const [who, ...lines] = starExample(major);
    body = <div className="ivco-star"><div className="row-between" style={{ gap: 8 }}><span className="small muted">The interviewer asks: <b style={{ color: "var(--ink)" }}>“Tell me about a time you solved a problem.”</b></span><span className="xs muted">Example from {who}</span></div>
      {lines.map((t, i) => <button key={i} className={"ivco-sent s" + i + (pick === i ? (i === 3 ? " right" : " wrong") : "")} onClick={() => choose(i, 3)} data-testid={`star-line-${i}`}><span className="lab">{"STAR"[i]}</span><span>{t}</span></button>)}
      <div className="ivco-legend">{STAR_LEGEND.map(([l, t], i) => <span key={l} className="xs"><i className={"s" + i}>{l}</i>{t}</span>)}</div></div>;
  } else {
    const parts = pitchParts(major, ws!.profile.classYear);
    const text = parts.map((p) => p[1]).join(" ");
    body = <div className="ivco-pitch">{parts.map(([l, t]) => <div key={l} className="ivco-slot"><b className="small">{l}</b><span>{t}</span></div>)}
      <div className="row" style={{ gap: 8 }}><button className="btn btn-ghost btn-sm" onClick={() => void say(text)} data-testid="button-hear-pitch"><Volume2 size={14} /> Hear it</button><span className="xs muted">An example. You'll build yours from your resume next.</span></div></div>;
  }
  const ok = pick === check.right || (pick === null && learned.includes(lesson));
  return (
    <section className="ivc-card ivco-lesson" data-testid={`lesson-${lesson}`}>
      <div className="row-between" style={{ gap: 8 }}><span className="ivc-kick">Step 1 · Learn · Lesson {at + 1} of 3</span><span className="ivco-dots" aria-hidden="true">{LESSONS.map((l, i) => <i key={l} className={learned.includes(l) ? "d" : i === at ? "on" : ""} />)}</span></div>
      <h2 className="ivc-h2">{LESSON_TITLE[lesson]}</h2>
      <div className="ivco-lesson-body">{body}</div>
      <div className="ivco-check" data-testid="lesson-check">
        <span className="small"><b>Quick check.</b> {check.q}</span>
        {check.opts.length > 0 && <div className="row" style={{ gap: 6 }}>{check.opts.map((o, i) => <button key={o} className={"btn btn-sm " + (pick === i ? (i === check.right ? "btn-primary" : "btn-secondary") : "btn-ghost")} onClick={() => choose(i, check.right)} data-testid={`check-${i}`}>{o}</button>)}</div>}
        {pick !== null && <span className="small" role="status">{pick === check.right ? <><b>Yes.</b> {check.why}</> : "Not quite. Try another one."}</span>}
      </div>
      <div className="row-between" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => move(at - 1)} disabled={at === 0} data-testid="button-lesson-back">Back</button>
        <button className={"btn " + (ok ? "btn-primary" : "btn-secondary")} onClick={() => move(at + 1)} data-testid="button-lesson-next">{LESSON_NEXT[at]}</button>
      </div>
    </section>
  );
}

// ---------- Build ----------
function Build({ next }: { next: () => void }) {
  const w = useStore().ws!;
  const [tab, setTab] = useState<"pitch" | "stories">(w.pitch?.text ? "stories" : "pitch");
  const stories = w.stories || [];
  const cov = coverage(stories);
  return (
    <div className="ivco-build">
      <div className="row-between" style={{ gap: 8 }}>
        <div className="ivco-tabs" role="tablist">{([["pitch", "30-second pitch", w.pitch?.text ? "Ready" : "Start here"], ["stories", "Interview stories", `${stories.filter(isReady).length} of 4 ready`]] as const).map(([id, l, s]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)} data-testid={`build-tab-${id}`}><b>{l}</b><small>{s}</small></button>))}</div>
        <span className="small muted" data-testid="story-coverage">{stories.length ? `Your stories answer ${cov} of the ${COMMON.length} most common story questions.` : "4 stories answer most “tell me about a time” questions."}</span>
      </div>
      {tab === "pitch" ? <PitchSlots /> : <StoryDeck />}
      <div className="row-between" style={{ gap: 8 }}>
        <RemyAskInline page="Interview" placeholder="Ask Remy about your pitch or stories…" starters={tab === "pitch" ? ["Does my pitch sound natural?", "How do I make it shorter?"] : ["Which story is strongest?", "What if I don't have a number?"]} />
      </div>
      {w.pitch?.text && stories.filter(isReady).length >= 4 && <div className="row"><button className="btn btn-primary" onClick={next} data-testid="button-build-next">Next: practice</button></div>}
    </div>
  );
}

// The pitch in four slots (mockup "Build"): each filled from a named profile or resume line, each editable.
function PitchSlots() {
  const { ws, save, toast } = useStore();
  const w = ws!;
  const filled = pitchSlots(w, firstName(w));
  const [slots, setSlots] = useState(filled.map((f) => f[1]));
  const [busy, setBusy] = useState(false);
  const text = slots.map((x) => x.trim()).filter(Boolean).join(" ");
  const { words, secs } = spoken(text);
  const changed = text !== (w.pitch?.text || "");
  const keep = async () => { setBusy(true); await save("pitch", { text, at: new Date().toISOString(), slots: slots.map((x) => x.trim()) }).then(() => toast("Pitch saved")).catch(() => {}); setBusy(false); };
  return (
    <section className="ivc-card stack-sm" data-testid="pitch-slots">
      <div className="row-between" style={{ gap: 8 }}><h3 style={{ margin: 0 }}>Your 30-second pitch</h3><span className="xs muted">Every line comes from your resume or profile. Change any words so it sounds like you.</span></div>
      {w.pitch?.text && !w.pitch.slots && <p className="small muted" style={{ margin: 0 }}>Your saved pitch: “{w.pitch.text}”</p>}
      {filled.map(([label, , from], i) => (
        <div key={label} className="ivco-pslot">
          <b className="small">{label}</b>
          <div style={{ minWidth: 0 }}>
            <textarea className="input" rows={2} value={slots[i]} placeholder={i === 2 ? "One thing you did and what came of it" : label} aria-label={label}
              onChange={(e) => setSlots(slots.map((x, k) => (k === i ? e.target.value : x)))} data-testid={`pitch-slot-${i}`} />
            <span className="xs muted">{slots[i] !== filled[i][1] || from === "Your words" ? "Your words" : from ? `From ${from}` : "Not on your resume yet. Add one thing you did and what came of it."}</span>
          </div>
        </div>))}
      <div className="row-between" style={{ gap: 8 }}>
        <span className={"small " + (secs > 40 ? "" : "muted")} data-testid="pitch-length">{words} words · about {secs} seconds spoken{secs > 40 ? ". Try to get it under 35." : ""}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={!text} onClick={() => void say(text)} data-testid="button-hear-my-pitch"><Volume2 size={14} /> Hear it</button>
          <button className="btn btn-primary btn-sm" disabled={!text || !changed || busy} onClick={keep} data-testid="button-save-pitch">{w.pitch?.text && !changed ? "Saved" : "Save"}</button>
        </div>
      </div>
    </section>
  );
}

// A real interview coming (an application at Interview, with its date when Remy knows it): pitch, 3 questions, one mock.
function PlanCard() {
  const w = useStore().ws!;
  const plan = interviewPlan(w, localDay());
  if (!plan) return null;
  const to = (k: string) => go(k === "pitch" ? "/interview?step=build" : k === "practice" ? "/interview?step=practice" : `/interview?step=mock${plan.jobId ? `&job=${plan.jobId}` : ""}`);
  return (
    <section className="ivc-card ivco-plan" data-testid="interview-plan">
      <div className="ivco-plan-head"><Remy size={56} mood="happy" /><div style={{ minWidth: 0 }}>
        <b>{plan.when ? `Your ${plan.company} interview is ${plan.when}.` : `You have an interview with ${plan.company}.`}</b>
        <p className="small muted" style={{ margin: 0 }}>I made a 3-day plan to get you ready. Tap a day to start.</p></div></div>
      <div className="ivco-plan-days">{plan.days.map((d) => (
        <button key={d.key} className={d.done ? "done" : ""} onClick={() => to(d.key)} data-testid={`plan-${d.key}`}>
          <span className="xs muted">{d.day}</span><b className="small">{d.done ? <Check size={14} className="ok" /> : null}{d.title}</b></button>))}</div>
    </section>
  );
}

// ---------- Practice ----------
function Practice() {
  const { ws, setWs, run } = useStore();
  const w = ws!;
  const { jobs } = useInterviewJobs();
  const [pickJob, setPickJob] = useState("");
  const job = jobs.find((j) => j.id === pickJob) || jobs[0];
  const profile = job ? pickProfile(job) : "generic";
  const field = job ? bankField(job.title, profile) : "generic";
  const groups: { label: string; qs: string[] }[] = [
    { label: "Everyone gets asked", qs: COMMON.slice(0, 5).map((c) => c.q) },
    ...(field !== "generic" ? [{ label: `For ${fieldLabel(field, PROFILES[profile].label)} roles`, qs: BANK[field].filter((b) => b.kind === "story").slice(0, 3).map((b) => b.q) }] : []),
    ...(job ? [{ label: `From ${job.company}'s posting`, qs: jobQuestions(job, w.resume?.doc).slice(1, -1).slice(0, 4).map((x) => x.q) }] : []),
  ].filter((g) => g.qs.length);
  const all = [...new Set(groups.flatMap((g) => g.qs))];
  const [q, setQ] = useState(all[0] || "");
  const [take, setTake] = useState(false);
  const drill = (w.drills || []).find((d) => d.q === q);
  const left = drillsLeft(w.drills);
  const stories = (w.stories || []).filter(isReady);
  const theme = COMMON.find((c) => c.q === q)?.theme;
  const fit = stories.find((s) => s.theme === theme);
  const nextQ = () => { const i = all.indexOf(q); setQ(all[(i + 1) % all.length]); setTake(false); };
  return (
    <div className="ivco-practice">
      <aside className="ivc-card ivco-qlist" data-testid="practice-list">
        <p className="ivc-label">Questions to expect</p>
        {jobs.length > 1 && <select className="input" style={{ width: "100%", minWidth: 0, marginBottom: 8 }} value={job?.id} onChange={(e) => setPickJob(e.target.value)} aria-label="Opening to practice for" data-testid="select-practice-job">{jobs.map((j) => <option key={j.id} value={j.id}>{j.company}: {j.title}</option>)}</select>}
        {groups.map((g) => (
          <div key={g.label}><div className="ivco-qg">{g.label}</div>
            {g.qs.map((x) => { const d = (w.drills || []).find((y) => y.q === x); return (
              <button key={x} className={"ivco-qi" + (x === q ? " on" : "")} onClick={() => { setQ(x); setTake(false); }} data-testid="practice-question">
                {d && practiced(d) ? <Check size={14} className="ok" /> : <i className={d ? "half" : ""} />}<span>{shortQ(x)}</span></button>); })}
          </div>))}
      </aside>
      <div className="ivco-drill">
        <section className="ivc-card stack-sm" style={{ gap: 8 }}>
          <div className="row-between" style={{ gap: 8 }}><span className="ivc-kick">Practice · {left} of {WEEKLY_DRILLS} rated answers left this week</span>{fit && <span className="xs muted">Best story: {fit.title}</span>}</div>
          <p className="ivc-ask" data-testid="practice-q">“{q}”</p>
          {!take && <Answer key={q + (drill?.at || "")} initial="" onSend={async (text, secs, fillers) => {
            const next = await run(() => api<Workspace>("POST", "/api/interviews/drill", { q, text, secs, fillers, jobId: job?.id }));
            if (next) { setWs(next); setTake(true); }
          }} skip={nextQ} stop={() => go("/interview")} last={false} />}
          {take && drill && <p className="small muted" style={{ margin: 0 }}>You said{drill.secs ? ` (${drill.secs} seconds)` : ""}: “{drill.text.length > 220 ? drill.text.slice(0, 220) + "…" : drill.text}”</p>}
        </section>
        {take && drill && <DrillTake d={drill} again={() => setTake(false)} next={nextQ} />}
        {!take && <section className="ivc-card stack-sm" style={{ gap: 8 }} data-testid="practice-listen"><p className="ivc-label" style={{ margin: 0 }}>I listen for all four parts</p>
          <div className="ivco-meter">{STAR_PARTS.map(([id, label]) => <span key={id} className="missing">{label}</span>)}</div>
          <p className="xs muted" style={{ margin: 0 }}>Hear all four and this question gets a check. About a minute out loud is plenty.</p></section>}
        {!take && <RemyAskInline page="Interview" placeholder="Ask Remy about this question…" starters={["Is my answer too long?", "Give me another example"]} />}
      </div>
    </div>
  );
}

function DrillTake({ d, again, next }: { d: Drill; again: () => void; next: () => void }) {
  const parts = starParts(d.ratings);
  return (
    <section className="ivc-card ivc-peach stack-sm" style={{ gap: 10 }} data-testid="practice-take">
      <div className="row-between" style={{ gap: 8 }}><b>What I heard</b><span className="xs muted">{d.secs ? `${d.secs} s · ` : ""}{d.fillers} filler word{d.fillers === 1 ? "" : "s"}{d.tries > 1 ? ` · try ${d.tries}` : ""}</span></div>
      {d.ratings.length > 0 && <div className="ivco-meter" data-testid="star-meter">{parts.map((p) => <span key={p.id} className={p.state}>{p.label} {p.state === "heard" ? "✓" : p.state === "thin" ? "· thin" : "· missing"}</span>)}</div>}
      {d.landed && <p className="small" style={{ margin: 0 }}><b>What landed:</b> “{d.landed.quote}” {d.landed.why}</p>}
      {d.sharpen && <p className="small" style={{ margin: 0 }}><b>One fix:</b> {d.sharpen.title}{d.sharpen.example ? <> Try: “{d.sharpen.example}”</> : null}</p>}
      {!d.ratings.length && !d.sharpen && <p className="small" style={{ margin: 0 }}>Saved. I couldn't rate this one, but a longer answer with one real example gives me more to go on.</p>}
      <div className="row" style={{ gap: 8 }}><button className="btn btn-primary btn-sm" onClick={again} data-testid="button-drill-again">Try again</button><button className="btn btn-ghost btn-sm" onClick={next} data-testid="button-drill-next">Next question</button></div>
    </section>
  );
}
