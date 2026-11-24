import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import type { ResumeDoc } from "@shared/types";
import { reviewResume, type BulletRef, type ReviewItem } from "@shared/review";
import { api, useOwnerView, useStore } from "../lib/store";
import { Remy, Spinner } from "./common";

type Upd = (fn: (d: ResumeDoc) => void) => void;
const FIELD_LABEL = { name: "Full name", email: "Email", phone: "Phone", location: "City, state", links: "LinkedIn URL" } as const;

/** Remy's review of the base resume: the few things worth fixing, each fixable right here. Remy asks for what it
 *  doesn't know, drafts the line from the student's own words, and the student approves. Nothing saves until they
 *  press Save (the usual "Review your changes"). */
export function ResumeReview({ doc, upd, onEdit, beside = false, onWalk }: { doc: ResumeDoc; upd: Upd; onEdit: () => void; beside?: boolean; onWalk?: () => void }) {
  const owner = useOwnerView();
  const { todo: live, good } = useMemo(() => reviewResume(doc, { listLike: owner }), [doc, owner]);
  // An open fix keeps the fields and lines it showed when opened, so a box doesn't vanish mid-typing once its value
  // passes ("maya@" → valid email); it updates when the student closes it.
  // Owners: Remy doesn't wait to be asked; his first question is already open (Remy reaches out first, Dilan Nov 22).
  const [frozen, setFrozen] = useState<Record<string, ReviewItem>>(() => { const first = owner && beside && !onWalk ? live.find((x) => x.kind === "numbers" || x.kind === "verbs") : undefined; return first ? { [first.kind]: first } : {}; });
  const keyOf = (it: ReviewItem) => (it.kind === "tip" ? "tip:" + it.title : it.kind);
  const order = ["contact", "dates", "numbers", "verbs"];
  const rank = (it: ReviewItem) => { const i = order.indexOf(it.kind); return i < 0 ? 9 : i; };
  const todo = [...live.map((it) => frozen[keyOf(it)] || it), ...Object.entries(frozen).filter(([k]) => !live.some((it) => keyOf(it) === k)).map(([, it]) => it)].sort((a, b) => rank(a) - rank(b));
  const toggle = (it: ReviewItem) => setFrozen((f) => { const k = keyOf(it); const n = { ...f }; if (n[k]) delete n[k]; else n[k] = it; return n; });
  const count = todo.length; // confirming what Remy read is step 1 of the base resume now
  return (
    <section className={beside ? "stack" : "card card-pad stack"} data-testid="resume-review">
      <div className="stack-sm" style={{ gap: 4 }}>
        <h3 className={owner && beside ? "row" : undefined} style={owner && beside ? { gap: 8, flexWrap: "nowrap" } : undefined}>{owner && beside && <Remy size={28} mood={count ? "think" : "happy"} />}{beside ? (count ? `${count} thing${count > 1 ? "s" : ""} to make it stronger` : "Looking strong") : count ? `Remy's review · ${count} thing${count > 1 ? "s" : ""} to fix` : "Remy's review · looking good"}</h3>
        <span className="xs muted">{owner && beside && count ? onWalk ? "Press Fix and I'll rewrite each line right on your resume, using only what you already wrote. Accept, edit or skip each one. Nothing changes until you save." : "I'll rewrite one line at a time from what you already wrote. Accept, edit or skip each one. Nothing changes until you save." : beside ? "Fix them right here, or just ask Remy in the chat. Nothing changes until you save." : "Remy's suggestions from your resume itself, not an employer's score. Fix them here; nothing changes until you press Save."}</span>
      </div>
      {todo.map((it) => <Item key={keyOf(it)} it={it} open={!!frozen[keyOf(it)]} onToggle={() => (onWalk && (it.kind === "numbers" || it.kind === "verbs") ? onWalk() : toggle(it))} doc={doc} upd={upd} onEdit={onEdit} oneAtATime={owner} />)}
      {good.length > 0 && (
        <div className="stack-sm" style={{ gap: 4 }} data-testid="review-good">
          {good.map((g) => <span key={g} className="xs row" style={{ gap: 6, flexWrap: "nowrap" }}><CheckCircle2 size={14} style={{ color: "var(--success, #22a05a)", flex: "none" }} /> {g}</span>)}
        </div>
      )}
    </section>
  );
}

function Item({ it, open, onToggle, doc, upd, onEdit, oneAtATime = false }: { it: ReviewItem; open: boolean; onToggle: () => void; doc: ResumeDoc; upd: Upd; onEdit: () => void; oneAtATime?: boolean }) {
  // Owners (Nov 23 live test: 8 question cards stacked into a long column): Remy asks about one line at a time.
  const [at, setAt] = useState(0);
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
      {open && (it.kind === "numbers" || it.kind === "verbs") && oneAtATime && (() => {
        const i = Math.min(at, it.bullets.length - 1), b = it.bullets[i];
        const now = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).find((x) => b.id && x.id === b.id);
        return (
          <div className="stack-sm" data-testid="review-one-at-a-time">
            <div className="row-between xs muted"><span data-testid="review-line-count">Line {i + 1} of {it.bullets.length}</span>
              <span className="row" style={{ gap: 4 }}>
                <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => setAt(i - 1)} aria-label="Previous line" data-testid="button-review-prev"><ArrowLeft size={14} /></button>
                <button className="btn btn-ghost btn-sm" disabled={i >= it.bullets.length - 1} onClick={() => setAt(i + 1)} data-testid="button-review-skip">Skip <ArrowRight size={14} /></button>
              </span>
            </div>
            {now && <BulletFix key={b.id} b={{ ...b, text: now.text.trim() }} kind={it.kind as "numbers" | "verbs"} upd={upd} onNext={i < it.bullets.length - 1 ? () => setAt(i + 1) : undefined} />}
          </div>
        );
      })()}
      {open && (it.kind === "numbers" || it.kind === "verbs") && !oneAtATime && (
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

const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
/** One plain line on why Remy's version reads better than the old one. */
function why(old: string, draft: string, kind: "numbers" | "verbs", answer: string) {
  const cut = wc(old) - wc(draft);
  const parts = [kind === "numbers" && answer.trim() ? `Adds your number (${answer.trim()})` : "Leads with what you did", cut >= 3 ? `cuts ${cut} extra words` : ""].filter(Boolean);
  return `Why it's better: ${parts.join(", and ")}.`;
}

export function BulletFix({ b, kind, upd, onNext, autoFocus, compact }: { b: BulletRef; kind: "numbers" | "verbs"; upd: Upd; onNext?: () => void; autoFocus?: boolean; compact?: boolean }) {
  const { run } = useStore();
  const [draftFor, setDraftFor] = useState(""); // the line text the draft was made from
  const [answer, setAnswer] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"" | "used" | "skipped">("");
  // Owners (Demetre, Nov 24: "it should do more on its own"): Remy rewrites the line from what it already says, then
  // the student accepts, edits or skips. He asks only when that fails (a missing number, or only they know their part).
  const owner = useOwnerView();
  // A missing number is a missing fact: Remy asks for it first instead of reshuffling the line's words (Dilan, Nov 24:
  // "if you don't have information at all, make sure to ask the user"). A weak start he can fix from the line itself.
  const [auto, setAuto] = useState(owner && kind === "verbs");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!owner || kind !== "verbs") return;
    let live = true;
    api<{ draft: string }>("POST", "/api/resume/bullet-draft", { kind, text: b.text, answer: "" })
      .then((r) => { if (live) { setDraft(r.draft); setDraftFor(b.text); } }, () => {}) // no honest rewrite: ask instead
      .finally(() => live && setAuto(false));
    return () => { live = false; };
  }, []);
  const ask = async () => {
    setBusy(true);
    const r = await run(() => api<{ draft: string }>("POST", "/api/resume/bullet-draft", { kind, text: owner && draft ? draft : b.text, answer }));
    setBusy(false);
    if (r) { setDraft(r.draft); setDraftFor(b.text); }
  };
  const use = () => {
    upd((d) => { for (const s of d.sections) for (const e of s.entries) for (const x of e.bullets) if (b.id && x.id === b.id) x.text = draft; });
    setDone("used");
  };
  const skip = () => (onNext ? onNext() : setDone("skipped"));
  if (done) return <span className="xs row" style={{ gap: 6 }}>{done === "used" ? <><Check size={14} /> Updated. Press Save when you're done.</> : "Skipped. Your line stays as it is."}{onNext && <button className="btn btn-secondary btn-sm" onClick={onNext} data-testid="button-review-next">Next line <ArrowRight size={14} /></button>}</span>;
  if (auto) return <span className="xs row" style={{ gap: 6 }} data-testid="bullet-fix-auto"><Spinner /> Remy is rewriting this line from what you already wrote…</span>;
  // Enter drafts, like any one-line question (Nov 23 live test: Enter did nothing).
  const enter = (ok: boolean) => (e: KeyboardEvent) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && ok && !busy) { e.preventDefault(); ask(); } };
  return (
    <div className={compact ? "stack-sm" : "card card-pad stack-sm"} style={compact ? undefined : { boxShadow: "none", padding: 10 }} data-testid="bullet-fix">
      {!compact && <><span className="xs muted">{b.where}</span>
      <span className="small">“{b.text}”</span></>}
      {!draft && kind === "numbers" && (
        <>
          <span className="xs">Remy won't guess a number. Roughly how many people, events, dollars or hours were involved? Skip it if you're not sure.</span>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. 40 members, $5,000" aria-label="The real number" autoFocus={autoFocus} onKeyDown={enter(/\d/.test(answer))} data-testid="input-bullet-number" />
            <button className="btn btn-secondary btn-sm" disabled={busy || !/\d/.test(answer)} onClick={ask} data-testid="button-draft-bullet">{busy ? <Spinner /> : <Sparkles size={14} />} Draft</button>
          </div>
        </>
      )}
      {!draft && kind === "verbs" && (
        <>
          <span className="xs">{owner ? "I can't tell your part from this line alone, so I won't guess. What did you do here? A few words is enough." : "What exactly did you do here? A few words in your own terms."}</span>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. wrote and scheduled the posts" aria-label="What you did" autoFocus={autoFocus} onKeyDown={enter(answer.trim().length >= 4)} data-testid="input-bullet-action" />
            <button className="btn btn-secondary btn-sm" disabled={busy || answer.trim().length < 4} onClick={ask} data-testid="button-draft-bullet">{busy ? <Spinner /> : <Sparkles size={14} />} Draft</button>
          </div>
        </>
      )}
      {draft && draftFor !== b.text && <span className="xs" style={{ color: "var(--amber)" }}>This line changed since Remy drafted it. Draft again.</span>}
      {draft && draftFor === b.text && !owner && (
        <>
          <span className="small"><b>New:</b> {draft}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={use} data-testid="button-use-draft"><Check size={14} /> Use it</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDraft("")}>No thanks</button>
          </div>
        </>
      )}
      {draft && draftFor === b.text && owner && (
        <>
          {editing
            ? <textarea className="input" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Your version of this line" autoFocus data-testid="input-draft-edit" />
            : <span className="small"><b>Remy's version:</b> {draft}</span>}
          {!editing && <span className="xs" data-testid="draft-why">{why(draftFor, draft, kind, answer)}</span>}
          <span className="xs muted">Only facts already on your resume{answer.trim() ? " and what you told Remy" : ""}. Nothing changes until you save.</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={use} disabled={!draft.trim()} data-testid="button-use-draft"><Check size={14} /> {editing ? "Use my version" : "Accept"}</button>
            {!editing && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} data-testid="button-edit-draft">Edit</button>}
            <button className="btn btn-ghost btn-sm" onClick={skip} data-testid="button-skip-draft">Skip</button>
          </div>
          {kind === "numbers" && !editing && (
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Know a real number? e.g. 40 members" aria-label="A real number, if you know one" onKeyDown={enter(/\d/.test(answer))} data-testid="input-bullet-number-optional" />
              <button className="btn btn-ghost btn-sm" disabled={busy || !/\d/.test(answer)} onClick={ask} data-testid="button-add-number">{busy ? <Spinner /> : <Sparkles size={14} />} Add it</button>
            </div>
          )}
        </>
      )}
      {!draft && owner && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={skip} data-testid="button-skip-line">Skip this line</button>}
    </div>
  );
}
