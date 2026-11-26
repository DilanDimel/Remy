// Format check (owners first, Nov 25, 2026). Dilan: "what if someone gives you a resume with pictures, 4 pages, what does
// Remy do? Nothing." Remy now reads the file's layout (pages, a photo, side-by-side columns, text size, margins) and says
// plainly what hurts it for the student's level, then offers three clean formats.
// The norms come from 4,528 real resumes (Nov 25 study, see docs/ai/status/lead/resume-accuracy.md): career-center
// student samples are 100% one page with no photo and a summary on 23%; people with 5+ years mostly use two pages and a
// summary (63-85%); three or more pages are common only past 10 years.
import type { FormatFinding, ResumeDoc, ResumeLayout } from "@shared/types";

/** Page 1's layout: a headshot-like picture, side-by-side text, the usual text size and the tightest side margin. */
export async function pdfLayout(buf: Buffer): Promise<ResumeLayout | null> {
  const { getDocumentProxy } = await import("unpdf");
  const { OPS } = await import("unpdf/pdfjs" as any).catch(() => ({ OPS: null as any }));
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const page = await pdf.getPage(1);
  const { width: W, height: H } = page.getViewport({ scale: 1 });
  const tc: any = await page.getTextContent();
  const lines = (tc.items as any[]).filter((it) => it.str?.trim() && it.transform).map((it) => ({ x: it.transform[4], y: H - it.transform[5], w: it.width as number, n: it.str.trim().length, size: Math.hypot(it.transform[0], it.transform[1]) }));
  if (!lines.length) return null;
  // The size most of the letters are set in.
  const bySize = new Map<number, number>();
  for (const l of lines) bySize.set(Math.round(l.size * 2) / 2, (bySize.get(Math.round(l.size * 2) / 2) || 0) + l.n);
  const bodySize = [...bySize].sort((a, b) => b[1] - a[1])[0][0];
  const margin = Math.round(Math.min(...lines.map((l) => l.x), ...lines.map((l) => W - (l.x + l.w))));
  // Two columns: real sentences in the right half sitting at the same height as text in the left part, many times over.
  const right = lines.filter((l) => l.x > W * 0.45 && l.n > 25);
  const beside = lines.filter((l) => l.x + l.w < W * 0.42 && right.some((r) => Math.abs(r.y - l.y) < 4)).length;
  let photo = false;
  if (OPS) {
    // An image fills the unit square of the current transform; a headshot is about 0.6-3 in wide, upright, near the top.
    const ops = await page.getOperatorList();
    let m = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    const mul = (a: number[], b: number[]) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
    ops.fnArray.forEach((fn: number, i: number) => {
      if (fn === OPS.save) stack.push(m);
      else if (fn === OPS.restore) m = stack.pop() ?? m;
      else if (fn === OPS.transform) m = mul(ops.argsArray[i], m);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const w = Math.hypot(m[0], m[1]), h = Math.hypot(m[2], m[3]), top = H - Math.max(m[5], m[5] + m[3]);
        if (w >= 45 && w <= 220 && h / w >= 0.7 && h / w <= 1.6 && top < H * 0.45) photo = true;
      }
    });
  }
  return { pages: pdf.numPages, photo, columns: beside >= 8, bodySize, margin };
}

/** The same layout read from a Word file (most student uploads that aren't PDFs used to get no format check at all).
 *  Pages come from Word's own count (docProps/app.xml); a file that never stored it is estimated from its words. */
export async function docxLayout(buf: Buffer): Promise<ResumeLayout | null> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return null;
  const app = (await zip.file("docProps/app.xml")?.async("string")) || "";
  const styles = (await zip.file("word/styles.xml")?.async("string")) || "";
  const text = (x: string) => [...x.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
  const words = text(xml.replace(/<\/w:p>/g, " </w:p>").replace(/<w:t(?:\s[^>]*)?>/g, (m) => m + " ")).split(/\s+/).filter(Boolean).length;
  const stored = +(app.match(/<Pages>(\d+)<\/Pages>/)?.[1] || 0);
  const pages = stored || Math.max(1, Math.ceil(words / 600)); // shortcut: ~600 words a page when Word didn't store a count
  // A headshot: an image 0.6-3 in wide (914,400 EMU an inch), about as tall as it is wide.
  const photo = [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].some(([, cx, cy]) => { const w = +cx / 914400, r = +cy / +cx; return w >= 0.6 && w <= 3 && r >= 0.7 && r <= 1.6; });
  // Side-by-side text: Word columns, or a layout table with real sentences in two cells of the same row, many times over.
  const rows = [...xml.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].filter(([r]) => [...r.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].filter(([c]) => text(c).length > 25).length >= 2).length;
  const columns = /<w:cols [^>]*w:num="([2-9])"/.test(xml) || rows >= 4;
  // The size most letters are set in (half-points), from each run's own size or the document default.
  const base = +(styles.match(/<w:docDefaults>[\s\S]*?<w:sz w:val="(\d+)"/)?.[1] || 22);
  const bySize = new Map<number, number>();
  for (const [r] of xml.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)) {
    const n = text(r).length;
    if (!n) continue;
    const sz = +(r.match(/<w:sz w:val="(\d+)"/)?.[1] || base) / 2;
    bySize.set(sz, (bySize.get(sz) || 0) + n);
  }
  const bodySize = [...bySize].sort((a, b) => b[1] - a[1])[0]?.[0] || base / 2;
  const mar = xml.match(/<w:pgMar [^>]*>/)?.[0] || "";
  const side = (k: string) => +(mar.match(new RegExp(`w:${k}="(\\d+)"`))?.[1] || 1440) / 20; // twips → points
  return { pages, photo, columns, bodySize, margin: Math.round(Math.min(side("left"), side("right"))) };
}

// Only as a label ("Gender: Male"), so "Gender Studies" or "religion reporter" isn't flagged.
const PERSONAL = /(^|\n|\|)\s*(date of birth|birth ?date|birthday|d\.o\.b\.?|marital status|nationality|gender|sex|religion|ethnicity|ssn|passport (?:no|number))\s*[:：-]/i;
const SUMMARY = /^(professional |career |executive )?(summary|profile|objective|about me|career objective|personal statement|summary of qualifications|qualifications summary)$/i;

/** The resume for Remy's clean formats: personal-detail lines (birthday, nationality) left out, and sections that
 *  held only those dropped. The saved resume isn't changed. */
export function withoutPersonal(doc: ResumeDoc): ResumeDoc {
  const keep = (t: string) => !PERSONAL.test("\n" + t);
  return { ...doc, sections: doc.sections.map((s) => ({ ...s, entries: s.entries.map((e) => ({ ...e, bullets: e.bullets.filter((b) => keep(b.text)) })).filter((e) => keep(e.org) && keep(e.role) && (e.org || e.role || e.dates || e.bullets.length)) })).filter((s) => s.entries.length) };
}

/** Years of work shown: from the earliest dated job (not school) to the latest or today. */
export function yearsShown(doc: ResumeDoc, now = new Date()): number {
  const ys: number[] = [];
  for (const s of doc.sections) {
    if (/educat|school|academ|course|honou?r|award|certif/i.test(s.heading)) continue;
    for (const e of s.entries) {
      for (const y of e.dates.match(/(19|20)\d{2}/g) || []) ys.push(+y);
      if (/present|current|now/i.test(e.dates)) ys.push(now.getFullYear());
    }
  }
  return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
}

/** What hurts this resume's format, worst first. `student`: still in school or within a year of graduating. */
export function formatCheck(doc: ResumeDoc, rawText: string, layout: ResumeLayout | undefined, student: boolean): FormatFinding[] {
  const out: FormatFinding[] = [];
  const years = yearsShown(doc);
  const words = rawText.split(/\s+/).filter(Boolean).length;
  const pages = layout?.pages ?? 0;
  const okPages = student ? 1 : 2; // US set: 1-2 pages for 73-88% of people at every level past school
  if (pages > okPages) out.push({ id: "pages", level: pages - okPages >= 2 ? "bad" : "fix", title: `${pages} pages is too long${student ? " for a student" : ""}`,
    detail: student ? "Every sample resume from the career centers we studied is one page. Recruiters skim the first page in seconds, so keep your best things there and cut the rest." : `Even with ${years || "several"} years of work, two pages is the norm. Keep the last 10 years in detail and shorten older roles to one line.` });
  if (layout?.photo) out.push({ id: "photo", level: "bad", title: "Take the photo off", detail: "US employers ask for resumes without photos, and many screen out ones that have them to avoid bias. None of the career-center samples we studied has one." });
  if (PERSONAL.test(rawText)) out.push({ id: "personal", level: "bad", title: "Remove personal details", detail: "Birthday, gender, marital status, nationality and religion don't belong on a US resume. They take space and invite bias." });
  if (layout?.columns) out.push({ id: "columns", level: "fix", title: "Two columns can scramble in job sites", detail: "Some application systems read straight across both columns and mix your lines up. One column is safest." });
  if (layout && layout.bodySize > 0 && layout.bodySize < 9.5) out.push({ id: "tiny", level: "fix", title: "Text is too small to read", detail: `Most of it is ${layout.bodySize} pt. Use 10-12 pt and cut words instead of shrinking them.` });
  else if (layout && layout.margin < 22) out.push({ id: "crowded", level: "fix", title: "The page is crowded to the edges", detail: "Text runs within a third of an inch of the edge, which looks cramped and can get cut off when printed. Keep about 0.5-1 inch and trim a line or two." });
  if (student && words > 750) out.push({ id: "words", level: "fix", title: `${words} words is a lot for one page`, detail: "Student samples run about 350-450 words. Keep 3-4 bullets for your strongest roles and 1-2 for the rest." });
  // From the file's own headings: the reader files loose lines under the name as "Summary" too.
  const hasSummary = rawText.split("\n").some((l) => SUMMARY.test(l.trim().replace(/:$/, "")));
  if (student && hasSummary) out.push({ id: "summary", level: "tip", title: "A summary is optional for students", detail: "Only about 1 in 4 student samples has one. Keep it to two lines about what you want and why you fit, or use the space for experience." });
  if (!student && years >= 5 && !hasSummary) out.push({ id: "summary", level: "tip", title: "Add a two-line summary", detail: "Most people with 5+ years open with one: what you do, for whom, and your strongest result." });
  if (/references (are )?available (up)?on request/i.test(rawText)) out.push({ id: "references", level: "tip", title: "Drop \"References available upon request\"", detail: "Employers assume it. Use the line for something they can't." });
  const rank = { bad: 0, fix: 1, tip: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
