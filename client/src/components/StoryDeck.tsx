import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { Story, StoryPart, Workspace } from "@shared/types";
import { STORY_ASK, STORY_PARTS } from "@shared/stories";
import { api, useStore } from "../lib/store";
import { Spinner, WorkingSteps } from "./common";
import { PracticeOutLoud } from "./PracticeOutLoud";

const LABEL: Record<StoryPart, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };

/** Story Deck: true STAR stories from the resume to practice for interviews. Remy explains what STAR is, and every
 *  part the resume doesn't say is a question for the student, answered in their own words, never filled in by Remy. */
export function StoryDeck() {
  const { ws, setWs, run, config } = useStore();
  const [busy, setBusy] = useState(false);
  const stories = ws!.stories || [];
  const ref = useRef<HTMLElement>(null);
  // Home's interview step links here (#story-deck); the Resume page is long.
  useEffect(() => { if (location.hash === "#story-deck") ref.current?.scrollIntoView({ block: "start" }); }, []);
  const make = async () => { setBusy(true); const r = await run(() => api<Workspace>("POST", "/api/ai/stories"), "Stories ready"); if (r) setWs(r); setBusy(false); };
  return (
    <section ref={ref} id="story-deck" className="card card-pad stack-sm" data-testid="story-deck">
      <div className="row-between"><h3>Story deck</h3>
        <button className="btn btn-secondary btn-sm" disabled={busy || !config?.ai.available} onClick={make} data-testid="button-make-stories">{busy ? <Spinner /> : <Sparkles size={14} />} {stories.length ? "Rebuild stories" : "Build my interview stories"}</button></div>
      {busy && <WorkingSteps steps={["Finding moments in your resume", "Shaping them into stories", "Checking each part against your resume"]} />}
      <div className="small stack-sm" style={{ gap: 4 }} data-testid="star-explainer">
        <span>Interviewers ask “Tell me about a time when…”. A strong answer is a short story with four parts, called <b>STAR</b>:</span>
        <span><b>S</b>ituation: where you were and what was going on · <b>T</b>ask: what you had to do · <b>A</b>ction: what <i>you</i> did · <b>R</b>esult: what changed.</span>
        <span className="xs muted">About a minute out loud. Remy builds each story only from your resume. Where your resume doesn't say, you'll see a question: answer it in your own words and the story is ready to practice. Your answers keep when you rebuild.</span>
      </div>
      <div className="grid-2">
        {stories.map((st) => <StoryCard key={st.id} st={st} />)}
      </div>
    </section>
  );
}

function StoryCard({ st }: { st: Story }) {
  const done = STORY_PARTS.filter((p) => st[p]).length;
  return (
    <div className="card card-pad stack-sm" style={{ boxShadow: "none" }} data-testid="story-card">
      <div className="row-between"><b className="small">{st.title}</b>{st.theme && <span className="chip chip-plain">{st.theme}</span>}</div>
      <span className="xs muted" data-testid="story-progress">{done === 4 ? "All 4 parts ready. Practice it out loud." : `${done} of 4 parts. Answer the ${4 - done === 1 ? "question" : `${4 - done} questions`} below to finish it.`}</span>
      {STORY_PARTS.map((p) => <PartRow key={p} st={st} part={p} />)}
      <PracticeOutLoud goal={[60, 120]} label="Tell it out loud" />
    </div>
  );
}

function PartRow({ st, part }: { st: Story; part: StoryPart }) {
  const { setWs, run } = useStore();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const mine = !!st.mine?.includes(part);
  const save = async (value: string) => {
    const r = await run(() => api<Workspace>("POST", `/api/stories/${st.id}/part`, { part, text: value }), value ? "Saved" : undefined);
    if (r) { setWs(r); setText(""); setEditing(false); }
  };
  if (st[part] && !editing) return (
    <p className="small" data-testid={`story-${part}`}>
      <b>{LABEL[part]}:</b> {st[part]}
      {mine && <> <span className="xs muted">(your words)</span> <button className="btn btn-ghost btn-sm" style={{ padding: "0 6px", height: "auto" }} onClick={() => { setText(st[part]); setEditing(true); }}>Edit</button></>}
    </p>
  );
  return (
    <div className="stack-sm" style={{ gap: 4 }} data-testid={`story-ask-${part}`}>
      <span className="small"><b>{LABEL[part]}:</b> <span style={{ color: "var(--amber)" }}>{st.asks?.[part] || STORY_ASK[part]}</span></span>
      <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="In your own words…" aria-label={`${LABEL[part]} for ${st.title}`} />
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-secondary btn-sm" disabled={text.trim().length < 8} onClick={() => save(text)} data-testid={`button-save-${part}`}><Check size={14} /> Save</button>
        {editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>}
        {editing && mine && <button className="btn btn-ghost btn-sm" onClick={() => save("")}>Clear</button>}
      </div>
    </div>
  );
}
