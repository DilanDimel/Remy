import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Label } from "@shared/types";

export function Pip({ size = 56, mood = "idle", className = "" }: { size?: number; mood?: "idle" | "wave" | "think"; className?: string }) {
  // Original mascot: a small plum "spark" with a leaf-like tassel — friendly, simple, readable at 24px.
  return (
    <svg className={`pip ${mood} ${className}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Pip, the Offer Ready guide">
      <g className="pip-body">
        <path d="M32 6c3 0 5 2 5.5 4.6C46 12.6 54 20 54 31c0 12.7-9.8 22-22 22S10 43.7 10 31c0-11 8-18.4 16.5-20.4C27 8 29 6 32 6z" fill="#4d2b6c" />
        <path d="M33 4c4-3 10-2 12 1-4 0-7 1.5-9.5 4.5z" fill="#8bbf9f" />
        <ellipse cx="32" cy="35" rx="15" ry="12.5" fill="#f4eef8" />
        <ellipse className="pip-eye" cx="26.5" cy="33" rx="2.6" ry="3.2" fill="#292632" />
        <ellipse className="pip-eye" cx="37.5" cy="33" rx="2.6" ry="3.2" fill="#292632" />
        <path d="M28 39.5c2.4 2.2 5.6 2.2 8 0" stroke="#292632" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="22" cy="38.5" r="2" fill="#e9b8c8" opacity=".8" />
        <circle cx="42" cy="38.5" r="2" fill="#e9b8c8" opacity=".8" />
        <path className="pip-arm" d="M52 30c4-2 7-6 7-9" stroke="#4d2b6c" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

const LABEL_CLASS: Record<Label, string> = {
  Live: "chip-live",
  "Demo data": "chip-demo",
  "Needs setup": "chip-setup",
  "Needs verification": "chip-verify",
  "Student provided": "chip-student",
};
export function StatusChip({ label, children }: { label: Label; children?: ReactNode }) {
  return (
    <span className={`chip ${LABEL_CLASS[label]}`} data-testid={`label-${label.replace(/\s/g, "-").toLowerCase()}`}>
      <span className="dot" aria-hidden />
      {children ?? label}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 860 } : undefined}>
        <div className="row-between">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" data-testid="button-close-modal"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

export function Busy({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <>{busy ? <Spinner /> : null}{children}</>;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Pip size={44} />
      <h3 style={{ color: "var(--ink)" }}>{title}</h3>
      {body && <p className="small">{body}</p>}
      {action}
    </div>
  );
}

export function AiUnavailableNote() {
  return (
    <div className="notice notice-warn" role="note">
      <strong>AI needs setup.</strong>
      <div>This server has no AI model configured, so AI-written drafts are unavailable. Uploads, editing, checks and exports still work.</div>
    </div>
  );
}
