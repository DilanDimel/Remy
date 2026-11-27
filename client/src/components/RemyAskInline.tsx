import { useState } from "react";
import { ArrowUp } from "lucide-react";
import type { Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { openRemy } from "../lib/tailorChat";
import { Remy, Rich, Spinner } from "./common";

/** Remy built into a page whose side panel stays closed (Interview, Dilan Nov 27): ask here, he answers here,
 *  and the same talk carries on in his chat. Same chat call as My Path's office (PathBoard.tsx). */
export function RemyAskInline({ page, placeholder, starters }: { page: string; placeholder: string; starters: string[] }) {
  const { config, setWs, run } = useStore();
  const [q, setQ] = useState(""), [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ q: string; a?: string } | null>(null);
  if (!config?.ai.available) return null;
  const ask = async (t0?: string) => {
    const text = (t0 ?? q).trim();
    if (!text || busy) return;
    setQ(""); setSaid({ q: text }); setBusy(true);
    const w = await run(() => api<Workspace>("POST", "/api/ai/chat?stream=1", { message: text, page, where: location.pathname + location.search, tabs: [] }, (l) => { if (typeof l.reply === "string") setSaid({ q: text, a: l.reply }); }));
    setBusy(false);
    if (w) { setWs(w); const m = [...w.chat].reverse().find((x) => x.role === "assistant"); setSaid({ q: text, a: m?.text }); }
    else setSaid(null);
  };
  return (
    <div className="ask-inline" data-testid="remy-ask-inline">
      <span className="ask-inline-face" aria-hidden><Remy size={30} mood={busy ? "think" : "idle"} /></span>
      <div className="ask-inline-body">
        {said ? (
          <div className="ask-inline-said" aria-live="polite">
            <p className="ask-inline-q">{said.q}</p>
            {said.a ? <div className="ask-inline-a"><Rich text={said.a} /></div> : <span className="ask-inline-wait" role="status"><Spinner /> Thinking…</span>}
            {!busy && said.a && <button type="button" className="link-btn ask-inline-more" onClick={openRemy} data-testid="button-ask-inline-chat">Keep talking in chat</button>}
          </div>
        ) : (
          <div className="asst-chips">{starters.map((s) => <button key={s} type="button" className="asst-chip" onClick={() => ask(s)} data-testid="button-ask-inline-chip">{s}</button>)}</div>
        )}
        <form className="ask-inline-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} disabled={busy} data-testid="input-ask-inline" />
          <button type="submit" className="icon-btn" disabled={busy || !q.trim()} aria-label="Send to Remy" data-testid="button-ask-inline-send"><ArrowUp size={17} /></button>
        </form>
      </div>
    </div>
  );
}
