// Owners (Nov 23): the moment a career pin (or a higher tier) is earned, anywhere in Remy, he says so once. The first
// time this runs it only records the pins the student already has, so nobody gets a pile of pop-ups for old steps.
import { useEffect, useState } from "react";
import { TIER_NAME, newPins, pinsSeen, type PinState } from "@shared/pins";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { Modal, Remy } from "./common";
import { PinArt } from "../pages/Rewards";

export function PinMoment() {
  const { ws, save } = useStore();
  const [shown, setShown] = useState<PinState[]>([]);
  const fresh = ws ? newPins(ws) : [];
  const first = !!ws && !ws.game?.pins;
  const sig = fresh.map((p) => p.id + p.tier).join(",") + (first ? "+first" : "");
  useEffect(() => {
    if (!ws || (!fresh.length && !first)) return;
    save("game", { ...(ws.game || { weeks: {} }), pins: { ...(ws.game?.pins || {}), ...pinsSeen(ws) } }).catch(() => {});
    if (!first) setShown(fresh);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown.length) return null;
  const p = shown[0], more = shown.length - 1, close = () => setShown([]);
  const tier = p.tiers.length > 1 ? ` (${TIER_NAME[p.tier - 1].toLowerCase()})` : "";
  return (
    <Modal title={`New pin: ${p.name}${tier}`} onClose={close}>
      <div className="rw-detail" data-testid="pin-moment">
        <div className="rw-moment"><Remy size={96} mood="happy" /><PinArt p={p} size={72} /></div>
        <p><b>Earned for:</b> {p.how.charAt(0).toLowerCase() + p.how.slice(1)}. {p.xp[p.tier - 1] ? `That's +${p.xp[p.tier - 1]} XP.` : ""}{more > 0 ? ` And ${more} more new pin${more === 1 ? "" : "s"}.` : ""}</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => { close(); go("/rewards"); }} data-testid="button-pin-moment-rewards">See all rewards</button>
          <button className="btn btn-ghost" onClick={close} data-testid="button-pin-moment-close">Nice</button>
        </div>
      </div>
    </Modal>
  );
}
