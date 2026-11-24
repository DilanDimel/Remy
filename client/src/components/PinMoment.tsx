// Owners (Nov 23): the moment a career pin (or a higher tier) is earned, anywhere in Remy, he says so once. The first
// time this runs it only records the pins the student already has, so nobody gets a pile of pop-ups for old steps.
import { useEffect, useState } from "react";
import { TIER_NAME, newPins, pinsSeen, type PinState } from "@shared/pins";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { Modal, Remy } from "./common";
import { PinArt } from "../pages/Rewards";
import type { Workspace } from "@shared/types";

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
  // A first interview or first offer is the big one: its own celebration, ahead of any other new pins.
  const big = shown.find((x) => x.id === "offer") || shown.find((x) => x.id === "interview");
  if (big && ws) return <BigMoment kind={big.id as "offer" | "interview"} company={companyFor(ws, big.id === "offer" ? "Offer" : "Interview")} onClose={() => setShown([])} />;
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

/** The company of the student's first interview (or offer), from Progress: the earliest such event, or the row's status. */
function companyFor(w: Workspace, status: "Interview" | "Offer") {
  const ok = (st: string) => st === status || (status === "Interview" && st === "Offer");
  const first = (t: Workspace["tracker"][number]) => t.events.filter((e) => ok(e.status)).map((e) => e.at).sort()[0] || (ok(t.status) ? "~" : "");
  return w.tracker.filter(first).sort((a, b) => first(a).localeCompare(first(b)))[0]?.company || "";
}

/** Owners (Rewards, Nov 24): a first interview or a first offer gets Remy in his graduation gown, confetti and the
 *  one next step that matters, instead of the small pin card. */
function BigMoment({ kind, company, onClose }: { kind: "offer" | "interview"; company: string; onClose: () => void }) {
  const offer = kind === "offer", at = company ? ` ${offer ? "from" : "at"} ${company}` : "";
  return (
    <Modal title={offer ? `Your first offer${at}!` : `Your first interview${at}!`} onClose={onClose}>
      <div className="rw-big-moment" data-testid={`big-moment-${kind}`}>
        <div className="rw-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 20}deg`, ["--d" as string]: `${(i % 3) * 0.12}s` }} />)}</div>
        <Remy size={150} mood="happy" outfit="gown" />
        <p>{offer ? <>You did this. Every resume line, every application and every interview led here. Take a breath, then ask me anything about the offer before you answer them.</>
          : <>That's what all the work was for. You earned the <b>First interview</b> pin. Want to practise the questions they'll likely ask?</>}</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => { onClose(); go(offer ? "/progress" : "/interview"); }} data-testid={`button-big-moment-${kind}`}>{offer ? "Look at the offer" : "Practise with Remy"}</button>
          <button className="btn btn-ghost" onClick={() => { onClose(); go("/rewards"); }} data-testid="button-big-moment-rewards">See my pins</button>
        </div>
      </div>
    </Modal>
  );
}
