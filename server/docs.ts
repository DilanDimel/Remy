import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import PDFDocument from "pdfkit";
import type { ResumeDoc, ResumeStyle } from "@shared/types";
import { resumeToText } from "./resume";

const FONT = "Calibri";
/** US Letter, 8.5 × 11 in, in twentieths of a point. */
const LETTER = { width: 12240, height: 15840 };

/** Sections in the original order, with Skills back where the student had it. */
type Block = { heading: string; entries?: ResumeDoc["sections"][number]["entries"]; skills?: ResumeDoc["skills"] };
function blocks(doc: ResumeDoc): Block[] {
  const out: Block[] = doc.sections.map((s) => ({ heading: s.heading, entries: s.entries }));
  if (doc.skills.length) out.splice(Math.min(doc.skillsIndex ?? out.length, out.length), 0, { heading: "Skills", skills: doc.skills });
  return out;
}

/** The student's font as Word knows it: PDF names of metric twins become the familiar font. */
export function wordFont(style?: ResumeStyle): string {
  const f = (style?.font || "").replace(/[^A-Za-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (/liberation ?sans|arimo|arial|helvetica/i.test(f)) return "Arial";
  if (/liberation ?serif|tinos|times/i.test(f)) return "Times New Roman";
  if (/liberation ?mono|cousine|courier/i.test(f) || style?.mono) return "Courier New";
  if (/carlito|calibri/i.test(f)) return "Calibri";
  if (/caladea|cambria/i.test(f)) return "Cambria";
  if (f && f.length < 40) return f;
  return style?.serif ? "Times New Roman" : FONT;
}

export async function resumeDocx(doc: ResumeDoc, style?: ResumeStyle): Promise<Buffer> {
  const font = wordFont(style);
  const roleItalic = style?.italic !== false;
  const sz = Math.round((style?.size ?? 10.5) * 2); // half-points
  const kids: Paragraph[] = [];
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: doc.contact.name, bold: true, size: sz + 10, font })] }));
  const contact = [doc.contact.location, doc.contact.email, doc.contact.phone, doc.contact.links].filter(Boolean).join(" | ");
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: contact, size: sz - 1, font })] }));
  const margin = Math.round((style?.margin ?? 36) * 20); // points → twentieths
  const right = 12240 - margin * 2;
  for (const b of blocks(doc)) {
    kids.push(new Paragraph({
      spacing: { before: 160, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "222222", space: 1 } },
      children: [new TextRun({ text: b.heading.toUpperCase(), bold: true, size: sz + 1, font })],
    }));
    for (const k of b.skills || []) kids.push(new Paragraph({ children: [new TextRun({ text: `${k.label}: `, bold: true, size: sz, font }), new TextRun({ text: k.items, size: sz, font })] }));
    (b.entries || []).forEach((e, i) => {
      const gap = i ? 80 : 0;
      if (e.org || e.location)
        kids.push(new Paragraph({ spacing: { before: gap }, tabStops: [{ type: TabStopType.RIGHT, position: right }], children: [new TextRun({ text: e.org, bold: true, size: sz, font }), new TextRun({ text: e.location ? `\t${e.location}` : "", bold: true, size: sz, font })] }));
      if (e.role || e.dates)
        kids.push(new Paragraph({ spacing: { before: e.org || e.location ? 0 : gap }, tabStops: [{ type: TabStopType.RIGHT, position: right }], children: [new TextRun({ text: e.role, italics: roleItalic, size: sz, font }), new TextRun({ text: e.dates ? `\t${e.dates}` : "", italics: roleItalic, size: sz, font })] }));
      for (const x of e.bullets) kids.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: x.text, size: sz, font })] }));
    });
  }
  const d = new Document({
    creator: "Remy",
    title: `${doc.contact.name} Resume`,
    // US Letter (the docx library defaults to A4, which pushed the right-aligned dates past the margin).
    sections: [{ properties: { page: { size: LETTER, margin: { top: Math.min(margin, 720), bottom: Math.min(margin, 720), left: margin, right: margin } } }, children: kids }],
  });
  return Packer.toBuffer(d);
}

export async function letterDocx(name: string, contact: string, letter: string): Promise<Buffer> {
  const kids = [
    new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 26, font: FONT })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: contact, size: 20, font: FONT })] }),
    ...letter.split(/\n\s*\n/).map((p) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: p.replace(/\n/g, " ").trim(), size: 22, font: FONT })] })),
  ];
  const d = new Document({ creator: "Remy", sections: [{ properties: { page: { size: LETTER, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children: kids }] });
  return Packer.toBuffer(d);
}

function pdfBuffer(build: (pdf: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "LETTER", margins: { top: 40, bottom: 40, left: 46, right: 46 }, info: { Creator: "Remy" } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    build(pdf);
    pdf.end();
  });
}

function renderResume(doc: ResumeDoc, style: ResumeStyle | undefined, scale: number, tight: number): Promise<{ buf: Buffer; pages: number }> {
  const M = style?.margin ?? 46;
  // PDFs use the built-in font closest to the student's: monospace, serif or sans. No italics if their resume has none.
  const fam = style?.mono || /courier|mono/i.test(style?.font || "") ? { r: "Courier", b: "Courier-Bold", i: "Courier-Oblique" }
    : style?.serif ? { r: "Times-Roman", b: "Times-Bold", i: "Times-Italic" } : { r: "Helvetica", b: "Helvetica-Bold", i: "Helvetica-Oblique" };
  const F = { ...fam, i: style?.italic === false ? fam.r : fam.i };
  const base = (style?.size ?? 9.5) * scale;
  return new Promise((resolve, reject) => {
    const edge = Math.min(M, 40) - 14 * tight; // top and bottom margins give a little room when it must fit
    const pdf = new PDFDocument({ size: "LETTER", bufferPages: true, margins: { top: edge, bottom: edge, left: M, right: M }, info: { Creator: "Remy" } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("error", reject);
    const W = pdf.page.width - M * 2;
    // tight 0 → 1: less room between lines, entries and sections before any text gets smaller.
    const lineGap = -1.2 * tight;
    pdf.on("pageAdded", () => pdf.x = M);
    pdf.font(F.b).fontSize(base + 5.5).text(doc.contact.name, { align: "center" });
    pdf.font(F.r).fontSize(base - 0.5).text([doc.contact.location, doc.contact.email, doc.contact.phone, doc.contact.links].filter(Boolean).join(" | "), { align: "center" });
    const rule = (title: string) => {
      pdf.moveDown(0.45 * (1 - 0.5 * tight)).font(F.b).fontSize(base + 1).text(title.toUpperCase(), M, pdf.y);
      const y = pdf.y + 1;
      pdf.moveTo(M, y).lineTo(M + W, y).lineWidth(0.7).stroke();
      pdf.moveDown(0.25 * (1 - 0.6 * tight));
    };
    const row = (left: string, right: string, font: string) => {
      const y = pdf.y;
      pdf.font(font).fontSize(base).text(left, M, y, { width: W * 0.7, lineGap });
      const after = pdf.y;
      if (right) pdf.font(font).fontSize(base).text(right, M, y, { width: W, align: "right", lineGap });
      pdf.y = Math.max(after, pdf.y);
      pdf.x = M;
    };
    for (const b of blocks(doc)) {
      rule(b.heading);
      for (const k of b.skills || []) pdf.font(F.b).fontSize(base).text(k.label + ": ", M, pdf.y, { continued: true, width: W, lineGap }).font(F.r).text(k.items, { lineGap });
      (b.entries || []).forEach((e, i) => {
        if (i) pdf.moveDown(0.3 * (1 - 0.7 * tight));
        if (e.org || e.location) row(e.org, e.location, F.b);
        if (e.role || e.dates) row(e.role, e.dates, F.i);
        for (const x of e.bullets) pdf.font(F.r).fontSize(base).text("•  " + x.text, M + 8, pdf.y, { width: W - 8, indent: -8, lineGap });
        pdf.x = M;
      });
    }
    const pages = pdf.bufferedPageRange().count;
    pdf.on("end", () => resolve({ buf: Buffer.concat(chunks), pages }));
    pdf.end();
  });
}

/** Remy's clean one-column resume in the student's own font, size and margins. If it runs longer than the
 *  original, it first tightens spacing, then shrinks text a little (never below 8 pt, or 1.5 pt under theirs). */
export async function resumePdf(doc: ResumeDoc, style?: ResumeStyle): Promise<Buffer> {
  const target = style?.pages ?? 1;
  const size = style?.size ?? 9.5;
  const floor = Math.max(8, size - 1.5);
  let out = await renderResume(doc, style, 1, 0);
  for (const [scale, tight] of [[1, 0.5], [1, 1], [0.95, 1], [0.9, 1], [0.85, 1]]) {
    if (out.pages <= target || size * scale < floor) break;
    out = await renderResume(doc, style, scale, tight);
  }
  return out.buf;
}

export function letterPdf(name: string, contact: string, letter: string): Promise<Buffer> {
  return pdfBuffer((pdf) => {
    pdf.font("Helvetica-Bold").fontSize(13).text(name);
    pdf.font("Helvetica").fontSize(9.5).text(contact).moveDown(1.2);
    for (const p of letter.split(/\n\s*\n/)) pdf.font("Helvetica").fontSize(10.5).text(p.replace(/\n/g, " ").trim(), { align: "left", lineGap: 2 }).moveDown(0.8);
  });
}

export const resumeTxt = (doc: ResumeDoc) => resumeToText(doc);
