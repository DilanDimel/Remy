// Tailored resumes for students who uploaded a Word file: change only the text of the edited bullets inside
// their own .docx, so fonts, spacing, bullets, columns and everything else stay exactly as they made it.
import type { ResumeDoc, ResumeStyle } from "@shared/types";
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

/** The paragraph's text replaced, keeping its first run's formatting and the paragraph's bullet and spacing. A bullet
 *  typed as text ("• ", "– ") in the old line stays in front of the new one. */
function retext(pxml: string, text: string, old = "") {
  const typed = old.match(/^[\s•●▪◦*–-]+/)?.[0] ?? "";
  const t = typed && !text.startsWith(typed.trim()) ? typed + text : text;
  let first = true;
  return pxml.replace(T, (m) => {
    if (!first) return m.endsWith("/>") ? m : m.replace(/>[\s\S]*<\/w:t>$/, "></w:t>");
    first = false;
    return `<w:t xml:space="preserve">${encode(t)}</w:t>`;
  });
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
  const inRun: { from: string; to: string }[] = [];
  for (const e of edits) {
    let best = -1, score = 0;
    paras.forEach((p, i) => {
      // A paragraph holding several lines (line breaks) is never replaced whole; its lines are edited one by one below.
      if (used.has(i) || !p.text.trim() || p.xml.includes("<w:br")) return;
      const s = norm(p.text) === norm(e.from) ? 1 : overlap(e.from, p.text);
      if (s > score) { score = s; best = i; }
    });
    if (best < 0 || score < 0.6) {
      // Some files keep several bullets in one paragraph, split by line breaks: edit the exact line inside its text run.
      inRun.push(e);
      continue;
    }
    used.add(best);
    const p = paras[best];
    replacements.push({ start: p.start, len: p.xml.length, xml: retext(p.xml, e.to, p.text) });
  }
  for (const r of replacements.sort((a, b) => b.start - a.start)) xml = xml.slice(0, r.start) + r.xml + xml.slice(r.start + r.len);
  for (const e of inRun) {
    const from = e.from.trim();
    let hit = false;
    xml = xml.replace(T, (m, inner) => {
      if (hit || inner === undefined || !decode(inner).includes(from)) return m;
      hit = true;
      return m.replace(/>[\s\S]*<\/w:t>$/, ` xml:space="preserve">${encode(decode(inner).replace(from, e.to))}</w:t>`).replace(/ xml:space="preserve"( xml:space="preserve")+/, ' xml:space="preserve"');
    });
    if (!hit) missed.push(e.from);
  }
  zip.file("word/document.xml", xml);
  return { buf: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), missed };
}

const paragraphs = (xml: string) => [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => ({ start: m.index!, xml: m[0], text: decode([...m[0].matchAll(T)].map((t) => t[1] || "").join("")) }));


/** The approved resume written into the student's own Word file. The diff is against the FILE (not Remy's copy), so
 *  lines changed in Remy before tailoring count too: a reworded line replaces the file line it came from (`fileLines`:
 *  each bullet's text as first read from the file, by id) or else its closest match; an added line goes right after the
 *  line before it, or before the entry's next line when it's first (copying that line's bullet and font); a line
 *  deleted in Remy is removed. Returns missed lines when something can't be placed, so the caller uses Remy's own layout. */
export async function editResumeDocx(buf: Buffer, base: ResumeDoc, version: ResumeDoc, removed: string[] = [], fileLines: Record<string, string> = {}): Promise<{ buf: Buffer; missed: string[] }> {
  const zip = await JSZip.loadAsync(buf);
  const xml0 = await zip.file("word/document.xml")?.async("string");
  if (!xml0) throw new Error("Not a Word document");
  const file = paragraphs(xml0).map((p) => p.text).filter((t) => t.trim());
  const flat = decode([...xml0.matchAll(T)].map((t) => t[1] || "").join(" "));
  const has = (t: string) => file.some((p) => norm(p) === norm(t)) || flat.includes(t.trim());
  const baseById = new Map(base.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => [b.id, b.text] as const))));
  const kept = new Set(version.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.filter((b) => has(b.text)).map((b) => norm(b.text)))));
  const gone = new Set(removed.map(norm));
  const hasOrig = Object.keys(fileLines).length > 0;
  const replace: { from: string; to: string }[] = [], add: { after?: string; before?: string; add: string }[] = [], missed: string[] = [];
  const taken = new Set<string>();
  const free = (p: string) => !kept.has(norm(p)) && !taken.has(p) && !gone.has(norm(p));
  const closest = (t: string, min: number) => {
    const best = file.filter(free).map((p) => [p, overlap(t, p)] as const).sort((x, y) => y[1] - x[1])[0];
    return best && best[1] >= min ? best[0] : "";
  };
  for (const e of version.sections.flatMap((s) => s.entries)) {
    // First where each changed line came from, then where new lines go (a new first line sits before the entry's next line).
    const placed = e.bullets.map((b) => {
      if (has(b.text)) return true;
      // A line added in Remy (not one read from the file) is only ever added, never matched onto a file line.
      if (hasOrig && !(b.id in fileLines)) return false;
      const old = baseById.get(b.id), orig = fileLines[b.id];
      const from = old && has(old) && free(old) ? old
        : orig && has(orig) && free(orig) ? file.find((p) => norm(p) === norm(orig)) || orig
        : (orig && closest(orig, 0.8)) || closest(b.text, 0.6);
      if (!from) return false;
      taken.add(from);
      replace.push({ from, to: b.text });
      return true;
    });
    e.bullets.forEach((b, i) => {
      if (placed[i]) return;
      // A reworded file line Remy couldn't find is reported rather than added next to the old one. Uploads from before
      // Remy kept `fileLines` can't tell new from reworded, so they keep the older rule (after the previous line, or report).
      if (b.id in fileLines) return void missed.push(b.text);
      const prev = i > 0 ? e.bullets[i - 1].text : "";
      const next = hasOrig ? e.bullets.find((x, j) => j > i && placed[j])?.text || "" : "";
      if (prev) add.push({ after: prev, add: b.text });
      else if (next) add.push({ before: next, add: b.text });
      else missed.push(b.text);
    });
  }
  const versionIds = new Set(version.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.id))));
  // Only lines Remy knows were deleted (a file line Remy never read isn't touched).
  const remove = [...new Set([...[...baseById].filter(([id]) => !versionIds.has(id)).map(([, t]) => t), ...removed])].filter((t) => file.some((p) => norm(p) === norm(t)) && !kept.has(norm(t)) && ![...taken].some((x) => norm(x) === norm(t)));
  const first = await editDocx(buf, replace);
  missed.push(...first.missed);
  if (missed.length || (!add.length && !remove.length)) return { buf: first.buf, missed };
  const z2 = await JSZip.loadAsync(first.buf);
  let xml = await z2.file("word/document.xml")!.async("string");
  for (const r of remove) {
    const p = paragraphs(xml).find((x) => norm(x.text) === norm(r) && !x.xml.includes("<w:br"));
    if (p) xml = xml.slice(0, p.start) + xml.slice(p.start + p.xml.length); else missed.push(r);
  }
  for (const a of add) {
    const anchor = a.after ?? a.before!;
    // The anchor must be one clear line: the same text under two jobs could put the new line under the wrong one.
    const hits = paragraphs(xml).filter((x) => norm(x.text) === norm(anchor));
    const p = hits.length === 1 && !hits[0].xml.includes("<w:br") ? hits[0] : null;
    if (!p) { missed.push(a.add); continue; }
    const pos = a.after !== undefined ? p.start + p.xml.length : p.start;
    xml = xml.slice(0, pos) + retext(p.xml, a.add, p.text) + xml.slice(pos);
  }
  z2.file("word/document.xml", xml);
  return { buf: await z2.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), missed };
}

/** The base resume as it stands now, written into the student's own Word file (redesign stage 3: the Resume page shows
 *  their real file, colours on top). Bullets go through editResumeDocx; a changed Skills line has only the changed part
 *  rewritten inside its own text run, so the bold label and fonts stay. Name, contact and job headers must already
 *  match the file; anything that can't be placed is returned in `missed` and the caller shows Remy's rebuild instead. */
export async function currentResumeDocx(buf: Buffer, doc: ResumeDoc, removed: string[] = [], fileLines: Record<string, string> = {}): Promise<{ buf: Buffer; missed: string[] }> {
  const first = await editResumeDocx(buf, doc, doc, removed, fileLines);
  const missed = [...first.missed];
  const zip = await JSZip.loadAsync(first.buf);
  let xml = await zip.file("word/document.xml")!.async("string");
  const flatOf = (x: string) => norm(decode([...x.matchAll(T)].map((t) => t[1] || "").join(" ")).replace(/\s+/g, " "));
  const flat0 = flatOf(xml), squash = (t: string) => norm(t).replace(/\s+/g, "");
  const inFile = (t: string) => !t.trim() || flat0.includes(norm(t)) || flat0.replace(/\s+/g, "").includes(squash(t));
  const c = doc.contact;
  for (const v of [c.name, c.email, c.phone, c.location, c.links]) if (!inFile(v)) missed.push(v);
  for (const s of doc.sections) {
    if (!inFile(s.heading)) missed.push(s.heading);
    for (const e of s.entries) for (const v of [e.org, e.role, e.location, e.dates]) if (!inFile(v)) missed.push(v);
  }
  for (const k of doc.skills) {
    if (inFile(k.items)) continue;
    // The Skills paragraph it came from: the one sharing the most words with the new line.
    const paras = paragraphs(xml).filter((p) => p.text.trim() && !p.xml.includes("<w:br"));
    const best = paras.map((p) => [p, overlap(k.items, p.text)] as const).sort((x, y) => y[1] - x[1])[0];
    if (!best || best[1] < 0.4) { missed.push(k.items); continue; }
    // Keep the file's own label ("Technical Skills: ") and change only the list after it.
    const p = best[0], old = p.text, label = old.match(/^[^:]{0,40}:\s*/)?.[0] ?? "", want = label + k.items;
    let pre = 0; while (pre < old.length && pre < want.length && old[pre] === want[pre]) pre++;
    let suf = 0; while (suf < old.length - pre && suf < want.length - pre && old[old.length - 1 - suf] === want[want.length - 1 - suf]) suf++;
    // Find the text run holding the changed span; a change across runs isn't guessed at.
    let at = 0, done = false;
    const out = p.xml.replace(T, (m, inner) => {
      if (inner === undefined) return m;
      const t = decode(inner), s0 = at, e0 = at + t.length;
      at = e0;
      if (done || pre < s0 || old.length - suf > e0 || (pre === e0 && old.length - suf === e0 && e0 !== old.length)) return m;
      done = true;
      const nt = t.slice(0, pre - s0) + want.slice(pre, want.length - suf) + t.slice(old.length - suf - s0);
      return m.replace(/^<w:t(?:\s[^>]*)?>[\s\S]*<\/w:t>$/, `<w:t xml:space="preserve">${encode(nt)}</w:t>`);
    });
    if (!done) { missed.push(k.items); continue; }
    xml = xml.slice(0, p.start) + out + xml.slice(p.start + p.xml.length);
  }
  zip.file("word/document.xml", xml);
  return { buf: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), missed };
}

const SERIF = /times|georgia|garamond|cambria|book antiqua|palatino|baskerville|bodoni|century schoolbook|didot|minion|constantia|bookman|caslon/i;
/** How the student's Word file looks (font family, body size, left margin, pages), so Remy's PDF can match it. */
export async function docxStyle(buf: Buffer): Promise<ResumeStyle | null> {
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
  const mono = /mono|courier|consolas/i.test(font);
  // Headers and footers too: templates often put the contact line in a header table or text box.
  const edges = (await Promise.all(Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n)).map((n) => zip.file(n)!.async("string")))).join("");
  const layout = { tables: /<w:tbl>/.test(doc + edges), textBoxes: /<w:txbxContent>/.test(doc + edges), columns: /<w:cols\b[^>]*w:num="[2-9]"/.test(doc) };
  return { serif: !mono && SERIF.test(font), mono, italic: /<w:i\/>|<w:i w:val="(1|true)"/.test(doc), font: font || undefined, size: Math.min(12, Math.max(9, half / 2)), margin: Math.min(96, Math.max(28, Math.round(left / 20))), pages: Math.max(1, pages), layout };
}
