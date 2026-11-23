// Redesign stage 3 (owners first, Nov 21, 2026): the whole resume on one page, colour-coded like the reference the team
// shared (action words, hard skills, soft skills, numbers, results), with every problem marked on its own line and one
// "Things to fix" list beside it. The checks are Remy's existing ones (shared/bullets.ts, shared/review.ts); the colours
// only show what's already in the student's words, nothing is added or guessed.
import { createPortal } from "react-dom";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ResumeDoc, ResumeStyle } from "@shared/types";
import { QUANT, WEAK, isAction, isListSection } from "@shared/bullets";
import { reviewResume } from "@shared/review";
import { splitList } from "@shared/words";

// The look of the student's own file (font, size, margins Remy read from it), so the page looks like theirs.
const FONTS: [RegExp, string][] = [
  [/garamond/i, 'Garamond, "EB Garamond", "Times New Roman", serif'], [/calibri|carlito/i, 'Calibri, Carlito, "Segoe UI", Arial, sans-serif'],
  [/cambria|caladea/i, 'Cambria, Caladea, Georgia, serif'], [/times/i, '"Times New Roman", Times, serif'], [/georgia/i, "Georgia, serif"],
  [/palatino|antiqua/i, '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif'], [/helvetica|arial|liberation ?sans/i, "Arial, Helvetica, sans-serif"],
  [/aptos/i, 'Aptos, Calibri, "Segoe UI", Arial, sans-serif'], [/roboto/i, "Roboto, Arial, sans-serif"], [/courier|mono|consolas/i, '"Courier New", Courier, monospace'],
];
export function paperStyle(st?: ResumeStyle): Record<string, string> | undefined {
  if (!st) return undefined;
  const named = st.font ? FONTS.find(([re]) => re.test(st.font!))?.[1] || `"${st.font.replace(/"/g, "")}", ${st.serif ? "Georgia, serif" : "Arial, sans-serif"}` : st.mono ? FONTS[9][1] : st.serif ? '"Times New Roman", Georgia, serif' : "Arial, Helvetica, sans-serif";
  // Points to screen pixels (96/72); a Letter page is 8.5in = 816px wide.
  return { fontFamily: named, fontSize: `${(st.size * 4) / 3}px`, padding: `${Math.round((st.margin * 4) / 3 * 0.75)}px ${Math.round((st.margin * 4) / 3)}px` };
}

export type Cat = "action" | "hard" | "soft" | "number" | "result";
export const CATS: [Cat, string][] = [["action", "Action words"], ["hard", "Hard skills & tools"], ["soft", "Soft skills"], ["number", "Numbers"], ["result", "Results"]];
// Common tools students list; the student's own Skills section is added on top of these.
const TOOLS = ["Excel", "PowerPoint", "Word", "Outlook", "Google Sheets", "Google Slides", "G-Suite", "Microsoft Office", "SQL", "Python", "R", "Java", "JavaScript", "TypeScript", "C\\+\\+", "Tableau", "Power BI", "Salesforce", "HubSpot", "QuickBooks", "Bloomberg", "Capital IQ", "FactSet", "SAP", "Oracle", "Jira", "Figma", "Canva", "Adobe", "Photoshop", "AutoCAD", "SolidWorks", "MATLAB", "Zendesk", "CRM", "VBA", "DCF", "financial model\\w*", "pivot tables?"];
const SOFT = /\b(communicat\w*|collaborat\w*|cross-functional\w*|team(?:work|s)?|leadership|led|mentor\w*|present\w*|negotiat\w*|problem[- ]solving|organiz\w*|coordinat\w*|customer service|public speaking|interpersonal|adaptab\w*|time management|partner\w*)\b/gi;
const NUMBER = /(?:\$\s?\d[\d,.]*\s?[kKmMbB]?\+?|\b\d[\d,.]*\+?%?|\b\d+(?:st|nd|rd|th)\b|#\d+)/g;
const RESULT = /\b(increas|reduc|improv|grow|grew|sav|rais|boost|cut|doubl|tripl|exceed|generat|drove|achiev)\w*\b[^.;]{0,70}?\b(?:by|to|over)\s+[$#]?\d[\d,.]*\+?%?[^.;,]{0,30}/gi;

export type Range = [number, number, Cat];
export function ranges(text: string, tools: RegExp): Range[] {
  const out: Range[] = [];
  const add = (re: RegExp, cat: Cat) => { for (const m of text.matchAll(re)) out.push([m.index!, m.index! + m[0].length, cat]); };
  add(RESULT, "result");
  add(NUMBER, "number");
  const first = text.match(/^\s*([A-Za-z][\w-]*(?:\s+and\s+[A-Za-z][\w-]*)?)/);
  if (first && isAction(text.trim()) && !WEAK.test(text.trim())) out.push([first.index! + first[0].indexOf(first[1]), first.index! + first[0].length, "action"]);
  add(tools, "hard");
  add(SOFT, "soft");
  // Earlier entries win where they overlap (a result phrase keeps its number inside it; an action word beats a soft skill).
  const kept: Range[] = [];
  for (const r of out) if (!kept.some((k) => r[0] < k[1] && k[0] < r[1])) kept.push(r);
  return kept.sort((a, b) => a[0] - b[0]);
}
function marked(text: string, tools: RegExp, on: Set<Cat>): ReactNode {
  const rs = ranges(text, tools).filter((r) => on.has(r[2]));
  if (!rs.length) return text;
  const parts: ReactNode[] = [];
  let at = 0;
  rs.forEach(([s, e, c], i) => { if (s > at) parts.push(text.slice(at, s)); parts.push(<mark key={i} className={`rm-${c}`}>{text.slice(s, e)}</mark>); at = e; });
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
/** What a highlight or a flag means, for the explanation that opens when a student taps it (Dilan, Nov 22: "if I click
 *  on it I want to see what Remy wants me to change"). Only explains and suggests; nothing is written into the resume. */
const STRONGER: [RegExp, string][] = [
  [/^provid/i, "Delivered, Prepared, Supplied"], [/^(assist|help|support)/i, "Ran, Built, Prepared, Handled"], [/^manag/i, "Led, Ran, Oversaw"],
  [/^(work|did|do)\b/i, "Built, Ran, Analyzed"], [/^(responsible|tasked|in charge|duties)/i, "Led, Ran, Owned"], [/^handl/i, "Resolved, Processed, Ran"],
  [/^(use|utiliz)/i, "Built, Analyzed, Modeled"], [/^(participat|involv)/i, "Organized, Presented, Built"],
];
export function explain(kind: string, text: string): { title: string; body: string; alt?: string; fix?: boolean } {
  const word = text.trim().split(/\s+/)[0] || text;
  const alt = STRONGER.find(([re]) => re.test(word))?.[1];
  switch (kind) {
    case "action": return { title: `Action word: “${text.trim()}”`, body: "Good: the line starts with what you did, and recruiters scan the first word. The colour marks it as an action word, not a mistake.", alt: alt && `If it's true, a more specific word reads stronger: ${alt}.` };
    case "hard": return { title: `Hard skill or tool: “${text.trim()}”`, body: "Postings and resume filters look for these. Keep it where you really used it, and name what you did with it." };
    case "soft": return { title: `Soft skill: “${text.trim()}”`, body: "Recruiters believe a soft skill when a line shows it. Pair it with what happened, like a number or a result." };
    case "number": return { title: `Number: “${text.trim()}”`, body: "Numbers make a line easy to believe and easy to remember." };
    case "result": return { title: "Result", body: "This shows what changed because of you: the strongest kind of line." };
    case "No number": return { title: "No number", body: "This line has no number. If you know a real one (people, events, dollars, hours, percent), adding it makes the line easier to believe. Remy asks you for it and drafts the line; you approve every word. Only add a number you actually know.", fix: true };
    case "Starts weak": return { title: "Starts weak", body: "The line doesn't start with what you did (or starts with words like “Responsible for” or “Helped with”). Start with the action you took.", alt: alt && `If it's true: ${alt}.`, fix: true };
    case "Too short": return { title: "Too short", body: "Under 8 words usually leaves out what you did or what came of it. Add the how or the result.", fix: true };
    case "Too long": return { title: "Too long", body: "Over 32 words is hard to scan. Keep the action, the how and the result; cut the rest.", fix: true };
    case "No dates": return { title: "No dates", body: "Experience entries need dates so recruiters can see when you did them. Add them in Edit." };
    default: return { title: kind, body: "" };
  }
}

export function issues(text: string): string[] {
  const t = text.trim().replace(/^[•\-–*]\s*/, "");
  const out: string[] = [];
  if (!isAction(t) || WEAK.test(t)) out.push("Starts weak");
  if (!QUANT.test(t)) out.push("No number");
  const n = words(t);
  if (n < 8) out.push("Too short"); else if (n > 32) out.push("Too long");
  return out;
}

/** `plain`: just the page, no colours, tags or side list (the resume preview where a browser can't show the PDF). */
/** `side`: replaces the built-in "things to fix" list (stage 3 puts Remy's review with its inline fixes there). */
/** Hard skills to colour: the student's own Skills section plus common tools. */
export function toolsRegex(doc: ResumeDoc): RegExp {
  const own = doc.skills.flatMap((k) => splitList(k.items)).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${[...own, ...TOOLS].join("|")})\\b`, "gi");
}

/** `real`: draws the student's own file (with colours) in place of Remy's drawn page; null = use the drawn page. */
export function ResumeMarkup({ doc, onFix, plain = false, look, side, real }: { doc: ResumeDoc; onFix: (where: "review" | "edit") => void; plain?: boolean; look?: ResumeStyle; side?: ReactNode; real?: (on: Set<Cat>) => ReactNode }) {
  const [on, setOn] = useState<Set<Cat>>(new Set(plain ? [] : CATS.map(([c]) => c)));
  const tools = useMemo(() => toolsRegex(doc), [doc.skills]);
  const ownFile = real?.(on) ?? null;
  const review = useMemo(() => reviewResume(doc, { listLike: true }), [doc]); // owners' page: certifications listed like skills need no dates
  // Tap a highlight or a flag: Remy's reason and what to change, beside the tap.
  const [why, setWhy] = useState<{ kind: string; text: string; x: number; y: number } | null>(null);
  const tap = (target: EventTarget | null, x: number, y: number) => {
    if (plain) return false;
    const el = (target as Element | null)?.closest?.("mark, .rm-flag, .rr-hl") as HTMLElement | null;
    if (!el) { setWhy(null); return false; }
    const flag = el.classList.contains("rm-flag");
    const cat = [...el.classList].find((k) => /^rm-(action|hard|soft|number|result)$/.test(k))?.slice(3);
    const text = el.dataset.t || el.textContent || "";
    const kinds = flag ? text.split(" · ").map((t) => t.trim()) : [cat || ""];
    setWhy({ kind: kinds.join("|"), text: flag ? "" : text, x: Math.max(8, Math.min(x, (body.current?.getBoundingClientRect().right ?? window.innerWidth) - 328)), y: y + 290 > window.innerHeight ? Math.max(8, y - 290) : y + 14 });
    return true;
  };
  const onTap = (e: React.MouseEvent) => { if (tap(e.target, e.clientX, e.clientY)) { e.preventDefault(); e.stopPropagation(); } };
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { // taps inside the Word-file frame (ResumeReal) arrive as "rr-tap"
    const el = body.current; if (!el) return;
    const on = (e: Event) => { const d = (e as CustomEvent).detail; tap(d.el, d.x, d.y); };
    el.addEventListener("rr-tap", on); return () => el.removeEventListener("rr-tap", on);
  });
  const bullets = doc.sections.filter((s) => !isListSection(s.heading)).flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.text))).filter((t) => t.trim());
  const count = (c: Cat) => bullets.filter((b) => ranges(b, tools).some((r) => r[2] === c)).length;
  const flip = (c: Cat) => setOn((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const c = doc.contact;
  return (
    <section className={"rm" + (plain ? " rm-plain" : "")} data-testid={plain ? "resume-plain" : "resume-markup"}>
      {!plain && <div className="rm-legend" role="group" aria-label="Highlight">
        {CATS.map(([k, label]) => (
          <button key={k} className={`rm-key rm-${k}`} aria-pressed={on.has(k)} onClick={() => flip(k)} data-testid={`rm-key-${k}`}>
            {label} <b>{count(k)}/{bullets.length}</b>
          </button>
        ))}
      </div>}
      <div className="rm-body" ref={body} onClick={onTap}>
        {ownFile ?? <article className="rm-paper" aria-label="Your resume, colour-coded" style={paperStyle(look)}>
          <h2 className="rm-name">{c.name || "Your name"}</h2>
          <p className="rm-contact">{[c.location, c.phone, c.email, c.links].filter((x) => x.trim()).join(" | ")}</p>
          {doc.sections.map((s) => (
            <Fragment key={s.id}>
              <h3 className="rm-head">{s.heading}</h3>
              {s.entries.map((e) => (
                <div key={e.id} className="rm-entry">
                  <div className="rm-row"><b>{e.org}</b><span>{e.location}</span></div>
                  <div className="rm-row rm-sub"><i>{e.role}</i><span>{e.dates || (plain || isListSection(s.heading) ? null : <span className="rm-flag">No dates</span>)}</span></div>
                  <ul>
                    {e.bullets.filter((b) => b.text.trim()).map((b) => {
                      const probs = plain || isListSection(s.heading) ? [] : issues(b.text);
                      return (
                        <li key={b.id} className={probs.length ? "rm-has-issue" : ""}>
                          {marked(b.text.replace(/^[•\-–*]\s*/, ""), tools, on)}
                          {probs.map((p) => <button key={p} className="rm-flag" title="Why?" data-testid="rm-flag">{p}</button>)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </Fragment>
          ))}
          {doc.skills.length > 0 && (<>
            <h3 className="rm-head">Skills</h3>
            {doc.skills.map((k) => <p key={k.id} className="rm-skill"><b>{k.label ? k.label + ": " : ""}</b>{marked(k.items, tools, on)}</p>)}
          </>)}
        </article>}
        {why && createPortal( // on body: the page's fade-in transform would otherwise offset a fixed popover
          <div className="rm-why" role="dialog" aria-label="Why Remy marked this" style={{ left: why.x, top: why.y }} onClick={(e) => e.stopPropagation()} data-testid="rm-why">
            {why.kind.split("|").map((k) => { const x = explain(k, why.text); return (
              <div key={k} className="stack-sm">
                <b>{x.title}</b>
                <span className="small">{x.body}</span>
                {x.alt && <span className="small"><b>Try:</b> {x.alt}</span>}
              </div>
            ); })}
            <div className="row" style={{ gap: 6 }}>
              {why.kind.split("|").some((k) => explain(k, "").fix) && <button className="btn btn-primary btn-sm" onClick={() => { setWhy(null); onFix("review"); }} data-testid="button-why-fix">Fix with Remy</button>}
              {why.kind === "No dates" && <button className="btn btn-primary btn-sm" onClick={() => { setWhy(null); onFix("edit"); }} data-testid="button-why-edit">Add dates</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setWhy(null)} data-testid="button-why-close">Close</button>
            </div>
          </div>
        , document.body)}
        {!plain && side && <aside className="rm-side rm-side-review" aria-label="What to fix">{side}</aside>}
        {!plain && !side && <aside className="rm-side" aria-label="What to fix">
          <h3>{review.todo.length ? `${review.todo.length} thing${review.todo.length === 1 ? "" : "s"} to fix` : "Nothing big to fix"}</h3>
          {review.todo.map((t, i) => (
            <div key={i} className="rm-todo">
              <b>{t.title}</b>
              {"why" in t && <span className="xs muted">{t.why}</span>}
              <button className="btn btn-secondary btn-sm" onClick={() => onFix(t.kind === "contact" || t.kind === "dates" ? "edit" : "review")} data-testid="rm-fix">{t.kind === "contact" || t.kind === "dates" ? "Fix it" : "Fix with Remy"}</button>
            </div>
          ))}
          {review.good.length > 0 && <div className="rm-good">{review.good.map((g) => <span key={g} className="xs">✓ {g}</span>)}</div>}
          <p className="xs muted">Colours show what's already in your words; Remy never adds anything you didn't write.</p>
        </aside>}
      </div>
    </section>
  );
}
