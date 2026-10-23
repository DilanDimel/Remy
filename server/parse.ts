import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import dns from "node:dns/promises";
import net from "node:net";
import type { Requirement, ResumeDoc, Section } from "@shared/types";
import { aiJson } from "./ai";
import { uid } from "./db";

// ---------- file → text ----------
export async function fileToText(buf: Buffer, name: string, mime: string): Promise<string> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      return String(text);
    } catch {
      throw Object.assign(new Error("We couldn't open this PDF. It may be damaged or password-protected — export it again, or upload a Word (.docx) file."), { status: 422 });
    }
  }
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    try {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: buf });
      return r.value;
    } catch {
      throw Object.assign(new Error("We couldn't open this Word file. Save it again as .docx, or upload a PDF."), { status: 422 });
    }
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md") || mime.startsWith("text/")) return buf.toString("utf8");
  throw Object.assign(new Error("Please upload a PDF, Word (.docx) or plain-text file."), { status: 415 });
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9$%]+/g, "");

// ---------- rules-based resume parser (fallback + no-AI mode) ----------
const HEADINGS = /^(education|experience|work experience|professional experience|projects?( & externships)?|projects and externships|activities( and| &) leadership|leadership( experience)?|activities|skills( & interests)?|technical skills|certifications?|honors( & awards)?|awards|volunteer( experience)?|involvement)\b/i;
const DATE_RE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}\s*[–—-]\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4})|(?:summer|fall|spring|winter)\s+\d{4}(?:\s*[–—-]\s*(?:present|(?:summer|fall|spring|winter)\s+\d{4}))?|expected(?: graduation)?:?\s+[a-z]+\.?\s+\d{4}|\b\d{4}\s*[–—-]\s*(?:present|\d{4}))\s*$/i;
const LOC_RE = /^(.*?)\s+((?:[A-Z][a-zA-Z.]+\s?){1,2},\s*(?:[A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)|Remote|Virtual)\s*$/;
const BULLET_RE = /^\s*[●•▪◦\-–*·]\s*/;

export function rulesParse(raw: string): ResumeDoc {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\u200b/g, "").trim()).filter(Boolean);
  const doc: ResumeDoc = { contact: { name: "", email: "", phone: "", location: "", links: "" }, sections: [], skills: [] };
  let i = 0;
  // contact block: everything before first heading
  const head: string[] = [];
  while (i < lines.length && !HEADINGS.test(lines[i])) head.push(lines[i++]);
  doc.contact.name = head[0] || "";
  const headText = head.slice(1).join(" | ");
  doc.contact.email = headText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || "";
  doc.contact.phone = headText.match(/\(?\d{3}\)?[-. )]*\d{3}[-. ]\d{4}/)?.[0] || "";
  doc.contact.location = head.slice(1).find((l) => /^[A-Z][a-zA-Z .]+,\s*[A-Z]{2}$/.test(l)) || "";
  doc.contact.links = (headText.match(/linkedin[^|]*/i)?.[0] || "").trim();

  let section: Section | null = null;
  let lastBullet: { text: string } | null = null;
  let pendingOrg: { org: string; location: string } | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (HEADINGS.test(line) && line.length < 40 && line === line.toUpperCase()) {
      section = { id: uid("s"), heading: titleCase(line), entries: [] };
      if (!/^(technical )?skills/i.test(line)) doc.sections.push(section);
      lastBullet = null;
      continue;
    }
    if (!section) continue;
    if (/^skills/i.test(section.heading) || /^technical skills/i.test(section.heading)) {
      const m = line.match(/^([^:]{2,40}):\s*(.+)$/);
      if (m) doc.skills.push({ id: uid("k"), label: m[1].trim(), items: m[2].trim() });
      else if (doc.skills.length) doc.skills[doc.skills.length - 1].items += " " + line;
      continue;
    }
    if (BULLET_RE.test(line)) {
      let entry = section.entries[section.entries.length - 1];
      if (!entry) {
        entry = { id: uid("e"), org: "", role: "", location: "", dates: "", bullets: [] };
        section.entries.push(entry);
      }
      const b = { id: uid("b"), text: line.replace(BULLET_RE, "").trim(), verified: true };
      entry.bullets.push(b);
      lastBullet = b;
      continue;
    }
    const dm = line.match(DATE_RE);
    if (dm && pendingOrg) {
      const role = line.slice(0, dm.index).replace(/[|,\s]+$/, "").trim();
      section.entries.push({ id: uid("e"), org: pendingOrg.org, location: pendingOrg.location, role, dates: dm[1].trim(), bullets: [] });
      pendingOrg = null;
      lastBullet = null;
      continue;
    }
    const next = lines[i + 1] || "";
    if (DATE_RE.test(next) && !BULLET_RE.test(next)) {
      const lm = line.match(LOC_RE);
      pendingOrg = lm ? { org: lm[1].trim(), location: lm[2].trim() } : { org: line, location: "" };
      continue;
    }
    if (lastBullet) {
      lastBullet.text += " " + line;
      continue;
    }
    // certification style lines or free text
    section.entries.push({ id: uid("e"), org: line, role: "", location: "", dates: "", bullets: [] });
  }
  // certification sections: bullets without org are fine
  return doc;
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bAnd\b/g, "and");
}

// ---------- AI resume parser with verbatim verification ----------
export async function aiParseResume(raw: string): Promise<ResumeDoc> {
  const out = await aiJson<any>(
    `You convert resume text into structured JSON. Copy wording VERBATIM from the resume. Never add, infer, summarize, or improve anything. Join bullet text that wraps across lines. If a field is missing, use an empty string.`,
    `Return JSON with this shape:
{"contact":{"name":"","email":"","phone":"","location":"","links":""},
 "sections":[{"heading":"Education","entries":[{"org":"","role":"","location":"","dates":"","bullets":["..."]}]}],
 "skills":[{"label":"Technical","items":"comma separated, verbatim"}]}
Put every resume section except Skills into "sections" in the original order (Education, Experience, Projects, Leadership, Certifications, etc.). For Education, use org=school, role=degree line (including GPA if present), dates=graduation text, bullets=the detail lines. Certifications: one entry per certification with org=name.

RESUME TEXT:
"""${raw.slice(0, 14000)}"""`,
    4000,
  );
  const n = norm(raw);
  const doc: ResumeDoc = {
    contact: {
      name: String(out?.contact?.name || ""), email: String(out?.contact?.email || ""), phone: String(out?.contact?.phone || ""),
      location: String(out?.contact?.location || ""), links: String(out?.contact?.links || ""),
    },
    sections: (out?.sections || []).map((s: any) => ({
      id: uid("s"),
      heading: String(s.heading || "Section"),
      entries: (s.entries || []).map((e: any) => ({
        id: uid("e"), org: String(e.org || ""), role: String(e.role || ""), location: String(e.location || ""), dates: String(e.dates || ""),
        bullets: (e.bullets || []).map((b: any) => {
          const t = String(b || "").trim();
          return { id: uid("b"), text: t, verified: n.includes(norm(t)) };
        }).filter((b: any) => b.text),
      })),
    })),
    skills: (out?.skills || []).map((k: any) => ({ id: uid("k"), label: String(k.label || "Skills"), items: String(k.items || "") })),
  };
  if (!doc.sections.length) throw new Error("AI could not find resume sections");
  return doc;
}

export function resumeToText(doc: ResumeDoc): string {
  const out: string[] = [doc.contact.name, [doc.contact.location, doc.contact.email, doc.contact.phone, doc.contact.links].filter(Boolean).join(" | ")];
  for (const s of doc.sections) {
    out.push("", s.heading.toUpperCase());
    for (const e of s.entries) {
      out.push([e.org, e.location].filter(Boolean).join(" — "));
      if (e.role || e.dates) out.push([e.role, e.dates].filter(Boolean).join(" | "));
      for (const b of e.bullets) out.push("• " + b.text);
    }
  }
  if (doc.skills.length) {
    out.push("", "SKILLS");
    for (const k of doc.skills) out.push(`${k.label}: ${k.items}`);
  }
  return out.filter((l) => l !== undefined).join("\n");
}

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

// Skills and tools a resume shows: everything on a "Skills"-type line, plus
// well-known tools mentioned anywhere. Used for matching, not shown as claims.
const KNOWN_TOOLS = ["excel", "powerpoint", "python", "sql", "tableau", "power bi", "bloomberg", "factset", "capital iq", "salesforce", "hubspot", "mailchimp", "canva", "figma", "photoshop", "illustrator", "google analytics", "ga4", "hootsuite", "meta business suite", "quickbooks", "sap", "java", "javascript", "c++", "matlab", "spss", "stata", "vba", "financial modeling", "dcf", "valuation", "accounting", "market research", "seo", "copywriting", "public speaking", "spanish", "french", "mandarin"];
export function extractSkills(doc: ResumeDoc, raw: string): string[] {
  const found = new Map<string, string>();
  const add = (x: string) => {
    const t = x.replace(/^[\s•·\-–:]+|[\s.;:]+$/g, "").trim();
    if (t.length > 1 && t.length < 40 && !/^(and|with|including|skills?|tools?|languages?|technical|interests?|certifications?)$/i.test(t)) found.set(t.toLowerCase(), t);
  };
  for (const sec of doc.sections) {
    if (!/skill|tool|technical|language|certif|software|proficien/i.test(sec.heading)) continue;
    for (const e of sec.entries) for (const line of [e.role, e.org, ...e.bullets.map((b) => b.text)]) {
      (line || "").replace(/^[A-Za-z ]{2,30}:\s*/, "").split(/[,;|•·]| and /).forEach(add);
    }
  }
  for (const g of doc.skills || []) (g.items || "").split(/[,;|•·]| and /).forEach(add);
  const lower = ` ${raw.toLowerCase()} `;
  for (const tool of KNOWN_TOOLS) if (new RegExp(`[^a-z]${tool.replace(/[+]/g, "\\+")}[^a-z]`).test(lower) && ![...found.keys()].includes(tool)) add(tool.replace(/\b\w/g, (c) => c.toUpperCase()));
  return [...found.values()].slice(0, 40);
}
