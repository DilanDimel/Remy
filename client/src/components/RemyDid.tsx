import { Check, ChevronRight, Undo2 } from "lucide-react";
import type { ChatAction, ChatMsg, Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { go } from "../lib/router";

/** What Remy did from one reply, each with Undo, plus the pages he offered to open. One small card of rows (orange tick,
 *  what changed, a quiet chevron when it opens a page, Undo), not underlined links (Dilan, Nov 26: "looks dodgy").
 *  Used by his side panel, Activity, the questions card and the My Path office, so a request looks the same everywhere. */
export function RemyDid({ m }: { m: ChatMsg }) {
  const { run, setWs } = useStore();
  if (!m.did?.length) return null;
  return (
    <div className="chat-did" data-testid="chat-did">
      {m.did.map((d) => (
        <div key={d.id} className={"did-row" + (d.undone ? " is-undone" : "")}>
          <span className="did-tick" aria-hidden>{d.undone ? <Undo2 size={12} /> : <Check size={12} strokeWidth={3} />}</span>
          {d.undone ? <span className="did-label"><s>{d.label}</s><span className="did-note">Undone</span></span>
            : d.link ? <button className="did-label did-open" onClick={() => go(d.link!)} data-testid="button-chat-did-open">{d.label}<ChevronRight size={14} className="did-chev" /></button>
            : <span className="did-label">{d.label}</span>}
          {!d.undone && !d.noUndo && <button className="did-undo" onClick={async () => { const w = await run(() => api<Workspace>("POST", `/api/chat/${m.id}/undo/${d.id}`), "Undone"); if (w) setWs(w); }} data-testid="button-chat-undo">Undo</button>}
        </div>
      ))}
    </div>
  );
}
/** The office has no room for every kind of button: pages Remy offered open from here; the rest wait in his panel. */
export function OfficeOpens({ actions }: { actions?: ChatAction[] }) {
  const opens = (actions || []).filter((a): a is Extract<ChatAction, { kind: "open" }> => a.kind === "open");
  if (!opens.length) return null;
  return <div className="row" style={{ gap: 6 }}>{opens.map((a) => <button key={a.link} className="btn btn-secondary btn-sm" onClick={() => go(a.link)} data-testid="button-office-open">{a.label}</button>)}</div>;
}
