import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import dns from "node:dns/promises";
import net from "node:net";
import type { Requirement } from "@shared/types";
import { aiJson } from "./ai";

// ---------- file → text ----------
const unreadable = (message: string, status = 422) => Object.assign(new Error(message), { status });

export async function fileToText(buf: Buffer, name: string, mime: string): Promise<string> {
  const lower = name.toLowerCase();
  // The file's first bytes win over its name: a .docx renamed to .pdf is still a zip.
  const isPdf = buf.subarray(0, 5).toString("latin1") === "%PDF-";
  const isZip = buf.length > 4 && buf.readUInt32BE(0) === 0x504b0304;
  const isOldWord = buf.length > 4 && buf.readUInt32BE(0) === 0xd0cf11e0;
  if (isPdf || (!isZip && (mime === "application/pdf" || lower.endsWith(".pdf")))) {
    try {
      return await pdfText(buf);
    } catch {
      throw unreadable("We couldn't read that PDF. It may be password-protected or damaged — export it again, or upload a Word (.docx) file.");
    }
  }
  if (isZip || lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    try {
      return await docxText(buf);
    } catch {
      throw unreadable("We couldn't read that Word file. Open it in Word or Google Docs, save it again as .docx or PDF, and upload that.");
    }
  }
  if (isOldWord || lower.endsWith(".doc")) throw unreadable("That's an older Word (.doc) file. Save it as .docx or PDF and upload it again.", 415);
  if (lower.endsWith(".txt") || lower.endsWith(".md") || mime.startsWith("text/")) {
    return buf[0] === 0xff && buf[1] === 0xfe ? buf.subarray(2).toString("utf16le") : buf.toString("utf8");
  }
  throw unreadable("Please upload a PDF, Word (.docx) or plain-text file.", 415);
}

async function pdfText(buf: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const pages: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    pages.push(layoutLines(items as PdfTextItem[]));
  }
  return dropRunningLines(pages).map((lines) => lines.join("\n")).join("\n");
}

/** Removes a header or footer printed on every page ("Jane Doe · Résumé | 2", "John Doe – 1/2").
 * Page 1 keeps its first lines: the name at the top is the resume's own heading. */
export function dropRunningLines(pages: string[][]): string[][] {
  if (pages.length < 2) return pages;
  const key = (l: string) => l.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  const edges = (lines: string[]) => [...lines.slice(0, 2), ...lines.slice(-2)];
  const seen = new Map<string, number>();
  for (const lines of pages) for (const k of new Set(edges(lines).filter((l) => l.length <= 100 && !/^[•●▪◦*–-]/.test(l)).map(key))) seen.set(k, (seen.get(k) || 0) + 1);
  const running = new Set([...seen].filter(([, n]) => n === pages.length).map(([k]) => k));
  return pages.map((lines, p) =>
    lines.filter((l, k) => !(running.has(key(l)) && (k >= lines.length - 2 || (p > 0 && k < 2)))),
  );
}

type PdfTextItem = { str?: string; transform?: number[]; width?: number; height?: number; hasEOL?: boolean };

/** Rebuilds a page's lines from pdf.js text items. A wide gap on a line (a
 * right-aligned date or location, a table column) becomes a tab, so the
 * parsers can tell "Texas Christian University⇥Fort Worth, TX" apart. */
export function layoutLines(items: PdfTextItem[]): string[] {
  const lines: string[] = [];
  let line = "";
  let end = NaN; // where the last visible text on this line ended
  let y = NaN;
  let size = 10;
  let spaced = false;
  const flush = () => {
    if (line.trim()) lines.push(line.trim());
    line = "";
    end = y = NaN;
    spaced = false;
  };
  for (const it of items) {
    if (typeof it.str !== "string") continue; // marked-content markers
    const [a = 0, , , d = 0, x = 0, ty = 0] = it.transform || [];
    if (!it.str.trim()) {
      if (it.str) spaced = true;
      if (it.hasEOL) flush();
      continue;
    }
    size = Math.abs(d) || Math.abs(a) || it.height || size;
    if (!Number.isNaN(y) && Math.abs(ty - y) > size * 0.6) flush(); // a new line without an EOL marker
    if (!Number.isNaN(end)) {
      const gap = x - end;
      if (gap > size * 2) line = line.trimEnd() + "\t";
      else if ((spaced || gap > size * 0.15 || gap < -size) && !/\s$/.test(line) && !/^\s/.test(it.str)) line += " ";
    }
    line += it.str;
    end = x + (it.width || it.str.length * size * 0.5);
    y = ty;
    spaced = false;
    if (it.hasEOL) flush();
  }
  flush();
  return lines;
}

async function docxText(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  // HTML keeps what raw text loses: Word's bullet lists, table cells and line breaks.
  const { value } = await mammoth.convertToHtml({ buffer: buf });
  const body = decodeHtml(
    value
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/t[dh]>/gi, "\t")
      .replace(/<br\s*\/?>|<\/(?:p|h\d|li|tr|ul|ol|table)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
  // Many templates put the name and contact details in the page header, which mammoth skips.
  const have = norm(body);
  const header = [...new Set(docxParts(buf, /^word\/header\d*\.xml$/).flatMap(wordXmlLines))].filter((l) => !have.includes(norm(l)));
  return [...header, body].join("\n");
}

/** Paragraphs of a WordprocessingML part, with tabs kept. */
function wordXmlLines(xml: string): string[] {
  return xml
    .split(/<\/w:p>/)
    .map((p) => decodeHtml(p.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "")).trim())
    .filter(Boolean);
}

/** The text of the zip entries whose names match (a .docx is a zip). Just enough to read headers. */
function docxParts(buf: Buffer, want: RegExp): string[] {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) return [];
  const out: string[] = [];
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0 && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; n--) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLength = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLength);
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    if (!want.test(name) || local + 30 > buf.length) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    try {
      out.push((method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"));
    } catch {} // a damaged header is skipped; the body still reads
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeHtml = (s: string) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (_m, dec, hex, name) =>
    dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ENTITIES[name.toLowerCase()],
  );

/** Lower-case with accents and ligatures folded away ("Física" → "fisica"). */
export const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
export const norm = (s: string) => fold(s).replace(/[^a-z0-9$%]+/g, "");

// ---------- public page fetch (posting import, link re-checks) ----------
const BLOCKED = [/(^|\.)linkedin\.com$/i, /(^|\.)joinhandshake\.com$/i, /(^|\.)handshake\.com$/i, /(^|\.)stellic\.com$/i, /(^|\.)my\.tcu\.edu$/i];

function privateIp(ip: string): boolean {
  let x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) x = x.slice(7); // IPv4-mapped IPv6
  if (net.isIPv4(x)) {
    const [a, b, c] = x.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (!net.isIPv6(x)) return true;
  return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^fe[c-f]/.test(x) || x.startsWith("64:ff9b:") || x.startsWith("ff");
}

// DNS lookup used at connect time: every resolved address is checked, so a host
// can't pass validation and then rebind to an internal address.
function safeLookup(hostname: string, opts: any, cb: any) {
  dns.lookup(hostname, { all: true }).then(
    (addrs) => {
      if (!addrs.length || addrs.some((a) => privateIp(a.address))) return cb(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }));
      if (opts && opts.all) return cb(null, addrs);
      cb(null, addrs[0].address, addrs[0].family);
    },
    (e) => cb(e),
  );
}

function validateUrl(raw: string | URL): URL {
  let u: URL;
  try {
    u = new URL(String(raw));
  } catch {
    throw Object.assign(new Error("That doesn't look like a valid link."), { status: 400 });
  }
  if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error("Only http(s) links are supported."), { status: 400 });
  if (u.username || u.password) throw Object.assign(new Error("Links with embedded logins aren't supported."), { status: 400 });
  if (BLOCKED.some((r) => r.test(u.hostname)))
    throw Object.assign(
      new Error("Remy doesn't read pages behind a login (LinkedIn, Handshake, Stellic, my.tcu.edu). Paste the posting text instead."),
      { status: 422, code: "login-wall" },
    );
  const h = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(h) && privateIp(h)) throw Object.assign(new Error("That address can't be reached."), { status: 400 });
  return u;
}

function getOnce(u: URL): Promise<{ status: number; location?: string; body: Buffer }> {
  const mod = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      u,
      {
        method: "GET",
        lookup: safeLookup as any,
        timeout: 12000,
        headers: { "User-Agent": "RemyBot/1.0 (student-requested single page read)", Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "gzip, deflate, br" },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: String(res.headers.location), body: Buffer.alloc(0) });
        }
        const enc = String(res.headers["content-encoding"] || "");
        const stream: NodeJS.ReadableStream = enc.includes("br") ? res.pipe(zlib.createBrotliDecompress()) : enc.includes("gzip") ? res.pipe(zlib.createGunzip()) : enc.includes("deflate") ? res.pipe(zlib.createInflate()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > 3_000_000) { req.destroy(); return resolve({ status, body: Buffer.concat(chunks) }); }
          chunks.push(c);
        });
        stream.on("end", () => resolve({ status, body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e: any) => reject(e?.code === "EBLOCKED" ? Object.assign(new Error("That address can't be reached."), { status: 400 }) : e));
    req.end();
  });
}

export async function fetchPublic(url: string): Promise<{ status: number; html: string; finalUrl: string }> {
  let u = validateUrl(url);
  for (let hop = 0; hop < 5; hop++) {
    const r = await getOnce(u);
    if (r.location) {
      u = validateUrl(new URL(r.location, u)); // re-check every redirect target
      continue;
    }
    return { status: r.status, html: r.body.toString("utf8"), finalUrl: u.toString() };
  }
  throw Object.assign(new Error("That link redirects too many times."), { status: 400 });
}

export function htmlToText(html: string): string {
  // Prefer structured JobPosting data when the page provides it.
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ld) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : j["@graph"] || [j];
      const jp = arr.find((x: any) => x && /JobPosting/i.test(String(x["@type"])));
      if (jp?.description) {
        const head = [jp.title, jp.hiringOrganization?.name, jp.jobLocation?.address?.addressLocality, jp.validThrough && `Valid through ${jp.validThrough}`]
          .filter(Boolean).join("\n");
        return head + "\n" + stripTags(jp.description);
      }
    } catch {}
  }
  return stripTags(html);
}
function stripTags(h: string) {
  return h
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export const CLOSED_SIGNALS = /(no longer accepting applications|this (job|position|posting) (has been|is) (closed|filled|no longer available)|applications? (are|is) (now )?closed|job not found|position has been filled)/i;

export async function aiExtractPosting(text: string) {
  const out = await aiJson<any>(
    `You extract facts from a job or program posting. Use ONLY information in the text. Quotes must be copied exactly from the text.`,
    `Return JSON:
{"title":"","company":"","location":"","kind":"job|internship|program|campus|event","format":"","dates":"","deadlineText":"exact deadline wording or empty","deadlineISO":"YYYY-MM-DD or empty",
 "eligibility":["exact quotes about who can apply"],
 "requirements":[{"keyword":"2-4 word label","quote":"exact sentence or phrase from the posting"}],
 "summary":"one or two plain sentences describing the role, from the text"}
List the 3-6 most important requirements or preferences.

POSTING TEXT:
"""${text.slice(0, 12000)}"""`,
    2000,
  );
  const n = norm(text);
  const reqs: Requirement[] = (out.requirements || [])
    .map((r: any, i: number) => ({ id: "r" + (i + 1), keyword: String(r.keyword || "").slice(0, 60), quote: String(r.quote || "").trim() }))
    .filter((r: Requirement) => r.quote && n.includes(norm(r.quote).slice(0, 120)));
  const elig = (out.eligibility || []).map(String).filter((q: string) => q && n.includes(norm(q).slice(0, 120)));
  return {
    title: String(out.title || "Untitled posting"),
    company: String(out.company || ""),
    location: String(out.location || ""),
    kind: ["job", "internship", "program", "campus", "event"].includes(out.kind) ? out.kind : "job",
    format: String(out.format || ""),
    dates: String(out.dates || ""),
    deadlineText: String(out.deadlineText || ""),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(out.deadlineISO || "") ? out.deadlineISO : "",
    eligibility: elig,
    requirements: reqs,
    summary: String(out.summary || ""),
    droppedQuotes: (out.requirements || []).length - reqs.length,
  };
}
