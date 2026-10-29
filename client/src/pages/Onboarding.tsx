import { uiFlags } from "../lib/router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Mail, Sparkles, Trash2 } from "lucide-react";
import type { Profile, Workspace } from "@shared/types";
import { FIELD_GROUPS } from "@shared/fields";
import { api, FAR_ENOUGH_STEP, fmtDate, rid, useStore } from "../lib/store";
import { reloadJobs, useJobs } from "../lib/jobs";
import { AiUnavailableNote, Remy, Spinner, StatusChip } from "../components/common";
import { ProfileImport, ResumeUpload } from "../components/Uploaders";
import { atAlumniSchool, atTcu, SchoolVerify } from "../components/SchoolVerify";
import { ConflictChoice } from "../components/ConflictChoice";
import { ResumeBuilder } from "../components/ResumeBuilder";
import { LinkedInGuide } from "../components/LinkedInGuide";
import { useGoogleCalendar } from "../components/GoogleCalendar";
import { LinkedInMark } from "./Welcome";

// Step numbers are stored in the workspace; 0 and 1 both open the resume step.
const STEPS = ["Your resume", "Review", "Preferences", "Questions", "Your plan"];

export default function Onboarding() {
  const { ws, save, config } = useStore();
  const w = ws!;
  const step = w.onboarding.step;
  const shown = Math.max(0, step - 1);
  // Coming back partway through: say so and let the student choose, instead of dropping them mid-step.
  const [welcomeBack, setWelcomeBack] = useState(() => step >= FAR_ENOUGH_STEP);
  const setStep = (s: number) => save("onboarding", { ...w.onboarding, step: s });
  const finish = async () => {
    uiFlags.flyIn = true;
    await save("onboarding", { ...w.onboarding, done: true });
  };
  return (
    <div className="ob">
      <div className="row-between" style={{ width: "100%", maxWidth: 740 }}>
        <span className="logo"><Remy size={26} /><span>Remy<b>.</b></span></span>
      </div>
      {!welcomeBack && (
        <ol className="ob-progress" aria-label={`Step ${shown + 1} of ${STEPS.length}: ${STEPS[shown]}`}>
          {STEPS.map((s, i) => <li key={s} className={i <= shown ? "on" : ""} aria-current={i === shown ? "step" : undefined}><span /><em>{s}</em></li>)}
        </ol>
      )}
      <div className="ob-card card card-pad fade-up" key={welcomeBack ? "back" : shown}>
        {welcomeBack ? (
          <WelcomeBack onContinue={() => setWelcomeBack(false)} onRestart={async () => { await save("onboarding", { ...w.onboarding, step: 1, answers: [], questions: [], targets: [] }); setWelcomeBack(false); }} />
        ) : (
          <>
            {step <= 1 && <ResumeStep onNext={() => setStep(2)} />}
            {step === 2 && <Review onBack={() => setStep(1)} onNext={() => setStep(3)} />}
            {step === 3 && <Preferences onBack={() => setStep(2)} />}
            {step === 4 && <Questions onBack={() => setStep(3)} onNext={() => setStep(5)} />}
            {step === 5 && <PlanStep onBack={() => setStep(4)} onFinish={finish} />}
          </>
        )}
      </div>
      {!config?.ai.available && <div style={{ maxWidth: 720, width: "100%" }}><AiUnavailableNote /></div>}
    </div>
  );
}

function WelcomeBack({ onContinue, onRestart }: { onContinue: () => void; onRestart: () => void }) {
  const { ws } = useStore();
  const w = ws!;
  const step = w.onboarding.step;
  const first = (w.profile.preferredName || w.profile.name).split(/\s+/)[0];
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
function ResumeStep({ onNext }: { onNext: () => void }) {
  const { ws, me } = useStore();
  const first = (ws!.profile.preferredName || me?.name || "").trim().split(/\s+/)[0];
  const w = ws!;
  const [open, setOpen] = useState<"" | "resume" | "school">(w.resume ? "" : "resume");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<"" | "build" | "linkedin">("");
  const linkedin = w.imports.find((i) => /linkedin/i.test(i.kind));
  const gc = useGoogleCalendar();
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
        <span className="eyebrow">Step 1 · Connect your accounts</span>
        <h2 className="conn-title">Start with your resume</h2>
      </div>
      <div className="remy-prompt">
        <Remy size={40} mood={busy ? "think" : "wave"} />
        <p><b>Hi{first ? `, ${first}` : ""}! I'm Remy.</b> Setup takes about 5 minutes. Your resume is what I build everything on: your profile, the openings I find and every application I help with, and I only use what's on it. No resume yet? We can build one together.</p>
      </div>

      <div className="stack-sm">
        <div className="conn-row">
          <span className="conn-ico resume" aria-hidden><FileText size={18} /></span>
          <div className="grow"><b>Resume / CV</b><span>{w.resume ? `${w.resume.fileName} · ${w.resume.doc.sections.length} sections${w.resume.parsedBy === "ai" ? ", checked against your file" : w.resume.parsedBy === "builder" ? ", built with Remy" : ""}` : "Required. PDF, Word or text"}</span></div>
          {w.resume ? <span className="conn-badge done"><Check size={13} /> Added</span> : <span className="conn-badge">Needed</span>}
          {w.resume && <button className="btn btn-secondary btn-sm" onClick={() => setOpen(open === "resume" ? "" : "resume")} disabled={busy} aria-expanded={open === "resume"} data-testid="button-source-resume">{open === "resume" ? "Cancel" : "Replace"}</button>}
        </div>
        {(open === "resume" || !w.resume) && <div className="conn-panel fade-up" data-testid={w.resume ? "resume-loaded" : undefined}><ResumeUpload compact={!!w.resume} onBusy={setBusy} onDone={() => setOpen("")} /></div>}
        {!w.resume && (
          <div className="conn-row" style={{ background: "var(--fox-soft)", borderColor: "transparent" }}>
            <span className="conn-ico" aria-hidden><Sparkles size={18} /></span>
            <div className="grow"><b>No resume yet? Build one with Remy</b><span>Most freshmen start here. A few taps and short answers, about 10 minutes. Only what you say goes on it.</span></div>
            <button className="btn btn-primary btn-sm" onClick={() => setPage("build")} data-testid="button-build-resume">{w.builder ? "Continue building" : "Build my resume"}</button>
          </div>
        )}
      </div>

      <div className="stack-sm">
        <span className="eyebrow">Other accounts · optional</span>
        <div className="conn-row">
          <span className="conn-ico linkedin" aria-hidden><LinkedInMark /></span>
          <div className="grow"><b>LinkedIn</b><span>{linkedin ? `${linkedin.fileName} · ${linkedin.factsAdded} fact${linkedin.factsAdded === 1 ? "" : "s"} to review on the next step` : "Adds experience that isn't on your resume"}</span></div>
          {linkedin ? <span className="conn-badge done"><Check size={13} /> Added</span> : <span className="conn-badge">Not added</span>}
          <button className="btn btn-secondary btn-sm" onClick={() => setPage("linkedin")} disabled={busy} title={busy ? "Wait for your resume to finish reading" : undefined} data-testid="button-source-linkedin">{linkedin ? "Add again" : "Connect"}</button>
        </div>
        {/* Shown to everyone from the start; school-only tools appear below once the email is verified. */}
        {atTcu(me) ? <SchoolVerify /> : (
          <>
            <div className="conn-row">
              <span className="conn-ico" aria-hidden><Mail size={18} /></span>
              <div className="grow"><b>School email</b><span>Verify your student email to unlock your school's tools and alumni</span></div>
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(open === "school" ? "" : "school")} data-testid="button-source-school">{open === "school" ? "Close" : "Verify"}</button>
            </div>
            {open === "school" && <div className="fade-up"><SchoolVerify /></div>}
          </>
        )}
        <div className="conn-row">
          <span className="conn-ico gcal" aria-hidden><CalendarMark /></span>
          <div className="grow"><b>Google Calendar</b><span>Your deadlines and interviews in a separate “Remy” calendar. Remy can't see your other calendars, and deletes it the moment you delete your account.</span></div>
          {!gc.available ? <span className="conn-badge">Coming soon</span>
            : gc.connected ? <span className="conn-badge done"><Check size={13} /> Connected</span>
            : gc.signedIn ? <button className="btn btn-secondary btn-sm" onClick={() => gc.connect("setup")} data-testid="button-source-gcal">Connect</button>
            : <span className="conn-badge">Sign in to connect</span>}
        </div>
        {soon.map(([k, title, what, ico]) => (
          <div key={k} className="conn-row">
            <span className={`conn-ico ${k}`} aria-hidden>{ico}</span>
            <div className="grow"><b>{title}</b><span>{what}</span></div>
            <span className="conn-badge">Coming soon</span>
          </div>
        ))}
      </div>
      <p className="xs muted">Remy never asks for your passwords. <a href="/policies">How Remy handles your information</a></p>
      <div className="row-between">
        <span className="xs muted">{!w.resume && "Add your resume, or build one, to continue."}</span>
        <button className="btn btn-primary" onClick={onNext} disabled={!w.resume || busy} data-testid="button-ob-next-sources">Continue <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

const PROFILE_FIELDS: [keyof Profile, string, string?][] = [
  ["name", "Full name"], ["preferredName", "What should Remy call you?"], ["applicationEmail", "Email for applications", "e.g. you@tcu.edu"], ["school", "School"], ["major", "Major(s)"], ["minors", "Minor(s)"], ["gpa", "GPA", "e.g. 3.6 (optional)"],
  ["classYear", "Class year"], ["graduation", "Expected graduation", "e.g. May 2029"], ["location", "Location"], ["targetRoles", "Roles you're curious about", "e.g. investment banking, fintech"],
  ["regions", "Where should Remy look?", "e.g. Fort Worth, Dallas, Remote"], ["opportunityTypes", "Kinds of opportunities", "e.g. Internships, Events"],
];

// Onboarding asks roles, regions and opportunity types on its own preferences step, so its review step leaves them out.
const PREF_KEYS: (keyof Profile)[] = ["classYear", "graduation", "targetRoles", "regions", "opportunityTypes"];
export function ProfileForm({ onSaved, hidePrefs }: { onSaved?: () => void; hidePrefs?: boolean }) {
  const { ws, save, run } = useStore();
  const [p, setP] = useState<Profile>(ws!.profile);
  useEffect(() => { setP(ws!.profile); }, [ws!.profile]);
  const dirty = JSON.stringify(p) !== JSON.stringify(ws!.profile);
  return (
    <div className="stack">
      <div className="grid-2">
        {PROFILE_FIELDS.filter(([k]) => !(hidePrefs && PREF_KEYS.includes(k))).map(([k, label, ph]) => (
          <label key={k} className="field">
            <span>{label}</span>
            {k === "classYear" ? (
              <select className="select" value={p.classYear} onChange={(e) => setP({ ...p, classYear: e.target.value })} data-testid="select-class-year">
                <option value="">Choose…</option>
                {["First-year", "Sophomore", "Junior", "Senior", "Graduate student"].map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" value={p[k] ?? ""} placeholder={ph} onChange={(e) => setP({ ...p, [k]: e.target.value })} data-testid={`input-profile-${k}`} />
            )}
          </label>
        ))}
      </div>
      <label className="field"><span>Goals</span><textarea className="textarea" value={p.goals} onChange={(e) => setP({ ...p, goals: e.target.value })} placeholder="What would a great next year look like?" data-testid="input-profile-goals" /></label>
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={async () => { const r = await run(() => save("profile", p), "Profile saved"); if (r) onSaved?.(); }} data-testid="button-save-profile">Save profile</button>
        {dirty && <span className="xs muted">Unsaved changes</span>}
      </div>
    </div>
  );
}

const YEAR_OPTS = ["First-year", "Sophomore", "Junior", "Senior", "Graduate student"];
const REGION_OPTS = ["Fort Worth", "Dallas", "DFW area", "Houston", "Austin", "Anywhere in Texas", "Remote", "Anywhere in the US"];
const TYPE_OPTS = ["Internships", "Full-time jobs", "Part-time / campus jobs", "Programs & insight days", "Events & networking", "Competitions"];
const AUTH_OPTS = ["U.S. citizen or permanent resident", "I'll need visa sponsorship (F-1 / OPT)"];
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

function Q({ n, children }: { n: number; children: ReactNode }) {
  return <div className="pref-q"><span className="pref-n">{n}</span><div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>{children}</div></div>;
}

/** Remy's quick questions: class year, where to look, what kinds of
 * opportunities and fields. Saved to the profile; Opportunities filters by them. */
function Preferences({ onBack }: { onBack: () => void }) {
  const { ws, save, run, setWs } = useStore();
  const p = ws!.profile;
  const [year, setYear] = useState(p.classYear ? [p.classYear] : []);
  const [grad, setGrad] = useState(p.graduation);
  const [timeline, setTimeline] = useState(splitList(p.timeline || ""));
  const [regions, setRegions] = useState(splitList(p.regions));
  const [otherRegion, setOtherRegion] = useState("");
  const [types, setTypes] = useState(p.opportunityTypes ? splitList(p.opportunityTypes) : ["Internships"]);
  const [fields, setFields] = useState(splitList(p.targetRoles));
  const [otherField, setOtherField] = useState("");
  const [unsure, setUnsure] = useState(!!ws!.onboarding.exploring);
  const [page, setPage] = useState(0);
  const [auth, setAuth] = useState(p.workAuth ? [AUTH_OPTS.find((o) => /sponsor/i.test(o) === /sponsor|visa/i.test(p.workAuth))!] : []);
  const [reloc, setReloc] = useState(p.relocation ? [p.relocation] : []);
  const [dream, setDream] = useState(p.dreamEmployers || "");
  const [avoid, setAvoid] = useState(p.avoid || "");
  const allFields = [...fields, ...splitList(otherField)];
  // Two short screens: what you want, then where and the practical bits.
  const missing = (page === 0
    ? [!year.length && "your year", !allFields.length && !unsure && "at least one field (or \"I'm not sure yet\")", !types.length && "what kinds of opportunities"]
    : [!auth.length && "work authorization"]).filter(Boolean);
  const toPage = (n: number) => { setPage(n); window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
  const submit = async () => {
    const r = await run(() => save("profile", {
      ...p,
      classYear: year[0] || "",
      graduation: grad.trim(),
      timeline: timeline.join(", "),
      regions: [...regions, ...splitList(otherRegion)].join(", "),
      opportunityTypes: types.join(", "),
      targetRoles: allFields.join(", "),
      workAuth: auth[0] || "",
      relocation: reloc[0] || "",
      dreamEmployers: dream.trim(),
      avoid: avoid.trim(),
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
          <span className="eyebrow">Step 3 · Preferences, {page + 1} of 2</span>
          <p>{page === 0
            ? <><b>Remy:</b> What are you looking for? This decides which openings I show you, and anything that rules you out stays hidden.</>
            : <><b>Remy:</b> Almost there. Where should I look, and is there anything that would rule an opening out?</>}</p>
        </div>
      </div>
      <div className="stack-lg fade-up" key={page}>
        {page === 0 ? <>
          <Q n={1}><strong>What year are you in?</strong><Chips options={YEAR_OPTS} value={year} onChange={setYear} multi={false} testid="pref-year" />
            <label className="field" style={{ maxWidth: 260 }}><span className="xs muted">Expected graduation</span><input className="input" value={grad} onChange={(e) => setGrad(e.target.value)} placeholder="e.g. May 2029" data-testid="input-pref-grad" /></label></Q>
          <Q n={2}><strong>Which fields or roles interest you?</strong>
            <div className="stack-sm" style={{ gap: 6 }}>
              <button type="button" className="pref-chip pref-unsure" aria-pressed={unsure} onClick={() => setUnsure(!unsure)} data-testid="pref-unsure">I'm not sure yet</button>
              {unsure && <span className="xs muted fade-up">No problem. Pick any that sound interesting, or none. Remy will search by your major and show you where it leads on My Path.</span>}
            </div>
            {FIELD_GROUPS.map(([group, opts]) => (
              <div key={group} className="stack-sm" style={{ gap: 4 }}><span className="xs muted" style={{ fontWeight: 700 }}>{group}</span><Chips options={opts} value={fields} onChange={setFields} testid="pref-field" /></div>
            ))}
            <input className="input" value={otherField} onChange={(e) => setOtherField(e.target.value)} placeholder="Something more specific? e.g. mechanical engineering, pre-med, sports marketing" aria-label="Other fields" data-testid="input-pref-field" /></Q>
          <Q n={3}><strong>What kinds of opportunities do you want?</strong><Chips options={TYPE_OPTS} value={types} onChange={setTypes} testid="pref-type" /></Q>
          <Q n={4}><strong>When do you want to start?</strong><Chips options={timelineOptions()} value={timeline} onChange={setTimeline} testid="pref-when" />
            <span className="xs muted">Pick all that work. Leave empty if you're open to anything.</span></Q>
        </> : <>
          <Q n={5}><strong>Where should I look for you?</strong><Chips options={REGION_OPTS} value={regions} onChange={setRegions} testid="pref-region" />
            <input className="input" value={otherRegion} onChange={(e) => setOtherRegion(e.target.value)} placeholder="Somewhere else? e.g. New York, Chicago" aria-label="Other regions" data-testid="input-pref-region" />
            <span className="xs muted">Open to relocating?</span><Chips options={RELOC_OPTS} value={reloc} onChange={setReloc} multi={false} testid="pref-reloc" /></Q>
          <Q n={6}><strong>Work authorization</strong><Chips options={AUTH_OPTS} value={auth} onChange={setAuth} multi={false} testid="pref-auth" />
            <span className="xs muted">If you'll need sponsorship, Remy hides postings that say they won't sponsor.</span></Q>
          <Q n={7}><strong>Dream employers <span className="muted xs">(optional)</span></strong>
            <input className="input" value={dream} onChange={(e) => setDream(e.target.value)} placeholder="e.g. Goldman Sachs, American Airlines" aria-label="Dream employers" data-testid="input-pref-dream" />
            <span className="xs muted">Remy checks their career sites first.</span></Q>
          <Q n={8}><strong>Anything to leave out? <span className="muted xs">(optional)</span></strong>
            <input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="e.g. tobacco, cold calling, a company name" aria-label="Things to avoid" data-testid="input-pref-avoid" /></Q>
        </>}
      </div>
      {missing.length > 0 && <p className="xs muted" data-testid="prefs-missing">To continue, choose {missing.join(", ")}.</p>}
      <div className="row-between">
        <button className="btn btn-ghost" onClick={() => (page ? toPage(0) : onBack())}><ArrowLeft size={16} /> Back</button>
        {page === 0
          ? <button className="btn btn-primary" onClick={() => toPage(1)} disabled={missing.length > 0} data-testid="button-ob-prefs-page">Next <ArrowRight size={16} /></button>
          : <button className="btn btn-primary" onClick={submit} disabled={missing.length > 0} data-testid="button-ob-next-prefs">Save and continue <ArrowRight size={16} /></button>}
      </div>
    </div>
  );
}

function Review({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, save, run, setWs } = useStore();
  const w = ws!;
  const unverified = w.resume?.doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.verified === false) || [];
  const suggested = w.memory.filter((m) => m.status === "suggested");
  const setFact = (id: string, patch: any) => save("memory", w.memory.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeFact = (id: string) => save("memory", w.memory.filter((m) => m.id !== id));
  const [skipVerify, setSkipVerify] = useState(false);
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Step 2 · Review</span>
        <h2>Is this right?</h2>
        <p className="small muted">Correct anything that's off. Remy only uses what you confirm here.</p>
      </div>
      <ProfileForm hidePrefs />
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
        </div>
      )}
      {suggested.length > 0 && (
        <div className="stack-sm">
          <h3>Facts from your other sources</h3>
          {suggested.map((m) => (
            <div key={m.id} className="source-row" style={{ padding: 10 }}>
              <div style={{ flex: 1 }} className="stack-sm"><div><div className="small">{m.text}</div><div className="xs muted">{m.source}</div></div>{m.conflict && <ConflictChoice fact={m} />}</div>
              {!m.conflict && <button className="btn btn-secondary btn-sm" onClick={() => run(() => setFact(m.id, { status: "approved" }))} data-testid="button-approve-fact">Keep</button>}
              <button className="icon-btn" onClick={() => run(() => removeFact(m.id))} aria-label="Remove fact"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <button className="btn btn-primary" onClick={async () => {
          // Every line matched the file word for word and the student says it's right: that's a confirmed resume.
          if (w.resume && !w.resume.confirmedAt && !unverified.length) await run(() => api<Workspace>("PUT", "/api/resume/doc", { doc: w.resume!.doc, confirm: true }).then(setWs));
          onNext();
        }} data-testid="button-ob-next-review">Looks right <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

// Remy's one-line reply to each answer: says what Remy will actually do with it (no AI call, nothing invented).
const UNSURE = /\b(not sure|no idea|idk|don'?t know|unsure|no clue)\b/i;
function reaction(a: string, target: string | undefined, i: number) {
  if (!a) return "No problem, we can come back to that.";
  if (UNSURE.test(a)) return "That's completely normal. I'll show you where your major can lead on My Path, and we'll figure it out together.";
  const by: Record<string, string[]> = {
    targetRoles: ["Great, I'll look for openings in those.", "Nice, I'll add those to your search."],
    dreamEmployers: ["Noted. I'll check their career sites first.", "Good picks. They go to the top of my search."],
    avoid: ["Got it, I'll leave those out.", "Understood, those stay hidden."],
    timeline: ["Got it. I'll focus on openings that start then.", "Perfect, I'll match openings to that timing."],
    interests: ["Love that. I'll use it when I suggest paths for you.", "That tells me a lot. I'll keep it in mind for your path."],
    goals: ["Good goal. I'll build your plan around it.", "Got it. Your plan will aim right at that."],
  };
  const lines = (target && by[target]) || ["Got it, that helps.", "Good to know.", "Thanks, that's useful."];
  return lines[i % lines.length];
}

function Questions({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, setWs, save, run, config } = useStore();
  const w = ws!;
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  // The answer being saved shows right away, so Next feels instant.
  const [pending, setPending] = useState<{ q: string; a: string } | null>(null);
  const qs = w.onboarding.questions;
  const targets = w.onboarding.targets || [];
  const answered = pending ? [...w.onboarding.answers, pending] : w.onboarding.answers;
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
  const submit = async (text: string) => {
    if (pending || !current) return;
    const a = text.trim();
    const i = idx;
    setPending({ q: current, a });
    setAnswer("");
    const answers = [...w.onboarding.answers, { q: current, a }];
    // Each question says which profile field its answer feeds (roles, dream employers, start date…), so it changes the matches.
    // Search fields only take short answers that name things; a sentence ("I don't know yet…") stays in Remy's memory instead.
    const target = targets[i] as keyof Profile | undefined;
    const searchField = target === "targetRoles" || target === "dreamEmployers" || target === "avoid";
    const fitsField = !searchField || (a.length <= 60 && !/\b(i|i'm|im|don'?t|not sure|no idea|idk|maybe)\b/i.test(a));
    try {
      if (a && target && target in w.profile && fitsField) {
        const before = String(w.profile[target] || "").trim();
        await save("profile", { ...w.profile, [target]: before ? `${before}, ${a}` : a });
      }
      if (a) {
        const fact = { id: "f" + Date.now(), text: `${current} — ${a}`, category: "goal", source: "Onboarding answer", status: "approved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await save("memory", [...w.memory, fact]);
      }
      const last = answers.length >= qs.length;
      if (last) await new Promise((r) => setTimeout(r, 900)); // let Remy's last reply land before the next step
      // The answers and the move to the next step go in one save, so the last answer can't be overwritten.
      await save("onboarding", { ...w.onboarding, answers, ...(last ? { step: 5 } : {}) });
    } finally {
      setPending(null);
    }
  };
  const options = [...(w.onboarding.options?.[idx] || []), "I'm not sure yet"];
  return (
    <div className="stack-lg">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "center", gap: 12 }}>
        <Remy size={44} mood={busy ? "think" : pending ? "happy" : "idle"} />
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="eyebrow">Step 4 · {qs.length ? `Question ${Math.min(idx + 1, qs.length)} of ${qs.length}` : "A few questions"}</span>
          <span className="small muted">Three quick questions so I can pick better openings for you.</span>
        </div>
      </div>
      <div className="ob-thread" aria-live="polite">
        {answered.map((x, i) => (
          <div key={i} className="stack-sm">
            <div className="bubble bubble-ai">{x.q}</div>
            <div className="bubble bubble-user fade-up">{x.a || "Skipped"}</div>
            <div className="bubble bubble-ai ob-react fade-up">{reaction(x.a, targets[i], i)}</div>
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
            placeholder="Or type your own answer" aria-label="Your answer" data-testid="input-answer" style={{ minHeight: 70 }} />
          <div className="row-between">
            <button className="btn btn-ghost" disabled={!!pending} onClick={() => submit("")} data-testid="button-skip-question">Skip</button>
            <button className="btn btn-primary" disabled={!answer.trim() || !!pending} onClick={() => submit(answer)} data-testid="button-answer">Next <ArrowRight size={16} /></button>
          </div>
        </div>
      )}
      {(!current || !qs.length) && !busy && !pending && (
        <div className="row-between">
          <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          <button className="btn btn-primary" onClick={onNext} data-testid="button-ob-next-questions">Continue <ArrowRight size={16} /></button>
        </div>
      )}
    </div>
  );
}

function PlanStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
  const { jobs, fits, refreshing } = useJobs();
  const matches = (jobs || []).filter((j) => !fits[j.id]?.excluded);
  const [busy, setBusy] = useState(false);
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
          <span className="eyebrow">Step 5 · Your starting plan</span>
          <h2>{busy ? "Putting your plan together…" : w.plan ? "Here's where I'd start" : "Your workspace is ready"}</h2>
          <p className="small muted">Suggestions, not requirements. You can change anything.</p>
        </div>
      </div>
      {busy && <div className="stack-sm">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}</div>}
      <div className="notice" data-testid="plan-matches">
        {refreshing || !jobs ? <span className="row"><Spinner /> Remy is checking employers' career sites for openings that fit you…</span>
          : matches.length ? <div><strong>Remy found {matches.length} opening{matches.length === 1 ? "" : "s"} that fit you</strong><ul className="plan-matches">{matches.slice(0, 3).map((j) => <li key={j.id} className="small"><b>{j.title}</b> <span className="muted">at {j.company}</span></li>)}</ul></div>
          : w.lastSearch && w.lastSearch.reached < w.lastSearch.scanned / 2
            ? <div><strong>Most employer career sites didn't answer just now</strong><div className="small muted">Remy reached {w.lastSearch.reached} of {w.lastSearch.scanned} (they may be down for maintenance). It will try again in about 30 minutes, and your openings will be waiting in Opportunities.</div></div>
            : <div><strong>No openings fit all your choices right now</strong><div className="small muted">Remy keeps checking every few hours. Adding more places or fields shows more.</div></div>}
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
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div className="row">
          {w.plan && config?.ai.available && <button className="btn btn-secondary" onClick={make} disabled={busy}>Regenerate</button>}
          <button className="btn btn-primary" onClick={onFinish} disabled={busy} data-testid="button-enter-workspace">Enter my workspace <ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}
