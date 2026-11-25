// Format check (owners first, Nov 25): layout read from the PDF, and what Remy says about it. Run with `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import PDFDocument from "pdfkit";
import type { ResumeDoc } from "@shared/types";
import { formatCheck, pdfLayout, withoutPersonal, yearsShown } from "./format";
import { toPng } from "./pdfTwin";
import { resumePdf } from "./docs";

async function pdf(draw: (d: PDFKit.PDFDocument) => void): Promise<Buffer> {
  const d = new PDFDocument({ size: "LETTER", margin: 50 });
  const chunks: Buffer[] = [];
  d.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((r) => d.on("end", () => r()));
  draw(d);
  d.end();
  await done;
  return Buffer.concat(chunks);
}
const job = (dates: string) => ({ id: "e" + dates, org: "Acme", role: "Analyst", location: "", dates, bullets: [] });
const doc = (dates: string[]): ResumeDoc => ({ contact: { name: "Jordan Lee", email: "", phone: "", location: "", links: "" }, skills: [],
  sections: [{ id: "s", heading: "Experience", entries: dates.map(job) }, { id: "ed", heading: "Education", entries: [job("2001 – 2005")] }] }) as any;

test("format: a headshot and a second page are read from the PDF", async () => {
  const face = toPng(2, 2, 3, new Uint8ClampedArray(16).fill(180))!;
  const buf = await pdf((d) => {
    d.image(face, 440, 50, { width: 90, height: 110 });
    d.font("Helvetica").fontSize(10.5).text("Jordan Lee", 50, 50).text("Experience", 50, 90);
    d.addPage().text("References", 50, 50);
  });
  const l = (await pdfLayout(buf))!;
  assert.equal(l.pages, 2);
  assert.equal(l.photo, true);
  assert.equal(l.columns, false);
  assert.equal(l.bodySize, 10.5);
  const plain = (await pdfLayout(await pdf((d) => d.font("Helvetica").fontSize(11).text("Jordan Lee", 50, 50))))!;
  assert.equal(plain.photo, false);
});

test("format: students get one page, no photo, no personal details; experienced people two pages and a summary", () => {
  const layout = { pages: 2, photo: true, columns: false, bodySize: 10, margin: 50 };
  const ids = (f: { id: string }[]) => f.map((x) => x.id);
  const s = formatCheck(doc(["2025 – Present"]), "Jordan Lee\nDate of birth: 1 Jan 2006\nSummary\nEager student", layout, true);
  assert.deepEqual(ids(s), ["photo", "personal", "pages", "summary"]);
  assert.match(s.find((x) => x.id === "pages")!.title, /2 pages is too long for a student/);
  // Twelve years of work: two pages is fine, a missing summary is a tip; three pages isn't.
  const pro = formatCheck(doc(["2014 – 2020", "2020 – Present"]), "Jordan Lee\nExperience\nGender Studies minor", { ...layout, photo: false }, false);
  assert.deepEqual(ids(pro), ["summary"]);
  assert.deepEqual(ids(formatCheck(doc(["2014 – Present"]), "x", { ...layout, photo: false, pages: 3 }, false)), ["pages", "summary"]);
  // A clean one-page student resume gets nothing.
  assert.deepEqual(formatCheck(doc(["2025 – Present"]), "Jordan Lee\nEducation", { ...layout, pages: 1, photo: false }, true), []);
});

test("format: years of work skip school dates", () => {
  assert.equal(yearsShown(doc(["Jun 2019 – Aug 2021", "2021 – 2024"])), 5);
});

test("format: each of the three formats renders a one-page PDF", async () => {
  const d = doc(["2025 – Present"]);
  for (const look of ["classic", "modern", "compact"] as const) {
    const buf = await resumePdf(d, { serif: false, size: 10, margin: 50, pages: 1, look });
    assert.equal((await pdfLayout(buf))!.pages, 1, look);
  }
});

test("format: the clean formats leave out birthday and nationality lines, and sections left empty", () => {
  const d = doc(["2025 – Present"]);
  d.sections.unshift({ id: "x", heading: "Summary", entries: [{ ...job(""), org: "", role: "", bullets: [{ id: "b", text: "Date of birth: 03/14/2005 | Nationality: American" }] }] } as any);
  const out = withoutPersonal(d);
  assert.deepEqual(out.sections.map((s) => s.heading), ["Experience", "Education"]);
  assert.equal(d.sections.length, 3); // the saved resume isn't touched
});
