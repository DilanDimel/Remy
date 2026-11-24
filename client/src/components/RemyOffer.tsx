import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Workspace } from "@shared/types";
import { offerFor, remyOffers } from "@shared/remyOffers";
import { dayKey } from "@shared/daily";
import { api, useStore } from "../lib/store";
import { useRoute } from "../lib/router";
import { Remy, Spinner } from "./common";
import { NextAsk, useAsks } from "./RemyAsk";

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
  const asks = useAsks();
  const [answeredOn, setAnsweredOn] = useState(""); // after an answer, its "done" card stays instead of an offer
  // Owners: Remy's open questions come first, one at a time (My Path asks in the office, AI memory lists them all).
  const askHere = path !== "/path" && path !== "/accounts";
  const ask = askHere && <NextAsk wrap={(c) => {
    const box = <div className={"remy-offer remy-ask-card fade-up" + (slot ? " docked" : "")} role="status" data-testid="remy-ask-card"><span className="remy-offer-face"><Remy size={40} mood="wave" /></span>{c}</div>;
    return slot ? createPortal(box, slot) : box;
  }} onAnswered={() => setAnsweredOn(path)} />;
  const o = askHere && (asks.length || answeredOn === path) ? undefined : offerFor(remyOffers(ws!, dayKey(), new Date().getHours()).filter((x) => !gone.includes(x.id)), path);
  if (!o) return ask || null;
  const doIt = async () => {
    setBusy(true);
    const w = await run(() => api<Workspace>("POST", "/api/remy/act", { action: o.action, offerId: o.id }));
    setBusy(false);
    if (w) { setGone((g) => [...g, o.id]); setWs(w); }
  };
  const notNow = () => { setGone((g) => [...g, o.id]); void save("settings", { offersSeen: [...(ws!.settings.offersSeen || []), o.id].slice(-200) }); };
  const card = (
    <div className={"remy-offer fade-up" + (slot ? " docked" : "")} role="status" data-testid="remy-offer">
      {/* Remy reaching out first is the point of this card (Dilan, Nov 23): his face, a live dot and a kicker say so */}
      <span className="remy-offer-face"><Remy size={40} mood="wave" /></span>
      <div className="stack-sm" style={{ gap: 8, minWidth: 0 }}>
        <span className="remy-offer-text"><span className="remy-offer-kicker"><i aria-hidden="true" />Remy noticed something</span>{o.text}</span>
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
