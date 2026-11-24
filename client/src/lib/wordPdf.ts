// A Word upload's PDF in its own look (Dilan, Nov 24: "give the user options to export to pdf, word, doc"). The browser
// lays out the student's Word file (docx-preview, the same drawing the Resume page shows); this measures where every
// word, line, rule and picture sits, and the server draws exactly that as a real-text PDF (POST /api/resume/word-pdf).
import { drawDocx } from "@/components/ResumeReal";
import { API_BASE, download } from "@/lib/store";

type Item = { str: string; x: number; y: number; size: number; w: number; font: string; color?: string };
type Shape = { x: number; y: number; w: number; h: number; fill: string | null; stroke: string | null; lw: number };
type Pic = { x: number; y: number; w: number; h: number; png: string };
export type Layout = { pages: { w: number; h: number; items: Item[]; shapes: Shape[]; images: Pic[] }[]; fonts: Record<string, { name: string; bold: boolean; italic: boolean }> };

const PT = 0.75; // CSS px to points
const hex = (c: string): string | null => {
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.05)) return null;
  return "#" + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
};

export async function measureWord(blob: Blob): Promise<Layout> {
  const out: Layout = { pages: [], fonts: {} };
  const drawn = await drawDocx(blob);
  // Laid out on its own, away from the app's styles, the same way the Resume page's preview frame shows it.
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:3000px;border:0;visibility:hidden;pointer-events:none";
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8">${drawn.styles.innerHTML}<style>html,body{margin:0}.docx-wrapper{background:transparent!important;padding:0!important}.docx-wrapper>section.docx{margin:0 0 12px!important;box-shadow:none!important}</style></head><body>${drawn.body.innerHTML}</body></html>`;
  const loaded = new Promise((r) => (frame.onload = r));
  document.body.appendChild(frame);
  try {
    await loaded;
    const win = frame.contentWindow!, document = frame.contentDocument!, getComputedStyle = win.getComputedStyle.bind(win);
    const body = document.body;
    await document.fonts?.ready;
    const ctx = document.createElement("canvas").getContext("2d")!;
    const sections = Array.from(body.querySelectorAll<HTMLElement>("section.docx")).slice(0, 4);
    for (const sec of sections) {
      const R = sec.getBoundingClientRect();
      const at = (r: DOMRect) => ({ x: (r.left - R.left) * PT, y: (r.top - R.top) * PT, w: r.width * PT, h: r.height * PT });
      const page: Layout["pages"][number] = { w: R.width * PT, h: R.height * PT, items: [], shapes: [], images: [] };
      // Text: words grouped into pieces that share a line and a style, each at its baseline.
      const walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
        const el = n.parentElement;
        if (!el || !n.data.trim()) continue;
        const cs = getComputedStyle(el);
        // (The drawing is laid out invisibly, so every element reads as hidden: only display matters.)
        if (cs.display === "none") continue;
        const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
        const bold = Number(cs.fontWeight) >= 600 || cs.fontWeight === "bold", italic = cs.fontStyle !== "normal";
        const id = `${fam}|${bold ? "b" : ""}${italic ? "i" : ""}`;
        out.fonts[id] ??= { name: fam, bold, italic };
        const px = parseFloat(cs.fontSize);
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
        const m = ctx.measureText("Hg");
        const ascent = m.fontBoundingBoxAscent ?? px * 0.9;
        const color = hex(cs.color) || undefined;
        const caps = cs.textTransform === "uppercase";
        let cur: { str: string; left: number; right: number; top: number } | null = null;
        const flush = () => { if (cur) page.items.push({ str: caps ? cur.str.toUpperCase() : cur.str, x: (cur.left - R.left) * PT, y: (cur.top - R.top + ascent) * PT, size: px * PT, w: (cur.right - cur.left) * PT, font: id, color: color === "#000000" ? undefined : color }); cur = null; };
        for (const w of n.data.matchAll(/\S+/g)) {
          const r = document.createRange();
          r.setStart(n, w.index!); r.setEnd(n, w.index! + w[0].length);
          const box = r.getClientRects()[0];
          if (!box || !box.width) continue;
          if (cur && Math.abs(box.top - cur.top) < 1 && box.left >= cur.right - 1) { cur.str += " " + w[0]; cur.right = box.right; }
          else { flush(); cur = { str: w[0], left: box.left, right: box.right, top: box.top }; }
        }
        flush();
      }
      // List bullets and numbers are drawn by the page as ::before marks, not text: each goes at its line's start.
      for (const el of Array.from(sec.querySelectorAll<HTMLElement>("p, li"))) {
        const b = getComputedStyle(el, "::before");
        const mark = (b.content || "").replace(/^["']|["']$/g, "").replace(/\\[0-9a-f]+\s?/gi, (e) => String.fromCodePoint(parseInt(e.slice(1), 16))).replace(/\s+/g, " ").trim();
        if (!mark || b.content === "none" || b.content === "normal" || b.display === "none") continue;
        const firstText = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let tn = firstText.nextNode() as Text | null;
        while (tn && !tn.data.trim()) tn = firstText.nextNode() as Text | null;
        if (!tn) continue;
        const r = document.createRange();
        const i = tn.data.search(/\S/);
        r.setStart(tn, i); r.setEnd(tn, i + 1);
        const box = r.getClientRects()[0];
        if (!box) continue;
        const cs = getComputedStyle(el), er = el.getBoundingClientRect();
        const fam = b.fontFamily.split(",")[0].replace(/["']/g, "").trim();
        const bold = Number(b.fontWeight) >= 600, italic = b.fontStyle !== "normal";
        const id = `${fam}|${bold ? "b" : ""}${italic ? "i" : ""}`;
        out.fonts[id] ??= { name: fam, bold, italic };
        const px = parseFloat(b.fontSize);
        ctx.font = `${b.fontStyle} ${b.fontWeight} ${px}px ${b.fontFamily}`;
        const ascent = ctx.measureText("Hg").fontBoundingBoxAscent ?? px * 0.9;
        const x = er.left + parseFloat(cs.paddingLeft || "0") + parseFloat(cs.textIndent || "0");
        if (x >= box.left - 1) continue;
        // Word starts the text at the hanging indent; the page's drawing often lets the tab after the bullet come up
        // short, so the first line's text is moved to where Word puts it.
        const textAt = er.left + parseFloat(cs.paddingLeft || "0");
        if (textAt - box.left > 1) {
          const y0 = (box.top - R.top) * PT, x0 = (box.left - R.left) * PT - 0.5;
          // The first line's pieces: from the first letter on, with their baseline inside that line's box. The line
          // is moved, and squeezed a little if it would now run past the right margin.
          const line = page.items.filter((it) => it.x >= x0 && it.y > y0 && it.y < y0 + box.height * PT);
          const from = x0 + 0.5, to = (textAt - R.left) * PT, end = Math.max(...line.map((it) => it.x + it.w));
          const limit = (er.right - parseFloat(cs.paddingRight || "0") - R.left) * PT;
          const k = end > from ? (Math.min(end + to - from, Math.max(limit, end)) - to) / (end - from) : 1;
          for (const it of line) { it.x = to + (it.x - from) * k; it.w *= k; }
        }
        page.items.push({ str: mark, x: (x - R.left) * PT, y: (box.top - R.top + ascent) * PT, size: px * PT, w: ctx.measureText(mark).width * PT, font: id, color: hex(b.color) === "#000000" ? undefined : hex(b.color) || undefined });
      }
      // Rules and boxes: borders and filled backgrounds (the white page itself left out).
      for (const el of Array.from(sec.querySelectorAll<HTMLElement>("*"))) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const b = at(r);
        const bg = hex(cs.backgroundColor);
        if (bg && bg !== "#ffffff") page.shapes.push({ ...b, fill: bg, stroke: null, lw: 0 });
        for (const side of ["Top", "Bottom", "Left", "Right"] as const) {
          const wpx = parseFloat((cs as any)[`border${side}Width`]), style = (cs as any)[`border${side}Style`], col = hex((cs as any)[`border${side}Color`]);
          if (!wpx || style === "none" || style === "hidden" || !col) continue;
          const lw = wpx * PT;
          const line = side === "Top" ? { x: b.x, y: b.y, w: b.w, h: lw } : side === "Bottom" ? { x: b.x, y: b.y + b.h - lw, w: b.w, h: lw } : side === "Left" ? { x: b.x, y: b.y, w: lw, h: b.h } : { x: b.x + b.w - lw, y: b.y, w: lw, h: b.h };
          page.shapes.push({ ...line, fill: col, stroke: null, lw: 0 });
        }
      }
      // Pictures, re-drawn as PNGs at up to twice their size on the page.
      for (const img of Array.from(sec.querySelectorAll("img"))) {
        const r = img.getBoundingClientRect();
        if (!r.width || !img.naturalWidth) continue;
        try {
          const c = document.createElement("canvas");
          const k = Math.min(1, (r.width * 2) / img.naturalWidth);
          c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
          c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
          const png = c.toDataURL("image/png").split(",")[1];
          if (png.length < 600_000) page.images.push({ ...at(r), png });
        } catch { /* a picture the browser won't hand over is left out */ }
      }
      out.pages.push(page);
    }
  } finally {
    frame.remove();
  }
  if (!out.pages.length || !out.pages.some((p) => p.items.length)) throw new Error("Nothing to draw");
  return out;
}

/** Downloads a Word upload's PDF in its own look: the Word file at `docxUrl` (their current file, or a tailored
 *  version's) laid out here and drawn by the server. False when that file isn't in their own layout or can't be
 *  measured, so the caller downloads Remy's PDF instead. */
export async function ownWordPdf(docxUrl: string, method: "GET" | "POST", name: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}${docxUrl}`, method === "POST" ? { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" } : { credentials: "same-origin" });
    const layout = r.headers.get("X-Remy-Layout");
    if (!r.ok || (layout && layout !== "original")) return false;
    // The Word download's own file name (a tailored version's), as a PDF.
    const own = (r.headers.get("content-disposition") || "").match(/filename="([^"]+)\.docx"/)?.[1];
    await download("/api/resume/word-pdf", name, { layout: await measureWord(await r.blob()), name: own || "" });
    return true;
  } catch {
    return false;
  }
}

/** The base resume's PDF button: their own look for a Word upload when it can be, else the server's PDF (which is
 *  already their own look for a PDF upload). */
export async function exportBasePdf(isWord: boolean) {
  if (isWord && await ownWordPdf("/api/resume/current-file", "POST", "Resume.pdf")) return;
  await download("/api/resume/export?format=pdf", "Resume.pdf");
}
