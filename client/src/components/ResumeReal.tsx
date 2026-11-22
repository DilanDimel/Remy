// Redesign stage 3 (owners first): the colour-coded resume drawn on the student's REAL file, not a redraw.
// Dilan, Nov 21: "make sure the resume actually looks like the user's". Word files: their own .docx with every change
// written into it (server: /api/resume/current-docx), drawn in the page. PDFs: their own pages, with the colours laid
// over the words. When either can't be done, the caller falls back to Remy's drawn page and says why.
import { useEffect, useRef, useState } from "react";
import type { ResumeDoc } from "@shared/types";
import { isListSection } from "@shared/bullets";
import { API_BASE } from "../lib/store";
import { Spinner } from "./common";
import { issues, ranges, toolsRegex, type Cat } from "./ResumeMarkup";

/** Letters and digits only, so a bullet matches its file line despite spacing, dashes or quotes. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const norm = (s: string) => s.replace(/^[\s•●▪◦*–-]+/, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const CAT_VARS: Cat[] = ["action", "hard", "soft", "number", "result"];
/** The paper highlight colours from the app's own tokens (light in both themes: the file is white paper). */
function palette(): Record<Cat | "flag", string> {
  const css = getComputedStyle(document.documentElement);
  const out = {} as Record<Cat | "flag", string>;
  for (const c of CAT_VARS) out[c] = css.getPropertyValue(`--paper-hl-${c}`).trim();
  out.flag = css.getPropertyValue("--error").trim();
  return out;
}
/** `all`: every section's lines (colours go everywhere); otherwise only the sections whose lines get problem tags. */
function bulletsOf(doc: ResumeDoc, all = false) {
  return doc.sections.filter((s) => all || !isListSection(s.heading)).flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.text.replace(/^[•\-–*]\s*/, "")))).filter((t) => t.trim());
}

/** Wraps the coloured words of every bullet paragraph (and Skills line) inside the drawn Word file, and adds its tags. */
function colourWord(root: HTMLElement, doc: ResumeDoc, on: Set<Cat>) {
  const tools = toolsRegex(doc);
  const bullets = bulletsOf(doc, true).map(squash).filter((b) => b.length > 8);
  const tagged = new Set(bulletsOf(doc).map(squash));
  // Same line, or (for long lines only) one holding the other: a short heading never matches part of a bullet.
  const same = (a: string, b: string) => a === b || (a.length > 30 && b.length > 30 && (a.includes(b) || b.includes(a)));
  const skills = doc.skills.map((k) => squash(k.items)).filter(Boolean);
  for (const p of Array.from(root.querySelectorAll("p"))) {
    const text = p.textContent || "";
    const key = squash(text);
    if (key.length < 8) continue;
    const isBullet = bullets.some((b) => same(b, key)), isSkill = !isBullet && skills.some((k) => key.endsWith(k));
    if (!isBullet && !isSkill) continue;
    const rs = ranges(text, tools).filter((r) => on.has(r[2]) && (isBullet || r[2] === "hard"));
    // Walk the text nodes (Word splits a line into runs) and wrap each coloured span where it falls.
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const nodes: { n: Text; s: number }[] = [];
    let at = 0;
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) { nodes.push({ n, s: at }); at += n.data.length; }
    for (const [s, e, c] of [...rs].reverse()) {
      for (const { n, s: ns } of [...nodes].reverse()) {
        const a = Math.max(s, ns), b = Math.min(e, ns + n.data.length);
        if (a >= b) continue;
        const r = document.createRange();
        r.setStart(n, a - ns); r.setEnd(n, b - ns);
        const m = document.createElement("mark");
        m.className = `rm-${c}`;
        r.surroundContents(m);
      }
    }
    if (isBullet && [...tagged].some((b) => same(b, key))) for (const t of issues(text)) {
      const f = document.createElement("span");
      f.className = "rm-flag"; f.textContent = t;
      p.appendChild(f);
    }
  }
}

// Office fonts most computers have, each with look-alikes for ones that don't (Calibri → Carlito, etc.).
const FALLBACK: [RegExp, string][] = [
  [/calibri/i, "Carlito, 'Segoe UI', Arial, sans-serif"], [/cambria/i, "Caladea, Georgia, serif"], [/times/i, "'Liberation Serif', 'Times New Roman', serif"],
  [/arial|helvetica/i, "'Liberation Sans', Arial, sans-serif"], [/garamond/i, "'EB Garamond', Georgia, serif"], [/georgia/i, "Georgia, serif"], [/aptos/i, "Calibri, Carlito, Arial, sans-serif"],
];
/** Draws a Word file in the page the way the student made it: on the live page (so right-aligned tab stops such as
 *  dates line up, which needs real layout), then lifted out as HTML. Each font gets look-alike fallbacks. */
export async function drawDocx(blob: Blob): Promise<{ body: HTMLElement; styles: HTMLElement }> {
  const { renderAsync } = await import("docx-preview");
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;visibility:hidden;pointer-events:none";
  const body = document.createElement("div"), styles = document.createElement("div");
  host.append(styles, body);
  document.body.appendChild(host);
  try {
    await renderAsync(blob, body, styles, { inWrapper: true, ignoreLastRenderedPageBreak: false, renderHeaders: true, renderFooters: true, useBase64URL: true, experimental: true });
    // Fonts first, so the tab stops below are measured with the fonts the page will really show.
    const withFallback = (css: string) => css.replace(/font-family:\s*([^;"}]+)/g, (m, fam: string) => {
      const f = FALLBACK.find(([re]) => re.test(fam));
      return f && !/sans-serif|serif\s*$/.test(fam.trim()) ? `font-family: ${fam.trim()}, ${f[1]}` : m;
    });
    for (const s of Array.from(styles.querySelectorAll("style"))) s.textContent = withFallback(s.textContent || "");
    for (const el of Array.from(body.querySelectorAll<HTMLElement>("[style*='font-family']"))) el.setAttribute("style", withFallback(el.getAttribute("style") || ""));
    // The library lines up tab stops 500 ms after drawing (it measures the live page), so wait for that first.
    await new Promise((r) => setTimeout(r, 650));
    // Text after the last tab that was meant to sit on the right margin (dates, places) is pinned there exactly, since
    // tab widths measured here can differ slightly from what the page shows (fonts, zoom): straight right edges.
    for (const p of Array.from(body.querySelectorAll("p"))) {
      const tabs = Array.from(p.querySelectorAll<HTMLElement>("span[style*='word-spacing']"));
      const last = tabs[tabs.length - 1];
      if (!last) continue;
      const pr = p.getBoundingClientRect(), range = document.createRange();
      range.setStartAfter(last); range.setEndAfter(p.lastChild!);
      const rr = range.getBoundingClientRect();
      if (!rr.width || Math.abs(pr.right - parseFloat(getComputedStyle(p).paddingRight || "0") - rr.right) > 60 || rr.height > pr.height * 0.75 + 4 && rr.top < pr.top - 2) continue;
      const right = document.createElement("span");
      right.style.cssText = "float:right";
      right.appendChild(range.extractContents());
      last.style.wordSpacing = "0";
      p.appendChild(right);
    }
  } finally {
    host.remove();
  }
  return { body, styles };
}

export function OwnWordColoured({ doc, version, on, onFail }: { doc: ResumeDoc; version: string; on: Set<Cat>; onFail: (why: string) => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [height, setHeight] = useState(900);
  const key = [...on].sort().join(",");
  useEffect(() => {
    let live = true;
    const slow = setTimeout(() => { if (live) onFail("slow"); }, 15_000);
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/resume/current-docx?v=${encodeURIComponent(version)}`, { credentials: "include" });
        if (r.status === 409) throw new Error("missed");
        if (!r.ok) throw new Error(String(r.status));
        const { body, styles } = await drawDocx(await r.blob());
        colourWord(body, doc, on);
        const c = palette();
        const css = `<style>html,body{margin:0;background:transparent;overflow:hidden}.docx-wrapper{background:transparent!important;padding:0!important}.docx-wrapper>section.docx{box-shadow:0 1px 6px rgba(0,0,0,.15)!important;margin:0 auto 12px!important}
          ${CAT_VARS.map((k) => `mark.rm-${k}{background:${c[k]};color:inherit;padding:0;border-radius:2px}`).join("")}
          .rm-flag{display:inline-block;margin-left:6px;padding:0 6px;border-radius:999px;font:600 7pt/1.5 system-ui,sans-serif;vertical-align:1px;color:${c.flag};border:1px solid currentColor;text-indent:0}</style>`;
        clearTimeout(slow);
        if (live) setHtml(`<!doctype html><html><head><meta charset="utf-8">${styles.innerHTML}${css}</head><body>${body.innerHTML}</body></html>`);
      } catch (e) {
        clearTimeout(slow);
        if (live) onFail((e as Error).message === "missed" ? "missed" : "unreadable");
      }
    })();
    return () => { live = false; clearTimeout(slow); };
  }, [version, key, JSON.stringify(doc)]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1.25, el.clientWidth / 830));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [html]);
  if (!html) return <div className="pdf-preview row" style={{ justifyContent: "center" }}><Spinner /> Drawing your resume…</div>;
  // No scripts run in the frame; same-origin only so the page can measure its height and show it all, no inner scroll.
  return (
    <div ref={box} className="rr-frame-box">
      <iframe ref={frame} className="rr-frame" sandbox="allow-same-origin" style={{ height }} title="Your resume, colour-coded on your own file" data-testid="resume-real-word"
        srcDoc={html.replace("</head>", `<style>body{zoom:${zoom.toFixed(3)}}</style></head>`)}
        onLoad={() => { const d = frame.current?.contentDocument; if (d) setHeight(Math.ceil(d.documentElement.scrollHeight) + 4); }} />
    </div>
  );
}

type Box = { left: number; top: number; width: number; height: number; cat?: Cat; flag?: string };
/** Their PDF's own pages as images, with the colours placed over the words (positions from the PDF's text). */
export function OwnPdfColoured({ doc, on, onFail }: { doc: ResumeDoc; on: Set<Cat>; onFail: (why: string) => void }) {
  const [pages, setPages] = useState<{ img: string; w: number; h: number; boxes: Box[] }[] | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ getDocumentProxy }, r] = await Promise.all([import("unpdf"), fetch(`${API_BASE}/api/resume/original`, { credentials: "include" })]);
        if (!r.ok) throw new Error(String(r.status));
        const pdf = await getDocumentProxy(new Uint8Array(await r.arrayBuffer()));
        const tools = toolsRegex(doc);
        const bullets = bulletsOf(doc, true).map(norm);
        const out: { img: string; w: number; h: number; boxes: Box[] }[] = [];
        for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
          const page = await pdf.getPage(n);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width; canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas } as any).promise;
          const tc = await page.getTextContent();
          const styles = (tc as any).styles || {};
          const meas = document.createElement("canvas").getContext("2d")!;
          const t = vp.transform as number[];
          const boxes: Box[] = [];
          for (const it of tc.items as any[]) {
            const str: string = it.str || "";
            if (!str.trim()) continue;
            const [, , c, d, e, f] = it.transform as number[];
            const x = t[0] * e + t[2] * f + t[4], y = t[1] * e + t[3] * f + t[5];
            const h = Math.hypot(c, d) * 2, w = (it.width || 0) * 2;
            const k = norm(str);
            // Colour only lines that are part of a bullet in the resume (not headers, dates or contact details).
            const inBullet = k.length > 3 && bullets.some((b) => b.includes(k));
            if (!inBullet) continue;
            const starts = bullets.some((b) => b.startsWith(k));
            // Where a word sits inside the line: measured in the line's own font family, scaled to the PDF's width.
            const fam = styles[it.fontName]?.fontFamily || "serif";
            meas.font = `${h}px ${fam}`;
            const full = meas.measureText(str).width || 1;
            const xAt = (i: number) => (meas.measureText(str.slice(0, i)).width / full) * w;
            for (const [s, en, cat] of ranges(str, tools)) {
              if (cat === "action" && !starts) continue;
              boxes.push({ left: x + xAt(s), top: y - h * 0.95, width: xAt(en) - xAt(s), height: h * 1.2, cat });
            }
            const ends = bulletsOf(doc).find((b) => k.length > 6 && norm(b).endsWith(k));
            const probs = ends ? issues(ends) : [];
            if (probs.length) {
              // One tag per line, after the line when it fits, else in the left margin, so it never covers words.
              const flag = probs.join(" · "), need = flag.length * 8.5 + 24;
              const left = x + w + 8 + need < vp.width - 8 ? x + w + 8 : x - 8 - need > 4 ? x - 8 - need : Math.max(4, vp.width - need - 8);
              boxes.push({ left, top: y - h * 0.95, width: 0, height: h * 1.2, flag });
            }
          }
          out.push({ img: canvas.toDataURL("image/png"), w: vp.width, h: vp.height, boxes });
        }
        if (live) setPages(out);
      } catch {
        if (live) onFail("unreadable");
      }
    })();
    return () => { live = false; };
  }, [JSON.stringify(doc)]);
  if (!pages) return <div className="pdf-preview row" style={{ justifyContent: "center" }}><Spinner /> Drawing your resume…</div>;
  return (
    <div className="rr-pdf" data-testid="resume-real-pdf">
      {pages.map((p, i) => (
        <div key={i} className="rr-page" style={{ aspectRatio: `${p.w} / ${p.h}` }}>
          <img src={p.img} alt={i === 0 ? "Your resume" : ""} />
          {p.boxes.filter((b) => b.flag || on.has(b.cat!)).map((b, j) => (
            <span key={j} className={b.flag ? "rm-flag rr-flag" : `rr-hl rm-${b.cat}`}
              style={{ left: `${(b.left / p.w) * 100}%`, top: `${(b.top / p.h) * 100}%`, height: `${(b.height / p.h) * 100}%`, ...(b.flag ? {} : { width: `${(b.width / p.w) * 100}%` }) }}>{b.flag}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
