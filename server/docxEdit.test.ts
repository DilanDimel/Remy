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
  // A new line in an entry with no line from the file to sit next to can't be placed: reported so the caller uses Remy's layout.
  const first = await editResumeDocx(original, doc([["n", "Brand new line"]]), doc([["n", "Brand new line"]]));
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

test("Remy's own Word layout and the cover letter are on US Letter, so right-aligned dates stay inside the margin (Nov 2 deep test)", async () => {
  const { resumeDocx, letterDocx } = await import("./docs");
  const doc = { contact: { name: "A B", email: "a@b.co", phone: "", location: "", links: "" }, skills: [],
    sections: [{ id: "s", heading: "Experience", entries: [{ id: "e", org: "Bell", role: "Intern", location: "Fort Worth, TX", dates: "May 2026 – Aug 2026", bullets: [] }] }] } as any;
  for (const buf of [await resumeDocx(doc, { serif: true, size: 10.5, margin: 36, pages: 1 }), await letterDocx("A B", "a@b.co", "Hello.")]) {
    const xml = await xmlOf(buf);
    assert.match(xml, /<w:pgSz[^>]*w:w="12240"[^>]*w:h="15840"/);
  }
  // The right tab stop is the Letter text width (12240 − 2 × 720), not past A4's narrower page.
  assert.match(await xmlOf(await resumeDocx(doc, { serif: true, size: 10.5, margin: 36, pages: 1 })), /w:pos="10800"/);
});

// Three bullets, so a middle line has neighbours on both sides.
async function threeBullets() {
  const run = (text: string, bold = false) => new TextRun({ text, font: "Georgia", size: 22, bold });
  return Packer.toBuffer(new Document({ sections: [{ children: [
    new Paragraph({ children: [run("Chick-fil-A", true)] }),
    new Paragraph({ bullet: { level: 0 }, children: [run("Took orders at the drive-thru and trained new hires")] }),
    new Paragraph({ bullet: { level: 0 }, children: [run("Worked weekends during the school year")] }),
    new Paragraph({ bullet: { level: 0 }, children: [run("Kept the dining room clean during rush")] }),
  ] }] }));
}
const entry = (bullets: [string, string][]) => ({ contact: {}, skills: [], sections: [{ id: "s", heading: "Experience", entries: [{ id: "e", org: "Chick-fil-A", role: "", location: "", dates: "", bullets: bullets.map(([id, text]) => ({ id, text })) }] }] }) as any;
const FILE: [string, string][] = [["b1", "Took orders at the drive-thru and trained new hires"], ["b2", "Worked weekends during the school year"], ["b3", "Kept the dining room clean during rush"]];

const ORIG = Object.fromEntries(FILE);
const lines = async (buf: Buffer) => [...(await xmlOf(buf)).matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((m) => [...m[0].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("")).filter(Boolean);

test("Word download: a first bullet reworded heavily in Remy replaces the file line it came from, so the student's own file is kept", async () => {
  const original = await threeBullets();
  const base = entry([["b1", "Coached five new team members on speed and accuracy"], FILE[1], FILE[2]]);
  const { buf, missed } = await editResumeDocx(original, base, base, [], ORIG);
  assert.deepEqual(missed, []);
  assert.deepEqual(await lines(buf), ["Chick-fil-A", "Coached five new team members on speed and accuracy", FILE[1][1], FILE[2][1]]);
  assert.equal(((await xmlOf(buf)).match(/<w:numPr>/g) || []).length, 3, "still three bullets");
  // Resumes uploaded before Remy kept the original lines: still reported (safe fallback), never guessed.
  assert.equal((await editResumeDocx(original, base, base)).missed.length, 1);
});

test("Word download: a middle bullet reworded heavily replaces the old line instead of sitting next to it", async () => {
  const base = entry([FILE[0], ["b2", "Covered Saturday shifts all through my classes"], FILE[2]]);
  const { buf, missed } = await editResumeDocx(await threeBullets(), base, base, [], ORIG);
  assert.deepEqual(missed, []);
  assert.deepEqual(await lines(buf), ["Chick-fil-A", FILE[0][1], "Covered Saturday shifts all through my classes", FILE[2][1]]);
});

test("Word download: a new first bullet added in Remy goes in before the entry's next bullet", async () => {
  const base = entry([["n", "Named employee of the month twice"], ...FILE]);
  const { buf, missed } = await editResumeDocx(await threeBullets(), base, base, [], ORIG);
  assert.deepEqual(missed, []);
  assert.deepEqual(await lines(buf), ["Chick-fil-A", "Named employee of the month twice", ...FILE.map((f) => f[1])]);
  assert.equal(((await xmlOf(buf)).match(/<w:numPr>/g) || []).length, 4, "a real bullet");
  assert.equal(((await xmlOf(buf)).match(/w:ascii="Georgia"/g) || []).length, 5, "in the student's font");
});

test("Word download: a new first line and a reworded first line keep their order", async () => {
  const base = entry([["b1", "Coached five new hires on speed"], FILE[1], FILE[2]]);
  const version = entry([["n", "Brand new tailored line"], ["b1", "Coached five new hires on speed"], FILE[1], FILE[2]]);
  const { buf, missed } = await editResumeDocx(await threeBullets(), base, version, [], ORIG);
  assert.deepEqual(missed, []);
  assert.deepEqual(await lines(buf), ["Chick-fil-A", "Brand new tailored line", "Coached five new hires on speed", FILE[1][1], FILE[2][1]]);
});

// Typed "•" bullets (no Word numbering), two entries and a role line: lines added in Remy must never overwrite file lines.
async function typedDocx() {
  const zip = new JSZip();
  const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  zip.file("word/document.xml", `<w:document><w:body>${[
    "Chick-fil-A", "Team Member, May 2023 - Present", "• Took orders at the drive-thru and trained new hires", "• Worked weekends during the school year",
    "Relevant coursework: Accounting I", "Starbucks", "• Made coffee for the morning rush"].map(p).join("")}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
test("Word download: a line added in Remy never overwrites the next job's heading, a role line or a line Remy didn't read, even with shared words", async () => {
  const orig = { b1: "Took orders at the drive-thru and trained new hires", b2: "Worked weekends during the school year" };
  const doc = (bullets: [string, string][]) => ({ contact: {}, skills: [], sections: [{ id: "s", heading: "Experience", entries: [
    { id: "e", org: "Chick-fil-A", role: "Team Member", location: "", dates: "May 2023 - Present", bullets: bullets.map(([id, text]) => ({ id, text })) },
    { id: "e2", org: "Starbucks", role: "", location: "", dates: "", bullets: [{ id: "s1", text: "Made coffee for the morning rush" }] }] }] }) as any;
  const all = [...await lines(await typedDocx())];
  // Added at the end, and added first.
  for (const added of ["Named employee of the month", "Promoted to Team Member in May 2023", "Completed coursework in Accounting I"])
  for (const base of [doc([["b1", orig.b1], ["b2", orig.b2], ["x", added]]), doc([["x", added], ["b1", orig.b1], ["b2", orig.b2]])]) {
    const out = await editResumeDocx(await typedDocx(), base, base, [], { ...orig, s1: "Made coffee for the morning rush" });
    const got = await lines(out.buf);
    for (const l of all) assert.ok(got.includes(l), `kept: ${l}`);
    assert.deepEqual(out.missed, []);
    assert.ok(got.includes(added));
    assert.equal(got.length, all.length + 1);
  }
});

test("Word download: a line deleted in Remy plus a new last line keeps the student's file", async () => {
  const base = entry([FILE[0], FILE[1], ["n", "Named employee of the month twice"]]);
  const { buf, missed } = await editResumeDocx(await threeBullets(), base, base, [FILE[2][1]], ORIG);
  assert.deepEqual(missed, []);
  assert.deepEqual(await lines(buf), ["Chick-fil-A", FILE[0][1], FILE[1][1], "Named employee of the month twice"]);
});

test("Word download: when the line to sit next to appears under two jobs, a new line is reported instead of guessed", async () => {
  const zip = new JSZip();
  const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  zip.file("word/document.xml", `<w:document><w:body>${["Chick-fil-A", "Worked weekends during the school year", "Starbucks", "Worked weekends during the school year", "Made coffee"].map(p).join("")}</w:body></w:document>`);
  const file = await zip.generateAsync({ type: "nodebuffer" });
  const doc = (sb: [string, string][]) => ({ contact: {}, skills: [], sections: [{ id: "s", heading: "Experience", entries: [
    { id: "e1", org: "Chick-fil-A", role: "", location: "", dates: "", bullets: [{ id: "c1", text: "Worked weekends during the school year" }] },
    { id: "e2", org: "Starbucks", role: "", location: "", dates: "", bullets: sb.map(([id, text]) => ({ id, text })) }] }] }) as any;
  const fl = { c1: "Worked weekends during the school year", s1: "Worked weekends during the school year", s2: "Made coffee" };
  const base = doc([["n", "Named barista of the month"], ["s1", "Worked weekends during the school year"], ["s2", "Made coffee"]]);
  const out = await editResumeDocx(file, base, base, [], fl);
  assert.deepEqual(out.missed, ["Named barista of the month"]);
});

test("Word download: a line reworded in Remy and then deleted is taken out of the file by its original wording", async () => {
  const base = entry([FILE[0], FILE[1]]);
  const { buf, missed } = await editResumeDocx(await threeBullets(), base, base, ["Covered weekend shifts", FILE[2][1]], ORIG);
  assert.deepEqual(missed, []);
  assert.deepEqual(await lines(buf), ["Chick-fil-A", FILE[0][1], FILE[1][1]]);
});

// Stage 3: the Resume page shows the student's own Word file with their changes; nothing it can't place is guessed.
test("current Word file: an added skill goes into the Skills line's own run, label and bold kept; unplaceable header is reported", async () => {
  const { currentResumeDocx } = await import("./docxEdit");
  const run = (text: string, bold = false) => new TextRun({ text, font: "Georgia", size: 22, bold });
  const original = await Packer.toBuffer(new Document({ sections: [{ children: [
    new Paragraph({ children: [run("Maya Lopez", true)] }),
    new Paragraph({ children: [run("Chick-fil-A", true)] }),
    new Paragraph({ bullet: { level: 0 }, children: [run("Trained new hires on the drive-thru line")] }),
    new Paragraph({ children: [run("Technical Skills: ", true), run("Excel, PowerPoint")] }),
  ] }] }));
  const doc = { contact: { name: "Maya Lopez", email: "", phone: "", location: "", links: "" }, sections: [{ id: "s", heading: "", entries: [{ id: "e", org: "Chick-fil-A", role: "", location: "", dates: "", bullets: [{ id: "b", text: "Trained new hires on the drive-thru line" }] }] }], skills: [{ id: "k", label: "Technical Skills", items: "Excel, PowerPoint, Tableau" }] } as any;
  const ok = await currentResumeDocx(original, doc);
  assert.deepEqual(ok.missed, []);
  const xml = await xmlOf(ok.buf);
  assert.ok(xml.includes("Excel, PowerPoint, Tableau"));
  assert.match(xml, /<w:b\/>[\s\S]*Technical Skills: /, "label run unchanged");
  const bad = await currentResumeDocx(original, { ...doc, sections: [{ ...doc.sections[0], entries: [{ ...doc.sections[0].entries[0], org: "Starbucks" }] }] });
  assert.deepEqual(bad.missed, ["Starbucks"]);
});
