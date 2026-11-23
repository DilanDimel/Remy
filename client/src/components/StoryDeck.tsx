import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { Story, StoryPart, Workspace } from "@shared/types";
import { otherExperience, STORY_ASK, STORY_PARTS } from "@shared/stories";
import { api, useOwnerView, useStore } from "../lib/store";
import { Example, Spinner, WorkingSteps } from "./common";
import { PracticeOutLoud } from "./PracticeOutLoud";

const LABEL: Record<StoryPart, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };
type Msg = { who: "ai" | "me"; text: string; story?: string };
type Ask = { st: Story; part: StoryPart };
const key = (q: Ask) => `${q.st.id}:${q.part}`;
const doneCount = (st: Story) => STORY_PARTS.filter((p) => st[p]).length;

/** Story Deck as a chat (Dilan's pick, Nov 18): Remy asks one question at a time for the parts the resume doesn't
 *  say, and the stories sit beside it with their progress. Every answer is the student's own words, never filled in
 *  by Remy; a story opens on the right to read it, edit your parts, or practice it out loud. */
export function StoryDeck() {
  const { ws, setWs, run, config } = useStore();
  const owner = useOwnerView();
  const [busy, setBusy] = useState(false);
  const stories = ws!.stories || [];
  const ref = useRef<HTMLElement>(null);
  // Home's interview step links here (#story-deck); the Resume page is long.
  useEffect(() => { if (location.hash === "#story-deck") ref.current?.scrollIntoView({ block: "start" }); }, []);
  const [open, setOpen] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const make = async () => { setBusy(true); const r = await run(() => api<Workspace>("POST", "/api/ai/stories"), "Stories ready"); if (r) { setWs(r); setLog([]); setSkipped([]); } setBusy(false); };

  // Remy's next question: the story the student picked first, then in order; skipped ones wait until asked again.
  const all: Ask[] = stories.flatMap((st) => STORY_PARTS.filter((p) => !st[p]).map((part) => ({ st, part })));
  const order = [...all.filter((q) => q.st.id === focus), ...all.filter((q) => q.st.id !== focus)];
  const next = order.find((q) => !skipped.includes(key(q)));
  const lastStory = [...log].reverse().find((m) => m.story)?.story;
  const question = (q: Ask) => q.st.asks?.[q.part] || STORY_ASK[q.part];
  // The story is named only when Remy moves on to a new one.
  const lead = (q: Ask) => (lastStory === q.st.id ? "" : `About “${q.st.title}”: `);
  const keep = (m: Msg[]) => setLog((l) => [...l, ...m].slice(-6)); // the last few lines only: the chat never becomes a wall
  // A draft belongs to the question it was typed for: if the question changes (another story picked, a part cleared),
  // the draft is cleared so it can never be saved into the wrong story.
  const nextKey = next ? key(next) : "";
  useEffect(() => { setText(""); }, [nextKey]);
  // An answer that sounds like another experience on the resume gets one question first; the student decides.
  const [check, setCheck] = useState<{ key: string; text: string; other: string } | null>(null);
  const answer = async (skip: boolean, sure = false) => {
    if (!next || sending) return;
    const q = next, asked = lead(q) + question(q);
    if (skip) { setCheck(null); setSkipped((s) => [...s, key(q)]); keep([{ who: "ai", text: asked, story: q.st.id }, { who: "me", text: "Skipped for now" }]); return; }
    const other = sure ? undefined : otherExperience(text, q.st, q.part, ws!.resume?.doc);
    if (other) { setCheck({ key: key(q), text, other }); return; }
    setCheck(null);
    setSending(true);
    const r = await run(() => api<Workspace>("POST", `/api/stories/${q.st.id}/part`, { part: q.part, text }));
    setSending(false);
    if (!r) return;
    setWs(r);
    keep([{ who: "ai", text: asked, story: q.st.id }, { who: "me", text: text.trim() }]);
    setText("");
  };

  const ready = stories.filter((st) => doneCount(st) === 4).length;
  const shown = stories.find((st) => st.id === open);
  return (
    <section ref={ref} id="story-deck" className="card card-pad stack-sm" data-testid="story-deck">
      <div className="row-between"><h3>Interview stories</h3>
        <span className="row" style={{ gap: 8 }}>
          {stories.length > 0 && <span className="xs muted" data-testid="story-summary">{ready} of {stories.length} ready{all.length ? ` · ${all.length} question${all.length === 1 ? "" : "s"} left` : ""}</span>}
          <button className="btn btn-secondary btn-sm" disabled={busy || !config?.ai.available} onClick={make} title={stories.length ? "Find new stories in your resume. Your answers are kept." : undefined} data-testid="button-make-stories">{busy ? <Spinner /> : <Sparkles size={14} />} {stories.length ? "Rebuild" : "Build my interview stories"}</button>
        </span>
      </div>
      {busy && <WorkingSteps steps={["Finding moments in your resume", "Shaping them into stories", "Checking each part against your resume"]} />}
      {!stories.length && owner ? (
        <Example testid="star-explainer">
          <q className="example-q">Tell me about a time you led a team.</q>
          <dl className="example-star">
            <dt>S</dt><dd>A campus club needed a student ambassador program.</dd>
            <dt>T</dt><dd>I was asked to recruit the first 10 ambassadors.</dd>
            <dt>A</dt><dd>I ran two info sessions and a referral sign-up sheet.</dd>
            <dt>R</dt><dd>14 students joined, and the program runs again this spring.</dd>
          </dl>
          <p className="xs muted">Remy finds moments like this on your resume and asks you a few short questions. It only uses facts you confirm.</p>
        </Example>
      ) : !stories.length ? (
        <p className="small muted" data-testid="star-explainer">Interviewers ask “Tell me about a time when…”. Remy finds moments on your resume and asks you a few short questions, so each becomes a one-minute story: what was going on, what you had to do, what <i>you</i> did, and what changed (called STAR).</p>
      ) : (
        <div className="story-chat">
          <div className="card card-pad stack-sm" style={{ boxShadow: "none" }} data-testid="story-thread">
            <div className="ob-thread" aria-live="polite">
              {!log.length && <div className="bubble bubble-ai">Interviewers ask “Tell me about a time when…”. I'll ask a few short questions so each story has all four parts. Answer in your own words; I never fill them in for you, and your answers stay if you rebuild.</div>}
              {log.map((m, i) => <div key={i} className={"bubble " + (m.who === "ai" ? "bubble-ai" : "bubble-user")}>{m.text}</div>)}
              {next ? (
                <div className="bubble bubble-ai" data-testid="story-question"><span className="xs muted" style={{ display: "block" }}>{LABEL[next.part]}</span>{lead(next)}<b>{question(next)}</b></div>
              ) : all.length ? (
                <div className="bubble bubble-ai">You skipped the rest for now. <button className="btn btn-ghost btn-sm" onClick={() => setSkipped([])} data-testid="button-ask-again">Ask me again</button></div>
              ) : (
                <div className="bubble bubble-ai" data-testid="stories-all-ready">All your stories have four parts. Open one in Your stories and practice it out loud.</div>
              )}
            </div>
            {next && <>
              <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !sending && text.trim().length >= 8) { e.preventDefault(); answer(false); } }} placeholder="Type your answer…" aria-label={`${LABEL[next.part]} for ${next.st.title}`} data-testid="input-story-answer" />
              {check && check.key === key(next) && check.text === text && (
                <div className="notice small stack-sm" role="alert" data-testid="story-other-experience">
                  <span>This sounds like your <b>{check.other}</b> experience. Is it about “{next.st.title}”? A story mixing two experiences is hard to tell in an interview.</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => answer(false, true)} data-testid="button-story-same">Yes, save it</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setCheck(null)} data-testid="button-story-fix">Let me fix it</button>
                  </div>
                </div>
              )}
              <div className="row-between">
                <button className="btn btn-ghost btn-sm" onClick={() => answer(true)} disabled={sending} data-testid="button-story-skip">Skip</button>
                <button className="btn btn-primary btn-sm" disabled={sending || text.trim().length < 8} onClick={() => answer(false)} data-testid="button-story-send">{sending ? <Spinner /> : null} Send</button>
              </div>
            </>}
          </div>
          <div className="stack-sm">
            <span className="eyebrow">Your stories</span>
            {stories.map((st) => {
              const n = doneCount(st);
              return (
                <button key={st.id} className={"story-row" + (open === st.id ? " on" : "")} aria-expanded={open === st.id} onClick={() => { setOpen(open === st.id ? null : st.id); if (n < 4) { setFocus(st.id); setSkipped((s) => s.filter((k) => !k.startsWith(st.id + ":"))); } }} data-testid="story-card">
                  <b className="small">{st.title}</b>
                  {owner ? <span className="iv-star" data-testid="story-progress" aria-label={n === 4 ? "Ready" : `${n} of 4 parts`}>{STORY_PARTS.map((p) => <i key={p} className={st[p] ? "d" : ""}>{LABEL[p][0]}</i>)}</span>
                    : <span className={"chip " + (n === 4 ? "chip-live" : "chip-plain")} data-testid="story-progress">{n === 4 ? "Ready" : `${n} of 4`}</span>}
                </button>
              );
            })}
            {shown && <StoryView st={shown} />}
          </div>
        </div>
      )}
    </section>
  );
}

/** One story, read in full: Remy's parts, the student's own (editable), what's still to answer, and practice. */
function StoryView({ st }: { st: Story }) {
  const done = doneCount(st) === 4;
  return (
    <div className="card card-pad stack-sm fade-up" style={{ boxShadow: "none" }} data-testid="story-view">
      {st.theme && <span className="chip chip-plain" style={{ alignSelf: "flex-start" }}>{st.theme}</span>}
      {STORY_PARTS.map((p) => st[p] ? <PartRow key={p} st={st} part={p} /> : <p key={p} className="small muted" data-testid={`story-missing-${p}`}><b>{LABEL[p]}:</b> Remy will ask you this in the chat.</p>)}
      {done ? <PracticeOutLoud goal={[60, 120]} label="Tell it out loud" script={STORY_PARTS.map((p) => st[p]).join(" ")} /> : <span className="xs muted">Answer the rest in the chat, then practice it out loud.</span>}
    </div>
  );
}

function PartRow({ st, part }: { st: Story; part: StoryPart }) {
  const { ws, setWs, run } = useStore();
  const [text, setText] = useState("");
  const [other, setOther] = useState<{ text: string; label: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const mine = !!st.mine?.includes(part);
  const save = async (value: string) => {
    const r = await run(() => api<Workspace>("POST", `/api/stories/${st.id}/part`, { part, text: value }), value ? "Saved" : undefined);
    if (r) { setWs(r); setText(""); setEditing(false); }
  };
  if (!editing) return (
    <p className="small" data-testid={`story-${part}`}>
      <b>{LABEL[part]}:</b> {st[part]}
      {mine && <> <span className="xs muted">(your words)</span> <button className="btn btn-ghost btn-sm" style={{ padding: "0 6px", height: "auto" }} onClick={() => { setText(st[part]); setEditing(true); }}>Edit</button></>}
    </p>
  );
  return (
    <div className="stack-sm" style={{ gap: 4 }} data-testid={`story-edit-${part}`}>
      <span className="small"><b>{LABEL[part]}:</b></span>
      <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label={`${LABEL[part]} for ${st.title}`} />
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-secondary btn-sm" disabled={text.trim().length < 8} onClick={() => { const o = other?.text === text ? undefined : otherExperience(text, st, part, ws!.resume?.doc); if (o) setOther({ text, label: o }); else save(text); }} data-testid={`button-save-${part}`}><Check size={14} /> {other?.text === text ? "Yes, save it" : "Save"}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        {mine && <button className="btn btn-ghost btn-sm" onClick={() => save("")}>Clear</button>}
      </div>
      {other?.text === text && <span className="xs field-warn" role="alert" data-testid="story-edit-other-experience">This sounds like your <b>{other.label}</b> experience. If it's really about “{st.title}”, press Yes, save it.</span>}
    </div>
  );
}
