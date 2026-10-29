// Tailored resumes for students who uploaded a Word file: change only the text of the edited bullets inside
// their own .docx, so fonts, spacing, bullets, columns and everything else stay exactly as they made it.
import JSZip from "jszip";

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const norm = (s: string) => s.replace(/^[\s•●▪◦*–-]+/, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const words = (s: string) => new Set(norm(s).split(/\W+/).filter((w) => w.length > 2));
/** Share of the bullet's words found in the paragraph (handles a bullet the student lightly edited in Remy). */
function overlap(a: string, b: string) {
  const A = words(a), B = words(b);
  if (!A.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.max(A.size, B.size);
}

const T = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g;

/** Replaces each `from` bullet with `to`. The new text takes the first text run's formatting; the paragraph's
 *  bullet, indent and spacing are untouched. Returns the bullets it couldn't find. */
export async function editDocx(buf: Buffer, edits: { from: string; to: string }[]): Promise<{ buf: Buffer; missed: string[] }> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Not a Word document");
  let xml = await file.async("string");
  const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => ({ start: m.index!, xml: m[0], text: decode([...m[0].matchAll(T)].map((t) => t[1] || "").join("")) }));
  const used = new Set<number>();
  const missed: string[] = [];
  const replacements: { start: number; len: number; xml: string }[] = [];
  for (const e of edits) {
    let best = -1, score = 0;
    paras.forEach((p, i) => {
      if (used.has(i) || !p.text.trim()) return;
      const s = norm(p.text) === norm(e.from) ? 1 : overlap(e.from, p.text);
      if (s > score) { score = s; best = i; }
    });
    if (best < 0 || score < 0.6) { missed.push(e.from); continue; }
    used.add(best);
    const p = paras[best];
    let first = true;
    const out = p.xml.replace(T, (m) => {
      if (!first) return m.endsWith("/>") ? m : m.replace(/>[\s\S]*<\/w:t>$/, "></w:t>");
      first = false;
      return `<w:t xml:space="preserve">${encode(e.to)}</w:t>`;
    });
    replacements.push({ start: p.start, len: p.xml.length, xml: out });
  }
  for (const r of replacements.sort((a, b) => b.start - a.start)) xml = xml.slice(0, r.start) + r.xml + xml.slice(r.start + r.len);
  zip.file("word/document.xml", xml);
  return { buf: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), missed };
}

const SERIF = /times|georgia|garamond|cambria|book antiqua|palatino|baskerville|bodoni|century schoolbook|didot|minion|constantia|bookman|caslon/i;
/** How the student's Word file looks (font family, body size, left margin, pages), so Remy's PDF can match it. */
export async function docxStyle(buf: Buffer): Promise<{ serif: boolean; size: number; margin: number; pages: number } | null> {
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) return null;
  const styles = (await zip.file("word/styles.xml")?.async("string")) || "";
  const app = (await zip.file("docProps/app.xml")?.async("string")) || "";
  const tally = (xml: string, re: RegExp) => { const m = new Map<string, number>(); for (const x of xml.matchAll(re)) m.set(x[1], (m.get(x[1]) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0]; };
  const font = tally(doc, /w:ascii="([^"]+)"/g) || tally(styles, /w:ascii="([^"]+)"/g) || "";
  const normal = styles.match(/<w:style\b[^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/)?.[0] || "";
  const half = Number(tally(doc, /<w:sz w:val="(\d+)"/g) || normal.match(/<w:sz w:val="(\d+)"/)?.[1] || styles.match(/<w:docDefaults>[\s\S]*?<w:sz w:val="(\d+)"/)?.[1] || 21);
  const left = Number(doc.match(/<w:pgMar[^>]*w:left="(\d+)"/)?.[1] || 1440);
  const pages = Number(app.match(/<Pages>(\d+)<\/Pages>/)?.[1] || 1);
  return { serif: SERIF.test(font), size: Math.min(12, Math.max(9, half / 2)), margin: Math.min(72, Math.max(28, Math.round(left / 20))), pages: Math.max(1, pages) };
}
