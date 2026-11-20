import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import type { ResumeDoc } from "@shared/types";
import { reviewResume, type BulletRef, type ReviewItem } from "@shared/review";
import { api, useStore } from "../lib/store";
import { Spinner } from "./common";

type Upd = (fn: (d: ResumeDoc) => void) => void;
const FIELD_LABEL = { name: "Full name", email: "Email", phone: "Phone", location: "City, state", links: "LinkedIn URL" } as const;

/** Remy's review of the base resume: the few things worth fixing, each fixable right here. Remy asks for what it
 *  doesn't know, drafts the line from the student's own words, and the student approves. Nothing saves until they
 *  press Save (the usual "Review your changes"). */
export function ResumeReview({ doc, upd, onEdit }: { doc: ResumeDoc; upd: Upd; onEdit: () => void }) {
  const { todo: live, good } = useMemo(() => reviewResume(doc), [doc]);
  // An open fix keeps the fields and lines it showed when opened, so a box doesn't vanish mid-typing once its value
  // passes ("maya@" → valid email); it updates when the student closes it.
  const [frozen, setFrozen] = useState<Record<string, ReviewItem>>({});
  const keyOf = (it: ReviewItem) => (it.kind === "tip" ? "tip:" + it.title : it.kind);
  const order = ["contact", "dates", "numbers", "verbs"];
  const rank = (it: ReviewItem) => { const i = order.indexOf(it.kind); return i < 0 ? 9 : i; };
  const todo = [...live.map((it) => frozen[keyOf(it)] || it), ...Object.entries(frozen).filter(([k]) => !live.some((it) => keyOf(it) === k)).map(([, it]) => it)].sort((a, b) => rank(a) - rank(b));
  const toggle = (it: ReviewItem) => setFrozen((f) => { const k = keyOf(it); const n = { ...f }; if (n[k]) delete n[k]; else n[k] = it; return n; });
  const count = todo.length; // confirming what Remy read is step 1 of the base resume now
  return (
    <section className="card card-pad stack" data-testid="resume-review">
      <div className="stack-sm" style={{ gap: 4 }}>
        <h3>{count ? `Remy's review · ${count} thing${count > 1 ? "s" : ""} to fix` : "Remy's review · looking good"}</h3>
        <span className="xs muted">Remy's suggestions from your resume itself, not an employer's score. Fix them here; nothing changes until you press Save.</span>
      </div>
      {todo.map((it) => <Item key={keyOf(it)} it={it} open={!!frozen[keyOf(it)]} onToggle={() => toggle(it)} doc={doc} upd={upd} onEdit={onEdit} />)}
      {good.length > 0 && (
        <div className="stack-sm" style={{ gap: 4 }} data-testid="review-good">
          {good.map((g) => <span key={g} className="xs row" style={{ gap: 6, flexWrap: "nowrap" }}><CheckCircle2 size={14} style={{ color: "var(--success, #22a05a)", flex: "none" }} /> {g}</span>)}
        </div>
      )}
    </section>
  );
}

function Item({ it, open, onToggle, doc, upd, onEdit }: { it: ReviewItem; open: boolean; onToggle: () => void; doc: ResumeDoc; upd: Upd; onEdit: () => void }) {
  return (
    <div className="review-item" data-testid={`review-${it.kind}`}>
      <button className="row-between small" style={{ textAlign: "left", gap: 8, flexWrap: "nowrap", width: "100%" }} onClick={() => (it.kind === "tip" ? onEdit() : onToggle())} aria-expanded={it.kind === "tip" ? undefined : open}>
        <b>{it.title}</b>
        <span className="btn btn-secondary btn-sm" style={{ flex: "none" }}>{it.kind === "tip" ? "Edit" : open ? "Close" : it.kind === "contact" ? "Add" : "Fix"} <ChevronRight size={14} /></span>
      </button>
      {"why" in it && <span className="xs muted">{it.why}</span>}
      {open && it.kind === "contact" && (
        <div className="stack-sm">
          {it.fields.map((f) => (
            <label key={f} className="field"><span>{FIELD_LABEL[f]}</span>
              <input className="input" value={doc.contact[f]} onChange={(e) => upd((d) => { d.contact[f] = e.target.value; })} data-testid={`review-input-${f}`} /></label>
          ))}
        </div>
      )}
      {open && it.kind === "dates" && (
        <div className="stack-sm">
          {it.entries.map((x) => {
            const e = doc.sections.find((s) => s.id === x.sectionId)?.entries.find((y) => y.id === x.entryId);
            return (
              <label key={x.entryId} className="field"><span>{x.label}</span>
                <input className="input" placeholder="e.g. Aug 2025 – Present" value={e?.dates || ""} onChange={(ev) => upd((d) => { const t = d.sections.find((s) => s.id === x.sectionId)?.entries.find((y) => y.id === x.entryId); if (t) t.dates = ev.target.value; })} data-testid="review-input-dates" /></label>
            );
          })}
        </div>
      )}
      {open && (it.kind === "numbers" || it.kind === "verbs") && (
        <div className="stack-sm">
          {it.bullets.slice(0, 5).map((b) => {
            // The list is frozen while open, but the text is always the line as it is now (another fix may have changed it).
            const now = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).find((x) => b.id && x.id === b.id);
            return now ? <BulletFix key={b.id} b={{ ...b, text: now.text.trim() }} kind={it.kind as "numbers" | "verbs"} upd={upd} /> : null;
          })}
          {it.bullets.length > 5 && <span className="xs muted">Fix these first, then the next ones show up.</span>}
        </div>
      )}
    </div>
  );
}

function BulletFix({ b, kind, upd }: { b: BulletRef; kind: "numbers" | "verbs"; upd: Upd }) {
  const { run } = useStore();
  const [draftFor, setDraftFor] = useState(""); // the line text the draft was made from
  const [answer, setAnswer] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ask = async () => {
    setBusy(true);
    const r = await run(() => api<{ draft: string }>("POST", "/api/resume/bullet-draft", { kind, text: b.text, answer }));
    setBusy(false);
    if (r) { setDraft(r.draft); setDraftFor(b.text); }
  };
  const use = () => {
    upd((d) => { for (const s of d.sections) for (const e of s.entries) for (const x of e.bullets) if (b.id && x.id === b.id) x.text = draft; });
    setDone(true);
  };
  if (done) return <span className="xs row" style={{ gap: 6 }}><Check size={14} /> Updated. Press Save when you're done.</span>;
  return (
    <div className="card card-pad stack-sm" style={{ boxShadow: "none", padding: 10 }} data-testid="bullet-fix">
      <span className="xs muted">{b.where}</span>
      <span className="small">“{b.text}”</span>
      {!draft && kind === "numbers" && (
        <>
          <span className="xs">Is there a real number here? How many people, events, dollars, hours or percent. Only if you know it.</span>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. 40 members, $5,000" aria-label="The real number" data-testid="input-bullet-number" />
            <button className="btn btn-secondary btn-sm" disabled={busy || !/\d/.test(answer)} onClick={ask} data-testid="button-draft-bullet">{busy ? <Spinner /> : <Sparkles size={14} />} Draft</button>
          </div>
        </>
      )}
      {!draft && kind === "verbs" && (
        <>
          <span className="xs">What exactly did you do here? A few words in your own terms.</span>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. wrote and scheduled the posts" aria-label="What you did" data-testid="input-bullet-action" />
            <button className="btn btn-secondary btn-sm" disabled={busy || answer.trim().length < 4} onClick={ask} data-testid="button-draft-bullet">{busy ? <Spinner /> : <Sparkles size={14} />} Draft</button>
          </div>
        </>
      )}
      {draft && draftFor !== b.text && <span className="xs" style={{ color: "var(--amber)" }}>This line changed since Remy drafted it. Draft again.</span>}
      {draft && draftFor === b.text && (
        <>
          <span className="small"><b>New:</b> {draft}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={use} data-testid="button-use-draft"><Check size={14} /> Use it</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDraft("")}>No thanks</button>
          </div>
        </>
      )}
    </div>
  );
}
