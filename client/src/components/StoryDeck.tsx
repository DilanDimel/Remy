import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { Spinner, WorkingSteps } from "./common";
import { PracticeOutLoud } from "./PracticeOutLoud";

/** Story Deck: true STAR stories from the resume to practice for interviews; gaps are asked, never filled in. */
export function StoryDeck() {
  const { ws, setWs, run, config } = useStore();
  const [busy, setBusy] = useState(false);
  const stories = ws!.stories || [];
  const make = async () => { setBusy(true); const r = await run(() => api<Workspace>("POST", "/api/ai/stories"), "Stories ready"); if (r) setWs(r); setBusy(false); };
  return (
    <section className="card card-pad stack-sm" data-testid="story-deck">
      <div className="row-between"><h3>Story deck</h3>
        <button className="btn btn-secondary btn-sm" disabled={busy || !config?.ai.available} onClick={make} data-testid="button-make-stories">{busy ? <Spinner /> : <Sparkles size={14} />} {stories.length ? "Rebuild stories" : "Build my interview stories"}</button></div>
      {busy && <WorkingSteps steps={["Finding moments in your resume", "Shaping them into stories", "Checking each part against your resume"]} />}
      <p className="xs muted">Interviewers ask “Tell me about a time…”. These stories use only what your resume says; anything missing is a question for you, not something Remy makes up.</p>
      <div className="grid-2">
        {stories.map((st) => (
          <div key={st.id} className="card card-pad stack-sm" style={{ boxShadow: "none" }}>
            <div className="row-between"><b className="small">{st.title}</b>{st.theme && <span className="chip chip-plain">{st.theme}</span>}</div>
            {([["Situation", st.situation], ["Task", st.task], ["Action", st.action], ["Result", st.result]] as const).map(([k, v]) => v && <p key={k} className="small"><b>{k}:</b> {v}</p>)}
            {st.missing && <p className="xs" style={{ color: "var(--amber)" }}>To complete it: {st.missing}</p>}
            <PracticeOutLoud goal={[60, 120]} label="Tell it out loud" />
          </div>
        ))}
      </div>
    </section>
  );
}
