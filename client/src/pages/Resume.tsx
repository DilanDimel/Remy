import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, Check, CheckCircle2, Download, FileText, Link2, Pencil, Plus, RotateCcw, ShieldAlert, ShieldCheck, Sparkles,
  Star, Trash2, X,
} from "lucide-react";
import type { Application, BulletChange, ClaimFlag, Job, ResumeDoc, Workspace } from "@shared/types";
import { API_BASE, api, download, fmtDate, rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { useJobs } from "../lib/jobs";
import { AiUnavailableNote, Empty, Remy, Spinner, StatusChip } from "../components/common";
import { ResumeUpload } from "../components/Uploaders";
import { preAnswers, TailorQuestions } from "../components/TailorQuestions";
import { clearAnswers } from "../lib/tailorDraft";

type Tab = "base" | "tailor" | "library";

export default function Resume({ query }: { query: URLSearchParams }) {
  const tab = (query.get("tab") as Tab) || "tailor";
  const { ws } = useStore();
  const effective: Tab = !ws!.resume && tab !== "library" ? "base" : tab;
  const setTab = (t: Tab) => go(`/resume?tab=${t}`);
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Resume/CV</span>
          <h1>Your experience, clearly expressed.</h1>
          <p>Every tailored change shows the posting requirement behind it and the evidence from your own resume.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {([["base", "Base resume"], ["tailor", "Tailor for an opening"], ["library", "Approved & exports"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={effective === k} onClick={() => setTab(k)} data-testid={`tab-resume-${k}`}>{l}</button>
        ))}
      </div>
      {effective === "base" && <BaseResume />}
      {effective === "tailor" && <Tailor query={query} />}
      {effective === "library" && <Library />}
    </>
  );
}

// ---------------------------------------------------------------- base resume
function BaseResume() {
  const { ws, setWs, run, toast } = useStore();
  const w = ws!;
  const [doc, setDoc] = useState<ResumeDoc | null>(w.resume?.doc ? JSON.parse(JSON.stringify(w.resume.doc)) : null);
  const [showRaw, setShowRaw] = useState(false);
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState(true);
  useEffect(() => { setDoc(w.resume?.doc ? JSON.parse(JSON.stringify(w.resume.doc)) : null); }, [w.resume?.uploadedAt]);
  if (!w.resume || !doc)
    return (
      <div className="card card-pad stack">
        <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}><Remy size={46} /><div><h2>Start with the resume you already have</h2><p className="small muted">Remy reads it, then you confirm every line. Nothing is invented.</p></div></div>
        <ResumeUpload />
      </div>
    );
  const dirty = JSON.stringify(doc) !== JSON.stringify(w.resume.doc);
  const saveDoc = async (confirm: boolean) => {
    const r = await run(() => api<Workspace>("PUT", "/api/resume/doc", { doc, confirm }), confirm ? "Base resume confirmed" : "Saved");
    if (r) setWs(r);
  };
  const upd = (fn: (d: ResumeDoc) => void) => setDoc((d) => { const c = JSON.parse(JSON.stringify(d)); fn(c); return c; });
  const unverified = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.verified === false).length;
  return (
    <div className="stack-lg">
      <div className="card card-pad row-between">
        <div className="stack-sm">
          <div className="row"><FileText size={18} style={{ color: "var(--plum)" }} /><strong data-testid="text-resume-file">{w.resume.fileName}</strong>
            {w.resume.confirmedAt ? <span className="chip chip-live"><Check size={12} /> Confirmed {fmtDate(w.resume.confirmedAt)}</span> : <span className="chip chip-setup">Needs your review</span>}
          </div>
          <span className="xs muted">Uploaded {fmtDate(w.resume.uploadedAt)} · read by {w.resume.parsedBy === "ai" ? "AI, then checked word-for-word against your file" : "the built-in parser"}{unverified ? ` · ${unverified} line(s) need a look` : ""}</span>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowRaw((s) => !s)}>{showRaw ? "Hide" : "Show"} original text</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setReplace((s) => !s)} data-testid="button-replace-resume">Replace file</button>
        </div>
      </div>
      {replace && <div className="card card-pad"><ResumeUpload compact onDone={() => setReplace(false)} /></div>}
      <div className="card card-pad stack" data-testid="card-resume-files">
        <div className="row-between">
          <div className="stack-sm">
            <h3>Your resume, as a file</h3>
            <span className="xs muted">{w.resume.original ? "Your original keeps your own layout. The export uses Remy's clean, ATS-friendly one-column format with your edits below." : "This resume was pasted or is the sample, so there's no original file. Export it as a clean PDF or Word file."}</span>
          </div>
          <div className="row">
            {w.resume.original && <button className="btn btn-secondary btn-sm" onClick={() => download("/api/resume/original?download=1", w.resume!.original!.name).catch((e) => toast(e.message, true))} data-testid="button-download-original"><Download size={14} /> Original</button>}
            <button className="btn btn-primary btn-sm" onClick={() => download("/api/resume/export?format=pdf", "Resume.pdf").catch((e) => toast(e.message, true))} disabled={dirty} title={dirty ? "Save your edits first" : undefined} data-testid="button-export-base-pdf"><Download size={14} /> Export PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={() => download("/api/resume/export?format=docx", "Resume.docx").catch((e) => toast(e.message, true))} disabled={dirty} data-testid="button-export-base-docx">Word</button>
          </div>
        </div>
        {w.resume.original?.mime === "application/pdf" && (
          <div className="stack-sm">
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setPreview((p) => !p)} data-testid="button-toggle-preview">{preview ? "Hide" : "Show"} your original PDF</button>
            {preview && <iframe className="pdf-preview" src={`${API_BASE}/api/resume/original#view=FitH`} title="Your original resume" data-testid="pdf-preview" />}
          </div>
        )}
      </div>
      {showRaw && <pre className="card card-pad xs" style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto", margin: 0 }}>{w.resume.rawText}</pre>}

      <div className="card card-pad stack">
        <h3>Contact</h3>
        <div className="grid-2">
          {(["name", "email", "phone", "location", "links"] as const).map((k) => (
            <label key={k} className="field"><span style={{ textTransform: "capitalize" }}>{k}</span>
              <input className="input" value={doc.contact[k]} onChange={(e) => upd((d) => { d.contact[k] = e.target.value; })} data-testid={`input-contact-${k}`} /></label>
          ))}
        </div>
      </div>

      {doc.sections.map((s, si) => (
        <div key={s.id} className="card card-pad stack">
          <div className="row-between">
            <input className="input" style={{ maxWidth: 320, fontWeight: 700 }} value={s.heading} onChange={(e) => upd((d) => { d.sections[si].heading = e.target.value; })} aria-label="Section heading" />
            <button className="btn btn-ghost btn-sm" onClick={() => upd((d) => { d.sections[si].entries.push({ id: rid("e"), org: "", role: "", location: "", dates: "", bullets: [] }); })}><Plus size={14} /> Entry</button>
          </div>
          {s.entries.map((e, ei) => (
            <div key={e.id} className="stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div className="grid-2">
                <input className="input" value={e.org} placeholder="Organization" onChange={(x) => upd((d) => { d.sections[si].entries[ei].org = x.target.value; })} aria-label="Organization" />
                <input className="input" value={e.location} placeholder="Location" onChange={(x) => upd((d) => { d.sections[si].entries[ei].location = x.target.value; })} aria-label="Location" />
                <input className="input" value={e.role} placeholder="Role / degree" onChange={(x) => upd((d) => { d.sections[si].entries[ei].role = x.target.value; })} aria-label="Role" />
                <input className="input" value={e.dates} placeholder="Dates" onChange={(x) => upd((d) => { d.sections[si].entries[ei].dates = x.target.value; })} aria-label="Dates" />
              </div>
              {e.bullets.map((b, bi) => (
                <div key={b.id} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <span style={{ marginTop: 9 }}>•</span>
                  <textarea className="textarea" style={{ minHeight: 44 }} value={b.text} onChange={(x) => upd((d) => { const bb = d.sections[si].entries[ei].bullets[bi]; bb.text = x.target.value; })} aria-label="Bullet" data-testid="input-bullet" />
                  {b.verified === false && <span title="Not found word-for-word in your file" style={{ color: "var(--amber)", marginTop: 8 }}><AlertTriangle size={16} /></span>}
                  <button className="icon-btn" onClick={() => upd((d) => { d.sections[si].entries[ei].bullets.splice(bi, 1); })} aria-label="Remove bullet"><Trash2 size={15} /></button>
                </div>
              ))}
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={() => upd((d) => { d.sections[si].entries[ei].bullets.push({ id: rid("b"), text: "", verified: true }); })}><Plus size={14} /> Bullet</button>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => upd((d) => { d.sections[si].entries.splice(ei, 1); })}>Remove entry</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className="card card-pad stack">
        <h3>Skills</h3>
        {doc.skills.map((k, ki) => (
          <div key={k.id} className="row" style={{ flexWrap: "nowrap" }}>
            <input className="input" style={{ maxWidth: 200 }} value={k.label} onChange={(e) => upd((d) => { d.skills[ki].label = e.target.value; })} aria-label="Skill group" />
            <input className="input" value={k.items} onChange={(e) => upd((d) => { d.skills[ki].items = e.target.value; })} aria-label="Skills" />
          </div>
        ))}
      </div>
      <div className="card card-pad row-between approve-bar">
        <span className="small muted">{dirty ? "You have unsaved edits. Your edits become the evidence Remy may use." : w.resume.confirmedAt ? "This is the evidence base for every tailored version." : "Confirm when every line is accurate."}</span>
        <div className="row">
          <button className="btn btn-secondary" disabled={!dirty} onClick={() => saveDoc(false)} data-testid="button-save-resume">Save edits</button>
          <button className="btn btn-primary" onClick={() => saveDoc(true)} data-testid="button-confirm-resume"><CheckCircle2 size={16} /> {w.resume.confirmedAt && !dirty ? "Re-confirm" : "Save & confirm"}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tailoring
function composeClient(w: Workspace, a: Application): { doc: ResumeDoc; changed: Set<string> } {
  const doc: ResumeDoc = JSON.parse(JSON.stringify(w.resume!.doc));
  const changed = new Set<string>();
  for (const c of a.changes) {
    if (c.status !== "accepted" && c.status !== "edited") continue;
    for (const s of doc.sections) for (const e of s.entries) for (const b of e.bullets) if (b.id === c.bulletId) { b.text = c.status === "edited" ? c.edited || c.revised : c.revised; changed.add(b.id); }
  }
  return { doc, changed };
}

function Tailor({ query }: { query: URLSearchParams }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
  const { jobs, fits } = useJobs();
  const jobParam = query.get("job");
  const appParam = query.get("app");
  useEffect(() => {
    if (!jobParam) return;
    const existing = w.applications.find((a) => a.jobId === jobParam);
    if (existing) { go(`/resume?tab=tailor&app=${existing.id}`); return; }
    run(() => api<{ application: Application; workspace: Workspace }>("POST", "/api/applications", { jobId: jobParam })).then((r) => {
      if (r) { setWs(r.workspace); go(`/resume?tab=tailor&app=${r.application.id}`); }
    });
  }, [jobParam]);
  const selected = w.applications.find((a) => a.id === appParam) || w.applications[0];
  const jobOf = (a: Application) => jobs?.find((j) => j.id === a.jobId);
  const start = async (jobId: string) => {
    const r = await run(() => api<{ application: Application; workspace: Workspace }>("POST", "/api/applications", { jobId }));
    if (r) { setWs(r.workspace); go(`/resume?tab=tailor&app=${r.application.id}`); }
  };
  // Openings you haven't started, best fit first; ones you're not eligible for are left out.
  const notStarted = (jobs || [])
    .filter((j) => j.kind !== "event" && !w.applications.some((a) => a.jobId === j.id) && !fits[j.id]?.excluded && !w.hiddenJobIds.includes(j.id))
    .sort((x, y) => (fits[y.id]?.score ?? 0) - (fits[x.id]?.score ?? 0));
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <div className="row-between">
          <span className="eyebrow">Your applications · {w.applications.length} · {notStarted.length} more openings that fit you</span>
          <button className="btn btn-ghost btn-sm" onClick={() => go("/opportunities?import=1")} data-testid="button-new-application"><Link2 size={14} /> Import a posting from a link or text</button>
        </div>
        <div className="opening-strip" data-testid="opening-strip">
          {w.applications.map((a) => {
            const j = jobOf(a);
            const pending = a.changes.filter((c) => c.status === "pending").length;
            return (
              <button key={a.id} className="pick" aria-pressed={selected?.id === a.id} onClick={() => go(`/resume?tab=tailor&app=${a.id}`)} data-testid="button-pick-application">
                <span className="xs muted">{j?.company || "…"}</span>
                <strong className="small">{j?.title || "Loading"}</strong>
                <span className="row xs">
                  {a.versions.length ? <span className="chip chip-live">Approved v{a.versions.length}</span> : a.generatedAt ? <span className="chip chip-plain">Draft{pending ? ` · ${pending} to review` : ""}</span> : <span className="chip chip-plain">Not generated</span>}
                  {a.staleReason && <span className="chip chip-setup">Review</span>}
                </span>
              </button>
            );
          })}
          {notStarted.map((j) => (
            <button key={j.id} className="pick pick-new" onClick={() => start(j.id)} data-testid="button-choose-job">
              <span className="xs muted">{j.company}</span>
              <strong className="small">{j.title}</strong>
              <span className="row xs"><span className="chip chip-plain"><Plus size={11} /> Start tailoring</span>{fits[j.id]?.eligibility === "likely" && <span className="chip chip-live">Eligible</span>}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        {!config?.ai.available && <div style={{ marginBottom: 12 }}><AiUnavailableNote /></div>}
        {selected && jobOf(selected) ? <AppEditor key={selected.id} a={selected} job={jobOf(selected)!} /> : (
          <div className="card"><Empty title="Pick an opening to tailor for" body="Choose one of the openings above, or import any public posting. Remy will propose truthful changes for you to review." /></div>
        )}
      </div>
    </div>
  );
}

type Sub = "changes" | "letter" | "checks" | "export";

function AppEditor({ a, job }: { a: Application; job: Job }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
  const [sub, setSub] = useState<Sub>("changes");
  const [busy, setBusy] = useState("");
  const call = async (key: string, fn: () => Promise<{ workspace: Workspace }>, ok?: string) => {
    setBusy(key);
    const r = await run(fn, ok);
    if (r) setWs(r.workspace);
    setBusy("");
    return r;
  };
  const generate = async () => {
    const r = await call("gen", () => api("POST", `/api/applications/${a.id}/generate`, { answers: preAnswers(a.id, job) }), "Tailored draft ready — review each change");
    if (r) clearAnswers(a.id);
  };
  // Remy's questions show in his side panel when it's open; otherwise right here.
  const panelVisible = w.settings.assistantOpen && !window.matchMedia("(max-width: 1020px)").matches;
  const pending = a.changes.filter((c) => c.status === "pending").length;
  const blocking = a.changes.filter((c) => (c.status === "accepted" || c.status === "edited") && c.flags.length).length;
  const approve = (override = false) => call("approve", () => api("POST", `/api/applications/${a.id}/approve`, { override }), override ? "Approved with the letter check overridden — downloads are ready" : "Approved — downloads are ready");
  const onlyLetterBlocks = !pending && !blocking && a.letterFlags.length > 0;

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div className="stack-sm">
            <span className="xs muted">{job.company} · <StatusChip label={job.label} /></span>
            <h2 data-testid="text-app-title">{job.title}</h2>
            <span className="xs muted">{job.deadlineText || "No deadline listed"} · <a href={job.applyUrl || job.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--plum)", fontWeight: 700 }}>Posting <ArrowUpRight size={12} style={{ display: "inline" }} /></a></span>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={!!busy || !config?.ai.available || !w.resume} data-testid="button-generate">
            {busy === "gen" ? <Spinner /> : a.generatedAt ? <RotateCcw size={16} /> : <Sparkles size={16} />} {busy === "gen" ? "Tailoring…" : a.generatedAt ? "Regenerate" : "Tailor with AI"}
          </button>
        </div>
        {a.staleReason && <div className="notice notice-warn" style={{ marginTop: 12 }}><AlertTriangle size={16} /><div>{a.staleReason}</div></div>}
        {a.generatedAt && <p className="xs muted" style={{ marginTop: 10 }}>Draft generated {fmtDate(a.generatedAt)} by {a.generatedBy} · {a.versions.length ? `approved v${a.versions.length} on ${fmtDate(a.versions[a.versions.length - 1].at)}` : "not yet approved"}</p>}
      </div>

      {!panelVisible && (busy === "gen" || !a.generatedAt || a.personalize.some((p) => !p.done)) && <div className="card card-pad"><TailorQuestions a={a} job={job} busy={busy === "gen"} /></div>}
      {busy === "gen" && <div className="card card-pad stack"><div className="row"><Remy size={40} mood="think" /><span className="muted">Remy is matching your experience to {job.company}'s requirements. This usually takes about a minute.</span></div>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 70 }} />)}</div>}

      {a.generatedAt && busy !== "gen" && (
        <>
          {a.strongestMatch?.text && (
            <div className="card card-pad stack-sm" style={{ borderColor: "var(--plum)" }} data-testid="card-strongest-match">
              <span className="eyebrow row" style={{ color: "var(--plum)" }}><Star size={14} /> Strongest match</span>
              <strong>{a.strongestMatch.text}</strong>
              <div className="grid-2 small">
                <div className="stack-sm"><span className="xs muted">Posting says</span><span className="quote">{a.strongestMatch.requirementQuote}</span></div>
                <div className="stack-sm"><span className="xs muted">Your evidence</span><span className="quote" style={{ borderColor: "var(--sage)" }}>{a.strongestMatch.evidence}</span></div>
              </div>
            </div>
          )}
          <div className="tabs" role="tablist">
            {([["changes", `Changes${pending ? ` (${pending})` : ""}`], ["letter", "Cover letter"], ["checks", "Checks"], ["export", "Preview & export"]] as [Sub, string][]).map(([k, l]) => (
              <button key={k} role="tab" className="tab" aria-selected={sub === k} onClick={() => setSub(k)} data-testid={`tab-app-${k}`}>{l}</button>
            ))}
          </div>
          {sub === "changes" && <Changes a={a} />}
          {sub === "letter" && <Letter a={a} />}
          {sub === "checks" && <Checks a={a} />}
          {sub === "export" && <ExportView a={a} job={job} />}
          <div className="card card-pad row-between approve-bar">
            <span className="small">
              {pending ? `${pending} change(s) still need your decision.` : blocking ? `${blocking} accepted change(s) have unsupported claims.` : a.letterFlags.length ? "The cover letter still needs attention." : "Ready to approve."}
            </span>
            <div className="row">
              {onlyLetterBlocks && <button className="btn btn-secondary" onClick={() => { if (confirm("Approve anyway? Remy will remove any unfilled [PERSONALIZE] spots and note in your safeguard log that you overrode the letter check.")) approve(true); }} disabled={!!busy} data-testid="button-override-letter"><ShieldAlert size={16} /> Override letter check</button>}
              <button className="btn btn-primary" onClick={() => approve()} disabled={!!busy} data-testid="button-approve-app">{busy === "approve" ? <Spinner /> : <ShieldCheck size={16} />} Approve this version</button>
            </div>
          </div>
        </>
      )}
      {!a.generatedAt && busy !== "gen" && (
        <div className="card"><Empty title="No tailored draft yet" body={w.resume ? `Remy will propose a few material changes for ${job.company}, write a cover letter draft, and check everything against your resume.` : "Upload your base resume first."} /></div>
      )}
    </div>
  );
}

function FlagList({ flags }: { flags: ClaimFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="stack-sm" data-testid="flags">
      {flags.map((f, i) => (
        <div key={i} className="flag"><ShieldAlert size={15} style={{ marginTop: 2 }} /><span>{f.message}</span></div>
      ))}
    </div>
  );
}

function Changes({ a }: { a: Application }) {
  if (!a.changes.length) return <div className="card"><Empty title="No material changes proposed" body="Your resume already reads well for this posting. You can still write the cover letter and export." /></div>;
  return (
    <div className="stack">
      {a.changes.map((c, i) => <ChangeCard key={c.id} a={a} c={c} n={i + 1} />)}
      {a.gaps.length > 0 && (
        <div className="card card-pad stack-sm">
          <h3>Honest gaps</h3>
          <p className="xs muted">Requirements your resume doesn't show yet. Remy won't paper over these.</p>
          {a.gaps.map((g, i) => <div key={i} className="small"><span className="muted">“{g.requirementQuote}”</span><div>{g.note}</div></div>)}
        </div>
      )}
    </div>
  );
}

function ChangeCard({ a, c, n }: { a: Application; c: BulletChange; n: number }) {
  const { setWs, run } = useStore();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.edited || c.revised);
  const [busy, setBusy] = useState(false);
  const put = async (body: any, ok?: string) => {
    setBusy(true);
    const r = await run(() => api<{ workspace: Workspace }>("PUT", `/api/applications/${a.id}/change/${c.id}`, body), ok);
    if (r) setWs(r.workspace);
    setBusy(false);
  };
  const statusChip = { pending: <span className="chip chip-plain">Your review</span>, accepted: <span className="chip chip-live">Accepted</span>, edited: <span className="chip chip-live">Edited by you</span>, rejected: <span className="chip chip-bad">Rejected — original kept</span> }[c.status];
  return (
    <div className="card card-pad stack" data-testid="card-change">
      <div className="row-between"><span className="eyebrow">Change {n} · {c.entryLabel}</span>{statusChip}</div>
      <div className="compare">
        <div className="orig"><div className="xs muted" style={{ marginBottom: 4, fontWeight: 700 }}>YOUR ORIGINAL</div>{c.original}</div>
        <div className="rev"><div className="xs muted" style={{ marginBottom: 4, fontWeight: 700 }}>{c.status === "edited" ? "YOUR EDIT" : "PROPOSED"}</div>
          {editing ? <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit wording" data-testid="input-edit-change" /> : c.status === "edited" ? c.edited : c.revised}
        </div>
      </div>
      <div className="grid-2">
        <div className="req-line"><Link2 size={15} style={{ marginTop: 3, color: "var(--plum)" }} /><div><div className="xs muted" style={{ fontWeight: 700 }}>POSTING REQUIREMENT</div><span className="small">“{c.requirementQuote}”</span></div></div>
        <div className="req-line"><ShieldCheck size={15} style={{ marginTop: 3, color: "var(--sage)" }} /><div><div className="xs muted" style={{ fontWeight: 700 }}>WHY</div><span className="small">{c.reason}</span></div></div>
      </div>
      {c.status !== "rejected" && <FlagList flags={c.flags} />}
      {c.status !== "rejected" && c.flags.length > 0 && (
        <div className="row">
          <button className="btn btn-danger btn-sm" onClick={() => put({ confirmedTrue: true }, "Saved as a fact you confirmed")} disabled={busy} data-testid="button-confirm-true">This is true — I can back it up</button>
          <span className="xs muted">Confirming adds it to your approved facts.</span>
        </div>
      )}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {editing ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setText(c.edited || c.revised); }}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()} onClick={async () => { await put({ edited: text }, "Edit saved and re-checked"); setEditing(false); }} data-testid="button-save-edit">Save edit</button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => put({ status: "rejected" })} disabled={busy} data-testid="button-reject"><X size={14} /> Reject</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} disabled={busy} data-testid="button-edit"><Pencil size={14} /> Edit</button>
            <button className="btn btn-primary btn-sm" onClick={() => put({ status: "accepted" })} disabled={busy || c.status === "accepted"} data-testid="button-accept"><Check size={14} /> Accept</button>
          </>
        )}
      </div>
    </div>
  );
}

function Letter({ a }: { a: Application }) {
  const { setWs, run } = useStore();
  const [text, setText] = useState(a.letter);
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(a.letter), [a.letter]);
  const saveLetter = async () => {
    setBusy(true);
    const r = await run(() => api<{ workspace: Workspace }>("PUT", `/api/applications/${a.id}/letter`, { letter: text }), "Letter saved and re-checked");
    if (r) setWs(r.workspace);
    setBusy(false);
  };
  const toggle = async (pid: string, done: boolean) => {
    const r = await run(() => api<{ workspace: Workspace }>("PUT", `/api/applications/${a.id}/personalize/${pid}`, { done }));
    if (r) setWs(r.workspace);
  };
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card card-pad stack">
        <div className="row-between"><h3>Cover letter draft</h3>{a.letterApproved ? <span className="chip chip-live">Approved</span> : <span className="chip chip-plain">Draft</span>}</div>
        <textarea className="textarea" style={{ minHeight: 420, fontSize: 14 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Cover letter" data-testid="input-letter" />
        <div className="row"><button className="btn btn-primary btn-sm" onClick={saveLetter} disabled={busy || text === a.letter} data-testid="button-save-letter">{busy && <Spinner />} Save & re-check</button><span className="xs muted">Replace every [PERSONALIZE: …] with your own words.</span></div>
      </div>
      <div className="stack">
        <div className="card card-pad stack-sm">
          <h3>Details only you can add</h3>
          {a.personalize.length ? a.personalize.map((p) => (
            <div key={p.id} className="item" style={{ padding: "8px 0" }}>
              <button className="check" role="checkbox" aria-checked={p.done} onClick={() => toggle(p.id, !p.done)} aria-label="Mark done" data-testid="checkbox-personalize">{p.done && <Check size={13} />}</button>
              <span className="small" style={{ textDecoration: p.done ? "line-through" : undefined }}>{p.text}</span>
            </div>
          )) : <span className="small muted">None suggested.</span>}
        </div>
        <div className="card card-pad stack-sm">
          <h3>Letter check</h3>
          {a.letterFlags.length ? <FlagList flags={a.letterFlags} /> : <span className="small row pass"><CheckCircle2 size={16} /> No unsupported claims or placeholders found.</span>}
        </div>
      </div>
    </div>
  );
}

function Checks({ a }: { a: Application }) {
  const { ws, setWs, run, config } = useStore();
  const [busy, setBusy] = useState("");
  const [test, setTest] = useState<ClaimFlag[] | null>(null);
  const [testText, setTestText] = useState("Managed a $250,000 student investment fund using Python and Bloomberg Terminal as Investment Committee Chair.");
  const flagged = a.changes.filter((c) => c.status !== "rejected" && c.flags.length);
  const audit = async () => {
    setBusy("audit");
    const r = await run(() => api<{ workspace: Workspace }>("POST", `/api/applications/${a.id}/audit`));
    if (r) setWs(r.workspace);
    setBusy("");
  };
  const runTest = async () => {
    setBusy("test");
    const r = await run(() => api<{ flags: ClaimFlag[]; workspace: Workspace }>("POST", "/api/safeguard/test", { text: testText }));
    if (r) { setTest(r.flags); setWs(r.workspace); }
    setBusy("");
  };
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="stack">
        <div className="card card-pad stack-sm">
          <h3>Unsupported-claim check</h3>
          <p className="xs muted">Rule-based and independent of the AI: flags numbers, tools, titles, names, class standing and added outcomes that aren't in your resume or approved facts.</p>
          <div className="row"><span className={"chip " + (flagged.length ? "chip-bad" : "chip-live")}>{flagged.length} resume change(s) flagged</span><span className={"chip " + (a.letterFlags.length ? "chip-bad" : "chip-live")}>{a.letterFlags.length} letter issue(s)</span></div>
          {flagged.map((c) => <div key={c.id} className="small"><strong>{c.entryLabel}</strong><FlagList flags={c.flags} /></div>)}
        </div>
        <div className="card card-pad stack-sm">
          <div className="row-between"><h3>AI second opinion</h3><button className="btn btn-secondary btn-sm" onClick={audit} disabled={!!busy || !config?.ai.available} data-testid="button-audit">{busy === "audit" && <Spinner />} Run audit</button></div>
          <p className="xs muted">A separate AI pass compares the tailored documents with your evidence. Advisory — the rule-based check above is what blocks export.</p>
          {a.audit ? (a.audit.findings.length ? a.audit.findings.map((f, i) => <div key={i} className="flag"><ShieldAlert size={15} /><span><strong>“{f.claim}”</strong> — {f.why}</span></div>) : <span className="small pass row"><CheckCircle2 size={16} /> No unsupported claims found ({fmtDate(a.audit.at)}).</span>) : <span className="small muted">Not run yet.</span>}
        </div>
        <div className="card card-pad stack-sm">
          <h3>Test the safeguard</h3>
          <p className="xs muted">Try a deliberately false claim and watch the checker catch it. Results are logged for your competition evidence.</p>
          <textarea className="textarea" style={{ minHeight: 60 }} value={testText} onChange={(e) => setTestText(e.target.value)} aria-label="Test claim" data-testid="input-safeguard" />
          <div><button className="btn btn-secondary btn-sm" onClick={runTest} disabled={!!busy} data-testid="button-safeguard-test">{busy === "test" && <Spinner />} Check this claim</button></div>
          {test && (test.length ? <FlagList flags={test} /> : <span className="small pass row"><CheckCircle2 size={16} /> Nothing unsupported — this is backed by your resume.</span>)}
        </div>
      </div>
      <div className="card card-pad stack-sm" data-testid="card-ats">
        <h3>ATS format check</h3>
        <p className="xs muted">For the resume as it will be exported, with the changes you accepted.</p>
        {a.ats.map((c) => (
          <div key={c.id} className="ats-row">
            {c.pass ? <CheckCircle2 size={16} className="pass" /> : <AlertTriangle size={16} className="fail" />}
            <div><strong>{c.label}</strong><div className="xs muted">{c.detail}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumePaper({ doc, changed }: { doc: ResumeDoc; changed?: Set<string> }) {
  return (
    <div className="resume-paper" data-testid="resume-preview">
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{doc.contact.name}</div><div>{[doc.contact.location, doc.contact.email, doc.contact.phone, doc.contact.links].filter(Boolean).join(" | ")}</div></div>
      {doc.sections.map((s) => (
        <div key={s.id}>
          <h4>{s.heading}</h4>
          {s.entries.map((e) => (
            <div key={e.id}>
              {(e.org || e.location) && <div className="rp-row"><strong>{e.org}</strong><strong>{e.location}</strong></div>}
              {(e.role || e.dates) && <div className="rp-row"><em>{e.role}</em><em>{e.dates}</em></div>}
              {e.bullets.length > 0 && <ul>{e.bullets.map((b) => <li key={b.id}><span className={changed?.has(b.id) ? "changed" : undefined}>{b.text}</span></li>)}</ul>}
            </div>
          ))}
        </div>
      ))}
      {doc.skills.length > 0 && <div><h4>Skills</h4>{doc.skills.map((k) => <div key={k.id}><strong>{k.label}:</strong> {k.items}</div>)}</div>}
    </div>
  );
}

function DownloadButtons({ a, v }: { a: Application; v: number }) {
  const { toast } = useStore();
  const dl = (doc: "resume" | "letter", format: string) =>
    download(`/api/applications/${a.id}/export?doc=${doc}&format=${format}&v=${v}`, `${doc}.${format}`).catch((e) => toast(e.message, true));
  return (
    <div className="stack-sm">
      <div className="row"><span className="small" style={{ width: 92, fontWeight: 700 }}>Resume</span>{["docx", "pdf", "txt"].map((f) => <button key={f} className="btn btn-secondary btn-sm" onClick={() => dl("resume", f)} data-testid={`button-download-resume-${f}`}><Download size={13} /> {f.toUpperCase()}</button>)}</div>
      <div className="row"><span className="small" style={{ width: 92, fontWeight: 700 }}>Cover letter</span>{["docx", "pdf", "txt"].map((f) => <button key={f} className="btn btn-secondary btn-sm" onClick={() => dl("letter", f)} data-testid={`button-download-letter-${f}`}><Download size={13} /> {f.toUpperCase()}</button>)}</div>
    </div>
  );
}

function ExportView({ a, job }: { a: Application; job: Job }) {
  const { ws } = useStore();
  const { doc, changed } = useMemo(() => composeClient(ws!, a), [ws, a]);
  return (
    <div className="stack">
      <div className="card card-pad stack-sm">
        <h3>Downloads</h3>
        {a.versions.length ? (
          [...a.versions].reverse().map((v) => (
            <div key={v.v} className="stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <span className="small"><strong>Version {v.v}</strong> · approved {fmtDate(v.at)}</span>
              <DownloadButtons a={a} v={v.v} />
            </div>
          ))
        ) : <span className="small muted">Approve this version to unlock Word, PDF and text downloads. Only approved versions can be exported.</span>}
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack-sm"><span className="eyebrow">Resume preview · highlighted lines changed for {job.company}</span><ResumePaper doc={doc} changed={changed} /></div>
        <div className="stack-sm"><span className="eyebrow">Cover letter preview</span><div className="resume-paper" style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{a.letter}</div></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- library
function Library() {
  const { ws } = useStore();
  const { jobs } = useJobs();
  const w = ws!;
  const approved = w.applications.filter((a) => a.versions.length);
  return (
    <div className="stack-lg">
      <div className="card card-pad stack">
        <h3>Approved application materials</h3>
        {approved.length ? approved.map((a) => {
          const j = jobs?.find((x) => x.id === a.jobId);
          const v = a.versions[a.versions.length - 1];
          return (
            <div key={a.id} className="stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div className="row-between"><div><span className="xs muted">{j?.company}</span><div><strong>{j?.title}</strong></div></div><span className="chip chip-live">v{v.v} · {fmtDate(v.at)}</span></div>
              {a.staleReason && <span className="xs" style={{ color: "var(--amber)" }}>{a.staleReason}</span>}
              <DownloadButtons a={a} v={v.v} />
            </div>
          );
        }) : <span className="small muted">Nothing approved yet. Approved versions appear here with Word, PDF and text downloads.</span>}
      </div>
      <div className="card card-pad stack">
        <h3>Safeguard log</h3>
        <p className="xs muted">Every time the checker catches an AI overstatement or you run a safeguard test, it's recorded here with a timestamp — real evidence, not a staged example.</p>
        {w.incidents.length ? w.incidents.slice(0, 20).map((i) => (
          <div key={i.id} className="stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <div className="row"><span className={"chip " + (i.kind === "Safeguard test" ? "chip-demo" : "chip-bad")}>{i.kind}</span><span className="xs muted">{new Date(i.at).toLocaleString()} · {i.where}</span></div>
            <span className="small quote">{i.text.slice(0, 300)}</span>
            <span className="xs muted">Caught: {i.flags.map((f) => f.term).join(", ") || "nothing"}</span>
          </div>
        )) : <span className="small muted">No incidents yet.</span>}
      </div>
    </div>
  );
}
