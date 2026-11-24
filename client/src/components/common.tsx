import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import type { Label } from "@shared/types";
import { unlockedOutfits } from "@shared/game";
import { pinColor, topPins } from "@shared/pins";
import { useStore } from "../lib/store";
import { scholarMarkup, startScholar } from "./scholar";

export type RemyMood = "idle" | "wave" | "think" | "happy";

/** Remy, the fox coach: the Scholar fox everywhere, signed in or not, so the old fox never flashes while the account loads. */
export function Remy({ size = 56, mood = "idle", className = "", outfit }: { size?: number; mood?: RemyMood; className?: string; outfit?: string }) {
  return <ScholarRemy size={size} mood={mood} className={className} outfit={outfit} />;
}

// Owner view (Nov 22): the Scholar fox the team picked, in his business suit. Drawing, outfits and the things he
// does on his own live in scholar.ts (shared with the mascot demo); moods arrive as classes.
function ScholarRemy({ size, mood, className, outfit: asked }: { size: number; mood: RemyMood; className: string; outfit?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const life = useRef<ReturnType<typeof startScholar>>();
  // He wears what the student picked from what they've earned (levels unlock outfits), and only changes into those.
  const ws = useStore()?.ws, g = ws?.game, owned = unlockedOutfits(g?.bestRank || 1, ws?.profile.classYear);
  const outfit = asked || (g?.outfit && owned.includes(g.outfit) ? g.outfit : "suit"), pool = owned.join();
  // His three best career pins on his chest, where he's big enough to see them (Rewards, Nov 24).
  const pins = useMemo(() => (ws && size >= 80 ? topPins(ws, 3).map(pinColor).join() : ""), [ws, size]);
  // Layout effect: the drawing goes in before the first paint, so a newly shown Remy never flashes an empty circle.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const pinList = pins ? pins.split(",") : [];
    ref.current.innerHTML = scholarMarkup(outfit, pinList);
    life.current = startScholar(ref.current, { outfit, outfits: pool.split(","), pins: pinList, auto: size >= 30 }); // tiny icons stay calm
    return () => life.current?.stop();
  }, [size, outfit, pool, pins]);
  useEffect(() => { if (mood === "wave") life.current?.play("wave", true); }, [mood]);
  return <svg ref={ref} className={`fox scholar ${mood} ${className}`} width={size} height={Math.round(size * 222 / 200)} viewBox="0 -8 200 222" role="img" aria-label="Remy the fox, your career coach" />;
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
  // Drawn on <body>: inside an animated page (a leftover transform) a fixed pop-up would sit far down the page.
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 860 } : undefined}>
        <div className="row-between">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" data-testid="button-close-modal"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

export function Busy({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <>{busy ? <Spinner /> : null}{children}</>;
}

/** A labelled sample of what a feature makes, shown in place of a paragraph before the student has their own (owners first, Nov 22, 2026). */
export function Example({ children, testid }: { children: ReactNode; testid?: string }) {
  return <div className="example" data-testid={testid}><span className="example-tag">Example</span>{children}</div>;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Remy size={44} />
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

/** Remy is still in development; shown beside the logo everywhere. */
export const BetaBadge = () => <span className="beta-badge" title="Remy is in development: features may change or be unfinished">Beta</span>;

/** Remy's replies: **bold** and "•"/"-" bullet lines, nothing else (no links or HTML from the AI). */
export function Rich({ text }: { text: string }) {
  const bold = (line: string) => line.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part.replace(/\*\*/g, "")));
  const blocks: JSX.Element[] = [];
  let items: string[] = [];
  const flush = () => { if (items.length) blocks.push(<ul key={blocks.length} className="bubble-list">{items.map((t, i) => <li key={i}>{bold(t)}</li>)}</ul>); items = []; };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:[•*-]|\d+[.)])\s+(.*)$/);
    if (m) { items.push(m[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{bold(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

/** Long AI work: names the stages Remy goes through, in order, so a wait doesn't look frozen. Stays on the last one. */
export function WorkingSteps({ steps, every = 4000 }: { steps: string[]; every?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), every); return () => clearInterval(t); }, [steps.length, every]);
  return (
    <div className="working-steps" role="status" aria-live="polite" data-testid="working-steps">
      {steps.map((s, k) => <span key={s} className={k < i ? "done" : k === i ? "now" : ""}>{k < i ? <Check size={12} /> : k === i ? <Spinner /> : <i />}{s}</span>)}
    </div>
  );
}

/** Copy with a visible "Copied" checkmark on the button itself (not only a toast far away). */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1600); }, () => setFailed(true));
  return (
    <button className={"btn btn-ghost btn-sm" + (done ? " copied" : "")} onClick={copy} aria-live="polite">
      {done ? <><Check size={14} style={{ color: "var(--success, #22a05a)" }} /> Copied</> : failed ? "Select and copy it" : <><Copy size={14} /> {label}</>}
    </button>
  );
}
