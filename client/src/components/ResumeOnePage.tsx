// Redesign stage 3 (owners first, Nov 21, 2026): the base resume as ONE page, no steps. Dilan: "it needs to show
// everyone's resume accurately to how it looks", "we just need to tell Remy what to add and not add, and it will change
// it and show you how it looks", "everything should just be there", ATS back, no Evidence Passport.
import { useState, type ReactNode } from "react";
import { Download, FileText } from "lucide-react";
import type { ResumeDoc, ResumeStyle, Workspace } from "@shared/types";
import { API_BASE, api, download, fmtDate, useStore } from "../lib/store";
import { ResumeMarkup, type Cat } from "./ResumeMarkup";
import { ResumeReview } from "./ResumeReview";
import { AtsXray } from "./AtsXray";
import { LinkedInFlags } from "./LinkedInCoach";
import { PdfPreview, WordPreview } from "./WordPreview";
import { OwnPdfColoured, OwnWordColoured } from "./ResumeReal";
import { exportBasePdf } from "../lib/wordPdf";
import { NameChoice } from "./NameChoice";
import { issues } from "@shared/markup";

function CurrentPdf({ version, doc, look }: { version: string; doc: ResumeDoc; look?: ResumeStyle }) {
  const canShow = typeof navigator !== "undefined" && (navigator as any).pdfViewerEnabled === true;
  const src = `${API_BASE}/api/resume/export?format=pdf&inline=1&v=${encodeURIComponent(version)}`;
  if (canShow) return <iframe className="pdf-preview" src={`${src}#view=FitH`} title="Your resume, current version" data-testid="current-preview" />;
  // Phones and browsers that can't show a PDF in the page get the resume drawn as a page, plus the file itself.
  return <><ResumeMarkup doc={doc} plain look={look} onFix={() => {}} /><a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} href={src} target="_blank" rel="noreferrer">Open the PDF</a></>;
}

export function ResumeOnePage({ doc, upd, dirty, onSave, onReplace, onEditByHand, approved }: { doc: ResumeDoc; upd: (fn: (d: ResumeDoc) => void) => void; dirty: boolean; onSave: () => void; onReplace: () => void; onEditByHand: () => void; approved?: ReactNode }) {
  const { ws, setWs, run, toast } = useStore();
  const r = ws!.resume!;
  const [view, setView] = useState<"resume" | "file">("resume");
  // Changed since upload: the saved stamp, or (for edits made before Remy kept one) a line that isn't in the file's text.
  const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const raw = squash(r.rawText || "");
  const edited = (!!r.editedAt && r.editedAt > r.uploadedAt) || (!!raw && r.doc.sections.some((s) => s.entries.some((e) => e.bullets.some((b) => b.text.trim() && !raw.includes(squash(b.text))))));
  const isWord = !!r.original?.mime.includes("wordprocessingml"), isPdf = r.original?.mime === "application/pdf";
  // A failed draw is kept per version on the page (unsaved changes included), so the next change tries their own file again.
  const version = (r.editedAt || r.uploadedAt) + JSON.stringify(doc);
  const [fail, setFail] = useState<{ v: string; why: string } | null>(null);
  const realFail = fail?.v === version ? fail.why : null;
  const setRealFail = (why: string) => setFail({ v: version, why });
  // Unsaved changes (Remy's fixes, by-hand edits) are drawn in their own file too, so the page never changes look.
  // Dilan, Nov 24: a student's resume is one page. When changes run it onto a second page, say by how many lines and
  // offer the weakest bullets to cut: real sentences only (not a certificate or course name), most flags first, then
  // the longest, which frees the most room.
  const [over, setOver] = useState<{ v: string; n: number } | null>(null);
  const overBy = over?.v === version ? over.n : 0;
  const weakest = overBy ? doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.text.trim().split(/\s+/).length >= 8)
    .map((b) => ({ b, n: issues(b.text, doc).length })).sort((a, b) => b.n - a.n || b.b.text.length - a.b.text.length).slice(0, 3).map((x) => x.b) : [];
  const cut = (id: string) => upd((d) => { for (const s of d.sections) for (const e of s.entries) e.bullets = e.bullets.filter((b) => b.id !== id); });
  const real = (on: Set<Cat>) => realFail ? null
    : isWord ? <OwnWordColoured doc={doc} version={version} on={on} onFail={setRealFail} />
    : isPdf ? <OwnPdfColoured doc={doc} changed={edited || dirty} on={on} onFail={setRealFail} onOver={(n) => setOver({ v: version, n })} />
    : null;
  // Said plainly whenever the page is Remy's drawing instead of their own file.
  const drawnWhy = !r.original ? ""
    : realFail === "missed" ? "A change here (like a new heading, a changed name, or more than fits on the page) can't go into your own file yet, so this is Remy's drawing of your resume in your font. Your original is under Original file."
    : realFail ? "Your file couldn't be drawn here, so this is Remy's drawing of it in your font."
    : "";
  const showOriginal = !edited && !!r.original;
  // Saves what's on screen, unsaved fixes included, so the save bar never lingers (skeptic review).
  const looksRight = () => run(() => api<Workspace>("PUT", "/api/resume/doc", { doc, confirm: true }).then(setWs), "Thanks, that's your base resume now");

  return (
    <div className="r1" data-testid="resume-one-page">
      <div className="r1-bar">
        <div className="row" style={{ gap: 8 }}><FileText size={17} /><b>{r.fileName}</b><span className="xs muted">{edited ? `Edited ${fmtDate(r.editedAt!)}` : `Added ${fmtDate(r.uploadedAt)}`}</span></div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => exportBasePdf(!!r.original?.mime.includes("wordprocessingml")).catch((e) => toast(e.message, true))} data-testid="button-export-base-pdf"><Download size={14} /> PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={() => download("/api/resume/export?format=docx", "Resume.docx").catch((e) => toast(e.message, true))} data-testid="button-export-base-docx">Word</button>
          <button className="btn btn-ghost btn-sm" onClick={onReplace} data-testid="button-replace-resume">Replace file</button>
          <button className="btn btn-ghost btn-sm" onClick={onEditByHand} data-testid="button-edit-by-hand">Edit by hand</button>
        </div>
      </div>

      <NameChoice />
      {!r.confirmedAt && (
        <div className="r1-confirm" data-testid="r1-confirm">
          <span className="small"><b>Does this look like your resume?</b> Remy builds every tailored version from it.</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={looksRight} data-testid="button-confirm-resume">Looks right</button>
            <button className="btn btn-ghost btn-sm" onClick={onEditByHand}>Fix something by hand</button>
          </div>
        </div>
      )}
      <p className="small muted r1-hint hide-phone">Want to change something? Just tell Remy in the chat, like "add Tableau to my skills" or "remove the coursework line". He shows you the change first.</p>
      <div className="r1-grid">
        <section className="r1-view">
          <div className="seg r1-tabs" role="group" aria-label="Show">
            <button aria-pressed={view === "resume"} onClick={() => setView("resume")} data-testid="r1-tab-resume">Your resume</button>
            <button aria-pressed={view === "file"} onClick={() => setView("file")} data-testid="r1-tab-file">{showOriginal ? "Original file" : "Your file"}</button>
          </div>
          {view === "resume" ? (
            // Make it stronger lives beside the resume now (Dilan, Nov 21: "can't we just integrate it with this?").
            <>{drawnWhy && <p className="xs muted" data-testid="r1-drawn-why">{drawnWhy}</p>}
            {overBy > 0 && (
              <div className="r1-over" role="status" data-testid="r1-over">
                <span className="small"><b>Your resume now runs {overBy} {overBy === 1 ? "line" : "lines"} onto a second page.</b> Recruiters expect one page from students, so cut about that much. The weakest lines to cut:</span>
                <ul className="r1-over-list">
                  {weakest.map((b) => (
                    <li key={b.id}>
                      <span className="xs">{b.text}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => cut(b.id)} data-testid={`button-cut-${b.id}`}>Cut</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ResumeMarkup doc={doc} look={r.style} real={real} upd={upd} onFix={() => document.getElementById("r1-stronger")?.scrollIntoView({ behavior: "smooth", block: "nearest" })} side={(walk: () => void) =>
              // Dilan, Nov 21: Make it stronger, the ATS check and approved versions & downloads as smaller cards beside the resume.
              <div className="r1-side-stack">
                <div className="r1-side-card" id="r1-stronger"><ResumeReview doc={doc} upd={upd} onEdit={onEditByHand} beside onWalk={walk} /></div>
                <div className="r1-side-card" data-testid="r1-side-ats">
                  <AtsXray doc={doc} quality={r.quality} upd={upd} />
                </div>
                <div className="r1-side-card" data-testid="r1-side-linkedin"><LinkedInFlags /></div>
                {approved && <div className="r1-side-card" data-testid="r1-approved">{approved}</div>}
              </div>
            } /></>
          ) : (
            <>
              <span className="xs muted">{showOriginal ? "Your original file, exactly as you uploaded it." : "Your current file with your changes, in your own layout when every change fits in it."}</span>
              {showOriginal ? (r.original!.mime === "application/pdf" ? <PdfPreview name={r.original!.name} /> : <WordPreview version={r.uploadedAt} />) : <CurrentPdf version={r.editedAt || r.uploadedAt} doc={r.doc} look={r.style} />}
            </>
          )}
        </section>

      </div>

      {dirty && (
        <div className="r1-save" role="status" data-testid="r1-save">
          <span className="small">You have changes that aren't saved yet.</span>
          <button className="btn btn-primary btn-sm" onClick={onSave} data-testid="button-save-resume">Save to my resume</button>
        </div>
      )}
    </div>
  );
}
