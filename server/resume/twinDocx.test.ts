import test from "node:test";
import assert from "node:assert/strict";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import { readTwin } from "./pdfTwin";
import { family, twinDocx } from "./twinDocx";

async function pdf(): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((r) => doc.on("end", () => r()));
  doc.image("client/public/icon-512.png", 480, 40, { width: 60 });
  doc.font("Times-Bold").fontSize(18).text("Jordan Lee", 50, 50);
  doc.font("Times-Bold").fontSize(11).text("EXPERIENCE", 50, 90);
  doc.moveTo(50, 104).lineTo(560, 104).lineWidth(0.8).stroke("#000000");
  doc.font("Times-Bold").text("Texas Christian University", 50, 112, { lineBreak: false });
  doc.font("Times-Roman").text("Oct 2025 – Present", 470, 112, { lineBreak: false });
  doc.text("•", 60, 128, { lineBreak: false });
  doc.text("Manage office communications and data entry for 40 faculty members, and organize the department", 72, 128, { lineBreak: false });
  doc.text("resources that 300+ students use each semester", 72, 141, { lineBreak: false });
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

test("Word copy of a PDF: real paragraphs with the PDF's font, the date on a right tab, wrapped bullet joined, rule kept", async () => {
  const zip = await JSZip.loadAsync(await twinDocx(await readTwin(await pdf())));
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.ok(Object.keys(zip.files).some((f) => /^word\/media\/.+\.png$/.test(f)), "the logo comes along");
  assert.match(xml, /<wp:anchor[^>]*>.*?<wp:positionH relativeFrom="page"><wp:posOffset>6096000</s, "at its spot on the page");
  const paras = xml.match(/<w:p>.*?<\/w:p>/g)!.map((p) => p.replace(/<[^>]+>/g, (t) => (t === "<w:tab/>" ? "\t" : "")));
  assert.ok(paras.some((p) => p.endsWith("Jordan Lee")));
  // The heading carries the rule as its bottom border.
  assert.match(xml, /<w:pBdr><w:bottom w:val="single"[^>]*\/><\/w:pBdr>.*?EXPERIENCE/);
  assert.ok(xml.includes('w:val="right"'), "right tab stop for the date");
  assert.ok(paras.some((p) => p.startsWith("Texas Christian University") && p.includes("Oct 2025")));
  const bullet = paras.find((p) => p.includes("Manage office"))!;
  assert.ok(bullet.includes("department resources that 300+ students"), "the wrapped line is one paragraph");
  assert.match(xml, /w:hanging="\d+"/);
  assert.match(xml, /w:ascii="Times New Roman"/);
});

test("Word font names", () => {
  assert.equal(family("ABCDEF+TimesNewRomanPSMT"), "Times New Roman");
  assert.equal(family("Calibri-Bold"), "Calibri");
  assert.equal(family("ArialMT"), "Arial");
  assert.equal(family("LiberationSerif-Italic"), "Times New Roman");
  assert.equal(family("Georgia"), "Georgia");
});
