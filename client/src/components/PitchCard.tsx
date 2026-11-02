import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { Spinner } from "./common";
import { PracticeOutLoud } from "./PracticeOutLoud";

/** 30-second elevator pitch: Remy drafts it from the student's own record; they edit it and practice out loud. */
export function PitchCard() {
  const { ws, setWs, save, run, config } = useStore();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(ws!.pitch?.text || "");
  useEffect(() => { setText(ws!.pitch?.text || ""); }, [ws!.pitch?.at]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const make = async () => { setBusy(true); const r = await run(() => api<Workspace>("POST", "/api/ai/pitch"), "Pitch ready"); if (r) setWs(r); setBusy(false); };
  return (
    <section className="card card-pad stack-sm" data-testid="pitch-card">
      <div className="row-between"><h3>Your 30-second pitch</h3>
        <button className="btn btn-secondary btn-sm" disabled={busy || !config?.ai.available} onClick={make} data-testid="button-make-pitch">{busy ? <Spinner /> : <Sparkles size={14} />} {ws!.pitch ? "Write it again" : "Draft my pitch"}</button></div>
      <p className="xs muted">For career fairs and networking: who you are, what you do, one experience, what you want next. Remy uses only facts from your resume and profile; make it sound like you.</p>
      {(ws!.pitch || text) && <>
        <textarea className="textarea" style={{ minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={1200} aria-label="Your pitch" data-testid="input-pitch" />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className={"xs " + (words > 90 ? "" : "muted")} style={words > 90 ? { color: "var(--amber)" } : undefined}>{words} words · about {Math.round(words / 2.5)} seconds spoken{words > 90 ? ", a bit long" : ""}</span>
          <button className="btn btn-ghost btn-sm" disabled={text === (ws!.pitch?.text || "")} onClick={() => save("pitch", { text, at: new Date().toISOString() }).catch(() => {})}>Save</button>
        </div>
        <PracticeOutLoud goal={[25, 35]} />
      </>}
    </section>
  );
}
