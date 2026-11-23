import { Check } from "lucide-react";
import type { ChatAction, ChatMsg, Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { go } from "../lib/router";

/** What Remy did from one reply (owners), each with Undo, plus the pages he offered to open. Used by his side panel
 *  and the My Path office, so a request works the same in both places. */
export function RemyDid({ m, card = false }: { m: ChatMsg; card?: boolean }) {
  const { run, setWs } = useStore();
  if (!m.did?.length) return null;
  return (
    <div className={card ? "card" : "chat-did"} style={card ? { maxWidth: "92%", padding: "6px 10px" } : undefined} data-testid="chat-did">
      {m.did.map((d) => (
        <div key={d.id} className="small" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <Check size={14} style={{ flexShrink: 0, opacity: d.undone ? 0.4 : 1 }} />
          {d.undone ? <span className="muted" style={{ flex: 1 }}><s>{d.label}</s> · undone</span> : <>
            <span style={{ flex: 1 }}>{d.link ? <a href={d.link} onClick={(e) => { e.preventDefault(); go(d.link!); }} style={{ textDecoration: "underline" }}>{d.label}</a> : d.label}</span>
            {!d.noUndo && <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={async () => { const w = await run(() => api<Workspace>("POST", `/api/chat/${m.id}/undo/${d.id}`), "Undone"); if (w) setWs(w); }} data-testid="button-chat-undo">Undo</button>}
          </>}
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
