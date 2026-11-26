// Company logos for employers Remy doesn't list (Dilan, Nov 26: most cards showed letters, on desktop and phone).
// Most live openings come from applicant systems (Greenhouse, Lever, Ashby, Workday...), whose links can't give the
// employer's own site, so shared/logos.ts had no domain and the card fell back to initials. Here the server finds the
// employer's real web domain once per company and the card loads its icon from the favicon service:
//   1. a domain Remy already knows, or the posting's own site (shared/logos.ts logoDomain),
//   2. a link on the company's applicant-system board that is clearly its own site ("security.opensesame.com"),
//   3. "<name>.com" when that site's title or site name says the company's name.
// A domain is used only when the favicon service has a real icon for it, so a wrong guess shows initials, never
// someone else's logo.
import { baseDomain, domainFits, logoDomain, nameWords } from "@shared/logos";
export { baseDomain, domainFits, nameWords };
import { orgKey } from "@shared/org";
import { knownDomain } from "@shared/logos";
const KNOWN = (c: string) => !!knownDomain(c);

const UA = "Mozilla/5.0 (compatible; RemyBot/1.0; student career assistant)";
const DAY = 864e5;
const cache = new Map<string, { domain: string; at: number }>();
const pending = new Map<string, Promise<string>>();
let running = 0;
const queue: (() => void)[] = [];
const MAX_AT_ONCE = 4;

/** The applicant-system board page for a posting link, when it's one whose board lists the employer's links. */
export function boardPage(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return ""; }
  const slug = u.pathname.split("/").filter(Boolean)[0] || "";
  if (!/^[a-z0-9_-]{2,80}$/i.test(slug)) return "";
  if (/(^|\.)greenhouse\.io$/.test(u.hostname)) return `https://job-boards.greenhouse.io/${slug}`;
  if (u.hostname === "jobs.lever.co") return `https://jobs.lever.co/${slug}`;
  if (u.hostname === "jobs.ashbyhq.com") return `https://jobs.ashbyhq.com/${slug}`;
  return "";
}

async function get(url: string): Promise<{ text: string; finalUrl: string; blocked?: boolean } | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(6000) });
    if (r.status === 403 || r.status === 429 || r.status === 503) return { text: "", finalUrl: url, blocked: true };
    if (!r.ok) return null;
    return { text: (await r.text()).slice(0, 600_000), finalUrl: r.url || url };
  } catch { return null; }
}

/** The favicon service answers an unknown domain with a 404 and its globe, so only a 200 is a real icon. */
async function hasIcon(domain: string): Promise<boolean> {
  try {
    const r = await fetch(iconUrl(domain), { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch { return false; }
}
export const iconUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/** A link on the board page that is clearly the employer's own site. */
export function siteFromBoard(html: string, company: string): string {
  const hosts = new Set<string>();
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"'\s>]+)/gi)) { try { hosts.add(new URL(m[1]).hostname); } catch { /* not a link */ } }
  for (const h of hosts) { const d = baseDomain(h); if (!/greenhouse|lever|ashby|google|facebook|linkedin|twitter|instagram|youtube|glassdoor/.test(d) && domainFits(d, company)) return d; }
  return "";
}

/** Does the page say it's this company (title or site name holds the company's first name word)? */
export function pageNames(html: string, company: string, label = ""): boolean {
  const title = (html.match(/<title[^>]*>([^<]{0,300})/i)?.[1] || "") + " " + (html.match(/og:site_name["']\s+content=["']([^"']{0,200})/i)?.[1] || "");
  const w = nameWords(company);
  // The whole name ("cainwatters"), or the domain's own name when it's one whole word of the company's ("prolific").
  const needle = label && label !== w.join("") && w.includes(label) && label.length >= 4 ? label : w.join("").slice(0, 12);
  return !!w.length && title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&amp;/g, "&").split(/[^a-z0-9]+/).join("").includes(needle);
}

async function find(company: string, url: string): Promise<string> {
  // A known employer, or the posting's own site when it's named like the company (an aggregator's site isn't).
  const direct = logoDomain(company, url);
  if (direct && (KNOWN(company) || domainFits(direct, company))) return direct;
  const board = boardPage(url);
  if (board) {
    const page = await get(board);
    const d = page && siteFromBoard(page.text, company);
    if (d && (await hasIcon(d))) return d;
  }
  const w = nameWords(company);
  const guesses = [...new Set([w.join(""), w[0] && w[0].length >= 4 ? w[0] : "", w.length > 1 ? w.slice(0, 2).join("") : ""].filter((x) => x && x.length >= 3 && x.length <= 40))].map((x) => x + ".com");
  for (const g of guesses.slice(0, 2)) {
    const page = await get(`https://${g}/`);
    // Big employers' sites turn bots away; a long full-name domain ("goldmansachs.com") with a real icon is theirs.
    if (page?.blocked && g === w.join("") + ".com" && w.join("").length >= 8) { if (await hasIcon(g)) return g; continue; }
    if (!page || !pageNames(page.text, company, g.replace(/\.com$/, ""))) continue;
    let d = g;
    try { d = baseDomain(new URL(page.finalUrl).hostname); } catch { /* keep the guess */ }
    if (await hasIcon(d)) return d;
  }
  return "";
}

/** The employer's web domain for its logo, or "" for initials. Cached a week per company (a miss for a day). */
export async function logoDomainFor(company: string, url = ""): Promise<string> {
  const key = orgKey(company || "");
  if (!key) return "";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.domain ? 7 : 1) * DAY) return hit.domain;
  if (pending.has(key)) return pending.get(key)!;
  const p = (async () => {
    if (running >= MAX_AT_ONCE) await new Promise<void>((r) => queue.push(r));
    running++;
    try {
      const domain = await find(company, url);
      cache.set(key, { domain, at: Date.now() });
      // shortcut: memory only, so a deploy re-finds each company once; keep it in the database if that gets slow.
      if (cache.size > 20_000) cache.delete(cache.keys().next().value!);
      return domain;
    } finally {
      running--;
      queue.shift()?.();
      pending.delete(key);
    }
  })();
  pending.set(key, p);
  return p;
}
