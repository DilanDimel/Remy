import { shortTitle } from "@shared/org";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown, ChevronUp, Download, FileText, Link2, Pencil, Plus, RotateCcw, ShieldAlert, ShieldCheck, Sparkles,
  Star, Trash2, X,
} from "lucide-react";
import type { Application, BulletChange, ClaimFlag, Job, ResumeDoc, Workspace } from "@shared/types";
import { API_BASE, api, download, fmtDate, rid, useStore } from "../lib/store";
import { go, replaceRoute } from "../lib/router";
import { useJobs } from "../lib/jobs";
import { AiUnavailableNote, Empty, Remy, Spinner, StatusChip, WorkingSteps } from "../components/common";
import { ResumeBuilder } from "../components/ResumeBuilder";
import { ResumeUpload } from "../components/Uploaders";
import { AtsCard } from "../components/AtsCard";
import { AtsXray } from "../components/AtsXray";
import { EvidencePassport } from "../components/EvidencePassport";
import { StoryDeck } from "../components/StoryDeck";
import { PitchCard } from "../components/PitchCard";
import { LinkedInCoach } from "../components/LinkedInCoach";
import { WordPreview } from "../components/WordPreview";
import { startTailor, useTailorSession } from "../lib/tailorChat";
import { textConcern } from "@shared/junk";

type Tab = "base" | "tailor" | "prep" | "library";

export default function Resume({ query }: { query: URLSearchParams }) {
  const tab = (query.get("tab") as Tab) || "base";
  const { ws } = useStore();
  const effective: Tab = !ws!.resume && tab !== "library" ? "base" : tab;
  const setTab = (t: Tab) => go(`/resume?tab=${t}`);
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Resume/CV</span>
          <h1>Your experience, clearly expressed.</h1>
          <p className="hide-phone">Every tailored change shows the posting requirement behind it and the evidence from your own resume.</p>
        </div>
      </div>
      <LaptopNudge />
      <div className="tabs" role="tablist">
        {([["base", "Base resume"], ["tailor", "Tailor for an opening"], ["prep", "Interview & LinkedIn"], ["library", "Approved & exports"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={effective === k} onClick={() => setTab(k)} data-testid={`tab-resume-${k}`}>{l}</button>
        ))}
      </div>
      {effective === "base" && <BaseResume />}
      {effective === "tailor" && <Tailor query={query} />}
      {effective === "prep" && <div className="stack-lg"><StoryDeck /><PitchCard /><LinkedInCoach /></div>}
      {effective === "library" && <Library />}
    </>
  );
}

// ---------------------------------------------------------------- base resume
function BaseResume() {
  // "Make my resume stronger" in setup lands here with the checks open.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("checks")) return;
    const t = setTimeout(() => { const d = document.getElementById("resume-checks") as HTMLDetailsElement | null; if (d) { d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); } }, 300);
    return () => clearTimeout(t);
  }, []);
  const { ws, setWs, run, toast } = useStore();
  const w = ws!;
  const [doc, setDoc] = useState<ResumeDoc | null>(w.resume?.doc ? JSON.parse(JSON.stringify(w.resume.doc)) : null);
  const [showRaw, setShowRaw] = useState(false);
  const [replace, setReplace] = useState(false);
  // Students who'd rather not see their file can minimize it; the choice is remembered on this device.
  // No choice yet: open on laptops, minimized on phones (the file preview is a screen tall there).
  const [preview, setPreviewState] = useState(() => { try { const v = localStorage.getItem("remy.resumePreview"); return v ? v !== "hidden" : !window.matchMedia("(max-width: 640px)").matches; } catch { return true; } });
  const setPreview = (fn: (p: boolean) => boolean) => setPreviewState((p) => { const n = fn(p); try { localStorage.setItem("remy.resumePreview", n ? "shown" : "hidden"); } catch { /* private mode */ } return n; });
  const [building, setBuilding] = useState(false);
  useEffect(() => { setDoc(w.resume?.doc ? JSON.parse(JSON.stringify(w.resume.doc)) : null); }, [w.resume?.uploadedAt]);
  if ((!w.resume || !doc) && building) return <div className="card card-pad"><ResumeBuilder onDone={() => setBuilding(false)} onCancel={() => setBuilding(false)} /></div>;
  if (!w.resume || !doc)
    return (
      <div className="card card-pad stack">
        <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}><Remy size={46} /><div><h2>Start with the resume you already have</h2><p className="small muted">Remy reads it, then you confirm every line. Nothing is invented.</p></div></div>
        <ResumeUpload />
        <div><button className="btn btn-secondary btn-sm" onClick={() => setBuilding(true)} data-testid="button-build-resume">{w.builder ? "Continue building your resume with Remy" : "No resume yet? Build one with Remy (about 10 minutes)"}</button></div>
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
          <span className="xs muted">{w.resume.parsedBy === "builder" ? "Made" : "Uploaded"} {fmtDate(w.resume.uploadedAt)} · {w.resume.parsedBy === "builder" ? "built with Remy from your answers" : `read by ${w.resume.parsedBy === "ai" ? "AI, then checked word-for-word against your file" : "the built-in parser"}`}{unverified ? ` · ${unverified} line(s) need a look` : ""}</span>
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
            <span className="xs muted">{w.resume.original ? "Your original keeps your own layout. The export uses Remy's clean, ATS-friendly one-column format with your edits below, in your font and length." : "This resume was pasted, so there's no original file. Export it as a clean PDF or Word file."}</span>
          </div>
          <div className="row">
            {w.resume.original && <button className="btn btn-secondary btn-sm" onClick={() => download("/api/resume/original?download=1", w.resume!.original!.name).catch((e) => toast(e.message, true))} data-testid="button-download-original"><Download size={14} /> Original</button>}
            <button className="btn btn-primary btn-sm" onClick={() => download("/api/resume/export?format=pdf", "Resume.pdf").catch((e) => toast(e.message, true))} disabled={dirty} title={dirty ? "Save your edits first" : undefined} data-testid="button-export-base-pdf"><Download size={14} /> Export PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={() => download("/api/resume/export?format=docx", "Resume.docx").catch((e) => toast(e.message, true))} disabled={dirty} data-testid="button-export-base-docx">Word</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { const d = document.getElementById("resume-checks") as HTMLDetailsElement | null; if (d) { d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); } }} data-testid="button-jump-checks">Checks ↓</button>
          </div>
        </div>
        {(() => { // live from the current bullets, so it's gone as soon as the line is reworded
          const rude = w.resume.doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.filter((b) => textConcern(b.text)).map((b) => b.text)));
          return rude.length > 0 && <div className="notice notice-bad" role="alert" data-testid="warn-rude-lines"><AlertTriangle size={16} /> <span>{rude.length === 1 ? "One line has" : `${rude.length} lines have`} language most employers would reject: “{rude[0].length > 90 ? rude[0].slice(0, 90) + "…" : rude[0]}”. Reword {rude.length === 1 ? "it" : "them"} in Edit before you apply.</span></div>;
        })()}
        {(w.resume.original?.mime === "application/pdf" || w.resume.original?.mime.includes("wordprocessingml")) && (
          <div className="stack-sm">
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setPreview((p) => !p)} aria-expanded={preview} data-testid="button-toggle-preview">
              {preview ? <><ChevronUp size={14} /> Minimize your resume</> : <><ChevronDown size={14} /> Show your resume</>}
            </button>
            {preview && (w.resume.original.mime === "application/pdf"
              ? <iframe className="pdf-preview" src={`${API_BASE}/api/resume/original#view=FitH`} title="Your original resume" data-testid="pdf-preview" />
              : <>
                  <span className="xs muted">A preview of your Word file. Fonts can look slightly different if your computer doesn't have them.</span>
                  <WordPreview version={w.resume.uploadedAt} />
                </>)}
          </div>
        )}
      </div>
      {showRaw && <pre className="card card-pad xs" style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto", margin: 0 }}>{w.resume.rawText}</pre>}

      <div className="card card-pad stack" id="edit-resume">
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
                  {textConcern(b.text) && <span title={textConcern(b.text)} role="img" aria-label={textConcern(b.text)} style={{ color: "var(--error)", marginTop: 8 }} data-testid="warn-bullet"><AlertTriangle size={16} /></span>}
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
      <div className={"card card-pad row-between approve-bar" + (dirty ? " floating" : "")}>
        <span className="small muted">{dirty ? "You have unsaved edits. Your edits become the evidence Remy may use." : w.resume.confirmedAt ? "This is the evidence base for every tailored version." : "Confirm when every line is accurate."}</span>
        <div className="row">
          <button className="btn btn-secondary" disabled={!dirty} onClick={() => saveDoc(false)} data-testid="button-save-resume">Save edits</button>
          <button className="btn btn-primary" onClick={() => saveDoc(true)} data-testid="button-confirm-resume"><CheckCircle2 size={16} /> {w.resume.confirmedAt && !dirty ? "Re-confirm" : "Save & confirm"}</button>
        </div>
      </div>
      {/* The resume comes first; suggestions, what an ATS reads and the evidence passport are one click away. */}
      <details className="card card-pad stack" id="resume-checks" data-testid="resume-checks">
        <summary style={{ cursor: "pointer" }}><h3 style={{ display: "inline" }}>Checks</h3> <span className="small muted">Suggestions, what an application system reads from your file, and the evidence behind your skills</span></summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <AtsCard refreshKey={`${w.resume.uploadedAt}-${w.resume.confirmedAt || ""}-${JSON.stringify(w.resume.doc).length}`} />
          {doc && <AtsXray doc={doc} quality={w.resume.quality} upd={upd} />}
          {doc && <EvidencePassport doc={doc} memory={w.memory} />}
        </div>
      </details>
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
  // ?go=1 (from "Tailor resume" on an opening): start tailoring right away, one click instead of two.
  const autoStart = query.get("go") === "1";
  useEffect(() => {
    if (!jobParam) return;
    const existing = w.applications.find((a) => a.jobId === jobParam);
    const goOn = autoStart ? "&go=1" : "";
    if (existing) { replaceRoute(`/resume?tab=tailor&app=${existing.id}${goOn}`); return; }
    run(() => api<{ application: Application; workspace: Workspace }>("POST", "/api/applications", { jobId: jobParam })).then((r) => {
      if (r) { setWs(r.workspace); replaceRoute(`/resume?tab=tailor&app=${r.application.id}${goOn}`); }
    });
  }, [jobParam]);
  const selected = w.applications.find((a) => a.id === appParam) || w.applications[0];
  const jobOf = (a: Application) => jobs?.find((j) => j.id === a.jobId);
  const start = async (jobId: string) => {
    const r = await run(() => api<{ application: Application; workspace: Workspace }>("POST", "/api/applications", { jobId }));
    if (r) { setWs(r.workspace); go(`/resume?tab=tailor&app=${r.application.id}`); }
  };
  // Openings you haven't started, best fit first, by the same rules as Opportunities: ones you're not eligible for
  // or that are outside the places you chose are left out. Only the best few, so the tailoring panel stays in view.
  const notStarted = (jobs || [])
    .filter((j) => j.kind !== "event" && !w.applications.some((a) => a.jobId === j.id) && !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false && !w.hiddenJobIds.includes(j.id))
    .sort((x, y) => (fits[y.id]?.score ?? 0) - (fits[x.id]?.score ?? 0));
  const shown = notStarted.slice(0, 8);
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <div className="row-between">
          <span className="eyebrow">Your applications · {w.applications.length} · {notStarted.length} more openings that fit you</span>
          <button className="btn btn-ghost btn-sm" onClick={() => go("/opportunities?import=1")} data-testid="button-new-application"><Link2 size={14} /> Import a posting from a link or text</button>
        </div>
        {/* phones show 3 applications (plus the open one); the rest are one tap away here */}
        {w.applications.length > 3 && (
          <select className="input phone-only-block" aria-label="All your applications" value={selected?.id || ""} onChange={(e) => go(`/resume?tab=tailor&app=${e.target.value}`)}>
            {!selected && <option value="">All {w.applications.length} applications…</option>}
            {w.applications.map((a) => { const j = jobOf(a); return <option key={a.id} value={a.id}>{j ? `${j.company}: ${shortTitle(j.title, j.company)}` : "Loading"}</option>; })}
          </select>
        )}
        <div className="opening-strip" data-testid="opening-strip">
          {w.applications.map((a, i) => {
            const j = jobOf(a);
            const pending = a.changes.filter((c) => c.status === "pending").length;
            return (
              <button key={a.id} className={"pick" + (i >= 3 && selected?.id !== a.id ? " pick-extra" : "")} aria-pressed={selected?.id === a.id} onClick={() => go(`/resume?tab=tailor&app=${a.id}`)} data-testid="button-pick-application">
                <span className="xs muted">{j?.company || "…"}</span>
                <strong className="small">{j ? shortTitle(j.title, j.company) : "Loading"}</strong>
                <span className="row xs">
                  {a.versions.length ? <span className="chip chip-live">Approved v{a.versions.length}</span> : a.generatedAt ? <span className="chip chip-plain">Draft{pending ? ` · ${pending} to review` : ""}</span> : <span className="chip chip-plain">Not generated</span>}
                  {a.staleReason && <span className="chip chip-setup">Review</span>}
                </span>
              </button>
            );
          })}
          {shown.map((j, i) => (
            <button key={j.id} className={"pick pick-new" + (i >= 3 ? " pick-extra" : "")} onClick={() => start(j.id)} data-testid="button-choose-job">
              <span className="xs muted">{j.company}</span>
              <strong className="small">{shortTitle(j.title, j.company)}</strong>
              <span className="row xs"><span className="chip chip-plain"><Plus size={11} /> Start tailoring</span>{fits[j.id]?.eligibility === "likely" && fits[j.id]?.checked && <span className="chip chip-live">Eligible</span>}</span>
            </button>
          ))}
          {/* phones list only the top 3 new openings (no sideways scrolling), so their "more" counts from 3 */}
          {notStarted.length > 3 && <button className="pick pick-new pick-more-phone" onClick={() => go("/opportunities")}><strong className="small">{notStarted.length - 3} more</strong><span className="xs muted">See them all in Opportunities</span></button>}
          {notStarted.length > shown.length && <button className="pick pick-new pick-more-wide" onClick={() => go("/opportunities")} data-testid="button-more-openings"><strong className="small">{notStarted.length - shown.length} more</strong><span className="xs muted">See them all in Opportunities</span></button>}
        </div>
      </div>
      <div>
        {!config?.ai.available && <div style={{ marginBottom: 12 }}><AiUnavailableNote /></div>}
        {selected && jobOf(selected) ? <AppEditor key={selected.id} a={selected} job={jobOf(selected)!} autoStart={autoStart && selected.id === appParam} /> : (
          <div className="card"><Empty title="Pick an opening to tailor for" body="Choose one of the openings above, or import any public posting. Remy will propose truthful changes for you to review." /></div>
        )}
      </div>
    </div>
  );
}

type Sub = "changes" | "letter" | "checks" | "export";

function AppEditor({ a, job, autoStart = false }: { a: Application; job: Job; autoStart?: boolean }) {
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
  // "Tailor with AI" starts a conversation in Remy's panel; he tailors once you've answered.
  const tailor = useTailorSession();
  const mine = tailor?.appId === a.id ? tailor : null;
  const conflict = ws!.fits[job.id]?.eligibility === "unlikely" ? ws!.fits[job.id]!.eligibilityNote : undefined;
  const generate = () => startTailor(a, job, conflict);
  useEffect(() => {
    if (!autoStart) return;
    replaceRoute(`/resume?tab=tailor&app=${a.id}`); // so a reload doesn't start it again
    if (!a.generatedAt && !mine && config?.ai.available) generate();
  }, []);
  const pending = a.changes.filter((c) => c.status === "pending").length;
  const blocking = a.changes.filter((c) => (c.status === "accepted" || c.status === "edited") && c.flags.length).length;
  const approve = () => call("approve", () => api("POST", `/api/applications/${a.id}/approve`), "Approved — downloads are ready");

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div className="stack-sm">
            <span className="xs muted">{job.company} · <StatusChip label={job.label} /></span>
            <h2 data-testid="text-app-title">{job.title}</h2>
            <span className="xs muted">{job.deadlineText || "No deadline listed"} · <a className="src-link" href={job.applyUrl || job.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--plum)", fontWeight: 700 }}>Posting <ArrowUpRight size={12} style={{ display: "inline" }} /></a></span>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={!!busy || (!!mine && mine.stage !== "done") || !config?.ai.available || !w.resume} data-testid="button-generate">
            {mine?.stage === "working" ? <Spinner /> : a.generatedAt ? <RotateCcw size={16} /> : <Sparkles size={16} />} {mine?.stage === "working" ? "Tailoring…" : mine?.stage === "asking" ? "Answering Remy…" : a.generatedAt ? "Regenerate" : "Tailor with AI"}
          </button>
        </div>
        {mine?.stage === "working" && <WorkingSteps steps={["Reading the posting", "Matching it to your resume", "Writing suggested changes", "Checking every change is true to your experience"]} />}
        {a.staleReason && <div className="notice notice-warn" style={{ marginTop: 12 }}><AlertTriangle size={16} /><div>{a.staleReason}</div></div>}
        {a.generatedAt && <p className="xs muted" style={{ marginTop: 10 }}>Draft made {fmtDate(a.generatedAt)} · {a.versions.length ? `approved v${a.versions.length} on ${fmtDate(a.versions[a.versions.length - 1].at)}` : "not yet approved"}</p>}
      </div>

      {mine?.stage === "asking" && <div className="card card-pad row" style={{ flexWrap: "nowrap" }} data-testid="tailor-asking"><Remy size={40} mood="wave" /><span className="small"><b>Remy is asking you a few questions in the chat.</b> Answer there (or type "skip") and he'll tailor as soon as you're done.</span></div>}
      {mine?.stage === "working" && <div className="card card-pad stack"><div className="row"><Remy size={40} mood="think" /><span className="muted">Remy is matching your experience to {job.company}'s requirements. This usually takes about a minute.</span></div>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 70 }} />)}</div>}

      {a.generatedAt && mine?.stage !== "working" && (
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
              {pending ? `${pending} change(s) still need your decision.` : blocking ? `${blocking} accepted change(s) have unsupported claims.` : a.letterFlags.length ? `Ready to approve. Your letter has ${a.letterFlags.length} thing(s) to check first: see Checks.` : "Ready to approve."}
            </span>
            <div className="row">
              <button className="btn btn-primary" onClick={() => approve()} disabled={!!busy} data-testid="button-approve-app">{busy === "approve" ? <Spinner /> : <ShieldCheck size={16} />} Approve this version</button>
            </div>
          </div>
        </>
      )}
      {!a.generatedAt && !mine && (
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
  const { ws, setWs, run } = useStore();
  const { jobs } = useJobs();
  const job = jobs?.find((j) => j.id === a.jobId);
  const used = ws!.memory.filter((m) => job && m.source === `Told Remy while tailoring for ${job.company}`);
  const [text, setText] = useState(a.letter);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(a.letter); }, [a.letter]);
  const saveLetter = async () => {
    setBusy(true);
    const r = await run(() => api<{ workspace: Workspace }>("PUT", `/api/applications/${a.id}/letter`, { letter: text }), "Letter saved and re-checked");
    if (r) setWs(r.workspace);
    setBusy(false);
  };
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card card-pad stack">
        <div className="row-between"><h3>Cover letter draft</h3>{a.letterApproved ? <span className="chip chip-live">Approved</span> : <span className="chip chip-plain">Draft</span>}</div>
        <textarea className="textarea" style={{ minHeight: 420 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Cover letter" data-testid="input-letter" />
        <div className="row"><button className="btn btn-primary btn-sm" onClick={saveLetter} disabled={busy || text === a.letter} data-testid="button-save-letter">{busy && <Spinner />} Save changes</button><span className="xs muted">Edit anything you like.</span></div>
      </div>
      <div className="stack">
        <div className="card card-pad stack-sm" data-testid="card-letter-answers">
          <h3>What Remy used</h3>
          <p className="xs muted">Your letter is written from your resume and what you told Remy — nothing to fill in.</p>
          {used.length ? used.map((m) => <div key={m.id} className="small" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>{m.text}</div>) : <span className="small muted">No answers yet.</span>}
          {job && <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => startTailor(a, job, ws!.fits[job.id]?.eligibility === "unlikely" ? ws!.fits[job.id]!.eligibilityNote : undefined)} data-testid="button-answer-again">Answer again &amp; rewrite</button>}
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
      <div style={{ gridColumn: "1 / -1" }}><AtsCard appId={a.id} refreshKey={a.changes.map((c) => c.status + (c.edited || "")).join("|")} /></div>
      <div className="stack">
        <div className="card card-pad stack-sm">
          <h3>Unsupported-claim check</h3>
          <p className="xs muted">Rule-based and independent of the AI: flags numbers, tools, titles, names, class standing and added outcomes that aren't in your resume or approved facts.</p>
          <div className="row"><span className={"chip " + (flagged.length ? "chip-bad" : "chip-live")}>{flagged.length} resume change(s) flagged</span><span className={"chip " + (a.letterFlags.length ? "chip-bad" : "chip-live")}>{a.letterFlags.length} letter issue(s)</span></div>
          {a.letterFlags.length > 0 && <div className="stack-sm" data-testid="letter-flags">{a.letterFlags.map((f, i) => <div key={i} className="flag"><ShieldAlert size={15} /><span><strong>“{f.term}”</strong> in your letter: {f.message} Edit it in the Cover letter tab if it isn't true.</span></div>)}</div>}
          {flagged.map((c) => <div key={c.id} className="small"><strong>{c.entryLabel}</strong><FlagList flags={c.flags} /></div>)}
        </div>
        <div className="card card-pad stack-sm">
          <div className="row-between"><h3>AI second opinion</h3><button className="btn btn-secondary btn-sm" onClick={audit} disabled={!!busy || !config?.ai.available} data-testid="button-audit">{busy === "audit" && <Spinner />} Run audit</button></div>
          <p className="xs muted">A separate AI pass compares the tailored documents with your evidence. Advisory — the rule-based check above is what blocks export.</p>
          {a.audit ? (a.audit.findings.length ? a.audit.findings.map((f, i) => <div key={i} className="flag"><ShieldAlert size={15} /><span><strong>“{f.claim}”</strong> — {f.why}</span></div>) : <span className="small pass row"><CheckCircle2 size={16} /> No unsupported claims found ({fmtDate(a.audit.at)}).</span>) : <span className="small muted">Not run yet.</span>}
        </div>
        <div className="card card-pad stack-sm">
          <h3>Test the safeguard</h3>
          <p className="xs muted">Type a claim that isn't true and watch the checker catch it, so you know what it protects you from.</p>
          <textarea className="textarea" style={{ minHeight: 60 }} value={testText} onChange={(e) => setTestText(e.target.value)} aria-label="Test claim" data-testid="input-safeguard" />
          <div><button className="btn btn-secondary btn-sm" onClick={runTest} disabled={!!busy} data-testid="button-safeguard-test">{busy === "test" && <Spinner />} Check this claim</button></div>
          {test && (test.length ? <FlagList flags={test} /> : <span className="small pass row"><CheckCircle2 size={16} /> Nothing unsupported — this is backed by your resume.</span>)}
        </div>
      </div>
      <div className="card card-pad stack-sm" data-testid="card-ats">
        <h3>ATS format check</h3>
        <p className="xs muted">For the resume as it will be exported, with the changes you accepted.</p>
        {a.ats.filter((c) => c.id !== "layout" || ws?.resume?.style?.layout).map((c) => ( // checks saved before Remy read the file's layout claimed a pass it never checked
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
              {e.bullets.length > 0 && <ul>{e.bullets.map((b) => <li key={b.id}><span className={changed?.has(b.id) ? "changed" : undefined}>{b.text}</span>{textConcern(b.text) && <span role="img" aria-label={textConcern(b.text)} title={textConcern(b.text)} style={{ color: "var(--error)", marginLeft: 4, verticalAlign: "middle" }} data-testid="warn-bullet-preview"><AlertTriangle size={13} /></span>}</li>)}</ul>}
            </div>
          ))}
        </div>
      ))}
      {doc.skills.length > 0 && <div><h4>Skills</h4>{doc.skills.map((k) => <div key={k.id}><strong>{k.label}:</strong> {k.items}</div>)}</div>}
    </div>
  );
}

type WordLayout = { layout: "original" | "remy"; reason?: "not-word" | "unreadable" | "missed"; missed?: string[]; more?: number };
function DownloadButtons({ a, v }: { a: Application; v: number }) {
  const { toast, ws } = useStore();
  const ownWord = !!ws?.resume?.original?.mime.includes("wordprocessingml");
  // Before the student downloads: can this version's Word file keep their own design? If not, say so and why.
  const [layout, setLayout] = useState<WordLayout | null>(null);
  // Base edits and deleted lines change which lines fit the file, so the answer is asked again when they change.
  const baseKey = useMemo(() => JSON.stringify([ws?.resume?.original?.name, ws?.resume?.original?.size, ws?.resume?.doc, ws?.resume?.removed]), [ws?.resume]);
  useEffect(() => {
    setLayout(null);
    if (!ownWord) return;
    let live = true;
    api<WordLayout>("GET", `/api/applications/${a.id}/word-layout?v=${v}`).then((r) => { if (live) setLayout(r); }).catch(() => {});
    return () => { live = false; };
  }, [a.id, v, ownWord, baseKey]);
  const dl = (doc: "resume" | "letter", format: string) =>
    download(`/api/applications/${a.id}/export?doc=${doc}&format=${format}&v=${v}`, `${doc}.${format}`).catch((e) => toast(e.message, true));
  return (
    <div className="stack-sm">
      <div className="row"><span className="small" style={{ width: 92, fontWeight: 700 }}>Resume</span>{["docx", "pdf", "txt"].map((f) => <button key={f} className="btn btn-secondary btn-sm" onClick={() => dl("resume", f)} data-testid={`button-download-resume-${f}`}><Download size={13} /> {f.toUpperCase()}</button>)}</div>
      {ownWord && layout?.layout === "remy" && (
        <div className="xs" style={{ color: "var(--amber)" }} data-testid="note-word-layout">
          {layout.reason === "missed"
            ? <>Heads up: this DOCX won't keep your own design. Remy couldn't find where {layout.missed!.length === 1 ? "this line goes" : "these lines go"} in your Word file: {layout.missed!.map((m) => `“${m.length > 80 ? m.slice(0, 80) + "…" : m}”`).join(", ")}{layout.more ? ` and ${layout.more} more` : ""}. So the DOCX uses Remy's clean one-column layout in your font. To keep your design, download Original on Base resume and make the change in Word.</>
            : <>Heads up: Remy couldn't open your Word file, so this DOCX uses Remy's clean one-column layout in your font, not your own design.</>}
        </div>
      )}
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
        <span className="xs muted">{ws!.resume?.original?.mime.includes("wordprocessingml")
          ? "Word download: your own file with only the changed lines replaced, so it keeps your exact design (Remy says so above if a version can't). PDF: Remy's clean layout in your font."
          : ws!.resume?.style
            ? `Remy rebuilds your resume in a clean, ATS-friendly layout using your ${ws!.resume.style.serif ? "serif" : "sans-serif"} font, size and margins, kept to ${ws!.resume.style.pages === 1 ? "one page" : `${ws!.resume.style.pages} pages`} like your original. Upload a Word file instead to keep your exact design.`
            : "Downloads use Remy's clean, ATS-friendly one-column layout."}</span>
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
        <p className="xs muted">Every time the checker stopped an AI overstatement in your documents, or you tested it, it's listed here with the date.</p>
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

/** Phones only, until dismissed: editing is easier on a bigger screen, and what works fine here. */
function LaptopNudge() {
  const [gone, setGone] = useState(() => { try { return localStorage.getItem("remy.laptopNudge") === "hidden"; } catch { return false; } });
  if (gone) return null;
  return (
    <div className="notice small phone-only" data-testid="laptop-nudge">
      <span>Editing a resume is easier on a laptop. On your phone you can review changes, approve them and download your files.</span>
      <button className="btn btn-ghost btn-sm" onClick={() => { setGone(true); try { localStorage.setItem("remy.laptopNudge", "hidden"); } catch { /* private mode */ } }}>Got it</button>
    </div>
  );
}
