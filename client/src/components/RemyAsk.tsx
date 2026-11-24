import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Workspace } from "@shared/types";
import { type Ask, remyAsks } from "@shared/remyAsks";
import { dayKey } from "@shared/daily";
import { api, useStore } from "../lib/store";
import { RemyDid } from "./RemyDid";
import { Spinner } from "./common";

// Owners (Nov 24, shared/remyAsks.ts): Remy's quick questions about the account. One shows at a time where the student
// already is: his office bubble on My Path, the card above the page or in his chat elsewhere, and all of them in AI
// memory. Tapping an answer has Remy do the fix himself (POST /api/remy/ask), with Undo.

/** Open questions for the signed-in student. */
export function useAsks(all = false): Ask[] {
  const { ws } = useStore();
  return ws ? remyAsks(ws, dayKey(), all) : [];
}

type Done = { id: string; text: string; copy?: string; messageId: string };

/** One question with its answers; after a tap, what Remy did, Undo and the next question. */
export function AskCard({ ask, next = 0, kicker = true, onAnswered, onNext }: { ask: Ask; next?: number; kicker?: boolean; onAnswered?: () => void; onNext?: () => void }) {
  const { ws, setWs, run } = useStore();
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [no, setNo] = useState<string[]>([]); // facts the student said aren't true
  const [copied, setCopied] = useState(false);
  const answer = async (answerKey: string) => {
    setBusy(answerKey);
    const r = await run(() => api<{ ws: Workspace; text: string; copy?: string; messageId: string }>("POST", "/api/remy/ask", { id: ask.id, answer: answerKey, keep: (ask.items || []).map((i) => i.id).filter((id) => !no.includes(id)) }));
    setBusy("");
    if (!r) return;
    if (answerKey !== "later") { setDone({ id: ask.id, text: r.text, copy: r.copy, messageId: r.messageId }); onAnswered?.(); }
    setWs(r.ws);
  };
  if (done) {
    const m = ws!.chat.find((x) => x.id === done.messageId);
    return (
      <div className="ask" data-testid="remy-ask-done">
        {kicker && <span className="ask-kick">Remy · done</span>}
        <p>{done.text}</p>
        {done.copy && <div className="ask-quote"><b>{done.copy}</b><button className="btn btn-secondary btn-sm" onClick={() => { void navigator.clipboard?.writeText(done.copy!); setCopied(true); }} data-testid="button-ask-copy">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button></div>}
        <div className="ask-foot">{m && <RemyDid m={m} />}{next > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setDone(null); onNext?.(); }} data-testid="button-ask-next">Next question · {next} more</button>}</div>
      </div>
    );
  }
  return (
    <div className="ask" data-testid="remy-ask">
      {kicker && <span className="ask-kick">Remy · quick question</span>}
      <p>{ask.text}</p>
      {ask.vs && <div className="ask-vs">{ask.vs.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>}
      {ask.items && <div className="ask-list">{ask.items.map((it) => (
        <div key={it.id} className="ask-item"><span>{it.text}</span>
          <span className="ask-tg" role="group" aria-label={`Is this true: ${it.text}`}>
            <button aria-pressed={!no.includes(it.id)} onClick={() => setNo(no.filter((x) => x !== it.id))} data-testid="button-ask-yes">Yes</button>
            <button aria-pressed={no.includes(it.id)} onClick={() => setNo([...no, it.id])} data-testid="button-ask-no">No</button>
          </span></div>))}</div>}
      <div className="ask-opts">
        {ask.items ? <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => answer("facts")} data-testid="button-ask-save">{busy === "facts" && <Spinner />}Save these</button>
          : ask.options.map((o) => <button key={o.key} className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => answer(o.key)} data-testid={`button-ask-${o.key}`}>{busy === o.key && <Spinner />}{o.label}</button>)}
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => answer("later")} data-testid="button-ask-later">Not now</button>
      </div>
    </div>
  );
}

/** The next question. An answered one stays on screen (what Remy did, Undo) until "Next question". */
export function NextAsk({ kicker = true, wrap = (n) => n, onAnswered }: { kicker?: boolean; wrap?: (card: JSX.Element) => JSX.Element; onAnswered?: () => void }) {
  const asks = useAsks();
  const [cur, setCur] = useState<Ask | null>(null);
  const ask = cur || asks[0];
  if (!ask) return null;
  return wrap(<AskCard key={ask.id} ask={ask} next={asks.filter((a) => a.id !== ask.id).length} kicker={kicker} onAnswered={() => { setCur(ask); onAnswered?.(); }} onNext={() => setCur(null)} />);
}
