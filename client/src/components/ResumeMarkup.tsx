// Redesign stage 3 (owners first, Nov 21, 2026): the whole resume on one page, colour-coded like the reference the team
// shared (action words, hard skills, soft skills, numbers, results), with every problem marked on its own line and one
// "Things to fix" list beside it. The checks are Remy's existing ones (shared/bullets.ts, shared/review.ts); the colours
// only show what's already in the student's words, nothing is added or guessed.
import { Fragment, useMemo, useState, type ReactNode } from "react";
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

type Cat = "action" | "hard" | "soft" | "number" | "result";
const CATS: [Cat, string][] = [["action", "Action words"], ["hard", "Hard skills & tools"], ["soft", "Soft skills"], ["number", "Numbers"], ["result", "Results"]];
// Common tools students list; the student's own Skills section is added on top of these.
const TOOLS = ["Excel", "PowerPoint", "Word", "Outlook", "Google Sheets", "Google Slides", "G-Suite", "Microsoft Office", "SQL", "Python", "R", "Java", "JavaScript", "TypeScript", "C\\+\\+", "Tableau", "Power BI", "Salesforce", "HubSpot", "QuickBooks", "Bloomberg", "Capital IQ", "FactSet", "SAP", "Oracle", "Jira", "Figma", "Canva", "Adobe", "Photoshop", "AutoCAD", "SolidWorks", "MATLAB", "Zendesk", "CRM", "VBA", "DCF", "financial model\\w*", "pivot tables?"];
const SOFT = /\b(communicat\w*|collaborat\w*|cross-functional\w*|team(?:work|s)?|leadership|led|mentor\w*|present\w*|negotiat\w*|problem[- ]solving|organiz\w*|coordinat\w*|customer service|public speaking|interpersonal|adaptab\w*|time management|partner\w*)\b/gi;
const NUMBER = /(?:\$\s?\d[\d,.]*\s?[kKmMbB]?\+?|\b\d[\d,.]*\+?%?|\b\d+(?:st|nd|rd|th)\b|#\d+)/g;
const RESULT = /\b(increas|reduc|improv|grow|grew|sav|rais|boost|cut|doubl|tripl|exceed|generat|drove|achiev)\w*\b[^.;]{0,70}?\b(?:by|to|over)\s+[$#]?\d[\d,.]*\+?%?[^.;,]{0,30}/gi;

type Range = [number, number, Cat];
function ranges(text: string, tools: RegExp): Range[] {
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
function issues(text: string): string[] {
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
export function ResumeMarkup({ doc, onFix, plain = false, look, side }: { doc: ResumeDoc; onFix: (where: "review" | "edit") => void; plain?: boolean; look?: ResumeStyle; side?: ReactNode }) {
  const [on, setOn] = useState<Set<Cat>>(new Set(plain ? [] : CATS.map(([c]) => c)));
  const tools = useMemo(() => {
    const own = doc.skills.flatMap((k) => splitList(k.items)).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`\\b(?:${[...own, ...TOOLS].join("|")})\\b`, "gi");
  }, [doc.skills]);
  const review = useMemo(() => reviewResume(doc), [doc]);
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
      <div className="rm-body">
        <article className="rm-paper" aria-label="Your resume, colour-coded" style={paperStyle(look)}>
          <h2 className="rm-name">{c.name || "Your name"}</h2>
          <p className="rm-contact">{[c.location, c.phone, c.email, c.links].filter((x) => x.trim()).join(" | ")}</p>
          {doc.sections.map((s) => (
            <Fragment key={s.id}>
              <h3 className="rm-head">{s.heading}</h3>
              {s.entries.map((e) => (
                <div key={e.id} className="rm-entry">
                  <div className="rm-row"><b>{e.org}</b><span>{e.location}</span></div>
                  <div className="rm-row rm-sub"><i>{e.role}</i><span>{e.dates || (plain ? null : <span className="rm-flag">No dates</span>)}</span></div>
                  <ul>
                    {e.bullets.filter((b) => b.text.trim()).map((b) => {
                      const probs = plain || isListSection(s.heading) ? [] : issues(b.text);
                      return (
                        <li key={b.id} className={probs.length ? "rm-has-issue" : ""}>
                          {marked(b.text.replace(/^[•\-–*]\s*/, ""), tools, on)}
                          {probs.map((p) => <button key={p} className="rm-flag" onClick={() => onFix("review")} title="Fix with Remy">{p}</button>)}
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
        </article>
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
