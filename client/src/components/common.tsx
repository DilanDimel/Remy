import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import type { Label } from "@shared/types";
import { useOwnerView } from "../lib/store";

export type RemyMood = "idle" | "wave" | "think" | "happy";

/** Remy, the fox coach (artwork from the Remy mockup). Split into parts so it can
 * bob, blink, twitch its ears, wave hello and tilt while thinking. */
export function Remy({ size = 56, mood = "idle", className = "" }: { size?: number; mood?: RemyMood; className?: string }) {
  if (useOwnerView()) return <ScholarRemy size={size} mood={mood} className={className} />;
  return (
    <svg className={`fox ${mood} ${className}`} width={size} height={Math.round(size * 84 / 72)} viewBox="0 0 72 84" role="img" aria-label="Remy the fox, your career coach">
      <g className="fox-body">
        <g className="fox-ear fox-ear-l">
          <path d="M13 31 L7 3 L33 15 Z" fill="#D94F1E" />
          <path d="M17.5 24.5 L13.8 10.5 L27.5 18 Z" fill="#3A2317" />
        </g>
        <g className="fox-ear fox-ear-r">
          <path d="M59 31 L65 3 L39 15 Z" fill="#D94F1E" />
          <path d="M54.5 24.5 L58.2 10.5 L44.5 18 Z" fill="#3A2317" />
        </g>
        <path d="M36 10 C51 10 62 22 62 38 C62 55 49 69 36 81 C23 69 10 55 10 38 C10 22 21 10 36 10 Z" fill="#E86A2A" />
        <path d="M36 81 C28 72 21.5 62.5 17.5 51.5 C24 57 29.5 59.5 36 59.5 C42.5 59.5 48 57 54.5 51.5 C50.5 62.5 44 72 36 81 Z" fill="#FFF7ED" />
        <path className="fox-eye" d="M19.5 38.5 Q24.5 35.5 29.5 38.5 Q24.5 41.5 19.5 38.5 Z" fill="#1A120B" />
        <path className="fox-eye" d="M42.5 38.5 Q47.5 35.5 52.5 38.5 Q47.5 41.5 42.5 38.5 Z" fill="#1A120B" />
        <path d="M31.3 66.8 Q36 63.8 40.7 66.8 Q39.8 72.8 36 73.8 Q32.2 72.8 31.3 66.8 Z" fill="#1A120B" />
      </g>
    </svg>
  );
}

// Owner view (Nov 22): the Scholar fox the team picked, in a business suit. Eyes and head follow the pointer;
// blinking, ear twitches and moods are CSS (.fox.scholar in index.css). One listener serves every fox on the page.
const scholars = new Set<SVGSVGElement>();
function lookAt(e: PointerEvent) {
  scholars.forEach((el) => {
    const r = el.getBoundingClientRect();
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    el.style.setProperty("--lx", clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)).toFixed(2));
    el.style.setProperty("--ly", clamp((e.clientY - (r.top + r.height * 0.45)) / (innerHeight / 2)).toFixed(2));
  });
}
const SCH_HEAD = "M100 52 C133 52 153 70 157 96 L171 119 C157 122 147 130 139 140 C128 152 114 158 100 158 C86 158 72 152 61 140 C53 130 43 122 29 119 L43 96 C47 70 67 52 100 52 Z";
const SCH_MASK = "M29 119 C43 122 53 130 61 140 C72 152 86 158 100 158 C114 158 128 152 139 140 C147 130 157 122 171 119 C162 107 148 103 134 107 C122 111 111 119 100 119 C89 119 78 111 66 107 C52 103 38 107 29 119 Z";
const MIRROR = "translate(200 0) scale(-1 1)";
function SchEar() {
  return <><path className="s-fur s-ol" d="M54 90 C46 66 43 42 49 25 C51 19 57 18 61 21 C75 33 87 45 97 60 Z" /><path className="s-ear-in" d="M60 76 C56 60 55 46 57 35 C66 43 74 51 82 61 Z" /></>;
}
function SchEye({ x }: { x: number }) {
  return (
    <g className="s-look">
      <ellipse className="s-pupil s-ink" cx={x} cy={103} rx={5.5} ry={7} />
      <circle className="s-pupil s-white" cx={x + 2} cy={100} r={1.8} />
      <path className="s-smiley s-stroke" d={`M${x - 6} 105 Q${x} 97 ${x + 6} 105`} />
    </g>
  );
}
function ScholarRemy({ size, mood, className }: { size: number; mood: RemyMood; className: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!scholars.size) addEventListener("pointermove", lookAt, { passive: true });
    scholars.add(el);
    return () => { scholars.delete(el); if (!scholars.size) removeEventListener("pointermove", lookAt); };
  }, []);
  const lapel = <path className="s-lapel s-ol" d="M84 157 L68 171 L80 177 L72 196 L100 177 Z" />;
  return (
    <svg ref={ref} className={`fox scholar ${mood} ${className}`} width={size} height={Math.round(size * 222 / 200)} viewBox="0 -8 200 222" role="img" aria-label="Remy the fox, your career coach">
      <g className="s-hop">
        <g className="s-breathe">
          <path className="s-shirt" d="M86 158 L114 158 L114 214 L86 214 Z" />
          <path className="s-shirt s-ol" d="M84 157 L100 177 L116 157 L108 152 L100 160 L92 152 Z" />
          <path className="s-tie s-ol" d="M95 165 L105 165 L107 173 L104 203 L100 208 L96 203 L93 173 Z" />
          <path className="s-suit s-ol" d="M30 214 C34 182 56 164 84 157 L100 177 L116 157 C144 164 166 182 170 214 Z" />
          {lapel}<g transform={MIRROR}>{lapel}</g>
          <path className="s-lapel s-ol s-thin" d="M128 190 L146 192 L145 198 L127 196 Z" /><path className="s-white" d="M134 190 L136 184 L139 185 L139 191 Z" />
        </g>
        <g className="s-head">
          <g className="s-bob">
            <g className="s-ear-l"><SchEar /></g>
            <g className="s-ear-r"><g transform={MIRROR}><SchEar /></g></g>
            <path className="s-fur s-ol" d={SCH_HEAD} />
            <path className="s-cream" d={SCH_MASK} />
            <path className="s-none s-ol" d={SCH_HEAD} />
            <ellipse className="s-cheek" cx={58} cy={126} rx={8} ry={4.5} /><ellipse className="s-cheek" cx={142} cy={126} rx={8} ry={4.5} />
            <SchEye x={75} /><SchEye x={125} />
            <g className="s-glasses">
              <circle className="s-lens" cx={75} cy={102} r={17} /><circle className="s-lens" cx={125} cy={102} r={17} />
              <path className="s-stroke" d="M92 100 Q100 95 108 100 M58 99 L46 95 M142 99 L154 95" />
            </g>
            <path className="s-ink" d="M91 124 Q100 119 109 124 Q107 132 100 134 Q93 132 91 124 Z" />
            <path className="s-mouth s-stroke" d="M92 142.5 Q100 143 108 142.5" />
          </g>
        </g>
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
