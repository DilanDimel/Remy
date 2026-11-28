import { go, uiFlags } from "../lib/router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileText, GraduationCap, Mail, Mic, Sparkles, Square } from "lucide-react";
import { canListen, useVoice } from "../lib/voice";
import { PATHS, type Job, type Profile, type SetupFocus, type Workspace } from "@shared/types";
import { FIELD_GROUPS, FIELD_MAJORS, splitFieldList } from "@shared/fields";
import { AUTH_OPTS, authChip } from "@shared/workAuth";
import { alreadyIn, fitsField, inField, setupReply, tappedResumeClaim } from "@shared/setupReply";
import { defaultTypes, fieldFromMajor, guessYearFor, yearOptions } from "@shared/setupDefaults";
import { api, FAR_ENOUGH_STEP, fmtDate, rid, useOwnerView, useStore } from "../lib/store";
import { reloadJobs, useJobs } from "../lib/jobs";
import { AiUnavailableNote, BetaBadge, Remy, Spinner, StatusChip, WorkingSteps } from "../components/common";
import { ProfileImport, ResumeUpload } from "../components/Uploaders";
import { atAlumniSchool, atTcu, SchoolVerify } from "../components/SchoolVerify";
import { AskCard, useAsks } from "../components/RemyAsk";
import type { Ask } from "@shared/remyAsks";
import { ResumeBuilder } from "../components/ResumeBuilder";
import { LinkedInGuide } from "../components/LinkedInGuide";
import { useGoogleCalendar } from "../components/GoogleCalendar";
import { useIsMobile } from "../hooks/use-mobile";
import { OrgLogo } from "../components/OrgLogo";
import { LinkedInMark } from "./Welcome";
import { CareerTime } from "../components/CareerTime";
import { ThemeToggle } from "../components/ThemeToggle";
import { firstName } from "@shared/names";
import { nameConcern } from "@shared/junk";
import { LIMIT_OPTS } from "@shared/limits";
import { regionHint, regionOptions } from "@shared/regions";

// Step numbers are stored in the workspace: 0 and 1 are the goal question (no focus yet) or the resume step; 2-5 follow.
const STEPS = ["Your goal", "Your resume", "Review", "Preferences", "Questions", "Your plan"];

export default function Onboarding() {
  const { ws, save, config } = useStore();
  const w = ws!;
  const step = w.onboarding.step;
  const [regoal, setRegoal] = useState(false); // Back from the resume step reopens the goal, keeping what was picked (Dilan, Nov 27)
  // The goal question is step 1; the saved step number (1-5) starts at the resume, so it shows one further along.
  const shown = step <= 1 ? (w.onboarding.focus && !regoal ? 1 : 0) : Math.min(step, STEPS.length - 1);
  const ownerView = useOwnerView();
  const [reading, setReading] = useState(""); // what the resume step is reading ("resume", "transcript"), shown live beside it
  // Coming back partway through: say so and let the student choose, instead of dropping them mid-step.
  // Owner view: skip it on a reload within the hour — it was showing even seconds after a refresh.
  const [welcomeBack, setWelcomeBack] = useState(() => {
    if (step < FAR_ENOUGH_STEP) return false;
    if (!ownerView) return true;
    try { const at = Number(localStorage.getItem("remy:ob:at")); if (at && Date.now() - at < 3_600_000) return false; } catch {}
    return true;
  });
  useEffect(() => { try { if (ownerView && !w.onboarding.done) localStorage.setItem("remy:ob:at", String(Date.now())); } catch {} }, [step, ownerView, w.onboarding.done]);
  const setStep = (s: number) => save("onboarding", { ...w.onboarding, step: s });
  const finish = async (tour = true) => {
    uiFlags.flyIn = true;
    // Setup ends on Home, where Remy's tutorial starts (it used to land on the page the student's goal pointed to).
    go("/");
    // Remy's tutorial starts now (set here so students who finished setup before it existed aren't surprised by it),
    // unless they skip it; "Show me around again" in the menu still starts it later.
    // New students after the release get setup and the tour, not the "Remy just got an update" card (Beta2Welcome).
    await save("settings", { tour: tour ? 0 : "done", ...(ownerView ? { beta2Seen: true } : {}) }).catch(() => {});
    await save("onboarding", { ...w.onboarding, done: true });
  };
  // The first screen saves the path and goal and picks where setup ends; nobody skips setup, since everything
  // Remy does is built on knowing the student (resume upload or "Build one with Remy" is the next step).
  const pick = async (focus: SetupFocus, exploring?: boolean) => { await save("onboarding", { ...w.onboarding, focus, ...(exploring ? { exploring: true } : {}) }); setRegoal(false); };
  const card = (
      <div className="ob-card card card-pad fade-up" key={welcomeBack ? "back" : shown}>
        {welcomeBack ? (
          <WelcomeBack onContinue={() => setWelcomeBack(false)} onRestart={async () => { await save("onboarding", { ...w.onboarding, step: 1, answers: [], questions: [], targets: [] }); setWelcomeBack(false); }} />
        ) : (
          <>
            {step <= 1 && (!w.onboarding.focus || regoal) ? <FocusPick onPick={pick} />
              : step <= 1 && <ResumeStep onBack={() => setRegoal(true)} onNext={() => setStep(2)} onBusy={setReading} />}
            {step === 2 && <Review onBack={() => setStep(1)} onNext={() => setStep(3)} />}
            {step === 3 && <Preferences onBack={() => setStep(2)} />}
            {step === 4 && <Questions onBack={() => setStep(3)} onNext={() => setStep(5)} />}
            {step === 5 && <PlanStep onBack={() => setStep(4)} onFinish={finish} />}
          </>
        )}
      </div>
  );
  // Owners (sign-up redesign, Nov 22): Remy's notebook beside the step, filling up with what the student has told Remy.
  if (ownerView) return (
    <div className="ob ob-owner" data-testid="setup-owner">
      <SetupNotebook shown={shown} back={welcomeBack} />
      <main className="ob-main">
        {card}
        {!config?.ai.available && <AiUnavailableNote />}
      </main>
      {!welcomeBack && <SetupPreview shown={shown} reading={reading} />}
    </div>
  );
  return (
    <div className="ob">
      <div className="row-between" style={{ width: "100%", maxWidth: 740 }}>
        <span className="logo"><Remy size={26} /><span>Remy<b>.</b></span><BetaBadge /></span>
        <ThemeToggle />
      </div>
      {!welcomeBack && (
        <div className="ob-progress-wrap">
          <span className="ob-progress-label" aria-hidden>Step {shown + 1} of {STEPS.length} · <b>{STEPS[shown]}</b></span>
          <ol className="ob-progress" aria-label={`Step ${shown + 1} of ${STEPS.length}: ${STEPS[shown]}`}>
            {STEPS.map((s, i) => <li key={s} className={i <= shown ? "on" : ""} aria-current={i === shown ? "step" : undefined}><span /></li>)}
          </ol>
        </div>
      )}
      {card}
      {!config?.ai.available && <div style={{ maxWidth: 720, width: "100%" }}><AiUnavailableNote /></div>}
    </div>
  );
}


/** Same kind string Settings used, so earlier transcript imports still count. */
const TRANSCRIPT = "Unofficial transcript";

// Owner setup: each step is a chapter, with what Remy says about it.
const CHAPTERS: [string, string][] = [
  ["Hello", "Tell me where you are and where you're headed. That's all I need to start."],
  ["Your story", "Your resume is my evidence. I only ever use what's on it, and what you tell me."],
  ["Check my notes", "Here's what I read. Fix anything I got wrong before I build on it."],
  ["Where to look", "Where should I look, and for what? You can change this any time."],
  ["Getting to know you", "A few quick questions only you can answer."],
  ["Your first step", "Here's where I'd start. Small steps, every day."],
];

/** Owner setup's side panel: Remy, the chapters, and every fact the student has given so far (all of it from them). */
function SetupNotebook({ shown, back }: { shown: number; back: boolean }) {
  const { ws } = useStore();
  const w = ws!;
  const p = w.profile;
  const transcript = w.imports.find((i) => i.kind === TRANSCRIPT);
  const facts = ([
    ["Right now", PATHS.find(([k]) => k === p.path)?.[1] || ""],
    ["Working toward", p.goal],
    ["Resume", w.resume?.fileName || ""],
    ["Studying", [p.major, p.school].filter(Boolean).join(" at ")],
    ["Finishing", p.graduation],
    ["Looking in", p.regions],
    ["Looking for", p.opportunityTypes],
    ["Transcript", transcript?.fileName || ""],
    ["Answers", w.onboarding.answers.length ? `${w.onboarding.answers.length} of ${w.onboarding.questions.length || 3}` : ""],
  ] as [string, string][]).filter(([, v]) => v && v.trim());
  return (
    <aside className="ob-note" aria-label="Your setup with Remy">
      {/* Light/dark stays in reach during setup (tester, Nov 25), as on the sign-in page. */}
      <div className="row-between"><span className="logo"><span>Remy<b>.</b></span><BetaBadge /></span><ThemeToggle /></div>
      <div className="ob-note-remy">
        <Remy size={60} mood={shown === 5 ? "happy" : "wave"} />
        <p className="ob-note-say" aria-live="polite">{back ? "Welcome back. Pick up where you left off, or start over." : CHAPTERS[shown][1]}</p>
      </div>
      <ol className="ob-chapters" aria-label={`Chapter ${shown + 1} of ${CHAPTERS.length}: ${CHAPTERS[shown][0]}`}>
        {CHAPTERS.map(([c], i) => (
          <li key={c} className={i < shown ? "done" : i === shown ? "now" : ""} aria-current={i === shown ? "step" : undefined}>
            <span className="ob-dot" aria-hidden>{i < shown ? <Check size={12} strokeWidth={3} /> : i + 1}</span><span className="ob-ch-name">{c}</span>
          </li>
        ))}
      </ol>
      <div className="ob-known" data-testid="setup-known">
        <span className="ob-known-h">What Remy knows so far <b>{facts.length}</b></span>
        {facts.length ? (
          <ul>{facts.map(([k, v]) => <li key={k} className="fade-up"><span>{k}</span><b>{v}</b></li>)}</ul>
        ) : <p>Nothing yet. Everything here comes from you, and you can change it later.</p>}
      </div>
      <p className="ob-note-foot">Remy never asks for your passwords and never sends anything for you.</p>
    </aside>
  );
}

/** Before the preferences step is saved, Remy only knows the student's home and goal: keep the preview to their state
 *  (or remote) and drop internships when they came for a full-time job (setup tests, Nov 26: Milan internships for a
 *  San Antonio veteran). Once places and kinds are saved, the server's fit decides. */
function beforePrefs(w: Workspace, j: Job) {
  const st = !w.profile.regions && (w.profile.location || "").match(/,\s*([A-Z]{2})\b/)?.[1];
  if (st && j.location && !/remote/i.test(j.location) && !new RegExp(`\\b${st}\\b`).test(j.location)) return false;
  return !!w.profile.opportunityTypes || !/full.?time|switch/i.test(w.profile.goal || "") || j.kind !== "internship";
}

/** Owner setup's right side (Dilan, Nov 23): a live preview of what Remy is building from each step, so the screen
 *  isn't half empty. Resume steps show Remy reading the file; later steps show the first openings arriving. */
function SetupPreview({ shown, reading }: { shown: number; reading: string }) {
  const { ws } = useStore();
  const w = ws!;
  const { jobs, fits, refreshing } = useJobs();
  const doc = w.resume?.doc;
  const first = firstName(w);
  if (shown <= 2) {
    const sections = doc?.sections.filter((s) => s.entries.length) || [];
    const read = sections.length + (doc?.skills.length ? 1 : 0); // Skills are kept apart from sections but shown as one
    return (
      <aside className="ob-pv" aria-label="What Remy is reading" data-testid="setup-preview">
        <span className="ob-pv-h">{reading ? `Reading your ${reading}` : doc ? `Remy read ${read} section${read === 1 ? "" : "s"}` : shown === 0 ? "Your workspace, so far" : "Your resume goes here"}</span>
        <div className={"ob-paper" + (reading ? " reading" : "") + (doc && !reading ? " read" : "")}>
          {doc && !reading ? (
            <>
              <b className="ob-paper-name">{doc.contact.name || first || "Your resume"}</b>
              {sections.slice(0, 8).map((s, i) => (
                <div key={s.id} className="ob-paper-sec" style={{ animationDelay: `${i * 140}ms` }}>
                  <span>{s.heading}</span>
                  {s.entries.slice(0, 3).map((e) => <div key={e.id}><p>{e.role || e.org ? <><b>{e.role || e.org}</b>{e.role && e.org ? ` · ${e.org}` : ""}</> : e.bullets[0]?.text}</p>{(e.role || e.org) && e.bullets[0] && <p className="ob-paper-bullet">{e.bullets[0].text}</p>}</div>)}
                </div>
              ))}
              {!!doc.skills.length && <div className="ob-paper-sec" style={{ animationDelay: `${Math.min(sections.length, 8) * 140}ms` }}><span>Skills</span><p>{doc.skills.map((k) => k.items).join(", ").slice(0, 120)}</p></div>}
            </>
          ) : (
            <>{[70, 40, 92, 84, 60, 0, 48, 90, 76, 82, 0, 55, 88].map((n, i) => <i key={i} className={n ? "" : "sp"} style={{ width: `${n}%` }} />)}{reading && <em className="ob-scan" aria-hidden />}</>
          )}
        </div>
        <p className="ob-pv-say" aria-live="polite">{reading ? (reading === "transcript" ? "Pulling out your courses, credits and GPA. Only what's on the page." : "Pulling out your roles, dates and skills. Only what's on the page.") : doc ? "I'll only ever use what's here, and what you tell me." : shown === 0 ? "Once I have your resume, I'll start looking for openings that fit." : "Upload it and watch me read it here."}</p>
      </aside>
    );
  }
  const matches = (jobs || []).filter((j) => !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false && beforePrefs(w, j));
  const looking = refreshing || !jobs;
  return (
    <aside className="ob-pv" aria-label="Your first openings" data-testid="setup-preview">
      <span className="ob-pv-h">{looking ? "Checking employers' career sites" : matches.length ? `${matches.length} opening${matches.length === 1 ? "" : "s"} so far` : "Your first openings"}</span>
      <ul className="ob-pv-jobs">
        {matches.slice(0, 8).map((j, i) => (
          <li key={j.id} style={{ animationDelay: `${i * 160}ms` }} data-testid="setup-preview-job">
            <OrgLogo company={j.company} url={j.applyUrl} className="ob-pv-logo" />
            <span><b>{j.title}</b><span>{j.company}{j.location ? ` · ${j.location}` : ""}</span></span>
          </li>
        ))}
        {(looking || !matches.length) && [0, 1, 2].map((i) => <li key={"s" + i} className={"ob-pv-skel" + (looking ? " busy" : "")} aria-hidden><span className="ob-pv-logo" /><span><i /><i /></span></li>)}
      </ul>
      <p className="ob-pv-say" aria-live="polite">{looking ? "New ones drop in here as I find them." : matches.length ? shown >= 5 ? "They'll be waiting on Home and in Opportunities." : "Your answers here sharpen this list." : "Nothing fits every choice yet. More places or fields shows more."}</p>
    </aside>
  );
}

// Where finishing setup lands, by what the student said would help most.
// "Find openings" lands on Home, where the plan's first step and the best-fitting openings are (Opportunities alone
// could be empty for fields Remy covers thinly); resume and interview go straight to the tool the student asked for.

/** First screen of setup: one question, so a student can get to what they came for. */
// "What are you working toward?": tap one or write your own. "Not sure yet" is a real answer (Remy starts from exploring).
const GOALS: [string, SetupFocus][] = [["Land an internship", "openings"], ["Find a full-time job", "openings"], ["Make my resume stronger", "resume"], ["Get ready for an interview", "interview"], ["Switch to a new field", "direction"], ["Not sure yet", "direction"]];

/** First screen of setup: where the student is and what they're working toward, so Remy starts from their goal. */
function FocusPick({ onPick }: { onPick: (f: SetupFocus, exploring?: boolean) => Promise<void> }) {
  const { ws, me, save, run } = useStore();
  const w = ws!;
  const first = firstName(w);
  const [busy, setBusy] = useState(false);
  const path = w.profile.path || "";
  const [goal, setGoal] = useState(w.profile.goal || "");
  const chip = GOALS.find(([g]) => g === goal);
  const ready = !!path && goal.trim().length > 1;
  const go2 = () => run(async () => {
    setBusy(true);
    const unsure = goal === "Not sure yet"; // the chip only: "Not sure between finance and consulting" says something
    await save("profile", { ...w.profile, goal: goal.trim().slice(0, 300) });
    // One save for focus and "still exploring", so neither overwrites the other.
    await onPick(chip ? chip[1] : "openings", unsure);
  }).finally(() => setBusy(false));
  return (
    <div className="stack-lg" data-testid="focus-pick">
      <div className="remy-prompt">
        <Remy size={44} mood="wave" />
        <div className="stack-sm">
          <h2>Hi{first ? ` ${first}` : ""}! What are you working toward?</h2>
          <p className="muted">Everything Remy suggests starts from this, so be as specific as you like. "Not sure yet" is a fine answer.</p>
        </div>
      </div>
      <div className="stack-sm">
        <b>Where are you right now?</b>
        <div className="pref-chips" role="group" aria-label="Where are you right now">
          {PATHS.map(([k, label]) => <button key={k} type="button" className="pref-chip" aria-pressed={path === k} onClick={() => save("profile", { ...w.profile, path: k })} data-testid={`path-${k}`}>{label}</button>)}
        </div>
      </div>
      <div className="stack-sm">
        <b>What are you working toward?</b>
        <div className="pref-chips" role="group" aria-label="What are you working toward">
          {GOALS.map(([g]) => <button key={g} type="button" className={"pref-chip" + (g === "Not sure yet" ? " pref-unsure" : "")} aria-pressed={goal === g} onClick={() => setGoal(g)} data-testid={`goal-${g.toLowerCase().replace(/\W+/g, "-")}`}>{g}</button>)}
        </div>
        <input className="input" value={chip ? "" : goal} onChange={(e) => setGoal(e.target.value)} maxLength={300} placeholder="Or in your own words" aria-label="What you're working toward" data-testid="input-goal" />
      </div>
      <div className="row-between">
        <span className="xs muted">{!path ? "Pick where you are right now." : !goal.trim() ? "Tap a goal or write your own." : "Next: your resume (upload it, or build one with Remy)."}</span>
        <button className="btn btn-primary" disabled={!ready || busy} onClick={go2} data-testid="button-goal-next">{busy ? <Spinner /> : null} Continue <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function WelcomeBack({ onContinue, onRestart }: { onContinue: () => void; onRestart: () => void }) {
  const { ws } = useStore();
  const w = ws!;
  const step = w.onboarding.step;
  const first = firstName(w);
  const done: [string, boolean, string][] = [
    ["Your resume", !!w.resume, w.resume ? w.resume.fileName : "Not uploaded yet"],
    ["Profile reviewed", step > 2, step > 2 ? "School, major and graduation confirmed" : "Next up"],
    ["Your preferences", step > 3, step > 3 ? [w.profile.opportunityTypes, w.profile.regions].filter(Boolean).join(" · ") : "Still to do"],
    ["A few questions", step > 4, `${w.onboarding.answers.length} of ${w.onboarding.questions.length || 3} answered`],
  ];
  return (
    <div className="stack-lg" data-testid="welcome-back">
      <div className="remy-prompt">
        <Remy size={44} mood="wave" />
        <div className="stack-sm">
          <h2>Welcome back{first ? `, ${first}` : ""}!</h2>
          <p className="muted">You're partway through setting up Remy. Here's what you've done so far.</p>
        </div>
      </div>
      <div className="stack-sm">
        {done.map(([label, ok, detail]) => (
          <div key={label} className="conn-row">
            <span className={`conn-badge ${ok ? "done" : ""}`}>{ok ? <><Check size={13} /> Done</> : "To do"}</span>
            <div className="grow"><b>{label}</b><span>{detail}</span></div>
          </div>
        ))}
      </div>
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onRestart} data-testid="button-start-over">Start over</button>
        <button className="btn btn-primary" onClick={onContinue} data-testid="button-continue-setup">Continue where I left off <ArrowRight size={16} /></button>
      </div>
      <p className="xs muted">Start over keeps your resume and profile; it takes you back to the first step to check everything again.</p>
    </div>
  );
}

/** Brand-coloured calendar tile for the Google Calendar connector (a generic calendar glyph, not Google's logo). */
function CalendarMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><text x="12" y="18.2" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="currentColor" stroke="none">31</text>
    </svg>
  );
}

/** Step 1: resume first (upload or build one), then the other accounts, each with its own row. */
function ResumeStep({ onBack, onNext, onBusy }: { onBack: () => void; onNext: () => void; onBusy?: (reading: string) => void }) {
  const { ws, me } = useStore();
  const first = firstName(ws!);
  const w = ws!;
  const [open, setOpen] = useState<"" | "resume" | "school" | "transcript">(w.resume ? "" : "resume");
  const ownerView = useOwnerView();
  const transcript = w.imports.find((i) => i.kind === TRANSCRIPT);
  const [busy, setBusy] = useState(false);
  const [reader, setReader] = useState("resume"); // which file is being read, so the side panel names the right one
  useEffect(() => { onBusy?.(busy ? reader : ""); }, [busy, reader]);
  const [page, setPage] = useState<"" | "build" | "linkedin">("");
  const linkedin = w.imports.find((i) => /linkedin/i.test(i.kind));
  const gc = useGoogleCalendar();
  const phone = useIsMobile();
  if (page === "build" && !w.resume) return <ResumeBuilder onDone={onNext} onCancel={() => setPage("")} />;
  if (page === "linkedin") return <LinkedInGuide onDone={() => setPage("")} />;
  // Handshake is used by most colleges; the TCU account and Stellic only exist at TCU.
  const soon: [string, string, string, ReactNode][] = [
    ...(atTcu(me) ? [["tcu", "TCU Student Account", "Enrollment, major and class standing", "TCU"], ["stellic", "Stellic Degree Audit", "Degree plan and semester roadmap", "S"]] as [string, string, string, ReactNode][] : []),
    ["handshake", "Handshake", "Saved jobs and career events, if your school uses it", "h"],
  ];
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h2 className="conn-title">Start with your resume</h2>
      </div>
      <div className="remy-prompt">
        <Remy size={40} mood={busy ? "think" : "wave"} />
        <p>{ownerView ? "About 5 minutes. Your resume is what I build everything on, and I only use what's on it." : <><b>Hi{first ? `, ${first}` : ""}! I'm Remy. </b>Setup takes about 5 minutes. Your resume is what I build everything on: your profile, the openings I find and every application I help with, and I only use what's on it. No resume yet? We can build one together.</>}</p>
      </div>

      <div className="stack-sm">
        <div className="conn-row">
          <span className="conn-ico resume" aria-hidden><FileText size={18} /></span>
          <div className="grow"><b>Resume / CV</b><span>{w.resume ? `${w.resume.fileName} · ${w.resume.doc.sections.length} sections${w.resume.parsedBy === "ai" ? ", checked against your file" : w.resume.parsedBy === "builder" ? ", built with Remy" : ""}` : "Required. PDF, Word or text"}</span></div>
          {w.resume ? <span className="conn-badge done"><Check size={13} /> Added</span> : <span className="conn-badge">Needed</span>}
          {w.resume && <button className="btn btn-secondary btn-sm" onClick={() => setOpen(open === "resume" ? "" : "resume")} disabled={busy} aria-expanded={open === "resume"} data-testid="button-source-resume">{open === "resume" ? "Cancel" : "Replace"}</button>}
        </div>
        {(open === "resume" || !w.resume) && <div className="conn-panel fade-up" data-testid={w.resume ? "resume-loaded" : undefined}><ResumeUpload compact={!!w.resume} onBusy={(b) => { if (b) setReader("resume"); setBusy(b); }} onDone={() => setOpen("")} /></div>}
        {!w.resume && (
          <div className="conn-row" style={{ background: "var(--fox-soft)", borderColor: "transparent" }}>
            <span className="conn-ico" aria-hidden><Sparkles size={18} /></span>
            <div className="grow"><b>No resume yet? Build one with Remy</b><span>Most freshmen start here. A few taps and short answers, about 10 minutes. Only what you say goes on it.</span></div>
            <button className="btn btn-primary btn-sm" onClick={() => setPage("build")} data-testid="button-build-resume">{w.builder ? "Continue building" : "Build my resume"}</button>
          </div>
        )}
      </div>

      {/* Phones (Dilan, Nov 25): the optional accounts fold into one row so the resume stays the one thing on screen. */}
      <details className="conn-more" open={!phone}>
      <summary className="eyebrow" data-testid="toggle-other-accounts">Other accounts · optional<span className="conn-more-hint">LinkedIn, school email, transcript</span></summary>
      <div className="stack-sm">
        <div className="conn-row">
          <span className="conn-ico linkedin" aria-hidden><LinkedInMark /></span>
          <div className="grow"><b>LinkedIn</b><span>{linkedin ? `${linkedin.fileName} · ${linkedin.factsAdded} fact${linkedin.factsAdded === 1 ? "" : "s"} to review on the next step` : "Download your profile as a PDF (your profile → More → Save to PDF), then upload it here"}</span></div>
          {linkedin ? <span className="conn-badge done"><Check size={13} /> Added</span> : <span className="conn-badge">Not added</span>}
          <button className="btn btn-secondary btn-sm" onClick={() => setPage("linkedin")} disabled={busy} title={busy ? "Wait for your resume to finish reading" : undefined} data-testid="button-source-linkedin">{linkedin ? "Upload again" : "Upload PDF"}</button>
        </div>
        {/* Shown to everyone from the start; school-only tools appear below once the email is verified. */}
        {atTcu(me) ? <SchoolVerify /> : (
          <>
            <div className="conn-row">
              <span className="conn-ico" aria-hidden><Mail size={18} /></span>
              <div className="grow"><b>School email</b><span>{ownerView ? "Verify your student email to see alumni from your school" : "Verify your student email to unlock your school's tools, like adding your degree plan"}</span></div>
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(open === "school" ? "" : "school")} data-testid="button-source-school">{open === "school" ? "Close" : "Verify"}</button>
            </div>
            {open === "school" && <div className="fade-up"><SchoolVerify /></div>}
          </>
        )}
        {gc.available && <div className="conn-row">
          <span className="conn-ico gcal" aria-hidden><CalendarMark /></span>
          <div className="grow"><b>Google Calendar</b><span>Your deadlines and interviews in a separate “Remy” calendar. Remy can't see your other calendars, and deletes it the moment you delete your account.</span></div>
          {gc.connected ? <span className="conn-badge done"><Check size={13} /> Connected</span>
            : gc.signedIn ? <button className="btn btn-secondary btn-sm" onClick={() => gc.connect("setup")} data-testid="button-source-gcal">Connect</button>
            : <span className="conn-badge">Sign in to connect</span>}
        </div>}
        {ownerView ? (
          <>
            {/* Owners: the transcript moved here from Settings (Dilan, Nov 22). Optional; facts wait for approval on the next step. */}
            <div className="conn-row">
              <span className="conn-ico" aria-hidden><GraduationCap size={18} /></span>
              <div className="grow"><b>Unofficial transcript</b><span>{transcript ? `${transcript.fileName} · ${transcript.factsAdded} thing${transcript.factsAdded === 1 ? "" : "s"} added. Edit them in Account anytime.` : "Your courses, credits and GPA, so Remy knows what you've already taken."}</span></div>
              {transcript ? <span className="conn-badge done"><Check size={13} /> Added</span> : <span className="conn-badge">Optional</span>}
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(open === "transcript" ? "" : "transcript")} disabled={busy} aria-expanded={open === "transcript"} data-testid="button-source-transcript">{open === "transcript" ? "Close" : transcript ? "Add again" : "Add"}</button>
            </div>
            {open === "transcript" && <div className="conn-panel fade-up"><ProfileImport kind={TRANSCRIPT} pdfOnly hint="Download your unofficial transcript as a PDF from your school's student portal, then upload it here." onBusy={(b) => { if (b) setReader("transcript"); setBusy(b); }} onDone={() => setOpen("")} /></div>}
            {!gc.available && <p className="xs muted conn-soon" data-testid="conn-soon">Coming soon: Google Calendar.</p>}
          </>
        ) : <p className="xs muted conn-soon" data-testid="conn-soon">Coming soon: {[...(gc.available ? [] : ["Google Calendar"]), ...soon.map(([, title]) => title)].join(", ")}.</p>}
      </div>
      </details>
      <p className="xs muted">Remy never asks for your passwords. <a className="auth-link" href="/policies">How Remy handles your information</a></p>
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack} disabled={busy} data-testid="button-ob-back-resume"><ArrowLeft size={16} /> Back</button>
        <span className="xs muted grow" style={{ textAlign: "right" }}>{!w.resume && "Add your resume, or build one, to continue."}</span>
        <button className="btn btn-primary" onClick={onNext} disabled={!w.resume || busy} data-testid="button-ob-next-sources">Continue <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

export const PROFILE_FIELDS: [keyof Profile, string, string?][] = [
  ["path", "Where are you right now?"], ["goal", "What you're working toward", "e.g. a summer 2027 finance internship in Dallas"], ["name", "Full name"], ["preferredName", "What should Remy call you?"], ["applicationEmail", "Email for applications", "e.g. you@tcu.edu"], ["school", "School"], ["major", "Major(s)"], ["minors", "Minor(s)"], ["gpa", "GPA", "e.g. 3.6 (optional)"],
  ["classYear", "Class year"], ["graduation", "Expected graduation", "e.g. May 2029"], ["location", "Location"], ["targetRoles", "Roles you're curious about", "e.g. investment banking, fintech"],
  ["regions", "Where should Remy look?", "e.g. Fort Worth, Dallas, Remote"], ["opportunityTypes", "Kinds of opportunities", "e.g. Internships, Events"],
  ["timeline", "When do you want to start?", "e.g. Summer 2027 (empty = open to anything)"], ["relocation", "Open to relocating?"], ["workAuth", "Work authorization"],
  ["dreamEmployers", "Dream employers", "e.g. PwC, EY (searched first)"], ["avoid", "Anything to leave out?", "e.g. audit, sales (hidden from your openings)"],
  ["constraints", "Anything that limits what you can take?", "e.g. Needs to be paid, Up to 15 hours a week"], ["worries", "What worries you most?", "e.g. Interviews"],
];

// Onboarding asks roles, regions and opportunity types on its own preferences step, so its review step leaves them out.
const PREF_KEYS: (keyof Profile)[] = ["classYear", "graduation", "targetRoles", "regions", "opportunityTypes", "timeline", "relocation", "workAuth", "dreamEmployers", "avoid", "constraints", "worries"];
/** draft: when given, the parent saves unsaved edits itself (setup's "Looks right"), so there's no separate Save button. */
export function ProfileForm({ onSaved, hidePrefs, draft, compact }: { onSaved?: () => void; hidePrefs?: boolean; draft?: { current: Profile | null }; compact?: boolean }) {
  const [typing, setTyping] = useState(""); // name notes wait until the student leaves the field
  // compact (setup on phones): filled answers show as short rows; Edit opens that one box.
  const [editing, setEditing] = useState<string[]>([]);
  const asRow = (k: string, v: string, warn = "") => compact && !!v.trim() && !warn && !editing.includes(k);
  const { ws, save, run } = useStore();
  const [p, setP] = useState<Profile>(ws!.profile);
  // When the saved profile changes underneath (a conflict answered on the same page, a save elsewhere), take the new
  // values but keep what the student typed and hasn't saved yet: "What should Remy call you?" was wiped this way.
  const base = useRef<Profile>(ws!.profile);
  useEffect(() => {
    const before = base.current;
    base.current = ws!.profile;
    setP((cur) => {
      const next: Record<string, unknown> = { ...ws!.profile };
      for (const k of Object.keys(cur) as (keyof Profile)[]) if (JSON.stringify(cur[k]) !== JSON.stringify(before[k])) next[k] = cur[k];
      return next as unknown as Profile;
    });
  }, [ws!.profile]);
  const dirty = JSON.stringify(p) !== JSON.stringify(ws!.profile);
  if (draft) draft.current = dirty ? p : null;
  return (
    <div className="stack">
      <div className="grid-2">
        {PROFILE_FIELDS.filter(([k]) => !(hidePrefs && PREF_KEYS.includes(k)) && !(k === "classYear" && !p.classYear && !yearOptions(p.path).length) && !(k === "minors" && !p.minors && p.path === "high-school")).map(([k, label0, ph]) => {
          const label = p.path && p.path !== "four-year" ? ({ major: "Program, trade or field", classYear: "Year (if in school)", graduation: "Expected finish date" } as Record<string, string>)[k] || label0 : label0;
          const v = String(p[k] ?? "");
          if (asRow(k, v, (k === "name" || k === "preferredName") ? nameConcern(v, k === "preferredName") || "" : "")) return <ProfileRow key={k} k={k} label={label} value={k === "path" ? PATHS.find(([x]) => x === v)?.[1] || v : v} onEdit={() => setEditing([...editing, k])} />;
          return (
          <label key={k} className="field">
            <span>{label}</span>
            {k === "path" ? (
              <select className="select" value={p.path || ""} onChange={(e) => setP({ ...p, path: e.target.value })} data-testid="select-path">
                <option value="">Choose…</option>
                {PATHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : k === "workAuth" || k === "relocation" ? (
              <select className="select" value={p[k] || ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} data-testid={`select-profile-${k}`}>
                <option value="">Choose…</option>
                {(k === "workAuth" ? [...AUTH_OPTS, ...(p.workAuth && !AUTH_OPTS.includes(p.workAuth) ? [p.workAuth] : [])] : RELOC_OPTS).map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : k === "classYear" ? (
              <select className="select" value={p.classYear} onChange={(e) => setP({ ...p, classYear: e.target.value })} data-testid="select-class-year">
                <option value="">Choose…</option>
                {[...yearOptions(p.path), ...(p.classYear && !yearOptions(p.path).includes(p.classYear) ? [p.classYear] : [])].map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" maxLength={600} value={p[k] ?? ""} placeholder={ph} onChange={(e) => setP({ ...p, [k]: e.target.value })} onFocus={() => setTyping(k)} onBlur={() => setTyping("")} data-testid={`input-profile-${k}`} />
            )}
            {compact && editing.includes(k) && (
              <span className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={async () => { const r = await run(() => save("profile", { ...ws!.profile, [k]: p[k] })); if (r) setEditing(editing.filter((x) => x !== k)); }} data-testid={`button-save-profile-${k}`}>Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setP({ ...p, [k]: ws!.profile[k] }); setEditing(editing.filter((x) => x !== k)); }} data-testid={`button-cancel-profile-${k}`}>Cancel</button>
              </span>
            )}
            {(k === "name" || k === "preferredName") && typing !== k && nameConcern(p[k] || "", k === "preferredName") && <span className="xs field-warn" role="note" data-testid={`warn-profile-${k}`}>{nameConcern(p[k] || "", k === "preferredName")}</span>}
          </label>
          );
        })}
      </div>
      {/* Setup already asked "What you're working toward", so an empty Goals box isn't asked twice there. */}
      {hidePrefs && !p.goals ? null : asRow("goals", p.goals || "") ? <ProfileRow k="goals" label="Goals" value={p.goals} onEdit={() => setEditing([...editing, "goals"])} /> :
      <label className="field"><span>Goals</span><textarea className="textarea" maxLength={600} value={p.goals} onChange={(e) => setP({ ...p, goals: e.target.value })} placeholder="What would a great next year look like?" data-testid="input-profile-goals" /></label>}
      {!draft && (<div className="row">
        <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={async () => { const r = await run(() => save("profile", p), "Profile saved"); if (r) onSaved?.(); }} data-testid="button-save-profile">Save profile</button>
        {dirty && <span className="xs muted">Unsaved changes</span>}
      </div>)}
    </div>
  );
}

function ProfileRow({ k, label, value, onEdit }: { k: string; label: string; value: string; onEdit: () => void }) {
  return (
    <div className="pf-row">
      <span className="grow"><span className="xs muted">{label}</span><b>{value}</b></span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit} aria-label={`Edit ${label}`} data-testid={`button-edit-profile-${k}`}>Edit</button>
    </div>
  );
}

const TYPE_OPTS = ["Internships", "Full-time jobs", "Part-time / campus jobs", "Programs & insight days", "Events & networking", "Competitions"];
const RELOC_OPTS = ["Yes", "For the right role", "No"];
/** The next few terms a student could start something, e.g. Spring 2027, Summer 2027, Fall 2027, Summer 2028. */
function timelineOptions(today = new Date()) {
  const y = today.getFullYear(), late = today.getMonth() >= 6;
  const s1 = late ? y + 1 : y;
  return [late ? `Spring ${y + 1}` : `Fall ${y}`, `Summer ${s1}`, `Fall ${s1}`, `Summer ${s1 + 1}`, "Full-time after graduation"];
}
const splitList = (v: string) => v.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);

function Chips({ options, value, onChange, multi = true, testid }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean; testid: string }) {
  return (
    <div className="pref-chips" role="group">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" className="pref-chip" aria-pressed={on} onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : [o])} data-testid={`${testid}-${o.toLowerCase().replace(/\W+/g, "-")}`}>{o}</button>
        );
      })}
    </div>
  );
}

/** One question card. No numbers (Dilan, Nov 27: "5, 6, 7, 8, 9" confused him); `why` says what the answer changes. */
function Q({ why, children }: { why: string; children: ReactNode }) {
  return <div className="pref-q"><div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>{children}<span className="xs muted pref-why">{why}</span></div></div>;
}

/** Remy's quick questions: class year, where to look, what kinds of
 * opportunities and fields. Saved to the profile; Opportunities filters by them. */
const TRIED_OPTS = ["Nothing yet", "Applied to a few", "Went to a career fair", "Talked to the career center", "Reached out to people"];
const WORRY_OPTS = ["No experience yet", "Not sure what I want", "Feeling behind", "Interviews", "My resume", "Talking to people"];

function Preferences({ onBack }: { onBack: () => void }) {
  const { ws, save, run, setWs } = useStore();
  const p = ws!.profile;
  const owner = useOwnerView();
  // Owners (Nov 23 review): start from what the resume already says (graduation year, home city) instead of blanks.
  // Only a year that is one of this path's choices counts, so a stale "Junior" never answers it for a high-schooler.
  const [year, setYear] = useState([p.classYear, guessYearFor(p.path || "", p.graduation)].filter((y) => yearOptions(p.path).includes(y)).slice(0, 1));
  const [grad, setGrad] = useState(p.graduation);
  // Asked once (Dilan, Nov 27): when the resume or profile already says the year, it shows as a line with Change.
  const [yearOpen, setYearOpen] = useState(() => !year.length);
  const [timeline, setTimeline] = useState(splitList(p.timeline || ""));
  // Places near the student (their city and state), not Texas for everyone: shared/regions.ts.
  const regionOpts = regionOptions(p.location || "");
  const [regions, setRegions] = useState(p.regions ? splitList(p.regions) : regionOpts.filter((r) => r === (p.location || "").split(",")[0].trim()));
  const [otherRegion, setOtherRegion] = useState("");
  const [types, setTypes] = useState(p.opportunityTypes ? splitList(p.opportunityTypes) : defaultTypes(p.goal, p.path));
  const [fields, setFields] = useState(p.targetRoles ? splitFieldList(p.targetRoles) : fieldFromMajor(p.major));
  // Grades for high school, two years for community college, no year question for work, trade or service paths.
  const yearOpts = yearOptions(p.path);
  const [otherField, setOtherField] = useState("");
  // Field groups open like a dropdown: the ones with a pick, or that match the student's major or goal, start open.
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const about = `${p.major || ""} ${p.goal || ""}`;
    const picked = splitFieldList(p.targetRoles);
    return FIELD_GROUPS.filter(([, opts]) => opts.some((o) => picked.includes(o) || FIELD_MAJORS[o]?.test(about))).map(([g]) => g);
  });
  // Phones: one search box finds a field across every group, so nobody scrolls through all of them.
  const phone = useIsMobile();
  const [fieldQ, setFieldQ] = useState("");
  const fieldHits = fieldQ.trim() ? FIELD_GROUPS.flatMap(([, o]) => o).filter((o, i, all) => all.indexOf(o) === i && o.toLowerCase().includes(fieldQ.trim().toLowerCase())) : [];
  const toggleGroup = (g: string) => setOpenGroups((o) => (o.includes(g) ? o.filter((x) => x !== g) : [...o, g]));
  const [unsure, setUnsure] = useState(!!ws!.onboarding.exploring);
  const [page, setPage] = useState(0);
  const [auth, setAuth] = useState(authChip(p.workAuth));
  const [reloc, setReloc] = useState(p.relocation ? [p.relocation] : []);
  const [dream, setDream] = useState(p.dreamEmployers || "");
  const [avoid, setAvoid] = useState(p.avoid || "");
  const [limits, setLimits] = useState(splitList(p.constraints || ""));
  const [tried, setTried] = useState(splitList(p.tried || ""));
  const [worries, setWorries] = useState(splitList(p.worries || ""));
  const [worryText, setWorryText] = useState("");
  const allFields = [...fields, ...splitList(otherField)];
  // Two short screens: what you want, then where and the practical bits.
  const missing = (page === 0
    ? [yearOpts.length && !year.length && "your year", !allFields.length && !unsure && "at least one field (or \"I'm not sure yet\")", !types.length && "what kinds of opportunities"]
    : []).filter(Boolean);
  const toPage = (n: number) => { setPage(n); window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
  // Page 1's picks are saved before page 2, so a refresh there doesn't lose them (the rest saves on "Save and continue").
  const nextPage = async () => {
    const r = await run(() => save("profile", { ...p, classYear: year[0] || "", graduation: grad.trim(), timeline: timeline.join(", "), opportunityTypes: types.join(", "), targetRoles: allFields.join(", ") }));
    // "I'm not sure yet" lives with setup, not the profile.
    const o = r && unsure !== !!ws!.onboarding.exploring ? await run(() => save("onboarding", { ...ws!.onboarding, exploring: unsure })) : r;
    if (r && o) toPage(1);
  };
  const submit = async () => {
    const r = await run(() => save("profile", {
      ...p,
      classYear: year[0] || "",
      graduation: grad.trim(),
      timeline: timeline.join(", "),
      regions: [...regions, ...splitList(otherRegion)].join(", "),
      opportunityTypes: types.join(", "),
      targetRoles: allFields.join(", "),
      workAuth: auth[0] || (authChip(p.workAuth).length ? "" : p.workAuth),
      relocation: reloc[0] || "",
      dreamEmployers: dream.trim(),
      avoid: avoid.trim(),
      constraints: limits.join(", "),
      tried: tried.join(", "),
      worries: [...worries, ...(worryText.trim() ? [worryText.trim()] : [])].join(", ").slice(0, 400),
    }), "Got it — Remy is searching for openings that fit");
    if (!r) return;
    if (unsure && !allFields.length && !ws!.tasks.some((t) => t.link === "/path?tab=career" && !t.done))
      await save("tasks", [{ id: rid("t"), title: "Explore the jobs your major leads to", why: "You said you're not sure yet. My Path lists the jobs people with your major go into, what each one is really like, and lets you add the ones you like to your search.", due: "", category: "Explore", done: false, source: "Setup", link: "/path?tab=career" }, ...ws!.tasks]);
    // Start the search now so results are ready by the last step.
    api<{ workspace: Workspace }>("POST", "/api/jobs/discover", {}).then((d) => { setWs(d.workspace); return reloadJobs(); }).catch(() => {});
    // "Not sure yet" and the move to the next step in one save (two saves would let the older copy win).
    await save("onboarding", { ...ws!.onboarding, exploring: unsure, step: 4 });
  };
  return (
    <div className="stack-lg">
      <div className="remy-prompt">
        <Remy size={44} mood="wave" />
        <div className="stack-sm">
          <span className="eyebrow">Page {page + 1} of 2</span>
          <p>{page === 0
            ? <><b>Remy:</b> What are you looking for? This decides which openings I show you, and anything that rules you out stays hidden.</>
            : <><b>Remy:</b> Almost there. Where should I look, and is there anything that would rule an opening out?</>}</p>
        </div>
      </div>
      <div className="stack-lg fade-up" key={page}>
        {page === 0 ? <>
          <Q why="So I suggest what fits your year, not a senior's.">{!yearOpen ? <span className="row" style={{ gap: 8 }}><strong data-testid="text-pref-year">{/grade/.test(year[0]) ? "You're in" : "You're a"} {year[0].toLowerCase()}{grad.trim() ? `, finishing ${grad.trim()}` : ""}.</strong><button type="button" className="btn btn-ghost btn-sm" onClick={() => setYearOpen(true)} data-testid="button-pref-year-change">Change</button></span> : <>{yearOpts.length ? <strong>What year are you in?</strong> : <strong>When did you finish school? <span className="muted xs">(optional)</span></strong>}<div className="pref-inline">{yearOpts.length > 0 && <Chips options={yearOpts} value={year} onChange={setYear} multi={false} testid="pref-year" />}
            <label className="field" style={{ maxWidth: 260 }}><span className="xs muted">{yearOpts.length ? "Expected graduation" : "Graduation"}</span><input className="input" value={grad} onChange={(e) => setGrad(e.target.value)} placeholder="e.g. May 2029" data-testid="input-pref-grad" /></label></div></>}</Q>
          <Q why="These decide which openings I search for first."><strong>Which fields or roles interest you?</strong>
            {!owner && <div className="stack-sm" style={{ gap: 6 }}>
              <button type="button" className="pref-chip pref-unsure" aria-pressed={unsure} onClick={() => setUnsure(!unsure)} data-testid="pref-unsure">I'm not sure yet</button>
              {unsure && <span className="xs muted fade-up">No problem. Pick any that sound interesting, or none. Remy will search by your major and show you where it leads on My Path.</span>}
            </div>}
            {phone && <input className="input" type="text" enterKeyHint="search" value={fieldQ} onChange={(e) => setFieldQ(e.target.value)} placeholder="Search fields, e.g. nursing" aria-label="Search fields" data-testid="input-pref-field-search" />}
            {fieldQ.trim() ? (fieldHits.length ? <Chips options={fieldHits} value={fields} onChange={setFields} testid="pref-field" />
              : <span className="xs muted">No field by that name. Type it in the box below and Remy searches for it.</span>) :
            <div className="pref-groups">
              {FIELD_GROUPS.map(([group, opts]) => {
                const open = openGroups.includes(group);
                const picked = opts.filter((o) => fields.includes(o));
                const id = "fg-" + group.toLowerCase().replace(/\W+/g, "-");
                return (
                  <div key={group} className={"pref-group" + (open ? " open" : "")}>
                    <button type="button" className="pref-group-head" aria-expanded={open} aria-controls={id} onClick={() => toggleGroup(group)} data-testid={`pref-group-${group.toLowerCase().replace(/\W+/g, "-")}`}>
                      <span className="grow"><b>{group}</b><span className="xs muted">{picked.length ? `${picked.length} picked: ${picked.join(", ")}` : `${opts.length} fields`}</span></span>
                      <ChevronDown size={18} aria-hidden />
                    </button>
                    {open && <div id={id} className="pref-group-body fade-up"><Chips options={opts} value={fields} onChange={setFields} testid="pref-field" /></div>}
                  </div>
                );
              })}
            </div>}
            {/* Owners: "not sure" sits beside the free-text box, saving a row (Dilan, Nov 23: no scrolling). */}
            <div className={owner ? "pref-inline" : undefined} style={owner ? undefined : { display: "contents" }}>
              <input className="input pref-grow" value={otherField} onChange={(e) => setOtherField(e.target.value)} placeholder="Something more specific?" aria-label="Other fields" data-testid="input-pref-field" />
              {owner && <button type="button" className="pref-chip pref-unsure" aria-pressed={unsure} onClick={() => setUnsure(!unsure)} data-testid="pref-unsure">I'm not sure yet</button>}
            </div>
            {owner && unsure && <span className="xs muted fade-up">No problem. Pick any that sound interesting, or none. Remy will search by your major and show you where it leads on My Path.</span>}</Q>
          <div className="pref-pair">
          <Q why="Only these kinds show up in Opportunities."><strong>What kinds of opportunities do you want?</strong><Chips options={TYPE_OPTS} value={types} onChange={setTypes} testid="pref-type" /></Q>
          <Q why="I hide openings that start before you can."><strong>When do you want to start?</strong><Chips options={timelineOptions()} value={timeline} onChange={setTimeline} testid="pref-when" />
            <span className="xs muted">Pick all that work. Leave empty if you're open to anything.</span></Q>
          </div>
        </> : <>
          <Q why="I only show openings in these places, plus remote."><strong>Where should I look for you?</strong><Chips options={[...regionOpts, ...regions.filter((r) => !regionOpts.includes(r))]} value={regions} onChange={setRegions} testid="pref-region" />
            {regionHint(regions) && <p className="xs muted" data-testid="text-region-hint">{regionHint(regions)}</p>}
            <div className="pref-inline"><input className="input pref-grow" value={otherRegion} onChange={(e) => setOtherRegion(e.target.value)} placeholder="Somewhere else? e.g. Chicago" aria-label="Other regions" data-testid="input-pref-region" />
            <span className="xs muted">Open to relocating?</span><Chips options={RELOC_OPTS} value={reloc} onChange={setReloc} multi={false} testid="pref-reloc" /></div></Q>
          <div className="pref-pair">
          <Q why="Only used to skip postings you couldn't take."><strong>Work authorization <span className="muted xs">(optional)</span></strong><Chips options={AUTH_OPTS} value={auth} onChange={setAuth} multi={false} testid="pref-auth" />
            <span className="xs muted">Only to skip postings you can't take: "won't sponsor" ones if you'll need sponsorship, U.S. citizens only ones if you aren't one. You can still open them. Leave it blank and nothing is hidden.</span></Q>
          <Q why="I check their career sites before anyone else's."><strong>Dream employers <span className="muted xs">(optional)</span></strong>
            <input className="input" value={dream} onChange={(e) => setDream(e.target.value)} placeholder="e.g. Goldman Sachs" aria-label="Dream employers" data-testid="input-pref-dream" />
            <span className="xs muted">Remy checks their career sites first.</span></Q>
          </div>
          <div className="pref-pair">
          <Q why="Anything that matches stays hidden."><strong>Anything to leave out? <span className="muted xs">(optional)</span></strong>
            <input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="e.g. tobacco, cold calling" aria-label="Things to avoid" data-testid="input-pref-avoid" /></Q>
          <Q why="So I don't suggest openings you can't take."><strong>Anything that limits what you can take? <span className="muted xs">(optional)</span></strong><Chips options={LIMIT_OPTS} value={limits} onChange={setLimits} testid="pref-limit" /></Q>
          </div>
          <div className="pref-pair">
          <Q why="So your plan doesn't repeat what you've already done."><strong>What have you tried so far? <span className="muted xs">(optional)</span></strong><Chips options={TRIED_OPTS} value={tried} onChange={setTried} testid="pref-tried" /></Q>
          <Q why="Your plan's first step starts here."><strong>What worries you most about this? <span className="muted xs">(optional)</span></strong><Chips options={WORRY_OPTS} value={worries} onChange={setWorries} testid="pref-worry" />
            <input className="input" value={worryText} onChange={(e) => setWorryText(e.target.value)} maxLength={200} placeholder="Or in your own words" aria-label="Your worry" data-testid="input-pref-worry" />
</Q>
          </div>
          {/* Remy repeats it back in one line before saving, so the student can catch anything wrong. */}
          <p className="small" data-testid="prefs-summary"><b>So:</b> {[year[0], allFields.slice(0, 3).join(", ") || (unsure ? "still exploring" : ""), types.join(", "), timeline.join(", "), [...regions, ...splitList(otherRegion)].join(", "), limits.join(", "), [...worries, worryText.trim()].filter(Boolean).length ? `worried about ${[...worries, worryText.trim()].filter(Boolean).join(", ").toLowerCase()}` : ""].filter(Boolean).join(" · ")}. <span className="muted">Change anything above if it's off.</span></p>
        </>}
      </div>
      {missing.length > 0 && <p className="xs muted" data-testid="prefs-missing">To continue, choose {missing.join(", ")}.</p>}
      <div className="row-between">
        <button className="btn btn-ghost" onClick={() => (page ? toPage(0) : onBack())}><ArrowLeft size={16} /> Back</button>
        {page === 0
          ? <button className="btn btn-primary" onClick={nextPage} disabled={missing.length > 0} data-testid="button-ob-prefs-page">Next <ArrowRight size={16} /></button>
          : <button className="btn btn-primary" onClick={submit} disabled={missing.length > 0} data-testid="button-ob-next-prefs">Save and continue <ArrowRight size={16} /></button>}
      </div>
    </div>
  );
}

function Review({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, save, run, setWs } = useStore();
  const w = ws!;
  const profileDraft = useRef<Profile | null>(null);
  const unverified = w.resume?.doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.verified === false) || [];
  const [skipVerify, setSkipVerify] = useState(false);
  // Tester, Nov 25: this page "takes a lot of reading and editing". Remy now says what he found in short rows, then asks
  // about each mismatch between the resume and LinkedIn (or the profile) one at a time.
  const checks = useAsks().filter((a) => CHECK_KINDS.includes(a.kind));
  const [checking, setChecking] = useState(false);
  // Value first: start the search from the resume alone, so real openings show before any more questions.
  const { jobs, fits } = useJobs();
  const [looking, setLooking] = useState(false);
  useEffect(() => {
    if (!w.resume || (jobs && jobs.length)) return;
    setLooking(true);
    api<{ workspace: Workspace }>("POST", "/api/jobs/discover", {}).then((d) => { setWs(d.workspace); return reloadJobs(); }).catch(() => {}).finally(() => setLooking(false));
  }, []);
  const first = (jobs || []).filter((j) => !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false).slice(0, 3);
  if (checking) return <SetupChecks onBack={() => setChecking(false)} onNext={onNext} />;
  return (
    <div className="stack-lg">
      {(looking || first.length > 0) && (
        <div className="notice" data-testid="first-matches">
          {first.length ? <div><strong>First openings that fit your resume</strong><ul className="plan-matches">{first.map((j) => <li key={j.id} className="small"><b>{j.title}</b> <span className="muted">at {j.company}</span></li>)}</ul><span className="xs muted">Your next answers sharpen these.</span></div>
            : <span className="row small"><Spinner /> Remy is already checking employers' career sites for openings that fit your resume…</span>}
        </div>
      )}
      <div className="stack-sm">
        <h2>Here's what I found</h2>
        <p className="small muted">Tap Edit on anything that's off, or fill in what's empty. Remy only uses what you confirm here.</p>
      </div>
      <ProfileForm hidePrefs draft={profileDraft} compact />
      {atAlumniSchool(w) && !skipVerify && <SchoolVerify onSkip={() => setSkipVerify(true)} />}
      {w.resume && (
        <div className="stack-sm">
          <h3>From your resume</h3>
          <div className="row">
            {w.resume.doc.sections.map((s) => <span key={s.id} className="chip chip-plain">{s.heading === s.heading.toUpperCase() ? s.heading.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : s.heading} · {s.entries.length}</span>)}
          </div>
          {w.resume.parsedBy === "builder" ? (
            <span className="xs muted row"><Check size={14} style={{ color: "var(--sage)" }} /> Built with Remy from your own answers. Edit any line in Resume/CV.</span>
          ) : unverified.length > 0 ? (
            <div className="notice notice-warn"><div>{unverified.length} line(s) couldn't be matched word-for-word to your file. You can fix them in Resume/CV.</div></div>
          ) : (
            <span className="xs muted row"><Check size={14} style={{ color: "var(--sage)" }} /> Every bullet matches your original file word-for-word.</span>
          )}
          {w.resume.parsedBy === "rules" && <div className="notice notice-warn" data-testid="rules-parse-warning"><div>Remy's AI reader was busy, so a simpler reader sorted your resume. The words are yours, but check in Resume/CV that each job has its own bullets and your degree line reads right.</div></div>}
        </div>
      )}
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <button className="btn btn-primary" onClick={async () => {
          // Every line matched the file word for word and the student says it's right: that's a confirmed resume.
          // Edits typed above count as confirmed too; without this they were lost on "Looks right".
          if (profileDraft.current && !(await run(() => save("profile", profileDraft.current!)))) return;
          if (w.resume && !w.resume.confirmedAt && !unverified.length) await run(() => api<Workspace>("PUT", "/api/resume/doc", { doc: w.resume!.doc, confirm: true }).then(setWs));
          if (checks.length) setChecking(true); else onNext();
        }} data-testid="button-ob-next-review">Looks right <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

/** Mismatches between the resume and the student's other sources: what setup asks about after "Looks right". */
const CHECK_KINDS: Ask["kind"][] = ["conflict", "name", "profile", "facts"];

/** One mismatch at a time, Remy's own question card (as on My Path): pick which is right, Remy fixes it, then the next. */
function SetupChecks({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const asks = useAsks().filter((a) => CHECK_KINDS.includes(a.kind));
  const [shown, setShown] = useState<Ask | null>(null); // the answered one stays up (what Remy did, Undo) until Next
  // Counted from the live list: checks answered here + the one showing + what's still waiting. A check that arrives
  // while the student works (another source finished reading) adds to the total instead of repeating "3 of 4".
  const [done, setDone] = useState<string[]>([]);
  const ask = shown || asks.find((a) => !done.includes(a.id));
  const left = asks.filter((a) => a.id !== ask?.id && !done.includes(a.id)).length;
  const at = done.length + (shown ? 0 : 1);
  return (
    <div className="stack-lg setup-checks" data-testid="setup-checks">
      <div className="stack-sm">
        {ask && <span className="xs muted" data-testid="text-check-count">{at} of {at + left}</span>}
        <h2>{ask ? "A few quick checks" : "That's everything"}</h2>
        <p className="small muted">{ask ? "Remy compared your resume with your other sources. Pick what's right and he fixes it." : "Thanks. Everything Remy uses now matches what you picked."}</p>
      </div>
      {ask && <AskCard key={ask.id} ask={ask} kicker={false} next={left} onAnswered={() => { setShown(ask); setDone((d) => (d.includes(ask.id) ? d : [...d, ask.id])); }} onNext={() => setShown(null)} />}
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        {(!ask || (shown && !left)) && <button className="btn btn-primary" onClick={onNext} data-testid="button-ob-next-checks">Continue <ArrowRight size={16} /></button>}
      </div>
    </div>
  );
}

function Questions({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, setWs, save, run, config, toast } = useStore();
  const w = ws!;
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  // The answer being saved shows right away, so Next feels instant.
  const [pending, setPending] = useState<{ q: string; a: string; toConfirm?: boolean; saved?: boolean } | null>(null);
  const qs = w.onboarding.questions;
  const targets = w.onboarding.targets || [];
  const answered = pending ? [...w.onboarding.answers, { q: pending.q, a: pending.a, toConfirm: pending.toConfirm }] : w.onboarding.answers;
  const idx = answered.length;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!qs.length && config?.ai.available && !busy) {
      setBusy(true);
      run(() => api<Workspace>("POST", "/api/ai/questions")).then((r) => r && setWs(r)).finally(() => setBusy(false));
    }
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [idx, busy]);
  const current = qs[idx];
  const entries = (w.resume?.doc.sections || []).flatMap((s) => s.entries);
  const resumeNames = { orgs: entries.map((e) => e.org).filter(Boolean), roles: entries.map((e) => e.role).filter(Boolean) };
  const submit = async (text: string) => {
    if (pending || !current) return;
    const a = text.trim();
    const i = idx;
    // Each question says which profile field its answer feeds (roles, dream employers, start date…), so it changes the matches.
    // Search fields only take short answers that name things; a sentence ("I don't know yet…") stays in Remy's AI memory instead (see shared/setupReply.ts).
    const target = targets[i] as keyof Profile | undefined;
    // Decided now and kept on the answer, so a later resume edit can't turn Remy's words into the student's.
    const toConfirm = tappedResumeClaim(current, a, w.onboarding.options?.[i] || [], target, resumeNames);
    setPending({ q: current, a, toConfirm });
    setAnswer("");
    const answers = [...w.onboarding.answers, { q: current, a, ...(toConfirm ? { toConfirm } : {}) }];
    try {
      if (a && !toConfirm && target && target in w.profile && fitsField(target, a)) {
        const before = String(w.profile[target] || "").trim();
        // Answering the same question twice (e.g. after a reload) must not repeat the answer.
        if (!alreadyIn(before, a)) await save("profile", { ...w.profile, [target]: before ? `${before}, ${a}` : a });
      }
      if (a) {
        const fact = { id: "f" + Date.now(), text: `${current} — ${a}`, category: "goal", source: toConfirm ? "Tapped one of Remy's suggested answers in setup: keep it only if it's true" : "Onboarding answer", status: toConfirm ? "suggested" : "approved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await save("memory", [...w.memory, fact]);
      }
      setPending({ q: current, a, saved: true }); // the profile and memory saves worked: Remy's reply can say what happened
      const last = answers.length >= qs.length;
      if (last) await new Promise((r) => setTimeout(r, 900)); // let Remy's last reply land before the next step
      // The answers and the move to the next step go in one save, so the last answer can't be overwritten.
      await save("onboarding", { ...w.onboarding, answers, ...(last ? { step: 5 } : {}) });
    } finally {
      setPending(null);
    }
  };
  const options = [...(w.onboarding.options?.[idx] || []), "I'm not sure yet"];
  // Brain dump by voice (owners first, a new feature): the browser hears it and fills the box; nothing is sent until Next.
  const ownerView = useOwnerView();
  const voice = useVoice((t) => setAnswer(t), (t) => setAnswer(t), (m) => toast(m, true));
  return (
    <div className="stack-lg">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "center", gap: 12 }}>
        <Remy size={44} mood={busy ? "think" : pending ? "happy" : "idle"} />
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="eyebrow">{qs.length ? `Question ${Math.min(idx + 1, qs.length)} of ${qs.length}` : "A few questions"}</span>
          <span className="small muted">Three quick questions so I can pick better openings for you.</span>
        </div>
      </div>
      <div className="ob-thread" aria-live="polite">
        {answered.map((x, i) => (
          <div key={i} className="stack-sm">
            <div className="bubble bubble-ai">{x.q}</div>
            <div className="bubble bubble-user fade-up">{x.a || "Skipped"}</div>
            <div className="bubble bubble-ai ob-react fade-up">{pending && !pending.saved && i === answered.length - 1 ? "Saving…" : setupReply(x.a, targets[i], inField(w.profile, targets[i], x.a), !!x.toConfirm)}</div>
          </div>
        ))}
        {busy && <div className="bubble bubble-ai row"><Spinner /> Thinking of a few useful questions…</div>}
        {current && !busy && <div key={idx} className="bubble bubble-ai ob-q fade-up" data-testid="text-question">{current}</div>}
        {!current && !busy && !qs.length && <div className="bubble bubble-ai">Questions need AI, which isn't available right now. You can continue without them.</div>}
        <div ref={end} />
      </div>
      {current && !busy && (
        <div className="stack-sm fade-up" key={"a" + idx}>
          <div className="row" style={{ gap: 6 }}>
            {options.map((o) => <button key={o} type="button" className={"pref-chip" + (o === "I'm not sure yet" ? " pref-unsure" : "")} disabled={!!pending} onClick={() => submit(o)} data-testid="button-answer-option">{o}</button>)}
          </div>
          <textarea className="textarea" autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && answer.trim()) { e.preventDefault(); submit(answer); } }}
            placeholder="Or say it in your own words, as much as you like" aria-label="Your answer" data-testid="input-answer" style={{ minHeight: 96 }} />
          <div className="row-between">
            <span className="row" style={{ gap: 6 }}>
              <button className="btn btn-ghost" disabled={!!pending} onClick={() => submit("")} data-testid="button-skip-question">Skip</button>
              {ownerView && canListen && <button type="button" className={"btn btn-sm " + (voice.on ? "btn-primary remy-listening" : "btn-secondary")} onClick={voice.toggle} disabled={!!pending} aria-label={voice.on ? "Stop listening" : "Say your answer"} aria-pressed={voice.on} data-testid="button-answer-mic">{voice.on ? <Square size={16} /> : <Mic size={16} />} {voice.on ? "Listening…" : "Say it"}</button>}
            </span>
            <button className="btn btn-primary" disabled={!answer.trim() || !!pending} onClick={() => submit(answer)} data-testid="button-answer">Next <ArrowRight size={16} /></button>
          </div>
        </div>
      )}
      {/* Waits for the last answer's save (it always ends: success or error), so a fast Continue can't skip it. */}
      {(!current || !qs.length) && !busy && (
        <div className="row-between">
          <button className="btn btn-ghost" disabled={!!pending} onClick={onBack}><ArrowLeft size={16} /> Back</button>
          <button className="btn btn-primary" disabled={!!pending} onClick={onNext} data-testid="button-ob-next-questions">{pending ? "Saving your answer…" : <>Continue <ArrowRight size={16} /></>}</button>
        </div>
      )}
    </div>
  );
}

function PlanStep({ onBack, onFinish }: { onBack: () => void; onFinish: (tour?: boolean) => void }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
  const owner = useOwnerView();
  const { jobs, fits, refreshing } = useJobs();
  const matches = (jobs || []).filter((j) => !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false && beforePrefs(w, j));
  const [busy, setBusy] = useState(false);
  // Owner view: an opening links into the workspace (finish setup, then open it) — they were dead text before.
  const openJob = async (id: string) => { await onFinish(false); go(`/opportunities?kind=all&id=${id}`); };
  const matchList = (
    <ul className="plan-matches">
      {matches.slice(0, 3).map((j) => (
        <li key={j.id} className="small">
          {owner
            ? <button className="plan-match-link" onClick={() => openJob(j.id)} data-testid="button-plan-opening"><b>{j.title}</b> <span className="muted">at {j.company}</span> <ArrowRight size={13} /></button>
            : <span><b>{j.title}</b> <span className="muted">at {j.company}</span></span>}
        </li>
      ))}
    </ul>
  );
  const make = async () => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/ai/plan"));
    if (r) setWs(r);
    setBusy(false);
  };
  useEffect(() => {
    if (!w.plan && config?.ai.available) make();
  }, []);
  return (
    <div className="stack-lg">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 14 }}>
        <Remy size={52} mood={busy ? "think" : "wave"} />
        <div className="stack-sm">
          <h2>{busy ? "Putting your plan together…" : w.plan ? "Here's where I'd start" : "Your workspace is ready"}</h2>
          <p className="small muted">Suggestions, not requirements. You can change anything.</p>
        </div>
      </div>
      {busy && <WorkingSteps steps={["Reading your resume and answers", "Choosing where to start", "Writing your first to-dos"]} />}
      <div className="notice" data-testid="plan-matches">
        {refreshing || !jobs ? <span className="row"><Spinner /> Remy is checking employers' career sites for openings that fit you…</span>
          : matches.length ? <div><strong>Remy found {matches.length} opening{matches.length === 1 ? "" : "s"} that fit you</strong>{matchList}{owner && !w.plan && <span className="xs muted">Start with the first one — open it to see why it fits and tailor your resume.</span>}</div>
          : w.lastSearch && w.lastSearch.reached < w.lastSearch.scanned / 2
            ? <div><strong>Most employer career sites didn't answer just now</strong><div className="small muted">Remy reached {w.lastSearch.reached} of {w.lastSearch.scanned} (they may be down for maintenance). It will try again in about 30 minutes, and your openings will be waiting in Opportunities.</div></div>
            : <div><strong>No openings fit all your choices right now</strong><div className="small muted">Remy checks again about once a day. Adding more places or fields shows more.</div></div>}
      </div>
      {w.plan && !busy && (
        <div className="stack">
          <div className="notice"><FileText size={16} style={{ color: "var(--plum)", marginTop: 3 }} /><div><strong>{w.plan.nextAction.title}</strong><div className="small muted">{w.plan.nextAction.why}</div></div></div>
          <div className="stack-sm">
            {w.tasks.filter((t) => !t.done).slice(0, 4).map((t) => (
              <div key={t.id} className="item" style={{ padding: "8px 0" }}><div className="item-main"><strong className="small">{t.title}</strong><div className="why">{t.why}</div></div>{t.due && <span className="chip chip-plain">{fmtDate(t.due)}</span>}</div>
            ))}
          </div>
        </div>
      )}
      <div className="card card-pad"><CareerTime /></div>
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div className="row">
          {w.plan && config?.ai.available && <button className="btn btn-secondary" onClick={make} disabled={busy}>Regenerate</button>}
          <button className="btn btn-ghost" onClick={() => onFinish(false)} disabled={busy} title="You can start it anytime from “Show me around again” in the menu under your name" data-testid="button-skip-tour">Skip the tour</button>
          <button className="btn btn-primary" onClick={() => onFinish()} disabled={busy} data-testid="button-enter-workspace">Enter my workspace <ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}
