// Redesign stage 3 (owners first, Nov 21, 2026): the base resume as ONE page, no steps. Dilan: "it needs to show
// everyone's resume accurately to how it looks", "we just need to tell Remy what to add and not add, and it will change
// it and show you how it looks", "everything should just be there", ATS back, no Evidence Passport.
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { ResumeDoc, ResumeStyle, Workspace } from "@shared/types";
import { API_BASE, api, download, fmtDate, useStore } from "../lib/store";
import { ResumeMarkup } from "./ResumeMarkup";
import { ResumeReview } from "./ResumeReview";
import { AtsXray } from "./AtsXray";
import { PdfPreview, WordPreview } from "./WordPreview";

function CurrentPdf({ version, doc, look }: { version: string; doc: ResumeDoc; look?: ResumeStyle }) {
  const canShow = typeof navigator !== "undefined" && (navigator as any).pdfViewerEnabled === true;
  const src = `${API_BASE}/api/resume/export?format=pdf&inline=1&v=${encodeURIComponent(version)}`;
  if (canShow) return <iframe className="pdf-preview" src={`${src}#view=FitH`} title="Your resume, current version" data-testid="current-preview" />;
  // Phones and browsers that can't show a PDF in the page get the resume drawn as a page, plus the file itself.
  return <><ResumeMarkup doc={doc} plain look={look} onFix={() => {}} /><a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} href={src} target="_blank" rel="noreferrer">Open the PDF</a></>;
}

export function ResumeOnePage({ doc, upd, dirty, onSave, onReplace, onEditByHand }: { doc: ResumeDoc; upd: (fn: (d: ResumeDoc) => void) => void; dirty: boolean; onSave: () => void; onReplace: () => void; onEditByHand: () => void }) {
  const { ws, setWs, run, toast } = useStore();
  const r = ws!.resume!;
  const [view, setView] = useState<"resume" | "file">("resume");
  const edited = !!r.editedAt && r.editedAt > r.uploadedAt;
  const showOriginal = !edited && !!r.original;
  // Saves what's on screen, unsaved fixes included, so the save bar never lingers (skeptic review).
  const looksRight = () => run(() => api<Workspace>("PUT", "/api/resume/doc", { doc, confirm: true }).then(setWs), "Thanks, that's your base resume now");

  return (
    <div className="r1" data-testid="resume-one-page">
      <div className="r1-bar">
        <div className="row" style={{ gap: 8 }}><FileText size={17} /><b>{r.fileName}</b><span className="xs muted">· {edited ? `edited ${fmtDate(r.editedAt!)}` : `added ${fmtDate(r.uploadedAt)}`}</span></div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => download("/api/resume/export?format=pdf", "Resume.pdf").catch((e) => toast(e.message, true))} data-testid="button-export-base-pdf"><Download size={14} /> PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={() => download("/api/resume/export?format=docx", "Resume.docx").catch((e) => toast(e.message, true))} data-testid="button-export-base-docx">Word</button>
          <button className="btn btn-ghost btn-sm" onClick={onReplace} data-testid="button-replace-resume">Replace file</button>
        </div>
      </div>

      {!r.confirmedAt && (
        <div className="r1-confirm" data-testid="r1-confirm">
          <span className="small"><b>Does this look like your resume?</b> Remy builds every tailored version from it.</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={looksRight} data-testid="button-confirm-resume">Looks right</button>
            <button className="btn btn-ghost btn-sm" onClick={onEditByHand}>Fix something by hand</button>
          </div>
        </div>
      )}
      <p className="small muted r1-hint">Want to change something? Just tell Remy in the chat, like "add Tableau to my skills" or "remove the coursework line". He shows you the change first.</p>
      <div className="r1-grid">
        <section className="r1-view">
          <div className="seg r1-tabs" role="group" aria-label="Show">
            <button aria-pressed={view === "resume"} onClick={() => setView("resume")} data-testid="r1-tab-resume">Your resume</button>
            <button aria-pressed={view === "file"} onClick={() => setView("file")} data-testid="r1-tab-file">{showOriginal ? "Original file" : "Your file"}</button>
          </div>
          {view === "resume" ? (
            // Make it stronger lives beside the resume now (Dilan, Nov 21: "can't we just integrate it with this?").
            <ResumeMarkup doc={doc} look={r.style} onFix={() => document.getElementById("r1-stronger")?.scrollIntoView({ behavior: "smooth", block: "nearest" })} side={<div id="r1-stronger"><ResumeReview doc={doc} upd={upd} onEdit={onEditByHand} beside /></div>} />
          ) : (
            <>
              <span className="xs muted">{showOriginal ? "Your original file, exactly as you uploaded it." : "Your current file, rebuilt in your font and length after your changes."}</span>
              {showOriginal ? (r.original!.mime === "application/pdf" ? <PdfPreview name={r.original!.name} /> : <WordPreview version={r.uploadedAt} />) : <CurrentPdf version={r.editedAt || r.uploadedAt} doc={r.doc} look={r.style} />}
            </>
          )}
        </section>

      </div>

      <section className="r1-section">
        <h3>ATS check</h3>
        <p className="xs muted">A general screening based on how common application systems (like Workday and Greenhouse) read resumes. It's not any one company's exact system, and no tool can promise you'll pass one.</p>
        <AtsXray doc={doc} quality={r.quality} upd={upd} />
      </section>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={onEditByHand} data-testid="button-edit-by-hand">Edit every line by hand</button>
      {dirty && (
        <div className="r1-save" role="status" data-testid="r1-save">
          <span className="small">You have changes that aren't saved yet.</span>
          <button className="btn btn-primary btn-sm" onClick={onSave} data-testid="button-save-resume">Save to my resume</button>
        </div>
      )}
    </div>
  );
}
