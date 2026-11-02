import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { editDocx, editResumeDocx } from "./docxEdit";

// A student's own Word resume: Georgia 11 pt, real bullets, and one bullet saved as three runs (Word does this).
async function studentDocx() {
  const run = (text: string, bold = false) => new TextRun({ text, font: "Georgia", size: 22, bold });
  return Packer.toBuffer(new Document({ sections: [{ children: [
    new Paragraph({ children: [run("Chick-fil-A", true)] }),
    new Paragraph({ bullet: { level: 0 }, children: [run("Took orders at the "), run("drive-thru"), run(" and trained new hires")] }),
    new Paragraph({ bullet: { level: 0 }, children: [run("Worked weekends during the school year")] }),
  ] }] }));
}
const xmlOf = async (buf: Buffer) => (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");

test("tailored Word download: only the changed bullet's text changes; font, size and bullets stay", async () => {
  const original = await studentDocx();
  const { buf, missed } = await editDocx(original, [{ from: "Took orders at the drive-thru and trained new hires", to: "Trained new hires & took drive-thru orders <fast>" }]);
  assert.deepEqual(missed, []);
  const before = await xmlOf(original), after = await xmlOf(buf);
  assert.ok(after.includes("Trained new hires &amp; took drive-thru orders &lt;fast&gt;"));
  assert.ok(!after.includes("Took orders at the"));
  assert.ok(after.includes("Worked weekends during the school year"), "untouched bullet is unchanged");
  // Same paragraphs, same numbering (bullets) and the same fonts and sizes as the student's file.
  const count = (x: string, re: RegExp) => (x.match(re) || []).length;
  assert.equal(count(after, /<w:p[ >]/g), count(before, /<w:p[ >]/g));
  assert.equal(count(after, /<w:numPr>/g), count(before, /<w:numPr>/g));
  assert.equal(count(after, /w:ascii="Georgia"/g), count(before, /w:ascii="Georgia"/g));
  assert.equal(count(after, /<w:sz w:val="22"\/>/g), count(before, /<w:sz w:val="22"\/>/g));
});

test("tailored Word download: a bullet it can't find is reported, not guessed", async () => {
  const { missed } = await editDocx(await studentDocx(), [{ from: "Managed a team of lifeguards at the city pool", to: "x" }]);
  assert.equal(missed.length, 1);
});

test("Word downloads use the student's font: PDF metric twins map to the familiar name, monospace stays monospace", async () => {
  const { wordFont } = await import("./docs");
  assert.equal(wordFont({ serif: false, size: 10, margin: 40, pages: 1, font: "LiberationSans" }), "Arial");
  assert.equal(wordFont({ serif: true, size: 10, margin: 40, pages: 1, font: "LiberationSerif" }), "Times New Roman");
  assert.equal(wordFont({ serif: false, size: 10, margin: 40, pages: 1, font: "Courier", mono: true }), "Courier New");
  assert.equal(wordFont({ serif: true, size: 10, margin: 40, pages: 1, font: "Garamond" }), "Garamond");
  assert.equal(wordFont(undefined), "Calibri");
});

test("a bullet inside a paragraph of line breaks is edited in its own run; nothing else changes", async () => {
  const JSZip = (await import("jszip")).default;
  const { editDocx } = await import("./docxEdit");
  const zip = new JSZip();
  zip.file("word/document.xml", `<w:document><w:body><w:p><w:r><w:rPr><w:rFonts w:ascii="Courier"/></w:rPr><w:t>• Monitored store cameras</w:t><w:br/><w:t>• Wrote incident reports used by store leadership</w:t></w:r></w:p></w:body></w:document>`);
  const out = await editDocx(await zip.generateAsync({ type: "nodebuffer" }), [{ from: "Wrote incident reports used by store leadership", to: "Wrote detailed incident reports for store leadership" }]);
  assert.deepEqual(out.missed, []);
  const xml = await (await JSZip.loadAsync(out.buf)).file("word/document.xml")!.async("string");
  assert.match(xml, /• Wrote detailed incident reports for store leadership/);
  assert.match(xml, /• Monitored store cameras/);
  assert.match(xml, /w:ascii="Courier"/);
});

test("Word download diffs against the file: a line added in Remy goes in with the same bullet and font; edits made before tailoring and deletions reach the file too", async () => {
  const original = await studentDocx();
  const doc = (bullets: [string, string][]) => ({ contact: {}, skills: [], sections: [{ id: "s", heading: "Experience", entries: [{ id: "e", org: "Chick-fil-A", role: "", location: "", dates: "", bullets: bullets.map(([id, text]) => ({ id, text })) }] }] }) as any;
  // Base in Remy: the first bullet reworded, a new third bullet added. The tailored version keeps both.
  const base = doc([["b1", "Took drive-thru orders and trained new hires"], ["b2", "Worked weekends during the school year"], ["b3", "Helped plan a $2,000 banquet budget"]]);
  const { buf, missed } = await editResumeDocx(original, base, base);
  assert.deepEqual(missed, []);
  const before = await xmlOf(original), after = await xmlOf(buf);
  const count = (x: string, re: RegExp) => (x.match(re) || []).length;
  assert.ok(after.includes("Took drive-thru orders and trained new hires") && !after.includes("Took orders at the"), "reworded in Remy before tailoring");
  assert.ok(after.indexOf("Helped plan a $2,000 banquet budget") > after.indexOf("Worked weekends"), "added line goes after the one before it");
  assert.equal(count(after, /<w:numPr>/g), count(before, /<w:numPr>/g) + 1, "the new line is a real bullet");
  assert.equal(count(after, /w:ascii="Georgia"/g), count(before, /w:ascii="Georgia"/g) + 1, "in the student's font");
  // A line deleted in Remy is removed from the file.
  const gone = await editResumeDocx(original, doc([["b1", "Took orders at the drive-thru and trained new hires"]]), doc([["b1", "Took orders at the drive-thru and trained new hires"]]), ["Worked weekends during the school year"]);
  const notKnown = await editResumeDocx(original, doc([["b1", "Took orders at the drive-thru and trained new hires"]]), doc([["b1", "Took orders at the drive-thru and trained new hires"]]));
  assert.ok((await xmlOf(notKnown.buf)).includes("Worked weekends"), "a file line Remy never read isn't removed");
  assert.ok(!(await xmlOf(gone.buf)).includes("Worked weekends"));
  // A new first line with nothing before it can't be placed: reported so the caller uses Remy's layout.
  const first = await editResumeDocx(original, doc([["n", "Brand new line"], ["b1", "Took orders at the drive-thru and trained new hires"]]), doc([["n", "Brand new line"], ["b1", "Took orders at the drive-thru and trained new hires"]]));
  assert.deepEqual(first.missed, ["Brand new line"]);
});

test("layout check: Remy notices a table in the student's Word file", async () => {
  const { docxStyle } = await import("./docxEdit");
  const { Table, TableRow, TableCell } = await import("docx");
  const plain = await docxStyle(await studentDocx());
  assert.deepEqual(plain?.layout, { tables: false, textBoxes: false, columns: false });
  const withTable = await Packer.toBuffer(new Document({ sections: [{ children: [
    new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph("Chick-fil-A")] }), new TableCell({ children: [new Paragraph("2024 – Present")] })] })] }),
  ] }] }));
  const s = await docxStyle(withTable);
  assert.equal(s?.layout?.tables, true);
});

test("layout check: a table in the Word header (where contact lines often sit) counts", async () => {
  const { docxStyle } = await import("./docxEdit");
  const { Table, TableRow, TableCell, Header } = await import("docx");
  const buf = await Packer.toBuffer(new Document({ sections: [{
    headers: { default: new Header({ children: [new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph("Dilan Desman")] }), new TableCell({ children: [new Paragraph("d@x.com")] })] })] })] }) },
    children: [new Paragraph("Experience")],
  }] }));
  assert.equal((await docxStyle(buf))?.layout?.tables, true);
});
