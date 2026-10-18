import { uiFlags } from "../lib/router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, GraduationCap, Linkedin, Mail, School, Trash2 } from "lucide-react";
import type { Profile, Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { AiUnavailableNote, Pip, Spinner, StatusChip } from "../components/common";
import { ProfileImport, ResumeUpload } from "../components/Uploaders";

const STEPS = ["Meet Pip", "Your sources", "Review", "A few questions", "Your plan"];

export default function Onboarding() {
  const { ws, save, setWs, run, config } = useStore();
  const w = ws!;
  const step = w.onboarding.step;
  const setStep = (s: number) => save("onboarding", { ...w.onboarding, step: s });
  const finish = async () => {
    uiFlags.flyIn = true;
    await save("onboarding", { ...w.onboarding, done: true });
  };
  return (
    <div className="ob">
      <div className="row-between" style={{ width: "100%", maxWidth: 720 }}>
        <span className="logo">offer<b>ready.</b></span>
        <button className="btn btn-ghost btn-sm" onClick={finish} data-testid="button-skip-onboarding">Skip setup</button>
      </div>
      <div className="ob-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : ""} title={s} />)}
      </div>
      <div className="ob-card card card-pad fade-up" key={step}>
        {step === 0 && <Intro onNext={() => setStep(1)} />}
        {step === 1 && <Sources onBack={() => setStep(0)} onNext={() => setStep(2)} />}
        {step === 2 && <Review onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <Questions onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && <PlanStep onBack={() => setStep(3)} onFinish={finish} />}
      </div>
      {!config?.ai.available && <div style={{ maxWidth: 720, width: "100%" }}><AiUnavailableNote /></div>}
    </div>
  );
}

function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="stack-lg">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 16 }}>
        <Pip size={76} mood="wave" />
        <div className="stack-sm">
          <h1>Hi, I'm Pip.</h1>
          <p className="muted">I'll help you turn what you've already done into a clear plan and strong, honest applications. Setup takes about two minutes, and you can skip anything.</p>
        </div>
      </div>
      <div className="grid-2">
        {[
          ["Understand you", "Read your resume and anything else you choose to share."],
          ["Suggest a path", "Roles, skills and next steps tied to your real background."],
          ["Find openings", "Relevant opportunities, with eligibility and deadlines."],
          ["Apply truthfully", "Tailored resumes and letters — every change shows its evidence."],
        ].map(([t, b]) => (
          <div key={t} className="card card-pad" style={{ boxShadow: "none" }}>
            <h3>{t}</h3>
            <p className="small muted">{b}</p>
          </div>
        ))}
      </div>
      <div className="row-between">
        <span className="xs muted">I only remember what you approve. You can see and delete it anytime in Accounts.</span>
        <button className="btn btn-primary" onClick={onNext} data-testid="button-ob-start">Let's start <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function Sources({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, save } = useStore();
  const w = ws!;
  const [open, setOpen] = useState<string>("");
  const [email, setEmail] = useState(w.profile.applicationEmail || w.profile.email);
  const imported = (k: string) => w.imports.find((i) => i.kind === k);
  const rows = [
    { k: "LinkedIn", icon: Linkedin, hint: "On LinkedIn, open your profile → More → Save to PDF, then upload it here. Offer Ready doesn't log in to LinkedIn." },
    { k: "Handshake", icon: GraduationCap, hint: "Copy the text from your Handshake profile (experience, skills, interests) and paste it here." },
    { k: "Stellic / degree plan", icon: School, hint: "Paste or upload your degree audit or planned courses. Offer Ready doesn't connect to Stellic directly." },
    { k: "TCU academic info", icon: School, hint: "Paste details like major, minors, honors, or planned coursework." },
  ];
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Step 2 · Your sources</span>
        <h2>Start with your resume</h2>
        <p className="small muted">This is the evidence everything else is built on. The rest is optional.</p>
      </div>
      {w.resume ? (
        <div className="notice notice-good" data-testid="resume-loaded">
          <Check size={16} />
          <div><strong>{w.resume.fileName}</strong> was read ({w.resume.doc.sections.length} sections, parsed by {w.resume.parsedBy === "ai" ? "AI and verified against your file" : "rules"}). You'll review it next.</div>
        </div>
      ) : (
        <ResumeUpload />
      )}
      {w.resume && <details><summary className="small" style={{ cursor: "pointer", color: "var(--plum)", fontWeight: 700 }}>Replace resume</summary><div style={{ marginTop: 10 }}><ResumeUpload compact /></div></details>}

      <div className="stack-sm">
        <h3>Optional: add more context</h3>
        {rows.map((r) => (
          <div key={r.k} className="stack-sm">
            <div className="source-row">
              <div className="source-icon"><r.icon size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row"><strong className="small">{r.k}</strong>{imported(r.k) ? <StatusChip label="Student provided">Imported · {imported(r.k)!.factsAdded} facts</StatusChip> : <StatusChip label="Needs setup">No direct connection</StatusChip>}</div>
                <div className="xs muted">Upload an export or paste text — never a password.</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(open === r.k ? "" : r.k)} data-testid={`button-source-${r.k.split(" ")[0].toLowerCase()}`}>{open === r.k ? "Close" : "Add"}</button>
            </div>
            {open === r.k && <div style={{ padding: "0 4px" }}><ProfileImport kind={r.k} hint={r.hint} onDone={() => setOpen("")} /></div>}
          </div>
        ))}
        <div className="source-row">
          <div className="source-icon"><Mail size={18} /></div>
          <div style={{ flex: 1 }}>
            <strong className="small">Application email</strong>
            <div className="xs muted">Used on your documents and outreach drafts. Inbox reading isn't connected — you can paste emails in Progress.</div>
            <input className="input" style={{ marginTop: 8 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" aria-label="Application email" data-testid="input-app-email" />
          </div>
        </div>
      </div>
      <div className="row-between">
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <button className="btn btn-primary" onClick={async () => { if (email !== w.profile.applicationEmail) await save("profile", { ...w.profile, applicationEmail: email }); onNext(); }} data-testid="button-ob-next-sources">
          {w.resume ? "Review what we found" : "Continue without a resume"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

const PROFILE_FIELDS: [keyof Profile, string, string?][] = [
  ["name", "Full name"], ["preferredName", "What should Pip call you?"], ["school", "School"], ["major", "Major(s)"],
  ["classYear", "Class year"], ["graduation", "Expected graduation", "e.g. May 2029"], ["location", "Location"], ["targetRoles", "Roles you're curious about", "e.g. investment banking, fintech"],
];

export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const { ws, save, run } = useStore();
  const [p, setP] = useState<Profile>(ws!.profile);
  useEffect(() => setP(ws!.profile), [ws!.profile]);
  const dirty = JSON.stringify(p) !== JSON.stringify(ws!.profile);
  return (
    <div className="stack">
      <div className="grid-2">
        {PROFILE_FIELDS.map(([k, label, ph]) => (
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
        <span className="eyebrow">Step 3 · Review</span>
        <h2>Is this right?</h2>
        <p className="small muted">Correct anything that's off. Offer Ready only uses what you confirm here.</p>
      </div>
      <ProfileForm />
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
        <Pip size={52} mood={busy ? "think" : "idle"} />
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
        <Pip size={52} mood={busy ? "think" : "wave"} />
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
