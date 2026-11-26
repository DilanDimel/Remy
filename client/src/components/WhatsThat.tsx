import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { api, useStore } from "../lib/store";
import { Spinner } from "./common";

type Answer = { term: string; known: boolean; what: string; why: string };

/** "What's that?" under a term Remy put on the student's path (an exam, a tool, a skill): Remy explains it in two lines, in place. */
export function WhatsThat({ term, field }: { term: string; field?: string }) {
  const { config } = useStore();
  const [a, setA] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!config?.ai.available) return null;
  const ask = async () => {
    setBusy(true); setErr("");
    try { setA(await api<Answer>("POST", "/api/terms/explain", { term, field })); } catch (e: any) { setErr(e.message || "Remy couldn't explain that just now."); }
    setBusy(false);
  };
  if (a) return (
    <div className="dp-sect" data-testid="whats-that-answer"><span><HelpCircle size={14} /> What it is</span>
      {a.known ? <><p>{a.what}</p>{a.why && <p className="small muted">{a.why}</p>}</> : <p className="small muted">Remy isn't sure what this one means. Your advisor or career center will know.</p>}
    </div>
  );
  return (
    <div className="row" style={{ gap: 8 }}>
      <button className="btn btn-ghost btn-sm" onClick={ask} disabled={busy} data-testid="button-whats-that">{busy ? <Spinner /> : <HelpCircle size={14} />} What's that?</button>
      {err && <span className="xs" style={{ color: "var(--fox-deep)" }}>{err}</span>}
    </div>
  );
}
