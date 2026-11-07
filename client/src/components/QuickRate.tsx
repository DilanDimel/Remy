import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "../lib/store";
import { count } from "../lib/signals";

const KEY = "remy.rated";
const rated = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const remember = (id: string) => { try { localStorage.setItem(KEY, JSON.stringify([...rated(), id].slice(-200))); } catch {} };

/** One-tap "Was this useful?" at the moment it matters (a tailored draft, a coach answer). 👍/👎 are counted for the
 *  owners' dashboard; a 👎 can add one line, which lands in the owners' feedback list. Asked once per item. */
export function QuickRate({ place, id, label = "Was this useful?" }: { place: string; id: string; label?: string }) {
  const [state, setState] = useState<"ask" | "why" | "done">(() => (rated().includes(id) ? "done" : "ask"));
  const [why, setWhy] = useState("");
  if (state === "done") return null;
  const vote = (up: boolean) => {
    count(`rate:${place}:${up ? "up" : "down"}`);
    remember(id);
    if (up) setState("done"); else setState("why");
  };
  const send = () => {
    if (why.trim().length >= 3) api("POST", "/api/feedback", { message: `👎 ${place}: ${why.trim()}`, page: location.pathname }).catch(() => {});
    setState("done");
  };
  if (state === "why") return (
    <form className="row xs" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); send(); }} data-testid={`quickrate-why-${place}`}>
      <input className="input" style={{ minWidth: 180, flex: 1, height: 30 }} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What was off? (optional)" maxLength={300} autoFocus aria-label="What was off?" />
      <button className="btn btn-ghost btn-sm">{why.trim() ? "Send" : "Skip"}</button>
    </form>
  );
  return (
    <span className="row xs muted" style={{ gap: 4 }} data-testid={`quickrate-${place}`}>
      {label}
      <button className="icon-btn" onClick={() => vote(true)} aria-label="Yes, useful" title="Useful"><ThumbsUp size={14} /></button>
      <button className="icon-btn" onClick={() => vote(false)} aria-label="Not useful" title="Not useful"><ThumbsDown size={14} /></button>
    </span>
  );
}
