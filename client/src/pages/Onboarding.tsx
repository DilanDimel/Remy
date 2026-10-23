import { uiFlags } from "../lib/router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Trash2 } from "lucide-react";
import { LinkedInMark, MailMark } from "./Welcome";
import type { Profile, Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { reloadJobs } from "../lib/jobs";
import { AiUnavailableNote, Remy, Spinner, StatusChip } from "../components/common";
import { ResumeUpload } from "../components/Uploaders";
import { providerOn, startOAuth } from "../lib/supabase";

// Step numbers are stored in the workspace; 0 and 1 both open Connect accounts
// (the landing page now introduces Remy, so there is no separate intro step).
const STEPS = ["Connect accounts", "Review", "Your preferences", "A few questions", "Your plan"];

export default function Onboarding() {
  const { ws, save, setWs, run, config } = useStore();
  const w = ws!;
  const step = w.onboarding.step;
  const shown = Math.max(0, step - 1);
  const setStep = (s: number) => save("onboarding", { ...w.onboarding, step: s });
  const finish = async () => {
    uiFlags.flyIn = true;
    await save("onboarding", { ...w.onboarding, done: true });
    // Start with real, current openings for this student.
    api("POST", "/api/jobs/discover", {}).then(() => reloadJobs()).catch(() => {});
  };
  return (
    <div className="ob">
      <div className="row-between" style={{ width: "100%", maxWidth: 740 }}>
        <span className="logo"><Remy size={26} /><span>Remy<b>.</b></span></span>
        <button className="btn btn-ghost btn-sm" onClick={finish} data-testid="button-skip-onboarding">Skip setup</button>
      </div>
      <div className="ob-progress" aria-label={`Step ${shown + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => <span key={s} className={i <= shown ? "on" : ""} title={s} />)}
      </div>
      <div className="ob-card card card-pad fade-up" key={shown}>
        {step <= 1 && <Sources onNext={() => setStep(2)} />}
        {step === 2 && <Review onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <Preferences onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && <Questions onBack={() => setStep(3)} onNext={() => setStep(5)} />}
        {step === 5 && <PlanStep onBack={() => setStep(4)} onFinish={finish} />}
      </div>
      {!config?.ai.available && <div style={{ maxWidth: 720, width: "100%" }}><AiUnavailableNote /></div>}
    </div>
  );
}

type ConnRow = { k: string; title: string; what: string; ico: ReactNode; icoClass: string };
const DEMO_ROWS: ConnRow[] = [
  { k: "tcu", title: "TCU Student Account / SSO", what: "Enrollment, major, class standing", ico: "TCU", icoClass: "tcu" },
  { k: "stellic", title: "Stellic Degree Audit", what: "Degree plan and semester roadmap", ico: "S", icoClass: "stellic" },
  { k: "handshake", title: "Handshake", what: "Saved jobs and career events", ico: "h", icoClass: "handshake" },
  { k: "linkedin", title: "LinkedIn", what: "Profile and experience", ico: <LinkedInMark />, icoClass: "linkedin" },
];

/** One "Connect Your Accounts" row status: Not connected → Connecting… → Connected. */
function ConnStatus({ state, children }: { state: "none" | "busy" | "done"; children?: ReactNode }) {
  if (state === "busy") return <span className="conn-badge busy"><Spinner /> Connecting…</span>;
  if (state === "done") return <span className="conn-badge done fade-up"><Check size={13} /> {children || "Connected"}</span>;
  return <span className="conn-badge">Not connected</span>;
}

function Sources({ onNext }: { onNext: () => void }) {
  const { ws, save, run, config } = useStore();
  const w = ws!;
  const [open, setOpen] = useState<string>(w.resume ? "" : "resume");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState(w.profile.applicationEmail || w.profile.email);
  const linkedinLive = w.imports.some((i) => i.kind === "LinkedIn (connected)");
  const linkedinReal = providerOn(config, "linkedin_oidc");
  const setRowBusy = (k: string) => (b: boolean) => setBusy((x) => (x[k] === b ? x : { ...x, [k]: b }));
  const stateOf = (k: string, done: boolean) => (busy[k] ? "busy" : done ? "done" : "none");
  const isDone = (k: string) => k === "linkedin" && linkedinLive;
  // TCU, Stellic and Handshake (and LinkedIn until its Supabase provider is on) aren't
  // connected to anything yet, so they say "Coming soon" instead of pretending to connect.
  const canConnect = (k: string) => k === "linkedin" && linkedinReal;
  const connectLinkedIn = async () => {
    setRowBusy("linkedin")(true);
    await run(() => startOAuth(config!, "linkedin_oidc", "connect-linkedin"));
    setRowBusy("linkedin")(false);
  };
  const toggle = (k: string) => setOpen(open === k ? "" : k);
  const connected = (w.resume ? 1 : 0) + DEMO_ROWS.filter((r) => isDone(r.k)).length + (w.profile.applicationEmail ? 1 : 0);
  const connectable = 2 + DEMO_ROWS.filter((r) => canConnect(r.k)).length;
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h2 className="conn-title">Connect Your Accounts</h2>
        <p className="muted">The more you connect, the better. <span className="xs">({connected} of {connectable} connected)</span></p>
      </div>
      <div className="remy-prompt">
        <Remy size={40} mood={Object.values(busy).some(Boolean) ? "think" : "idle"} />
        <p><b>Remy:</b> Please connect these accounts so that I can understand your background and goals better. Start with your resume — it's the evidence everything else is built on.</p>
      </div>

      <div className="stack-sm" id="connList">
        <div className="conn-row">
          <span className="conn-ico resume" aria-hidden><FileText size={18} /></span>
          <div className="grow"><b>Resume / CV</b><span>{w.resume ? `${w.resume.fileName} · ${w.resume.doc.sections.length} sections, ${w.resume.parsedBy === "ai" ? "verified against your file" : "read by rules"}` : "Experience, skills and education — required for tailoring"}</span></div>
          <ConnStatus state={stateOf("resume", !!w.resume)}>Imported</ConnStatus>
          <button className="btn btn-secondary btn-sm" onClick={() => toggle("resume")} disabled={busy.resume} aria-expanded={open === "resume"} data-testid="button-source-resume">{open === "resume" ? "Close" : w.resume ? "Update" : "Connect"}</button>
        </div>
        {open === "resume" && <div className="conn-panel fade-up" data-testid={w.resume ? "resume-loaded" : undefined}><ResumeUpload compact={!!w.resume} onBusy={setRowBusy("resume")} onDone={() => setOpen("")} /></div>}

        {DEMO_ROWS.map((r) => {
          const done = isDone(r.k);
          const live = r.k === "linkedin" && linkedinLive;
          return (
            <div key={r.k} className="conn-row">
              <span className={`conn-ico ${r.icoClass}`} aria-hidden>{r.ico}</span>
              <div className="grow"><b>{r.title}</b><span>{live ? `Connected as ${w.imports.find((i) => i.kind === "LinkedIn (connected)")!.fileName}` : r.what}</span></div>
              {canConnect(r.k) || done ? <ConnStatus state={stateOf(r.k, done)} /> : <span className="conn-badge">Coming soon</span>}
              {!done && canConnect(r.k) && <button className="btn btn-secondary btn-sm" onClick={connectLinkedIn} disabled={busy[r.k]} data-testid={`button-source-${r.k}`}>Connect</button>}
            </div>
          );
        })}

        <div className="conn-row">
          <span className="conn-ico email" aria-hidden><MailMark /></span>
          <div className="grow"><b>Primary Work/School Email</b><span>{w.profile.applicationEmail ? `${w.profile.applicationEmail} · used on your documents and outreach drafts` : "Used on your documents and outreach drafts"}</span></div>
          <ConnStatus state={stateOf("email", !!w.profile.applicationEmail)}>Saved</ConnStatus>
          <button className="btn btn-secondary btn-sm" onClick={() => toggle("email")} disabled={busy.email} aria-expanded={open === "email"} data-testid="button-source-email">{open === "email" ? "Close" : w.profile.applicationEmail ? "Update" : "Connect"}</button>
        </div>
        {open === "email" && (
          <div className="conn-panel fade-up row">
            <input className="input" style={{ flex: 1, minWidth: 200 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@tcu.edu" aria-label="Application email" data-testid="input-app-email" />
            <button className="btn btn-primary btn-sm" disabled={!/.+@.+\..+/.test(email) || busy.email} onClick={async () => { setRowBusy("email")(true); await save("profile", { ...w.profile, applicationEmail: email }); setRowBusy("email")(false); setOpen(""); }} data-testid="button-save-app-email">Save</button>
          </div>
        )}
      </div>
      <p className="xs muted">Remy never asks for your passwords. TCU, Stellic and Handshake connections are coming soon{linkedinReal ? "; LinkedIn asks for your permission on LinkedIn's own site" : " (LinkedIn too)"}.</p>
      <div className="row-between">
        <span />
        <button className="btn btn-primary" onClick={async () => { if (email && email !== w.profile.applicationEmail && /.+@.+\..+/.test(email)) await save("profile", { ...w.profile, applicationEmail: email }); onNext(); }} data-testid="button-ob-next-sources">
          {w.resume ? "Continue" : "Continue without a resume"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

const PROFILE_FIELDS: [keyof Profile, string, string?][] = [
  ["name", "Full name"], ["preferredName", "What should Remy call you?"], ["school", "School"], ["major", "Major(s)"],
  ["classYear", "Class year"], ["graduation", "Expected graduation", "e.g. May 2029"], ["location", "Location"], ["targetRoles", "Roles you're curious about", "e.g. investment banking, fintech"],
  ["regions", "Where should Remy look?", "e.g. Fort Worth, Dallas, Remote"], ["opportunityTypes", "Kinds of opportunities", "e.g. Internships, Events"],
];

// Onboarding asks roles, regions and opportunity types on its own preferences step, so its review step leaves them out.
const PREF_KEYS: (keyof Profile)[] = ["targetRoles", "regions", "opportunityTypes"];
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
              <input className="input" value={p[k]} placeholder={ph} onChange={(e) => setP({ ...p, [k]: e.target.value })} data-testid={`input-profile-${k}`} />
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
const FIELD_OPTS = ["Finance", "Investment banking", "Accounting", "Consulting", "Marketing", "Sales", "Data & analytics", "Tech", "Supply chain", "Real estate"];
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
function Preferences({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, save, run } = useStore();
  const p = ws!.profile;
  const [year, setYear] = useState(p.classYear ? [p.classYear] : []);
  const [grad, setGrad] = useState(p.graduation);
  const [regions, setRegions] = useState(splitList(p.regions));
  const [otherRegion, setOtherRegion] = useState("");
  const [types, setTypes] = useState(p.opportunityTypes ? splitList(p.opportunityTypes) : ["Internships"]);
  const [fields, setFields] = useState(splitList(p.targetRoles));
  const [otherField, setOtherField] = useState("");
  const submit = async () => {
    const r = await run(() => save("profile", {
      ...p,
      classYear: year[0] || "",
      graduation: grad.trim(),
      regions: [...regions, ...splitList(otherRegion)].join(", "),
      opportunityTypes: types.join(", "),
      targetRoles: [...fields, ...splitList(otherField)].join(", "),
    }), "Got it — Remy will tailor your openings to this");
    if (r) onNext();
  };
  return (
    <div className="stack-lg">
      <div className="remy-prompt">
        <Remy size={44} mood="wave" />
        <div className="stack-sm">
          <span className="eyebrow">Step 3 · Your preferences</span>
          <p><b>Remy:</b> A few quick questions so I only show you openings you can actually go for, in places you actually want to be.</p>
        </div>
      </div>
      <Q n={1}><strong>What year are you in?</strong><Chips options={YEAR_OPTS} value={year} onChange={setYear} multi={false} testid="pref-year" />
        <label className="field" style={{ maxWidth: 260 }}><span className="xs muted">Expected graduation</span><input className="input" value={grad} onChange={(e) => setGrad(e.target.value)} placeholder="e.g. May 2029" data-testid="input-pref-grad" /></label></Q>
      <Q n={2}><strong>Where should I look for you?</strong><Chips options={REGION_OPTS} value={regions} onChange={setRegions} testid="pref-region" />
        <input className="input" value={otherRegion} onChange={(e) => setOtherRegion(e.target.value)} placeholder="Somewhere else? e.g. New York, Chicago" aria-label="Other regions" data-testid="input-pref-region" /></Q>
      <Q n={3}><strong>What kinds of opportunities do you want?</strong><Chips options={TYPE_OPTS} value={types} onChange={setTypes} testid="pref-type" /></Q>
      <Q n={4}><strong>Which fields or roles interest you?</strong><Chips options={FIELD_OPTS} value={fields} onChange={setFields} testid="pref-field" />
        <input className="input" value={otherField} onChange={(e) => setOtherField(e.target.value)} placeholder="Anything else? e.g. sports marketing, fintech" aria-label="Other fields" data-testid="input-pref-field" /></Q>
      <p className="xs muted">You can change these anytime in Accounts. Openings that clearly rule you out (like "must be a current sophomore") are hidden; anything unclear stays, labeled.</p>
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <button className="btn btn-primary" onClick={submit} data-testid="button-ob-next-prefs">Save and continue <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function Review({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, save, run } = useStore();
  const w = ws!;
  const unverified = w.resume?.doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.verified === false) || [];
  const suggested = w.memory.filter((m) => m.status === "suggested");
  const setFact = (id: string, patch: any) => save("memory", w.memory.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeFact = (id: string) => save("memory", w.memory.filter((m) => m.id !== id));
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Step 2 · Review</span>
        <h2>Is this right?</h2>
        <p className="small muted">Correct anything that's off. Remy only uses what you confirm here.</p>
      </div>
      <ProfileForm hidePrefs />
      {w.resume && (
        <div className="stack-sm">
          <h3>From your resume</h3>
          <div className="row">
            {w.resume.doc.sections.map((s) => <span key={s.id} className="chip chip-plain">{s.heading} · {s.entries.length}</span>)}
          </div>
          {unverified.length > 0 ? (
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
              <div style={{ flex: 1 }}><div className="small">{m.text}</div><div className="xs muted">{m.source}</div></div>
              <button className="btn btn-secondary btn-sm" onClick={() => run(() => setFact(m.id, { status: "approved" }))} data-testid="button-approve-fact">Keep</button>
              <button className="icon-btn" onClick={() => run(() => removeFact(m.id))} aria-label="Remove fact"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <button className="btn btn-primary" onClick={onNext} data-testid="button-ob-next-review">Looks right <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function Questions({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, setWs, save, run, config } = useStore();
  const w = ws!;
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const qs = w.onboarding.questions;
  const idx = w.onboarding.answers.length;
  useEffect(() => {
    if (!qs.length && config?.ai.available && !busy) {
      setBusy(true);
      run(() => api<Workspace>("POST", "/api/ai/questions")).then((r) => r && setWs(r)).finally(() => setBusy(false));
    }
  }, []);
  const current = qs[idx];
  const submit = async (skip = false) => {
    const answers = [...w.onboarding.answers, { q: current, a: skip ? "" : answer.trim() }];
    await save("onboarding", { ...w.onboarding, answers });
    if (!skip && answer.trim()) {
      const fact = { id: "f" + Date.now(), text: `${current} — ${answer.trim()}`, category: "goal", source: "Onboarding answer", status: "approved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await save("memory", [...w.memory, fact]);
    }
    setAnswer("");
    if (answers.length >= qs.length) onNext();
  };
  return (
    <div className="stack-lg">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 14 }}>
        <Remy size={52} mood={busy ? "think" : "idle"} />
        <div className="stack-sm">
          <span className="eyebrow">Step 4 · {qs.length ? `Question ${Math.min(idx + 1, qs.length)} of ${qs.length}` : "A few questions"}</span>
          {busy ? <span className="row muted"><Spinner /> Thinking of a few useful questions…</span> : current ? <h2 data-testid="text-question">{current}</h2> : <h2>{qs.length ? "All done — thank you." : "Questions need AI"}</h2>}
        </div>
      </div>
      {current && !busy && (
        <>
          <textarea className="textarea" autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="A sentence or two is plenty" aria-label="Your answer" data-testid="input-answer" />
          <div className="row-between">
            <button className="btn btn-ghost" onClick={() => submit(true)} data-testid="button-skip-question">Skip</button>
            <button className="btn btn-primary" disabled={!answer.trim()} onClick={() => submit(false)} data-testid="button-answer">Next <ArrowRight size={16} /></button>
          </div>
        </>
      )}
      {(!current || !qs.length) && !busy && (
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
      {w.plan && !busy && (
        <div className="stack">
          <div className="notice"><FileText size={16} style={{ color: "var(--plum)", marginTop: 3 }} /><div><strong>{w.plan.nextAction.title}</strong><div className="small muted">{w.plan.nextAction.why}</div></div></div>
          <div className="stack-sm">
            {w.tasks.filter((t) => !t.done).slice(0, 4).map((t) => (
              <div key={t.id} className="item" style={{ padding: "8px 0" }}><div className="item-main"><strong className="small">{t.title}</strong><div className="why">{t.why}</div></div>{t.due && <span className="chip chip-plain">{t.due}</span>}</div>
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
