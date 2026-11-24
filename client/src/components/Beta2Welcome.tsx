// Beta 2 (Nov 24): the first time a student opens Remy after owners release the redesign (shared/features.ts),
// Remy says what changed, once, and offers the new tour. Owners never see it; new students get setup and the tour instead.
import { Modal, Remy } from "./common";
import { tourAgain } from "./Tour";
import { useOwnersOnly, useOwnerView, useStore } from "../lib/store";

const NEW = [
  ["A new look, and a new Remy", "Every page is cleaner, and Remy has a fresh look to match."],
  ["Remy does things for you", "Ask him in chat to save an opening, add a to-do or fix a resume line. You approve every change, and anything can be undone."],
  ["My Path is Remy's office", "Your plan, your streak and your level in one place. Every step you take earns XP."],
  ["Openings that really fit", "Remy checks each opening against your major, year and resume, and tells you why it fits."],
] as const;

export function Beta2Welcome() {
  const { ws, save } = useStore();
  const released = useOwnerView(), owner = useOwnersOnly();
  if (!released || owner || !ws?.onboarding.done || ws.settings.beta2Seen) return null;
  const close = () => save("settings", { beta2Seen: true }).catch(() => {});
  return (
    <Modal title="Welcome to Beta 2" onClose={close}>
      <div className="b2-welcome" data-testid="beta2-welcome">
        <Remy size={64} mood="happy" />
        <p className="b2-lead">Remy just got his biggest update yet. Here's what's new:</p>
        <ul className="b2-list">
          {NEW.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}
        </ul>
        <div className="row b2-actions">
          <button className="btn btn-primary" onClick={() => { close(); tourAgain(save); }} data-testid="button-beta2-tour">Show me around</button>
          <button className="btn btn-ghost" onClick={close} data-testid="button-beta2-close">Got it</button>
        </div>
      </div>
    </Modal>
  );
}
