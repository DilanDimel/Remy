import { useState } from "react";
import { Plus } from "lucide-react";
import type { ResumeDoc } from "@shared/types";
import { addStoryEntry } from "@shared/storyEntry";
import { api, useStore } from "../lib/store";
import { Spinner } from "./common";
import { StoryBox } from "./ResumeBuilder";
import { FitTextarea } from "./FitTextarea";

const KINDS: [string, string][] = [["internship", "Internship"], ["job", "Job"], ["club", "Club or team"], ["volunteer", "Volunteering"], ["project", "Project"]];
const BLANK = /\[[^\]]*\]/;
type Line = { text: string; source: string; keep: boolean };

/** Add an experience by telling the story (Julio's user testing, Nov 27): Remy drafts 1-2 lines from only the student's
 *  words (POST /api/resume/story, the builder's draft and honesty check); they keep, edit or drop each, then save as usual. */
export function StoryEntry({ upd }: { upd: (f: (d: ResumeDoc) => void) => void }) {
  const { run } = useStore();
  const empty = { kind: "internship", org: "", role: "", start: "", end: "", city: "", story: "" };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty, v: string) => setF((x) => ({ ...x, [k]: v }));
  if (!open) return <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)} data-testid="button-story-open"><Plus size={14} /> Add an experience from your story</button>;
  const draft = async () => {
    setBusy(true);
    const r = await run(() => api<{ lines: { text: string; source: string }[]; by: "ai" | "rules" }>("POST", "/api/resume/story", f));
    setBusy(false);
    if (r) { setLines(r.lines.map((l) => ({ ...l, keep: true }))); setRules(r.by === "rules"); }
  };
  const kept = (lines || []).filter((l) => l.keep && l.text.trim() && !BLANK.test(l.text));
  const blanks = (lines || []).some((l) => l.keep && BLANK.test(l.text));
  const add = () => { upd((d) => { d.sections = addStoryEntry(d, f, kept.map((l) => l.text)).sections; }); setOpen(false); setF(empty); setLines(null); };
  return (
    <div className="card card-pad stack" data-testid="card-story-entry">
      <div className="stack-sm"><h3>Add an experience</h3><span className="xs muted">Tell the story your way. I'll write one or two resume lines from only what you say.</span></div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {KINDS.map(([k, label]) => <button key={k} type="button" className={"chip " + (f.kind === k ? "chip-student" : "chip-plain")} aria-pressed={f.kind === k} onClick={() => set("kind", k)} data-testid={`chip-story-${k}`}>{label}</button>)}
      </div>
      <div className="grid-2">
        <label className="field"><span>Where</span><input className="input" value={f.org} onChange={(e) => set("org", e.target.value)} placeholder="Company, club or place" data-testid="input-story-org" /></label>
        <label className="field"><span>Your role</span><input className="input" value={f.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Finance Intern" data-testid="input-story-role" /></label>
        <label className="field"><span>Start</span><input className="input" value={f.start} onChange={(e) => set("start", e.target.value)} placeholder="Jun 2026" data-testid="input-story-start" /></label>
        <label className="field"><span>End</span><input className="input" value={f.end} onChange={(e) => set("end", e.target.value)} placeholder="Aug 2026 (or Present)" data-testid="input-story-end" /></label>
      </div>
      <StoryBox value={f.story} onChange={(v) => { set("story", v); setLines(null); }} />
      {!lines && <div className="row">
        <button className="btn btn-primary btn-sm" onClick={draft} disabled={busy || f.story.trim().length < 20 || !f.org.trim()} data-testid="button-story-draft">{busy ? <Spinner /> : null} Write my resume lines</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} data-testid="button-story-cancel">Cancel</button>
      </div>}
      {lines && <div className="stack-sm" data-testid="story-lines">
        <b className="small">My lines</b>
        {rules && <div className="notice small"><div>The AI writer wasn't available, so these are your own sentences, tidied up. Edit them however you like.</div></div>}
        {!lines.length && <span className="small muted">I couldn't find a full sentence to use. Add a little more about what you did.</span>}
        {lines.map((l, i) => (
          <div key={i} className="stack-sm" style={{ opacity: l.keep ? 1 : 0.55 }} data-testid="story-line">
            <FitTextarea className="textarea" style={{ minHeight: 56 }} value={l.text} onChange={(e) => setLines((x) => x!.map((y, n) => (n === i ? { ...y, text: e.target.value } : y)))} aria-label="Resume line" data-testid="input-story-line" />
            {BLANK.test(l.text) && <span className="xs" style={{ color: "var(--warn)" }}>Replace the [blank] with the real number, or delete it.</span>}
            {l.source && <span className="xs muted">From your words: “{l.source.slice(0, 160)}”</span>}
            <label className="row small"><input type="checkbox" checked={l.keep} onChange={(e) => setLines((x) => x!.map((y, n) => (n === i ? { ...y, keep: e.target.checked } : y)))} data-testid="input-story-keep" /> Use this line</label>
          </div>
        ))}
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!kept.length || blanks} data-testid="button-story-add">Add to my resume</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setLines(null)} data-testid="button-story-redo">Change my story</button>
        </div>
        <span className="xs muted">It's added to your resume below. Save your edits to keep it.</span>
      </div>}
    </div>
  );
}
