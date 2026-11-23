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
export function ResumeReview({ doc, upd, onEdit, beside = false, focus }: { doc: ResumeDoc; upd: Upd; onEdit: () => void; beside?: boolean; focus?: { text: string; kind: string; n: number } | null }) {
  const owner = useOwnerView();
  const { todo: live, good } = useMemo(() => reviewResume(doc, { listLike: owner }), [doc, owner]);
  // An open fix keeps the fields and lines it showed when opened, so a box doesn't vanish mid-typing once its value
  // passes ("maya@" → valid email); it updates when the student closes it.
  // Owners: Remy doesn't wait to be asked; his first question is already open (Remy reaches out first, Dilan Nov 22).
  const [frozen, setFrozen] = useState<Record<string, ReviewItem>>(() => { const first = owner && beside ? live.find((x) => x.kind === "numbers" || x.kind === "verbs") : undefined; return first ? { [first.kind]: first } : {}; });
  const keyOf = (it: ReviewItem) => (it.kind === "tip" ? "tip:" + it.title : it.kind);
  const order = ["contact", "dates", "numbers", "verbs"];
  const rank = (it: ReviewItem) => { const i = order.indexOf(it.kind); return i < 0 ? 9 : i; };
  const todo = [...live.map((it) => frozen[keyOf(it)] || it), ...Object.entries(frozen).filter(([k]) => !live.some((it) => keyOf(it) === k)).map(([, it]) => it)].sort((a, b) => rank(a) - rank(b));
  const toggle = (it: ReviewItem) => setFrozen((f) => { const k = keyOf(it); const n = { ...f }; if (n[k]) delete n[k]; else n[k] = it; return n; });
  const count = todo.length; // confirming what Remy read is step 1 of the base resume now
  // A tapped line's "Fix with Remy": open the fix that lists that line and go straight to it.
  const [jump, setJump] = useState<{ key: string; id: string; n: number } | null>(null);
  useEffect(() => {
    if (!focus) return;
    const sq = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
    const line = sq(focus.text);
    const want = /number/i.test(focus.kind) ? "numbers" : /weak/i.test(focus.kind) ? "verbs" : "";
    const it = live.filter((x) => x.kind === "numbers" || x.kind === "verbs").sort((a) => (a.kind === want ? -1 : 1))
      .find((x) => (x as Extract<ReviewItem, { bullets: BulletRef[] }>).bullets.some((b) => line.includes(sq(b.text).slice(0, 40))));
    if (!it) return;
    const b = (it as Extract<ReviewItem, { bullets: BulletRef[] }>).bullets.find((x) => line.includes(sq(x.text).slice(0, 40)))!;
    setFrozen((f) => (f[keyOf(it)] ? f : { ...f, [keyOf(it)]: it }));
    setJump({ key: keyOf(it), id: b.id, n: focus.n });
  }, [focus?.n]);
  return (
    <section className={beside ? "stack" : "card card-pad stack"} data-testid="resume-review">
      <div className="stack-sm" style={{ gap: 4 }}>
        <h3 className={owner && beside ? "row" : undefined} style={owner && beside ? { gap: 8, flexWrap: "nowrap" } : undefined}>{owner && beside && <Remy size={28} mood={count ? "think" : "happy"} />}{beside ? (count ? `${count} thing${count > 1 ? "s" : ""} to make it stronger` : "Looking strong") : count ? `Remy's review · ${count} thing${count > 1 ? "s" : ""} to fix` : "Remy's review · looking good"}</h3>
        <span className="xs muted">{owner && beside && count ? "I'll ask about one line at a time and draft it from your answer. Nothing changes until you save." : beside ? "Fix them right here, or just ask Remy in the chat. Nothing changes until you save." : "Remy's suggestions from your resume itself, not an employer's score. Fix them here; nothing changes until you press Save."}</span>
      </div>
      {todo.map((it) => <Item key={keyOf(it)} it={it} open={!!frozen[keyOf(it)]} onToggle={() => toggle(it)} doc={doc} upd={upd} onEdit={onEdit} oneAtATime={owner} jumpTo={jump?.key === keyOf(it) ? jump : null} />)}
      {good.length > 0 && (
        <div className="stack-sm" style={{ gap: 4 }} data-testid="review-good">
          {good.map((g) => <span key={g} className="xs row" style={{ gap: 6, flexWrap: "nowrap" }}><CheckCircle2 size={14} style={{ color: "var(--success, #22a05a)", flex: "none" }} /> {g}</span>)}
        </div>
      )}
    </section>
  );
}

function Item({ it, open, onToggle, doc, upd, onEdit, oneAtATime = false, jumpTo }: { it: ReviewItem; open: boolean; onToggle: () => void; doc: ResumeDoc; upd: Upd; onEdit: () => void; oneAtATime?: boolean; jumpTo?: { id: string; n: number } | null }) {
  // Owners (Nov 23 live test: 8 question cards stacked into a long column): Remy asks about one line at a time.
  const [at, setAt] = useState(0);
  const lines = "bullets" in it ? it.bullets : [];
  useEffect(() => { if (jumpTo) { const i = lines.findIndex((b) => b.id === jumpTo.id); if (i >= 0) setAt(i); } }, [jumpTo?.n]);
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

function BulletFix({ b, kind, upd, onNext }: { b: BulletRef; kind: "numbers" | "verbs"; upd: Upd; onNext?: () => void }) {
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
  if (done) return <span className="xs row" style={{ gap: 6 }}><Check size={14} /> Updated. Press Save when you're done.{onNext && <button className="btn btn-secondary btn-sm" onClick={onNext} data-testid="button-review-next">Next line <ArrowRight size={14} /></button>}</span>;
  // Enter drafts, like any one-line question (Nov 23 live test: Enter did nothing).
  const enter = (ok: boolean) => (e: KeyboardEvent) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && ok && !busy) { e.preventDefault(); ask(); } };
  return (
    <div className="card card-pad stack-sm" style={{ boxShadow: "none", padding: 10 }} data-testid="bullet-fix">
      <span className="xs muted">{b.where}</span>
      <span className="small">“{b.text}”</span>
      {!draft && kind === "numbers" && (
        <>
          <span className="xs">Is there a real number here? How many people, events, dollars, hours or percent. Only if you know it.</span>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. 40 members, $5,000" aria-label="The real number" onKeyDown={enter(/\d/.test(answer))} data-testid="input-bullet-number" />
            <button className="btn btn-secondary btn-sm" disabled={busy || !/\d/.test(answer)} onClick={ask} data-testid="button-draft-bullet">{busy ? <Spinner /> : <Sparkles size={14} />} Draft</button>
          </div>
        </>
      )}
      {!draft && kind === "verbs" && (
        <>
          <span className="xs">What exactly did you do here? A few words in your own terms.</span>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. wrote and scheduled the posts" aria-label="What you did" onKeyDown={enter(answer.trim().length >= 4)} data-testid="input-bullet-action" />
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
