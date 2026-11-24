import test from "node:test";
import assert from "node:assert/strict";
import PDFDocument from "pdfkit";
import { currentResumePdf, readTwin, twinPdf } from "./pdfTwin";

// A small one-column resume PDF: name, a ruled heading, a job with two bullets, then a second heading.
async function resumePdf(): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((r) => doc.on("end", () => r()));
  doc.font("Times-Bold").fontSize(18).text("Jordan Lee", 50, 50);
  doc.font("Times-Bold").fontSize(11).text("EXPERIENCE", 50, 90);
  doc.moveTo(50, 104).lineTo(560, 104).lineWidth(0.8).stroke("#000000");
  doc.font("Times-Roman").fontSize(11).text("Texas Christian University, Work Study Student", 50, 112);
  doc.text("• Manage office communications and help organize resources for students", 60, 128);
  doc.text("• Deliver administrative support to faculty and staff", 60, 144);
  doc.font("Times-Bold").text("SKILLS", 50, 170);
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
const one = "Manage office communications and help organize resources for students";
const two = "Deliver administrative support to faculty and staff";
const resume = (bullets: { id: string; text: string }[]) => ({ contact: { name: "Jordan Lee", email: "", phone: "", location: "", links: "" }, skills: [],
  sections: [{ id: "s", heading: "EXPERIENCE", entries: [{ id: "e", org: "Texas Christian University", role: "Work Study Student", dates: "", location: "", bullets }] }] }) as any;
const lineOf = async (buf: Buffer, re: RegExp) => (await readTwin(buf)).pages[0].items.filter((i) => re.test(i.str));

test("PDF twin: a reworded line is rewritten in place, wraps in its own width, and what's below moves down", async () => {
  const pdf = await resumePdf();
  const longer = "Manage office communications and data entry for 40 faculty members, and organize the department resources that 300+ students use each semester";
  const out = await currentResumePdf(pdf, resume([{ id: "b1", text: longer }, { id: "b2", text: two }]), { b1: one, b2: two });
  assert.deepEqual(out.missed, []);
  const text = (await readTwin(out.buf!)).pages[0].items.map((i) => i.str).join(" ");
  assert.ok(text.includes("40 faculty members") && !text.includes("help organize resources"));
  assert.ok(text.includes("Jordan Lee") && text.includes("Deliver administrative support"));
  // Still the bullet in front, at the same spot; the next line and heading sit one line lower than before.
  const [before] = await lineOf(pdf, /^SKILLS/), [after] = await lineOf(out.buf!, /^SKILLS/);
  assert.ok(after.y - before.y > 10 && after.y - before.y < 20, `moved ${after.y - before.y}`);
  assert.ok((await lineOf(out.buf!, /•/)).length >= 2);
});

test("PDF twin: a deleted line closes up", async () => {
  const pdf = await resumePdf();
  const out = await currentResumePdf(pdf, resume([{ id: "b2", text: two }]), { b1: one, b2: two });
  assert.deepEqual(out.missed, []);
  const text = (await readTwin(out.buf!)).pages[0].items.map((i) => i.str).join(" ");
  assert.ok(!text.includes("Manage office"));
  const [before] = await lineOf(pdf, /^SKILLS/), [after] = await lineOf(out.buf!, /^SKILLS/);
  assert.ok(before.y - after.y > 10, "moved up");
});

test("PDF twin: a line added in Remy goes under the bullet before it, with its bullet; one with nothing above is reported", async () => {
  const pdf = await resumePdf();
  const added = await currentResumePdf(pdf, resume([{ id: "b1", text: one }, { id: "new", text: "Trained two new student workers" }, { id: "b2", text: two }]), { b1: one, b2: two });
  assert.deepEqual(added.missed, []);
  const [a] = await lineOf(added.buf!, /Trained two new/), [b1] = await lineOf(added.buf!, /Manage office/), [b2] = await lineOf(added.buf!, /Deliver administrative/);
  assert.ok(a.y > b1.y && a.y < b2.y, "between its neighbours");
  assert.ok(a.str.startsWith("•") && Math.abs(a.x - b1.x) < 1, "same bullet and indent");
  const [before] = await lineOf(pdf, /^SKILLS/), [after] = await lineOf(added.buf!, /^SKILLS/);
  assert.ok(after.y - before.y > 10, "what's below moved down");
  const first = await currentResumePdf(pdf, resume([{ id: "new", text: "Trained two new student workers" }, { id: "b1", text: one }, { id: "b2", text: two }]), { b1: one, b2: two });
  assert.equal(first.buf, null);
  assert.deepEqual(first.missed, ["Trained two new student workers"]);
});

test("PDF twin: a picture (a logo) is carried over at its spot", async () => {
  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((r) => doc.on("end", () => r()));
  doc.image("client/public/icon-512.png", 480, 40, { width: 80 });
  doc.font("Times-Roman").fontSize(11).text("Jordan Lee", 50, 50);
  doc.end();
  await done;
  const t = await readTwin(Buffer.concat(chunks));
  const [im] = t.pages[0].images!;
  assert.ok(Math.abs(im.x - 480) < 1 && Math.abs(im.y - 40) < 1 && Math.abs(im.w - 80) < 1, JSON.stringify({ ...im, png: 0 }));
  assert.equal(im.png.subarray(1, 4).toString(), "PNG");
  const again = await readTwin(await twinPdf(t));
  assert.equal(again.pages[0].images!.length, 1);
});
