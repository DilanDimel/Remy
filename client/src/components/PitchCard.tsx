import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Workspace } from "@shared/types";
import { fieldExample } from "@shared/fields";
import { api, useOwnerView, useStore } from "../lib/store";
import { Example, Spinner } from "./common";
import { PracticeOutLoud } from "./PracticeOutLoud";

/** 30-second elevator pitch: Remy drafts it from the student's own record; they edit it and practice out loud. */
export function PitchCard() {
  const { ws, setWs, save, run, config } = useStore();
  const owner = useOwnerView();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(ws!.pitch?.text || "");
  useEffect(() => { setText(ws!.pitch?.text || ""); }, [ws!.pitch?.at]);
  // The example follows the student's own major and year (a nursing student never sees a finance pitch).
  const ex = fieldExample(ws!.profile.major || ws!.profile.targetRoles);
  const year = (ws!.profile.classYear || "").toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const make = async () => { setBusy(true); const r = await run(() => api<Workspace>("POST", "/api/ai/pitch"), "Pitch ready"); if (r) setWs(r); setBusy(false); };
  return (
    <section className="card card-pad stack-sm" data-testid="pitch-card">
      <div className="row-between"><h3>Your 30-second pitch</h3>
        <button className="btn btn-secondary btn-sm" disabled={busy || !config?.ai.available} onClick={make} data-testid="button-make-pitch">{busy ? <Spinner /> : <Sparkles size={14} />} {ws!.pitch ? "Write it again" : "Draft my pitch"}</button></div>
      {owner && !ws!.pitch && !text ? (
        <Example testid="pitch-example">
          <p className="example-pitch">“Hi, I'm Jordan, a <b>{[ex.subject, year].filter(Boolean).join(" ") || "student"}</b>. This fall I <b>{ex.did}</b>. I'm looking for a <b>{year === "senior" ? "full-time role" : "summer internship"}</b>{ex.subject ? ` in ${ex.subject}` : ""}.”</p>
          <p className="xs muted">For career fairs and coffee chats. Remy writes yours from your resume, then you practice it out loud.</p>
        </Example>
      ) : <p className="xs muted">For career fairs and coffee chats: hello, what you study, one real thing you did, what you want next. Remy writes it to be said out loud, using only facts from your resume and profile. Change any words so it sounds like you, then practice: Remy tells you your pace, filler words, and if you're reciting instead of talking.</p>}
      {(ws!.pitch || text) && <>
        <textarea className="textarea" style={{ minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={1200} aria-label="Your pitch" data-testid="input-pitch" />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className={"xs " + (words > 90 ? "" : "muted")} style={words > 90 ? { color: "var(--warn)" } : undefined}>{words} words · about {Math.round(words / 2.5)} seconds spoken{words > 90 ? ", a bit long" : ""}</span>
          <button className="btn btn-ghost btn-sm" disabled={text === (ws!.pitch?.text || "")} onClick={() => save("pitch", { text, at: new Date().toISOString() }).catch(() => {})}>Save</button>
        </div>
        {!/\b(interested in|looking for|hoping to|want to|I'd love to|next (summer|year)|this summer)\b/i.test(text) && <p className="xs" style={{ color: "var(--warn)" }} data-testid="pitch-no-target">Your pitch doesn't say what you want next. Add a line yourself, or add the roles you're interested in (Account → Profile) and write it again.</p>}
        <PracticeOutLoud goal={[25, 35]} script={text} />
      </>}
    </section>
  );
}
