// The big update (Nov 24): the first time a student opens Remy after owners release the redesign (shared/features.ts),
// Remy says what changed, once, and offers the new tour. Owners never see it; new students get setup and the tour instead.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Compass, FileCheck2, Sparkles, Target, X, type LucideIcon } from "lucide-react";
import { Remy } from "./common";
import { tourAgain } from "./Tour";
import { useOwnersOnly, useOwnerView, useStore } from "../lib/store";

/** The update's name, shown to students. One place, so a rename is one line. */
export const UPDATE_NAME = "The Big Upgrade";

const NEW: [LucideIcon, string, string][] = [
  [Sparkles, "A fresh look", "Every page is cleaner, and Remy has a new look to match."],
  [FileCheck2, "Remy does it for you", "Ask him to save an opening, add a to-do or fix a resume line. You approve every change."],
  [Compass, "My Path is his office", "Your plan, streak and level in one place. Every step earns XP."],
  [Target, "Openings that fit", "Each opening is checked against your major, year and resume, with the reason why."],
];

export function Beta2Welcome() {
  const { ws, save } = useStore();
  const released = useOwnerView(), owner = useOwnersOnly();
  const show = released && !owner && !!ws?.onboarding.done && !ws.settings.beta2Seen;
  const close = () => save("settings", { beta2Seen: true }).catch(() => {});
  useEffect(() => {
    if (!show) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!show) return null;
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal b2" role="dialog" aria-modal="true" aria-labelledby="b2-title" data-testid="beta2-welcome">
        <button className="icon-btn b2-x" onClick={close} aria-label="Close" data-testid="button-beta2-x"><X size={18} /></button>
        <header className="b2-head">
          <div className="asst-avatar b2-face"><Remy size={58} mood="happy" /></div>
          <div>
            <span className="b2-kicker">New update · {UPDATE_NAME}</span>
            <h2 id="b2-title">Remy just got his biggest update yet</h2>
          </div>
        </header>
        <ul className="b2-grid">
          {NEW.map(([Icon, t, d]) => (
            <li key={t}><span className="b2-ic"><Icon size={18} aria-hidden="true" /></span><b>{t}</b><span>{d}</span></li>
          ))}
        </ul>
        <div className="b2-actions">
          <button className="btn btn-ghost" onClick={close} data-testid="button-beta2-close">Maybe later</button>
          <button className="btn btn-primary" onClick={() => { close(); tourAgain(save); }} data-testid="button-beta2-tour">Show me around</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
