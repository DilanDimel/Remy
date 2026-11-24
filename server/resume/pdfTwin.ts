// Keeps a PDF resume's own look after edits (Dilan, Nov 24: "Remy should be able to convert and make it perfect").
// A PDF can't be edited in place, so Remy rebuilds the page from the PDF itself: every piece of text at its exact
// spot, in the file's own embedded font and size, plus its lines and boxes. Only edited lines are rewrapped, in
// their own font, and everything below them moves down. The result is a real-text PDF (resume filters read it).
import PDFDocument from "pdfkit";
import * as fontkit from "fontkit";
import path from "path";
import zlib from "zlib";
import type { ResumeDoc } from "@shared/types";

export type Item = { str: string; x: number; y: number; size: number; w: number; font: string; color?: string; added?: boolean };
type Shape = { x: number; y: number; w: number; h: number; fill: string | null; stroke: string | null; lw: number };
type Font = { name: string; data?: Buffer; ff?: any; bold: boolean; italic: boolean; serif: boolean; mono: boolean; trusted?: boolean; scale?: number };
type Img = { x: number; y: number; w: number; h: number; png: Buffer };
export type TwinPage = { w: number; h: number; items: Item[]; shapes: Shape[]; images?: Img[] };
export type Twin = { pages: TwinPage[]; fonts: Record<string, Font> };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const SERIF = /times|georgia|garamond|cambria|caladea|book ?antiqua|palatino|baskerville|bodoni|century|didot|minion|constantia|bookman|caslon|serif(?!.*sans)|gelasio|tinos|libre ?baskerville|merriweather/i;

/** Reads the PDF into a Twin: text pieces with their font, size and spot, and the filled/stroked rectangles (rules). */
export async function readTwin(buf: Buffer): Promise<Twin> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf), { fontExtraProperties: true, disableFontFace: true } as any);
  const { OPS } = await import("unpdf/pdfjs" as any).catch(() => ({ OPS: null as any }));
  const fonts: Record<string, Font> = {};
  const pages: TwinPage[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    // The operator list first: it's what makes pdf.js load the page's fonts.
    const ops = OPS ? await page.getOperatorList() : null;
    const tc: any = await page.getTextContent();
    const items: Item[] = [];
    const tint = ops ? colourOf(ops, OPS) : () => undefined;
    for (const it of tc.items as any[]) {
      if (!it.str) continue;
      const [a, b, , , e, f] = it.transform as number[];
      // Symbol-font bullets come through as private-use characters no other font has.
      items.push({ str: it.str.replace(/[\uF000-\uF8FF]/g, "•"), x: e, y: vp.height - f, size: Math.hypot(a, b), w: it.width, font: it.fontName, color: tint(it.str) });
      if (!fonts[it.fontName]) {
        const fo: any = page.commonObjs.has(it.fontName) ? page.commonObjs.get(it.fontName) : null;
        const name = String(fo?.name || tc.styles?.[it.fontName]?.fontFamily || "").replace(/^[A-Z]{6}\+/, "");
        let ff: any;
        // pdf.js hands over the embedded font as OpenType. A letter it can't map (subsets drop unused ones, some files
        // remap them) falls back to a standard font when drawn.
        try { ff = fo?.data ? fontkit.create(Buffer.from(fo.data)) : undefined; } catch { ff = undefined; }
        fonts[it.fontName] = { name, data: ff ? Buffer.from(fo.data) : undefined, ff, bold: /bold|black|heavy|semibold|demi/i.test(name), italic: /italic|oblique/i.test(name), serif: SERIF.test(name), mono: /mono|courier|consol/i.test(name) };
      }
    }
    const marks: { id: string; x: number; y: number; w: number; h: number }[] = [];
    const shapes = ops ? shapesOf(ops, OPS, vp.height, marks) : [];
    pages.push({ w: vp.width, h: vp.height, items, shapes, images: await imagesOf(page, marks) });
  }
  const t = { pages, fonts };
  trust(t);
  return t;
}

/** Rectangles and straight lines the page fills or strokes (section rules, colour bars, boxes). */
function shapesOf(list: { fnArray: number[]; argsArray: any[] }, OPS: any, H: number, imgs: { id: string; x: number; y: number; w: number; h: number }[] = []): Shape[] {
  const out: Shape[] = [];
  let fill = "#000000", stroke = "#000000", lw = 1, pending: number[] | null = null;
  const hex = (a: any) => typeof a === "string" ? a : typeof a?.[0] === "string" ? a[0] : Array.isArray(a) ? "#" + a.slice(0, 3).map((v: number) => Math.round(v > 1 ? v : v * 255).toString(16).padStart(2, "0")).join("") : "#000000";
  // The current transform (cm), with save/restore: a path's box is in its own space, the page needs it in page space.
  let m = [1, 0, 0, 1, 0, 0];
  const stack: { m: number[]; fill: string; stroke: string; lw: number }[] = [];
  const mul = (a: number[], b: number[]) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  const at = (x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  list.fnArray.forEach((fn, i) => {
    const args = list.argsArray[i];
    if (fn === OPS.save) stack.push({ m, fill, stroke, lw });
    else if (fn === OPS.restore) ({ m, fill, stroke, lw } = stack.pop() ?? { m, fill, stroke, lw });
    else if (fn === OPS.transform) m = mul(args as number[], m);
    else if (fn === OPS.setFillRGBColor) fill = hex(args);
    else if (fn === OPS.setStrokeRGBColor) stroke = hex(args);
    else if (fn === OPS.setFillGray) fill = hex([args[0], args[0], args[0]]);
    else if (fn === OPS.setStrokeGray) stroke = hex([args[0], args[0], args[0]]);
    else if (fn === OPS.setLineWidth) lw = args[0];
    else if (fn === OPS.paintImageXObject && typeof args?.[0] === "string") {
      // An image fills the unit square of the current transform (a logo, a photo, an icon).
      const [p0, p1] = [at(0, 0), at(1, 1)];
      imgs.push({ id: args[0], x: Math.min(p0[0], p1[0]), y: H - Math.max(p0[1], p1[1]), w: Math.abs(p1[0] - p0[0]), h: Math.abs(p1[1] - p0[1]) });
    }
    else if (fn === OPS.constructPath) {
      // Newer pdf.js: [op, [path], minMax]; older: [ops, coords, minMax]. Either way the last arg is the box.
      const mm = args[args.length - 1];
      if (mm && mm.length === 4 && Number.isFinite(mm[0])) {
        const [p0, p1] = [at(mm[0], mm[1]), at(mm[2], mm[3])];
        pending = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])];
      } else pending = null;
      // A combined path-and-paint op in newer pdf.js.
      const paint = typeof args[0] === "number" && args.length === 3 ? args[0] : null;
      if (pending && paint !== null && paint !== OPS.endPath) push(paint);
    } else if (pending && (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.stroke || fn === OPS.fillStroke || fn === OPS.closeStroke)) push(fn);
  });
  function push(op: number) {
    const [x0, y0, x1, y1] = pending!;
    pending = null;
    const isFill = op === OPS.fill || op === OPS.eoFill || op === OPS.fillStroke;
    const isStroke = op === OPS.stroke || op === OPS.fillStroke || op === OPS.closeStroke;
    // Only simple, page-sized-or-smaller shapes: a white full-page background isn't worth drawing.
    if (x1 - x0 > 2000 || y1 - y0 > 2000) return;
    if (isFill && /^#f{6}$/i.test(fill) && !isStroke) return;
    out.push({ x: x0, y: H - y1, w: x1 - x0, h: y1 - y0, fill: isFill ? fill : null, stroke: isStroke ? stroke : null, lw: lw * Math.hypot(m[0], m[1]) });
  }
  return out;
}

/** The page's pictures as PNGs at their spot (pdf.js hands them over decoded). Tiny marks and huge scans are left out. */
async function imagesOf(page: any, marks: { id: string; x: number; y: number; w: number; h: number }[]): Promise<Img[]> {
  const out: Img[] = [];
  for (const m of marks) {
    if (m.w < 4 || m.h < 4) continue;
    const store = m.id.startsWith("g_") ? page.commonObjs : page.objs;
    const o: any = await Promise.race([new Promise((r) => { try { store.get(m.id, r); } catch { r(null); } }), new Promise((r) => setTimeout(() => r(null), 2000))]);
    if (!o?.data || !o.width || !o.height || o.width * o.height > 4_000_000) continue;
    const png = toPng(o.width, o.height, o.kind, o.data);
    if (png) out.push({ x: m.x, y: m.y, w: m.w, h: m.h, png });
  }
  return out;
}
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** pdf.js image data (kind 1: 1-bit grey, 2: RGB, 3: RGBA) as a PNG file. */
export function toPng(w: number, h: number, kind: number, data: Uint8Array | Uint8ClampedArray): Buffer | null {
  const ch = kind === 3 ? 4 : kind === 2 ? 3 : kind === 1 ? 1 : 0;
  if (!ch) return null;
  const rowIn = kind === 1 ? Math.ceil(w / 8) : w * ch;
  const raw = Buffer.alloc((w * (ch === 1 ? 1 : ch) + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * ch + 1);
    raw[o] = 0;
    if (kind === 1) for (let x = 0; x < w; x++) raw[o + 1 + x] = (data[y * rowIn + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
    else raw.set(data.subarray(y * rowIn, (y + 1) * rowIn), o + 1);
  }
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type), body]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = ch === 4 ? 6 : ch === 3 ? 2 : 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Text colour, read in drawing order: each piece of text takes the fill colour its letters were drawn in. */
function colourOf(list: { fnArray: number[]; argsArray: any[] }, OPS: any) {
  let fill = "#000000", text = "";
  const marks: { at: number; color: string }[] = [];
  list.fnArray.forEach((fn, i) => {
    const args = list.argsArray[i];
    if (fn === OPS.setFillRGBColor) fill = typeof args[0] === "string" ? args[0] : "#" + Array.from(args as number[]).slice(0, 3).map((v) => Math.round(v > 1 ? v : v * 255).toString(16).padStart(2, "0")).join("");
    else if (fn === OPS.setFillGray) fill = "#" + Math.round(args[0] * 255).toString(16).padStart(2, "0").repeat(3);
    else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      const glyphs = (fn === OPS.showText ? args[0] : args[0]).filter((g: any) => g && typeof g === "object");
      marks.push({ at: text.length, color: fill });
      text += squash(glyphs.map((g: any) => g.unicode || "").join(""));
    }
  });
  let pos = 0;
  return (str: string) => {
    const k = squash(str);
    if (!k) return undefined;
    const at = text.indexOf(k, pos);
    if (at < 0) return undefined;
    pos = at + k.length;
    const m = [...marks].reverse().find((x) => x.at <= at);
    return m && m.color !== "#000000" ? m.color : undefined;
  };
}

/** Lines of text on a page: items sharing a baseline, left to right, split where a wide gap separates columns. */
export function linesOf(p: TwinPage) {
  const rows: Item[][] = [];
  // Space-only pieces are left out: one can bridge the gap to a right-aligned date and hide the column break.
  for (const it of p.items.filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) < Math.max(1.5, it.size * 0.25));
    if (row) row.push(it); else rows.push([it]);
  }
  return rows.flatMap((r) => {
    const segs: Item[][] = [];
    for (const it of r.sort((a, b) => a.x - b.x)) {
      const last = segs[segs.length - 1]?.at(-1);
      // A right-aligned date sits far from its line but on purpose; only a gap past 3 em in a line that wraps splits it.
      if (last && it.x - (last.x + last.w) > it.size * 3) segs.push([it]); else if (last) segs[segs.length - 1].push(it); else segs.push([it]);
    }
    return segs;
  });
}
/** The line right under `l` in the same column (starts near its left edge), if any. */
function below(lines: Item[][], l: Item[]) {
  const y = l[0].y, x = l[0].x;
  return lines.filter((m) => m[0].y > y + 1 && m[0].y - y < l[0].size * 2 && Math.abs(m[0].x - x) < l[0].size * 2.5).sort((a, b) => a[0].y - b[0].y)[0];
}

const BULLET = /^[\s•●▪◦‣∙·*–—-]+/;
/** Applies line edits to the Twin. Each `from` must match one or more whole consecutive lines (the bullet glyph and
 *  wrapping ignored); the new text is wrapped in the same font, size, indent and width, and everything below on the
 *  page moves by the change in height. Returns the edits it couldn't place. */
export function editTwin(t: Twin, edits: { from: string; to: string; after?: boolean }[]): { missed: string[] } {
  // An empty `to` deletes the line and moves what's below up. `after` adds `to` as a new line under `from`, with the
  // same bullet, font and indent.
  const missed: string[] = [];
  for (const e of edits) {
    const want = squash(e.from.replace(BULLET, ""));
    let done = false;
    for (const p of t.pages) {
      const rows = linesOf(p);
      for (let i = 0; i < rows.length && !done; i++) {
        let acc = "";
        const old: Item[][] = [];
        for (let l: Item[] | undefined = rows[i]; l && acc.length < want.length; l = below(rows, l)) {
          acc += squash(l.map((x) => x.str).join(""));
          if (!want.startsWith(acc)) break;
          old.push(l);
        }
        if (acc !== want || !acc) continue;
        const text = old.flatMap((r) => r).filter((x) => squash(x.str));
        const first = text[0];
        const left = first.x, cont = old[1]?.find((x) => squash(x.str))?.x ?? left;
        // The right edge: the widest line in this column that starts at or before this line's indent.
        const colLeft = Math.min(...old.map((l) => l[0].x)) - first.size * 3;
        // Section rules in the same column mark the text width too (a page with no right-aligned dates).
        const right = Math.max(...rows.filter((r) => r[0].x >= colLeft && r[0].x <= left + 1).map((r) => r[r.length - 1].x + r[r.length - 1].w),
          ...p.shapes.filter((s) => s.x >= colLeft && s.x <= left + 1 && s.h < 3).map((s) => s.x + s.w), first.x + first.w);
        const lead = old.length > 1 ? (old[old.length - 1][0].y - old[0][0].y) / (old.length - 1) : first.size * 1.16;
        const font = t.fonts[first.font];
        // A bullet typed as text ("• ", "– ") stays in front of the new line.
        const prefix = first.str.match(BULLET)?.[0] ?? "";
        const wrapped = wrap(prefix + e.to.replace(BULLET, "").trim(), font, first.size, right - left, right - cont);
        const gone = !e.to.replace(BULLET, "").trim();
        const shift = e.after ? wrapped.length * lead : ((gone ? 0 : wrapped.length) - old.length) * lead;
        // A deleted line takes its bullet glyph with it; an edited one keeps it.
        const oldSet = new Set(e.after ? [] : gone ? old.flat() : text);
        const bottom = old[old.length - 1][0].y;
        // Only what's below in the same column moves (a sidebar beside it stays put).
        const inCol = (x0: number) => x0 >= colLeft - 1;
        const lowest = Math.max(...p.items.filter((x) => inCol(x.x) && !oldSet.has(x)).map((x) => x.y));
        // A change that would push text off the page isn't made (the caller falls back to Remy's drawing).
        if (shift > 0 && lowest + shift > p.h - 18) continue;
        p.items = p.items.filter((x) => !oldSet.has(x));
        for (const x of p.items) if (x.y > bottom + 0.5 && inCol(x.x)) x.y += shift;
        for (const s of p.shapes) if (s.y > bottom + 0.5 && inCol(s.x)) s.y += shift;
        for (const im of p.images || []) if (im.y > bottom + 0.5 && inCol(im.x)) im.y += shift;
        // A new line goes right under the old one, with a copy of its bullet glyph.
        const top = e.after ? bottom + lead : first.y;
        if (e.after) for (const g of old[0].filter((x) => !squash(x.str) && x.x < left)) p.items.push({ ...g, y: top + (g.y - first.y), added: true });
        if (!gone) wrapped.forEach((str, k) => p.items.push({ str, x: k ? cont : left, y: top + k * lead, size: first.size, w: measure(font, str, first.size), font: first.font, color: first.color, added: true }));
        done = true;
      }
      if (done) break;
    }
    if (!done) missed.push(e.from);
  }
  return { missed };
}

/** True when the file's own font can be trusted to draw `s`: it has every letter (spaces aside, subsets often leave the
 *  space out) and its widths matched the original text when the file was read (some files remap letters). */
const covers = (f: Font | undefined, s: string) => !!f?.ff && f.trusted !== false && [...s.replace(/\s/g, "")].every((c) => f.ff.hasGlyphForCodePoint(c.codePointAt(0)));
const em = (ff: any, w: string, size: number) => (ff.layout(w).advanceWidth / ff.unitsPerEm) * size;

// Open, metric-matched stand-ins (SIL Open Font License, server/fonts): Carlito = Calibri, Caladea = Cambria,
// Liberation Serif = Times New Roman, Liberation Sans = Arial/Helvetica. Used for any letter the file's font lacks.
const METRIC_TWIN = /times|liberation ?serif|tinos|arial|helvetica|liberation ?sans|arimo|calibri|carlito|cambria|caladea/i;
const FONT_DIR = path.resolve(process.cwd(), "server", "fonts");
function standIn(f: Font | undefined): { id: string; file: string } {
  const fam = /calibri|carlito/i.test(f?.name || "") ? "Carlito" : /cambria|caladea/i.test(f?.name || "") ? "Caladea" : f?.serif ? "LiberationSerif" : "LiberationSans";
  const style = f?.bold && f?.italic ? "BoldItalic" : f?.bold ? "Bold" : f?.italic ? "Italic" : "Regular";
  const id = `${fam}-${style}`;
  return { id, file: path.join(FONT_DIR, `${id}.ttf`) };
}
const standInFk = new Map<string, any>();
function fkOf(f: Font | undefined) {
  const { id, file } = standIn(f);
  if (!standInFk.has(id)) standInFk.set(id, fontkit.openSync(file));
  return standInFk.get(id);
}
/** Each word with the font that draws it and its width. */
function words(f: Font | undefined, s: string, size: number) {
  // One font per line: a line mixing the file's font and a stand-in looks patched.
  const own = covers(f, s);
  const k = own ? 1 : f?.scale ?? 1;
  return s.split(" ").map((w) => ({ w, own, stretch: k, width: w ? em(own ? f!.ff : fkOf(f), w, size) * k : 0 }));
}
const spaceW = (f: Font | undefined, size: number) => em(fkOf(f), " ", size) * (f?.scale ?? 1);
/** Width of a new line as Remy will draw it. */
function measure(f: Font | undefined, s: string, size: number) {
  const ws = words(f, s, size);
  return ws.reduce((n, x) => n + x.width, 0) + (ws.length - 1) * spaceW(f, size);
}
function wrap(text: string, f: Font | undefined, size: number, w1: number, w2: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(f, next, size) > (out.length ? w2 : w1)) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Checks each embedded font against the file: drawn in it, the original text must come out the width the PDF says. */
function trust(t: Twin) {
  for (const [id, f] of Object.entries(t.fonts)) {
    if (!f.ff) continue;
    // A font with an open, same-width twin is drawn in the twin: it's always clean, while pdf.js's rebuilt subsets
    // can map letters wrongly (Calibri's "ti" ligature drawn for every "t", Nov 24 test).
    if (METRIC_TWIN.test(f.name)) { f.trusted = false; continue; }
    let bad = false;
    for (const p of t.pages) for (const it of p.items) {
      if (bad || it.font !== id || it.added || !it.str.includes(" ") || it.str.replace(/\s/g, "").length < 6 || !covers(f, it.str)) continue;
      const ws = it.str.split(" ").filter(Boolean);
      // Each piece on its own: the words drawn in this font must fit in the piece's width with normal spaces.
      const mine = ws.reduce((n, w) => n + em(f.ff, w, it.size), 0);
      const room = it.w - (ws.length - 1) * it.size * 0.15;
      bad = mine > room * 1.03 || mine < (it.w - (ws.length - 1) * it.size * 0.45) * 0.97;
    }
    f.trusted = !bad;
  }
  // A stand-in for a font without an open twin (Georgia, Garamond, DejaVu...) is stretched so its text runs as wide as
  // the file's own, so a changed line wraps where the student's font would.
  for (const [id, f] of Object.entries(t.fonts)) {
    if (METRIC_TWIN.test(f.name)) continue;
    let theirs = 0, mine = 0;
    for (const p of t.pages) for (const it of p.items) if (it.font === id && !it.added && it.str.length > 8) { theirs += it.w; mine += em(fkOf(f), it.str, it.size); }
    f.scale = mine ? Math.min(1.25, Math.max(0.8, theirs / mine)) : 1;
  }
}

/** Draws the Twin as a PDF: each word in the file's own font when it can be trusted, else its open stand-in, at the
 *  same spot and size; original pieces keep their exact width; then lines and boxes underneath. */
export async function twinPdf(t: Twin): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((r) => doc.on("end", () => r()));
  for (const [id, f] of Object.entries(t.fonts)) if (f.data) try { doc.registerFont(id, f.data); } catch { f.data = undefined; f.ff = undefined; }
  for (const p of t.pages) {
    doc.addPage({ size: [p.w, p.h], margin: 0 });
    for (const s of p.shapes) {
      doc.save().lineWidth(s.lw).rect(s.x, s.y, s.w, s.h);
      if (s.fill && s.stroke) doc.fillAndStroke(s.fill, s.stroke); else if (s.fill) doc.fill(s.fill); else doc.stroke(s.stroke!);
      doc.restore();
    }
    for (const im of p.images || []) try { doc.image(im.png, im.x, im.y, { width: im.w, height: im.h }); } catch { /* an image pdfkit can't read is left out */ }
    for (const it of p.items) {
      const f = t.fonts[it.font];
      const ws = words(f, it.str, it.size);
      const sum = ws.reduce((n, x) => n + x.width, 0);
      // Original pieces keep their width (the gap absorbs any difference); new lines use the font's own space.
      const gap = ws.length > 1 && !it.added && it.w > sum ? (it.w - sum) / (ws.length - 1) : spaceW(f, it.size);
      let x = it.x;
      doc.fillColor(it.color || "#000000").fontSize(it.size);
      for (const w of ws) {
        if (w.w) {
          const si = standIn(f);
          if (!w.own) try { doc.registerFont(si.id, si.file); } catch { /* already */ }
          // Same height as the file's text; a stand-in is only stretched sideways to run as wide.
          doc.font(w.own ? it.font : si.id).text(w.w, x, it.y, { lineBreak: false, baseline: "alphabetic", horizontalScaling: w.stretch * 100 } as any);
        }
        x += w.width + gap;
      }
    }
  }
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

/** The base resume as it stands now, drawn on the student's own PDF: every reworded or deleted bullet changed in
 *  place (matched by the text first read from the file, `fileLines`), and new bullets added under the one before.
 *  Changed names, headers or skills can't be placed yet: they come back in `missed`, and the caller shows Remy's
 *  drawing instead. */
export async function currentResumePdf(buf: Buffer, doc: ResumeDoc, fileLines: Record<string, string> = {}): Promise<{ buf: Buffer | null; missed: string[] }> {
  const { twin, missed } = await currentResumeTwin(buf, doc, fileLines);
  return { buf: twin ? await twinPdf(twin) : null, missed };
}
/** The same, as the edited Twin (for a Word copy in the PDF's look, `twinDocx`). */
export async function currentResumeTwin(buf: Buffer, doc: ResumeDoc, fileLines: Record<string, string> = {}): Promise<{ twin: Twin | null; missed: string[] }> {
  const t = await readTwin(buf);
  const now = new Map(doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => [b.id, b.text] as const))));
  const edits: { from: string; to: string; after?: boolean }[] = [], adds: typeof edits = [], missed: string[] = [];
  for (const [id, text] of now) if (id in fileLines && squash(text) !== squash(fileLines[id])) edits.push({ from: fileLines[id], to: text });
  for (const [id, text] of Object.entries(fileLines)) if (!now.has(id)) edits.push({ from: text, to: "" });
  // A line added in Remy goes under the bullet before it in the same role (as that bullet reads now), once the
  // edits are in. The first bullet of a role with none from the file has nothing to sit under.
  for (const e of doc.sections.flatMap((s) => s.entries)) e.bullets.forEach((b, k) => {
    if (b.id in fileLines || !b.text.trim()) return;
    if (k === 0) missed.push(b.text); else adds.push({ from: e.bullets[k - 1].text, to: b.text, after: true });
  });
  edits.push(...adds);
  const flat = squash(t.pages.flatMap((p) => p.items.map((i) => i.str)).join(""));
  const c = doc.contact;
  for (const v of [c.name, c.email, c.phone, c.location, c.links, ...doc.sections.flatMap((s) => [s.heading, ...s.entries.flatMap((e) => [e.org, e.role, e.location, e.dates])]), ...doc.skills.map((k) => k.items)])
    if (squash(v || "") && !flat.includes(squash(v))) missed.push(v);
  missed.push(...editTwin(t, edits).missed);
  return { twin: missed.length ? null : t, missed };
}
