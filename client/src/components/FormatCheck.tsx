// Format check (owners first, Nov 25, 2026). Dilan: a resume with a photo or four pages got no word from Remy. Remy
// now says plainly what hurts the file's format for the student's level and offers three clean formats with the same words.
import { useEffect, useState } from "react";
import type { FormatFinding, ResumeLayout, ResumeLook, Workspace } from "@shared/types";
import { API_BASE, api, useStore } from "../lib/store";

type Format = { findings: FormatFinding[]; layout: ResumeLayout | null; look: ResumeLook | null; student: boolean };
export const LOOKS: { id: ResumeLook; name: string; why: string }[] = [
  { id: "classic", name: "Classic", why: "Serif, centred name, ruled headings. What most career centers hand out." },
  { id: "modern", name: "Modern", why: "Clean sans, name on the left, quiet spaced headings." },
  { id: "compact", name: "Compact", why: "Smaller margins for a full page of experience, still one column." },
];

function useFormat() {
  const { ws } = useStore();
  const [f, setF] = useState<Format | null>(null);
  const key = `${ws?.resume?.uploadedAt}|${ws?.resume?.editedAt}|${ws?.resume?.style?.look}|${ws?.profile.classYear}`;
  useEffect(() => { api<Format>("GET", "/api/resume/format").then(setF).catch(() => setF(null)); }, [key]);
  return f;
}

/** Above the resume, when the format really hurts: the problems in one line and the way out, no scrolling needed. */
export function FormatStrip({ onFormats }: { onFormats: () => void }) {
  const f = useFormat();
  const { ws } = useStore();
  const worst = f?.findings.filter((x) => x.level !== "tip") || [];
  if (!f || !worst.length || ws?.resume?.style?.look) return null;
  return (
    <div className="fmt-strip" role="status" data-testid="format-strip">
      <span className="small"><b>Remy noticed the format is hurting you:</b> {worst.map((x) => x.title.replace(/\.$/, "")).join(" · ")}.</span>
      <button className="btn btn-primary btn-sm" onClick={onFormats} data-testid="button-strip-formats">See 3 clean formats</button>
    </div>
  );
}

/** Beside the resume: what hurts the format, worst first, and the way to three clean formats. */
export function FormatCard({ onFormats }: { onFormats: () => void }) {
  const f = useFormat();
  if (!f) return null;
  const worst = f.findings.filter((x) => x.level !== "tip");
  const name = LOOKS.find((l) => l.id === f.look)?.name;
  return (
    <div className="r1-side-card fmt-card" data-testid="format-card">
      <h3>{name ? `Using the ${name} format` : worst.length ? "Your format is costing you" : f.findings.length ? "Format: one idea" : "Format looks right"}</h3>
      {!f.findings.length && !name && <p className="xs muted">{f.layout ? `${f.layout.pages} page${f.layout.pages > 1 ? "s" : ""}, no photo, readable text.` : "Nothing in the format holds it back."}</p>}
      <ul className="fmt-list">
        {f.findings.map((x) => (
          <li key={x.id} className={`fmt-${x.level}`} data-testid={`format-${x.id}`}>
            <b className="small">{x.title}</b>
            <span className="xs muted">{x.detail}</span>
          </li>
        ))}
      </ul>
      <button className={worst.length && !name ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={onFormats} data-testid="button-see-formats">{name ? "Change format" : "See 3 clean formats"}</button>
    </div>
  );
}

/** Page 1 of a format's PDF drawn as a picture (unpdf, as the resume itself is), so every browser and phone sees it. */
function PdfThumb({ src, title }: { src: string; title: string }) {
  const [img, setImg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ getDocumentProxy }, r] = await Promise.all([import("unpdf"), fetch(src, { credentials: "include" })]);
        if (!r.ok) throw new Error(String(r.status));
        const page = await (await getDocumentProxy(new Uint8Array(await r.arrayBuffer()))).getPage(1);
        const vp = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas } as any).promise;
        if (live) setImg(canvas.toDataURL("image/png"));
      } catch { if (live) setFailed(true); }
    })();
    return () => { live = false; };
  }, [src]);
  if (failed) return <a className="btn btn-ghost btn-sm" href={src} target="_blank" rel="noreferrer">Open the {title} PDF</a>;
  return img ? <a href={src} target="_blank" rel="noreferrer" title={`Open the ${title} PDF`}><img className="fmt-preview" src={img} alt={`Your resume in the ${title} format`} /></a> : <div className="fmt-preview fmt-loading" aria-label="Drawing the preview" />;
}

/** In place of the resume: the same words in three formats, side by side on a laptop, one under another on a phone. */
export function FormatPicker({ onClose }: { onClose: () => void }) {
  const { ws, setWs, run } = useStore();
  const look = ws?.resume?.style?.look;
  const v = encodeURIComponent(`${ws?.resume?.editedAt || ws?.resume?.uploadedAt}`);
  const pick = (l: ResumeLook | null) => run(() => api<Workspace>("POST", "/api/resume/format", { look: l }).then((w) => { setWs(w); onClose(); }), l ? "Format changed. Your words stay the same." : "Back to your own file");
  return (
    <div className="stack fmt-picker" data-testid="format-picker">
      <div className="row-between">
        <div><h3>Pick a format</h3><p className="xs muted">Same words, nothing added. Personal details like a birthday are left out. One column, so job sites read it in order.</p></div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} data-testid="button-close-formats">Back to my resume</button>
      </div>
      <div className="fmt-grid">
        {LOOKS.map((l) => {
          const src = `${API_BASE}/api/resume/format/preview?look=${l.id}&v=${v}`;
          return (
            <div key={l.id} className="fmt-option" aria-current={look === l.id} data-testid={`format-option-${l.id}`}>
              <div className="row-between fmt-option-head">
                <b>{l.name}</b>
                <button className="btn btn-primary btn-sm" disabled={look === l.id} onClick={() => pick(l.id)} data-testid={`button-use-${l.id}`}>{look === l.id ? "Using this" : "Use this format"}</button>
              </div>
              <span className="xs muted">{l.why}</span>
              <PdfThumb src={src} title={l.name} />
            </div>
          );
        })}
      </div>
      {look && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => pick(null)} data-testid="button-own-format">Keep my own file instead</button>}
    </div>
  );
}
