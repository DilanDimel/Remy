// Redesign stage 3 (owners first, Nov 21, 2026): the whole resume on one page, colour-coded like the reference the team
// shared (action words, hard skills, soft skills, numbers, results), with every problem marked on its own line and one
// "Things to fix" list beside it. The checks are Remy's existing ones (shared/bullets.ts, shared/review.ts); the colours
// only show what's already in the student's words, nothing is added or guessed.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ResumeDoc, ResumeStyle } from "@shared/types";
import { QUANT, WEAK, isAction, isListSection } from "@shared/bullets";
import { reviewResume, type BulletRef } from "@shared/review";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { BulletFix } from "./ResumeReview";
import { Remy } from "./common";
import { closeRemy } from "../lib/tailorChat";
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
/** The line with its tags, the last word and the tags kept together so a tag never wraps onto a line by itself. */
function tagged(text: string, flags: ReactNode[], tools: RegExp, on: Set<Cat>): ReactNode {
  if (!flags.length) return marked(text, tools, on);
  const k = text.trimEnd().lastIndexOf(" ") + 1;
  if (k <= 0 || ranges(text, tools).some(([s, e]) => s < k && e > k)) return <span className="rm-tail">{marked(text, tools, on)}{flags}</span>;
  return <>{marked(text.slice(0, k), tools, on)}<span className="rm-tail">{marked(text.slice(k), tools, on)}{flags}</span></>;
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
const PAGE_W = 1000; // the drawn page's layout width (CSS px, unzoomed): its column at 1440 with Remy's panel closed
const zoomOf = (el: Element) => (el as Element & { currentCSSZoom?: number }).currentCSSZoom || 1;
type Step = { b: BulletRef; kind: "numbers" | "verbs" };
const sq = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

/** `upd`: Remy walks the flagged lines one at a time right on the page, his question under each line (owners). */
export function ResumeMarkup({ doc, onFix, plain = false, look, side, real, upd }: { doc: ResumeDoc; onFix: (where: "review" | "edit", line?: { text: string; kind: string }) => void; plain?: boolean; look?: ResumeStyle; side?: ReactNode | ((walk: () => void) => ReactNode); real?: (on: Set<Cat>) => ReactNode; upd?: (fn: (d: ResumeDoc) => void) => void }) {
  const [on, setOn] = useState<Set<Cat>>(new Set(plain ? [] : CATS.map(([c]) => c)));
  const tools = useMemo(() => toolsRegex(doc), [doc.skills]);
  const ownFile = real?.(on) ?? null;
  const review = useMemo(() => reviewResume(doc, { listLike: true }), [doc]); // owners' page: certifications listed like skills need no dates
  // Tap a highlight or a flag: Remy's reason and what to change, beside the tap.
  const [why, setWhy] = useState<{ kind: string; text: string; line: string; x: number; y: number } | null>(null);
  const tap = (target: EventTarget | null, x: number, y: number) => {
    if (plain) return false;
    const el = (target as Element | null)?.closest?.("mark, .rm-flag, .rr-hl") as HTMLElement | null;
    if (!el) { setWhy(null); return false; }
    const flag = el.classList.contains("rm-flag");
    const cat = [...el.classList].find((k) => /^rm-(action|hard|soft|number|result)$/.test(k))?.slice(3);
    const text = el.dataset.t || el.textContent || "";
    const kinds = flag ? text.split(" · ").map((t) => t.trim()) : [cat || ""];
    // Placed inside the page body, so the popover scrolls with its line (Dilan, Nov 23: "it moves with it"). Units are
    // the body's own pixels: the app shell is zoomed, screen pixels are divided by that zoom.
    const h = body.current!.getBoundingClientRect(), z = zoomOf(body.current!);
    const left = Math.max(0, Math.min((x - h.left) / z, h.width / z - 328)), below = y + 290 <= window.innerHeight;
    setWhy({ kind: kinds.join("|"), text: flag ? "" : text, line: el.closest("li, p")?.textContent || "", x: left, y: (y - h.top) / z + (below ? 14 : -290) });
    return true;
  };
  const onTap = (e: React.MouseEvent) => { if (tap(e.target, e.clientX, e.clientY)) { e.preventDefault(); e.stopPropagation(); } };
  const body = useRef<HTMLDivElement>(null);
  // Desktop: the drawn page is laid out at one fixed width and scaled to fit, so opening Remy's panel shrinks it like
  // a page instead of re-wrapping every line (Demetre, Nov 24). Phones keep the wrapping layout.
  const paper = useRef<HTMLElement>(null);
  useEffect(() => {
    const host = body.current, el = paper.current;
    if (!host || !el) return;
    const fit = () => {
      el.style.zoom = "";
      if (!matchMedia("(min-width: 761px)").matches) return;
      const col = el.getBoundingClientRect().width / zoomOf(host);
      el.style.zoom = String(Math.min(1.25, col / PAGE_W));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [!!ownFile]);
  useEffect(() => { // taps inside the Word-file frame (ResumeReal) arrive as "rr-tap"
    const el = body.current; if (!el) return;
    const on = (e: Event) => { const d = (e as CustomEvent).detail; tap(d.el, d.x, d.y); };
    el.addEventListener("rr-tap", on); return () => el.removeEventListener("rr-tap", on);
  });
  // Remy's walk through the flagged lines, asked on the resume itself (Dilan, Nov 23: "not through chat bot ... on the
  // literally resume"). The list is fixed when the walk starts, so a line stays in it after its fix.
  const [walk, setWalk] = useState<{ list: Step[]; i: number } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const startWalk = (line = "") => {
    const list: Step[] = doc.sections.filter((s) => !isListSection(s.heading, true)).flatMap((s) => s.entries.flatMap((e) => e.bullets.flatMap((b): Step[] => {
      const p = b.text.trim() ? issues(b.text) : [];
      const kind = p.includes("No number") ? "numbers" : p.includes("Starts weak") ? "verbs" : null;
      return kind ? [{ b: { id: b.id, text: b.text.trim().replace(/^[•\-–*]\s*/, ""), where: [e.role, e.org].filter(Boolean).join(", ") || s.heading }, kind }] : [];
    })));
    if (!list.length) return;
    closeRemy(); // Remy is on the resume now, so his side panel makes room (Demetre, Nov 24)
    setWalk({ list, i: Math.max(0, list.findIndex((x) => sq(line).includes(sq(x.b.text).slice(0, 40)))) });
  };
  const cur = walk?.list[walk.i];
  const scrolledTo = useRef("");
  useEffect(() => {
    if (!cur) { setPos(null); return; }
    let lit: HTMLElement | null = null;
    const place = () => {
      const host = body.current; if (!host) return;
      const live = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).find((x) => x.id === cur.b.id)?.text ?? cur.b.text;
      const key = sq(live).slice(0, 40);
      const frame = host.querySelector<HTMLIFrameElement>("iframe.rr-frame");
      const pdf = host.querySelector<HTMLElement>(".rr-pdf");
      const paper = (frame || host.querySelector(".rm-paper") || pdf)?.getBoundingClientRect();
      // Their own PDF (page images): the line's flag tag marks where the line ends (Nov 24: the walk never showed there).
      const el = frame?.contentDocument
        ? Array.from(frame.contentDocument.querySelectorAll<HTMLElement>("p")).find((p) => sq(p.textContent || "").includes(key)) ?? null
        : pdf ? Array.from(pdf.querySelectorAll<HTMLElement>(".rr-flag")).find((f) => sq(f.dataset.line || "") === sq(cur.b.text) || sq(f.dataset.line || "") === sq(live)) ?? null
        : host.querySelector<HTMLElement>(`[data-bid="${cur.b.id}"]`);
      if (!el || !paper) return pdf ? undefined : setPos(null); // a fixed line loses its flag on the PDF: stay put
      if (frame && lit !== el) { // the frame runs no scripts and has its own styles: mark the line from here
        if (lit) lit.style.outline = "";
        el.style.outline = `2px solid ${getComputedStyle(document.documentElement).getPropertyValue("--fox")}`; el.style.outlineOffset = "2px"; lit = el;
      }
      // All in the body's own pixels: screen pixels over the shell's zoom. Rects inside the frame are already in them.
      const r = el.getBoundingClientRect(), h = host.getBoundingClientRect(), z = zoomOf(host);
      const px = (paper.left - h.left) / z, pw = paper.width / z;
      const top = frame ? (paper.top - h.top) / z + r.bottom + 6 : (r.bottom - h.top) / z + 6;
      const lineLeft = frame ? px + r.left : pdf ? px : (r.left - h.left) / z;
      const width = Math.min(540, pw - 16);
      const left = Math.max(px + 8, Math.min(lineLeft, px + pw - width - 8));
      setPos((p) => (p && Math.abs(p.top - top) < 1 && Math.abs(p.left - left) < 1 && p.width === width ? p : { top, left, width }));
    };
    place();
    const t = setInterval(place, 400); // shortcut: polls, because the Word frame redraws by itself after each change; fine for one open walk
    return () => { clearInterval(t); if (lit) lit.style.outline = ""; };
  }, [cur?.b.id, walk?.i, doc]);
  const coach = useRef<HTMLDivElement>(null);
  useEffect(() => { // bring each new question into view, whatever scrolls the page
    if (!pos || !walk || scrolledTo.current === cur!.b.id + walk.i) return;
    scrolledTo.current = cur!.b.id + walk.i;
    coach.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pos, walk?.i]);
  const step = (d: number) => setWalk((w) => (w && w.i + d >= 0 && w.i + d < w.list.length ? { ...w, i: w.i + d } : null));
  const bullets = doc.sections.filter((s) => !isListSection(s.heading, true)).flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.text))).filter((t) => t.trim());
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
        {upd && !walk && <button className="btn btn-primary btn-sm rm-walk-start" onClick={() => startWalk()} data-testid="button-walk-start">Fix with Remy, line by line</button>}
      </div>}
      <div className="rm-body" ref={body} onClick={onTap}>
        {ownFile ?? <article ref={paper} className="rm-paper" aria-label="Your resume, colour-coded" style={paperStyle(look)}>
          <h2 className="rm-name">{c.name || "Your name"}</h2>
          <p className="rm-contact">{[c.location, c.phone, c.email, c.links].filter((x) => x.trim()).join(" | ")}</p>
          {doc.sections.map((s) => (
            <Fragment key={s.id}>
              <h3 className="rm-head">{s.heading}</h3>
              {s.entries.map((e) => (
                <div key={e.id} className="rm-entry">
                  <div className="rm-row"><b>{e.org}</b><span>{e.location}</span></div>
                  <div className="rm-row rm-sub"><i>{e.role}</i><span>{e.dates || (plain || isListSection(s.heading, true) || !(e.role.trim() || e.org.trim()) ? null : <span className="rm-flag">No dates</span>)}</span></div>
                  <ul>
                    {e.bullets.filter((b) => b.text.trim()).map((b) => {
                      const probs = plain || isListSection(s.heading, true) ? [] : issues(b.text);
                      return (
                        <li key={b.id} data-bid={b.id} className={(probs.length ? "rm-has-issue" : "") + (cur?.b.id === b.id ? " rm-coach-line" : "")}>
                          {tagged(b.text.replace(/^[•\-–*]\s*/, ""), probs.map((p) => <button key={p} className="rm-flag" title="Why?" data-testid="rm-flag">{p}</button>), tools, on)}
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
        {walk && cur && pos && upd && (
          <div ref={coach} className="rm-coach" style={{ top: pos.top, left: pos.left, width: pos.width }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Remy's question about this line" data-testid="rm-coach">
            <div className="row-between" style={{ gap: 8, flexWrap: "nowrap" }}>
              <span className="row small" style={{ gap: 8, flexWrap: "nowrap" }}><Remy size={26} mood="think" /><b>Let's make this line stronger</b></span>
              <span className="row xs muted" style={{ gap: 2, flexWrap: "nowrap", flex: "none" }}>
                {walk.i + 1} of {walk.list.length}
                <button className="btn btn-ghost btn-sm" onClick={() => step(-1)} disabled={walk.i === 0} aria-label="Previous line" data-testid="button-walk-prev"><ArrowLeft size={14} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => step(1)} disabled={walk.i === walk.list.length - 1} aria-label="Skip this line" data-testid="button-walk-skip"><ArrowRight size={14} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setWalk(null)} aria-label="Stop" data-testid="button-walk-stop"><X size={14} /></button>
              </span>
            </div>
            <BulletFix key={cur.b.id + walk.i} b={cur.b} kind={cur.kind} upd={upd} autoFocus compact onNext={walk.i < walk.list.length - 1 ? () => step(1) : () => setWalk(null)} />
          </div>
        )}
        {why && (
          <div className="rm-why" role="dialog" aria-label="Why Remy marked this" style={{ left: why.x, top: Math.max(0, why.y), position: "absolute" }} onClick={(e) => e.stopPropagation()} data-testid="rm-why">
            {why.kind.split("|").map((k) => { const x = explain(k, why.text); return (
              <div key={k} className="stack-sm">
                <b>{x.title}</b>
                <span className="small">{x.body}</span>
                {x.alt && <span className="small"><b>Try:</b> {x.alt}</span>}
              </div>
            ); })}
            <div className="row" style={{ gap: 6 }}>
              {why.kind.split("|").some((k) => explain(k, "").fix) && <button className="btn btn-primary btn-sm" onClick={() => { setWhy(null); if (upd) startWalk(why.line); else onFix("review", { text: why.line, kind: why.kind }); }} data-testid="button-why-fix">Fix with Remy</button>}
              {why.kind === "No dates" && <button className="btn btn-primary btn-sm" onClick={() => { setWhy(null); onFix("edit"); }} data-testid="button-why-edit">Add dates</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setWhy(null)} data-testid="button-why-close">Close</button>
            </div>
          </div>
        )}
        {!plain && side && <aside className="rm-side rm-side-review" aria-label="What to fix">{typeof side === "function" ? side(() => startWalk()) : side}</aside>}
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
