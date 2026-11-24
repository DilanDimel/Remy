// A Word copy of a PDF resume in its own look (Dilan, Nov 24: "give the user options to export to pdf, word, doc").
// Built from the PDF twin: each line becomes a real Word paragraph (not floating text boxes, so it edits and reads
// like a normal resume) with the PDF's font, size, colour, indent, spacing, right-aligned dates and section rules.
// A sidebar layout becomes a two-column table. Opens in Word and Google Docs.
import { AlignmentType, BorderStyle, Document, HorizontalPositionRelativeFrom, ImageRun, LineRuleType, Packer, Paragraph, ShadingType, Tab, Table, TableCell, TableRow, TabStopType, TextRun, TextWrappingType, VerticalPositionRelativeFrom, WidthType } from "docx";
import { linesOf, type Item, type Twin, type TwinPage } from "./pdfTwin";

const TW = 20; // twips per point
const GLYPH = /^[•●▪◦‣∙·*–—-]$/;

/** The font name Word knows: subset tag, style suffix and PostScript endings dropped; open twins named as the font. */
export function family(name: string) {
  const n = name.replace(/^[A-Z]{6}\+/, "").split(/[-,]/)[0].replace(/(PS)?MT$|PS$/, "");
  if (/^times$|liberation ?serif|tinos|^CM[A-Z]|LMRoman|nimbusrom/i.test(n)) return "Times New Roman";
  if (/liberation ?sans|arimo|helvetica|nimbussan/i.test(n)) return "Arial";
  if (/carlito/i.test(n)) return "Calibri";
  if (/caladea/i.test(n)) return "Cambria";
  if (/dejavu ?sans/i.test(n)) return "DejaVu Sans";
  if (/dejavu ?serif/i.test(n)) return "DejaVu Serif";
  return n.replace(/([a-z])([A-Z])/g, "$1 $2").trim() || "Calibri";
}

type Seg = Item[];
type Col = { left: number; right: number; segs: Seg[] };
const end = (s: Seg) => s[s.length - 1].x + s[s.length - 1].w;

export async function twinDocx(t: Twin): Promise<Buffer> {
  return Packer.toBuffer(new Document({ sections: t.pages.map((p) => page(t, p)) }));
}

function page(t: Twin, p: TwinPage) {
  const segs = linesOf(p).filter((s) => s.some((i) => i.str.trim()));
  const left = Math.min(...segs.map((s) => s[0].x)), right = Math.max(...segs.map(end));
  const centred = (s: Seg) => s[0].x > left + 30 && Math.abs((s[0].x + end(s)) / 2 - p.w / 2) < 6;
  const sameRow = (s: Seg) => segs.filter((o) => Math.abs(o[0].y - s[0].y) < 2);
  // A sidebar layout: many lines alone on their row that start in the middle of the page.
  const lone = segs.filter((s) => s[0].x > p.w * 0.25 && s[0].x < p.w * 0.7 && sameRow(s).length === 1 && !centred(s));
  let split = lone.length >= 5 ? Math.min(...lone.map((s) => s[0].x)) : 0;
  const firstLone = Math.min(...lone.map((s) => s[0].y));
  const crossing = split ? segs.filter((s) => s[0].x < split - 1 && end(s) > split + 1) : [];
  // Full-width lines above both columns (a name banner) go above the table; any other crossing line means no sidebar.
  if (crossing.some((s) => s[0].y >= firstLone)) split = 0;
  const rules = p.shapes.filter((s) => s.h < 3 && s.w > 40);
  const margin = { top: Math.max(18, Math.min(...segs.map((s) => s[0].y - s[0].size))), left, right: Math.max(12, p.w - right - 3), bottom: 18 };
  // Pictures float at their exact spot on the page, behind nothing and pushing no text.
  const pics = (p.images || []).map((im) => new ImageRun({ type: "png", data: im.png, transformation: { width: Math.round(im.w * 96 / 72), height: Math.round(im.h * 96 / 72) },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(im.x * 12700) }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(im.y * 12700) }, wrap: { type: TextWrappingType.NONE }, allowOverlap: true } }));
  const props = { page: { size: { width: p.w * TW, height: p.h * TW }, margin: { top: margin.top * TW, left: margin.left * TW, right: margin.right * TW, bottom: margin.bottom * TW, header: 0, footer: 0 } } };
  if (!split) return { properties: props, children: paragraphs(t, { left, right, segs }, rules, margin.top, centred, pics) };
  const top = segs.filter((s) => crossing.includes(s));
  const rest = segs.filter((s) => !crossing.includes(s));
  const startY = top.length ? Math.max(...top.map((s) => s[0].y)) + top[0][0].size * 0.4 : margin.top;
  const cols: Col[] = [
    { left, right: split - 6, segs: rest.filter((s) => s[0].x < split - 1) },
    { left: split, right, segs: rest.filter((s) => s[0].x >= split - 1) },
  ];
  // A filled box behind the sidebar becomes the cell's shading.
  const bg = (c: Col) => p.shapes.find((s) => s.fill && s.x <= c.left + 2 && s.x + s.w >= c.right - 2 && s.h > p.h * 0.5)?.fill?.replace("#", "");
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const table = new Table({
    width: { size: (right - left) * TW, type: WidthType.DXA },
    columnWidths: [(split - left) * TW, (right - split) * TW],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: cols.map((c, k) => new TableCell({
      width: { size: ((k ? right : split) - (k ? split : left)) * TW, type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      shading: bg(c) ? { type: ShadingType.CLEAR, fill: bg(c)!, color: "auto" } : undefined,
      children: paragraphs(t, c, rules, startY, centred, top.length || k ? [] : pics),
    })) })],
  });
  return { properties: props, children: [...paragraphs(t, { left, right, segs: top }, rules, margin.top, centred, top.length ? pics : []), table] };
}

/** One column's lines as Word paragraphs, top to bottom, wrapped lines joined back into their paragraph. */
function paragraphs(t: Twin, c: Col, rules: TwinPage["shapes"], startY: number, centred: (s: Seg) => boolean, pics: ImageRun[] = []): Paragraph[] {
  const rows: Seg[][] = [];
  for (const s of [...c.segs].sort((a, b) => a[0].y - b[0].y || a[0].x - b[0].x)) {
    const r = rows.find((r) => Math.abs(r[0][0].y - s[0].y) < 2);
    if (r) r.push(s); else rows.push([s]);
  }
  type P = { first: Seg; extras: Seg[]; lines: Seg[]; glyph?: Item; textX: number; contX?: number; y: number; lastY: number; size: number; rule?: TwinPage["shapes"][number] };
  const ps: P[] = [];
  for (const [main, ...extras] of rows) {
    const prev = ps[ps.length - 1];
    const x = main[0].x, size = main[0].size, last = prev?.lines[prev.lines.length - 1];
    // A wrapped line: right under the last one, at its text's indent, same size, and the line above ran to the edge.
    const firstWord = main[0].str.trim().split(/\s+/)[0] || "";
    const wordW = (main[0].w / Math.max(1, main[0].str.length)) * (firstWord.length + 1);
    if (prev && !extras.length && !prev.extras.length && !GLYPH.test(main[0].str.trim()) && Math.abs(size - prev.size) < 0.3 && main[0].y - prev.lastY < size * 1.7
      && main[0].font === last!.at(-1)!.font && Math.abs(x - (prev.contX ?? prev.textX)) < size * 1.2 && x >= prev.textX - 1 && end(last!) > c.right - wordW - size * 1.5 && !centred(main)) {
      prev.contX ??= x;
      prev.lines.push(main);
      prev.lastY = main[0].y;
      continue;
    }
    // A bullet glyph drawn on its own (often followed by a space piece): the text starts at the next real piece.
    const body = GLYPH.test(main[0].str.trim()) ? main.find((i, k) => k > 0 && i.str.trim()) : undefined;
    const glyph = body ? main[0] : undefined;
    ps.push({ first: main, extras, lines: [main], glyph, textX: body ? body.x : x, y: main[0].y, lastY: main[0].y, size: body ? body.size : size });
  }
  // A section rule hangs under the last paragraph above it (in this column).
  for (const r of rules) {
    if (r.x > c.right - 10 || r.x + r.w < c.left + 10) continue;
    const above = [...ps].reverse().find((q) => q.lastY <= r.y + 1);
    if (above && !above.rule) above.rule = r;
  }
  let bottom = startY;
  return ps.map((q, n) => {
    const lead = q.lines.length > 1 ? (q.lastY - q.y) / (q.lines.length - 1) : q.size * 1.17;
    const top = q.y - lead * 0.8;
    const before = Math.max(0, top - bottom);
    const ruleGap = q.rule ? Math.max(0, q.rule.y - (q.lastY + lead * 0.2)) : 0;
    bottom = q.lastY + lead * 0.2 + (q.rule ? ruleGap + q.rule.lw : 0);
    const runs: TextRun[] = [];
    const push = (items: Item[], lead = "") => items.forEach((it, k) => {
      if (q.glyph === it || (q.glyph && !it.str.trim() && items[k - 1] === q.glyph)) return;
      const prev = items[k - 1];
      const gap = prev && prev !== q.glyph && !/\s$/.test(prev.str) && !/^\s/.test(it.str) && it.x - (prev.x + prev.w) > it.size * 0.12 ? " " : "";
      const f = t.fonts[it.font];
      const text = (k === 0 || items.slice(0, k).every((x) => x === q.glyph || !x.str.trim()) ? lead : "") + gap + it.str;
      runs.push(new TextRun({ children: text.startsWith("\t") ? [new Tab(), text.slice(1)] : [text], font: family(f?.name || ""), size: Math.round(it.size * 2), bold: f?.bold, italics: f?.italic, color: it.color?.replace("#", "") }));
    });
    if (q.glyph) {
      const f = t.fonts[q.glyph.font];
      runs.push(new TextRun({ text: q.glyph.str.trim(), font: family(f?.name || ""), size: Math.round(q.glyph.size * 2), color: q.glyph.color?.replace("#", "") }), new TextRun({ children: [new Tab()], size: Math.round(q.size * 2) }));
    }
    q.lines.forEach((l, k) => push(l, k ? " " : ""));
    const tabs = q.extras.map((e) => Math.abs(end(e) - c.right) < 6 ? { type: TabStopType.RIGHT, position: Math.round((c.right - c.left) * TW) } : { type: TabStopType.LEFT, position: Math.round((e[0].x - c.left) * TW) });
    for (const e of q.extras) push(e, "\t");
    const centre = centred(q.first) && !q.extras.length;
    // Text that wrapped short of the column edge had a right indent: keep it so lines break where they did.
    const wrapEnd = Math.max(...q.lines.slice(0, -1).map(end));
    const rightIndent = q.lines.length > 1 && c.right - wrapEnd > q.size * 1.5 ? c.right - wrapEnd - q.size * 0.4 : 0;
    const indentLeft = centre ? 0 : (q.contX ?? q.textX) - c.left;
    const firstX = q.glyph ? q.glyph.x : q.first[0].x;
    return new Paragraph({
      children: n ? runs : [...pics, ...runs],
      alignment: centre ? AlignmentType.CENTER : AlignmentType.LEFT,
      tabStops: tabs.length ? tabs : undefined,
      indent: centre ? undefined : { left: Math.round(indentLeft * TW), right: Math.round(rightIndent * TW), ...(firstX < c.left + indentLeft - 0.5 ? { hanging: Math.round((c.left + indentLeft - firstX) * TW) } : firstX > c.left + indentLeft + 0.5 ? { firstLine: Math.round((firstX - c.left - indentLeft) * TW) } : {}) },
      spacing: { before: Math.round(before * TW), after: 0, line: Math.round(lead * TW), lineRule: LineRuleType.EXACT },
      border: q.rule ? { bottom: { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(q.rule.lw * 8)), color: (q.rule.stroke || q.rule.fill || "#000000").replace("#", ""), space: Math.round(ruleGap) } } : undefined,
    });
  });
}
