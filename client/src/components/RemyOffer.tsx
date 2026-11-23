import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Workspace } from "@shared/types";
import { offerFor, remyOffers } from "@shared/remyOffers";
import { dayKey } from "@shared/daily";
import { api, useStore } from "../lib/store";
import { useRoute } from "../lib/router";
import { Remy, Spinner } from "./common";

// Where the offer goes: inside Remy's open panel (OfferSlot sits above his chat box), otherwise as a strip above the
// page. It never floats over the page (Dilan, Nov 23: it covered the season banner and the resume list).
let slotEl: HTMLElement | null = null;
const subs = new Set<() => void>();
const setSlot = (el: HTMLElement | null) => { slotEl = el; subs.forEach((f) => f()); };
export function OfferSlot() {
  return <div className="asst-offer-slot" ref={setSlot} />;
}
function useSlot() {
  const [el, setEl] = useState(slotEl);
  useEffect(() => { const f = () => setEl(slotEl); subs.add(f); f(); return () => { subs.delete(f); }; }, []);
  return el;
}

/** Owners: Remy reaches out on the page you're on with one thing he can do for you (shared/remyOffers.ts). */
export function RemyOffer() {
  const { ws, setWs, run, save } = useStore();
  const { path } = useRoute();
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<string[]>([]); // hidden at once, before the save returns
  const slot = useSlot();
  const o = offerFor(remyOffers(ws!, dayKey()).filter((x) => !gone.includes(x.id)), path);
  if (!o) return null;
  const doIt = async () => {
    setBusy(true);
    const w = await run(() => api<Workspace>("POST", "/api/remy/act", { action: o.action, offerId: o.id }));
    setBusy(false);
    if (w) { setGone((g) => [...g, o.id]); setWs(w); }
  };
  const notNow = () => { setGone((g) => [...g, o.id]); void save("settings", { offersSeen: [...(ws!.settings.offersSeen || []), o.id].slice(-200) }); };
  const card = (
    <div className={"remy-offer fade-up" + (slot ? " docked" : "")} role="status" data-testid="remy-offer">
      <Remy size={34} mood="wave" />
      <div className="stack-sm" style={{ gap: 8, minWidth: 0 }}>
        <span className="small">{o.text}</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={doIt} disabled={busy} data-testid="button-offer-do">{busy ? <Spinner /> : null}{o.label}</button>
          <button className="btn btn-ghost btn-sm" onClick={notNow} disabled={busy} data-testid="button-offer-not-now">Not now</button>
        </div>
      </div>
      <button className="remy-offer-x" onClick={notNow} aria-label="Dismiss" data-testid="button-offer-dismiss"><X size={14} /></button>
    </div>
  );
  return slot ? createPortal(card, slot) : card;
}
