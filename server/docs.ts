import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import PDFDocument from "pdfkit";
import type { ResumeDoc } from "@shared/types";
import { resumeToText } from "./resume";

const FONT = "Calibri";

export async function resumeDocx(doc: ResumeDoc): Promise<Buffer> {
  const kids: Paragraph[] = [];
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: doc.contact.name, bold: true, size: 32, font: FONT })] }));
  const contact = [doc.contact.location, doc.contact.email, doc.contact.phone, doc.contact.links].filter(Boolean).join(" | ");
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: contact, size: 20, font: FONT })] }));
  for (const s of doc.sections) {
    kids.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "222222", space: 1 } },
        children: [new TextRun({ text: s.heading.toUpperCase(), bold: true, size: 22, font: FONT })],
      }),
    );
    for (const e of s.entries) {
      if (e.org || e.location)
        kids.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: 10400 }],
            children: [new TextRun({ text: e.org, bold: true, size: 21, font: FONT }), new TextRun({ text: e.location ? `\t${e.location}` : "", bold: true, size: 21, font: FONT })],
          }),
        );
      if (e.role || e.dates)
        kids.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: 10400 }],
            children: [new TextRun({ text: e.role, italics: true, size: 21, font: FONT }), new TextRun({ text: e.dates ? `\t${e.dates}` : "", italics: true, size: 21, font: FONT })],
          }),
        );
      for (const b of e.bullets) kids.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b.text, size: 21, font: FONT })] }));
    }
  }
  if (doc.skills.length) {
    kids.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "222222", space: 1 } },
        children: [new TextRun({ text: "SKILLS", bold: true, size: 22, font: FONT })],
      }),
    );
    for (const k of doc.skills)
      kids.push(new Paragraph({ children: [new TextRun({ text: `${k.label}: `, bold: true, size: 21, font: FONT }), new TextRun({ text: k.items, size: 21, font: FONT })] }));
  }
  const d = new Document({
    creator: "Remy",
    title: `${doc.contact.name} Resume`,
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: kids }],
  });
  return Packer.toBuffer(d);
}

export async function letterDocx(name: string, contact: string, letter: string): Promise<Buffer> {
  const kids = [
    new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 26, font: FONT })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: contact, size: 20, font: FONT })] }),
    ...letter.split(/\n\s*\n/).map((p) => new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: p.replace(/\n/g, " ").trim(), size: 22, font: FONT })] })),
  ];
  const d = new Document({ creator: "Remy", sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children: kids }] });
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

export function resumePdf(doc: ResumeDoc): Promise<Buffer> {
  return pdfBuffer((pdf) => {
    const W = pdf.page.width - 92;
    pdf.font("Helvetica-Bold").fontSize(15).text(doc.contact.name, { align: "center" });
    pdf.font("Helvetica").fontSize(9).text([doc.contact.location, doc.contact.email, doc.contact.phone, doc.contact.links].filter(Boolean).join(" | "), { align: "center" });
    const rule = (title: string) => {
      pdf.moveDown(0.5).font("Helvetica-Bold").fontSize(10.5).text(title.toUpperCase());
      const y = pdf.y + 1;
      pdf.moveTo(46, y).lineTo(46 + W, y).lineWidth(0.7).stroke();
      pdf.moveDown(0.25);
    };
    const row = (left: string, right: string, font: string) => {
      const y = pdf.y;
      pdf.font(font).fontSize(9.5).text(left, 46, y, { width: W * 0.7 });
      const after = pdf.y;
      if (right) pdf.font(font).fontSize(9.5).text(right, 46, y, { width: W, align: "right" });
      pdf.y = Math.max(after, pdf.y);
      pdf.x = 46;
    };
    for (const s of doc.sections) {
      rule(s.heading);
      for (const e of s.entries) {
        if (e.org || e.location) row(e.org, e.location, "Helvetica-Bold");
        if (e.role || e.dates) row(e.role, e.dates, "Helvetica-Oblique");
        for (const b of e.bullets) pdf.font("Helvetica").fontSize(9.5).text("•  " + b.text, 54, pdf.y, { width: W - 8, indent: -8 });
        pdf.x = 46;
      }
    }
    if (doc.skills.length) {
      rule("Skills");
      for (const k of doc.skills) pdf.font("Helvetica-Bold").fontSize(9.5).text(k.label + ": ", 46, pdf.y, { continued: true }).font("Helvetica").text(k.items);
    }
  });
}

export function letterPdf(name: string, contact: string, letter: string): Promise<Buffer> {
  return pdfBuffer((pdf) => {
    pdf.font("Helvetica-Bold").fontSize(13).text(name);
    pdf.font("Helvetica").fontSize(9.5).text(contact).moveDown(1.2);
    for (const p of letter.split(/\n\s*\n/)) pdf.font("Helvetica").fontSize(10.5).text(p.replace(/\n/g, " ").trim(), { align: "left", lineGap: 2 }).moveDown(0.8);
  });
}

export const resumeTxt = (doc: ResumeDoc) => resumeToText(doc);
