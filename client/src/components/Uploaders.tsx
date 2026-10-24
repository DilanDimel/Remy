import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { Spinner } from "./common";

export function ResumeUpload({ compact = false, onDone, onBusy }: { compact?: boolean; onDone?: () => void; onBusy?: (busy: boolean) => void }) {
  const { setWs, run, config } = useStore();
  const [busy, setBusy] = useState<"" | "file" | "text">("");
  useEffect(() => { onBusy?.(!!busy); }, [busy]);
  useEffect(() => () => onBusy?.(false), []); // the panel can close before busy resets
  const [drag, setDrag] = useState(false);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const sendFile = async (f?: File | null) => {
    if (!f) return;
    setBusy("file");
    const fd = new FormData();
    fd.append("file", f);
    const w = await run(() => api<Workspace>("POST", "/api/resume/upload", fd), "Resume read — please review it");
    if (w) { setWs(w); onDone?.(); }
    setBusy("");
  };
  const sendText = async () => {
    setBusy("text");
    const w = await run(() => api<Workspace>("POST", "/api/resume/text", { text }), "Resume read — please review it");
    if (w) { setWs(w); onDone?.(); setPaste(false); }
    setBusy("");
  };
  return (
    <div className="stack">
      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onClick={() => !busy && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); sendFile(e.dataTransfer.files?.[0]); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        data-testid="dropzone-resume"
        style={compact ? { padding: 18 } : undefined}
      >
        {busy === "file" ? <Spinner /> : <Upload size={22} style={{ color: "var(--plum)" }} />}
        <strong>{busy === "file" ? (config?.ai.available ? "Reading your resume with AI…" : "Reading your resume…") : "Upload your resume"}</strong>
        <span className="xs muted">PDF, Word (.docx) or .txt · up to 5 MB · text-based files work best</span>
        <input ref={input} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={(e) => sendFile(e.target.files?.[0])} data-testid="input-resume-file" />
      </div>
      <div className="row">
        <button className="btn btn-ghost btn-sm" onClick={() => setPaste((p) => !p)} disabled={!!busy} data-testid="button-paste-resume">Paste text instead</button>
      </div>
      {paste && (
        <div className="stack-sm">
          <textarea className="textarea" style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your full resume text…" aria-label="Resume text" data-testid="input-resume-text" />
          <div><button className="btn btn-primary btn-sm" disabled={text.length < 200 || !!busy} onClick={sendText} data-testid="button-submit-resume-text">{busy === "text" && <Spinner />} Read this resume</button></div>
        </div>
      )}
    </div>
  );
}

export function ProfileImport({ kind, hint, onDone, onBusy }: { kind: string; hint: string; onDone?: (added: number) => void; onBusy?: (busy: boolean) => void }) {
  const { setWs, run, config } = useStore();
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusy?.(busy); }, [busy]);
  useEffect(() => () => onBusy?.(false), []);
  const [text, setText] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const send = async (f?: File | null) => {
    setBusy(true);
    const fd = new FormData();
    fd.append("kind", kind);
    if (f) fd.append("file", f);
    else fd.append("text", text);
    const r = await run(() => api<{ workspace: Workspace; added: number }>("POST", "/api/import/profile", fd));
    if (r) {
      setWs(r.workspace);
      setText("");
      onDone?.(r.added);
    }
    setBusy(false);
  };
  return (
    <div className="stack-sm">
      <p className="xs muted">{hint}</p>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Paste text from your ${kind} profile…`} aria-label={`${kind} text`} style={{ minHeight: 80 }} data-testid={`input-import-${kind.toLowerCase().replace(/\W/g, "")}`} />
      <div className="row">
        <button className="btn btn-secondary btn-sm" disabled={busy || text.trim().length < 40 || !config?.ai.available} onClick={() => send()} data-testid={`button-import-${kind.toLowerCase().replace(/\W/g, "")}`}>{busy && <Spinner />} Extract facts</button>
        <button className="btn btn-ghost btn-sm" disabled={busy || !config?.ai.available} onClick={() => file.current?.click()}>Upload PDF</button>
        <input ref={file} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => send(e.target.files?.[0])} />
      </div>
    </div>
  );
}
