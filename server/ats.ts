import type { AtsScore, Job, ResumeDoc } from "@shared/types";

// ATS readiness score out of 100, computed from the resume itself (no AI), so
// it's instant and gives the same number every time. Each lost point comes with
// the specific fix that would earn it back.

const STRONG = /^(led|built|grew|launched|managed|created|designed|developed|analyz|organized|trained|presented|drove|owned|published|surveyed|coordinated|improved|increased|reduced|negotiated|founded|directed|executed|implemented|researched|modeled|forecast|automated|streamlined|delivered|won|raised|secured|mentored|wrote|produced|planned|conducted|evaluated|optimized|spearheaded|initiated|established|collaborated|supported|prepared|assisted|served|tutored|taught|volunteered|completed|calculated|reviewed|tracked|built)/i;
const WEAK = /^(responsible for|helped|assisted with|worked on|duties included|tasked with|was in charge of|handled|did)\b/i;
const QUANT = /\d|%|\$/;

const lc = (s: string) => s.toLowerCase();
function textOf(doc: ResumeDoc) {
  return [doc.contact.name, ...doc.sections.flatMap((s) => [s.heading, ...s.entries.flatMap((e) => [e.org, e.role, e.dates, ...e.bullets.map((b) => b.text)])]), ...doc.skills.map((k) => k.label + " " + k.items)].join("\n");
}

export function atsScore(doc: ResumeDoc, keywords: string[], against: string): AtsScore {
  const text = textOf(doc);
  const low = lc(text);
  const bullets = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).map((b) => b.text.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean).length;
  const headings = doc.sections.map((s) => lc(s.heading));
  type Item = AtsScore["categories"][number]["items"][number];
  const cat = (name: string, max: number, items: Item[]) => {
    const earned = items.reduce((n, i) => n + i.earned, 0);
    return { name, max, score: Math.round(Math.min(max, earned)), items };
  };
  const item = (ok: boolean, pts: number, good: string, fix: string, partial = ok ? 1 : 0): Item => ({ ok, earned: Math.round(pts * partial * 10) / 10, max: pts, text: ok ? good : fix });

  const contact = cat("Contact info", 10, [
    item(!!doc.contact.name.trim(), 2, "Name at the top.", "Put your full name on the first line."),
    item(/@/.test(doc.contact.email), 3, "Email address found.", "Add a professional email address to the header."),
    item(/\d{3}.*\d{4}/.test(doc.contact.phone), 2, "Phone number found.", "Add a phone number — most ATS profiles require one."),
    item(/linkedin|github|http/i.test(doc.contact.links), 2, "LinkedIn or portfolio link found.", "Add your LinkedIn URL to the header."),
    item(!!doc.contact.location.trim(), 1, "Location found.", "Add your city and state (e.g. Fort Worth, TX) so location filters match you."),
  ]);

  const has = (re: RegExp) => headings.some((h) => re.test(h));
  const entries = doc.sections.flatMap((s) => s.entries);
  const dated = entries.filter((e) => /\d{4}|present/i.test(e.dates)).length;
  const structure = cat("Sections & structure", 20, [
    item(has(/experience|employment|work/), 6, "Standard \"Experience\" section.", "Add a section titled exactly \"Experience\" — ATS parsers look for that word."),
    item(has(/education/), 5, "Standard \"Education\" section.", "Add an \"Education\" section with school, degree and expected graduation."),
    item(doc.skills.length > 0 || has(/skill/), 4, "Skills section found.", "Add a plain \"Skills\" line (comma-separated tools and skills); parsers read it first."),
    item(entries.length > 0 && dated === entries.length, 5, "Every entry has dates.", `${entries.length - dated} entr${entries.length - dated === 1 ? "y is" : "ies are"} missing dates — add month and year to each.`, entries.length ? dated / entries.length : 0),
  ]);

  const strong = bullets.filter((b) => STRONG.test(b.replace(/^[•\-–*]\s*/, ""))).length;
  const weak = bullets.filter((b) => WEAK.test(b.replace(/^[•\-–*]\s*/, "")));
  const quant = bullets.filter((b) => QUANT.test(b)).length;
  const goodLen = bullets.filter((b) => { const n = b.split(/\s+/).length; return n >= 8 && n <= 32; }).length;
  const n = bullets.length || 1;
  const bulletsCat = cat("Bullet quality", 30, [
    item(bullets.length >= 6, 6, `${bullets.length} achievement bullets.`, bullets.length ? `Only ${bullets.length} bullets — aim for 3-5 under each role.` : "No bullets found — describe each role in 3-5 bullets.", Math.min(1, bullets.length / 6)),
    item(strong / n >= 0.7, 9, "Most bullets open with a strong action verb.", `${bullets.length - strong} bullet${bullets.length - strong === 1 ? "" : "s"} don't start with an action verb (Led, Built, Analyzed…).${weak.length ? ` Rewrite weak openers like "${weak[0].split(/\s+/).slice(0, 3).join(" ")}…".` : ""}`, Math.min(1, strong / n / 0.7)),
    item(quant / n >= 0.5, 9, "At least half your bullets include a number.", `${quant} of ${bullets.length} bullets have a number. Add real counts, %, or $ where you have them — never estimate.`, Math.min(1, quant / n / 0.5)),
    item(goodLen / n >= 0.8, 6, "Bullets are a skimmable length.", `${bullets.length - goodLen} bullet${bullets.length - goodLen === 1 ? " is" : "s are"} too short or too long — aim for 8-32 words each.`, Math.min(1, goodLen / n / 0.8)),
  ]);

  const format = cat("Length & format", 15, [
    item(words >= 250 && words <= 800, 8, `${words} words — a healthy one-page length.`, words < 250 ? `Only ${words} words — add detail to your strongest roles.` : `${words} words — trim to one page (about 450-700 words).`, words < 250 ? words / 250 : words > 800 ? Math.max(0, 1 - (words - 800) / 600) : 1),
    item(!/[│┃■◆★►]|\t{2,}/.test(text), 4, "No symbols that confuse parsers.", "Remove decorative symbols and tab-aligned columns; ATS reads them as noise."),
    item(new Set(entries.map((e) => (/[a-z]{3}\s+\d{4}/i.test(e.dates) ? "word" : /\d{1,2}\/\d{4}/.test(e.dates) ? "num" : "other"))).size <= 1, 3, "Dates use one consistent format.", "Use one date format everywhere (e.g. \"Jun 2026 – Aug 2026\")."),
  ]);

  const kws = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 15);
  const hit = kws.filter((k) => k.split(/[\s/+]+/).filter((w) => w.length > 3).some((w) => low.includes(lc(w))));
  const missing = kws.filter((k) => !hit.includes(k));
  const keywordCat = cat("Keyword match", 25, [
    kws.length
      ? item(hit.length / kws.length >= 0.6, 25, `Matches ${hit.length} of ${kws.length} keywords ${against}.`, `Matches ${hit.length} of ${kws.length} keywords ${against}. Missing: ${missing.slice(0, 5).join(", ")}. Add them only where they're true.`, Math.min(1, hit.length / kws.length / 0.6))
      : item(false, 25, "", "Pick or save an opening so Remy can check your keywords against it.", 0.5),
  ]);

  const categories = [contact, structure, bulletsCat, format, keywordCat];
  const score = categories.reduce((s, c) => s + c.score, 0);
  const fixes = categories.flatMap((c) => c.items.filter((i) => !i.ok).map((i) => ({ category: c.name, text: i.text, gain: Math.round(i.max - i.earned) })))
    .filter((f) => f.gain > 0).sort((a, b) => b.gain - a.gain);
  return { score, categories, fixes, keywords: { matched: hit, missing }, against, at: new Date().toISOString() };
}

/** Keywords for the base resume: the student's best-fit openings' requirements. */
export function keywordsFrom(jobs: Job[]) {
  return jobs.flatMap((j) => j.requirements.map((r) => r.keyword));
}
