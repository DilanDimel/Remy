// Reads the AI status files in docs/ai/status/ (see docs/ai/README.md). Used by `npm run check:ai`,
// `npm run ai:brief` and the owners' dashboard, so all three agree on what a claim is.

export type Claim = { paths: string[]; branch: string; until: string };
export type Request = { to: string; text: string };
export type AiStatus = { updated: string; workingOn: string[]; claims: Claim[]; requests: Request[] };

/** Lines under one `## Heading`, up to the next `## `. */
function section(md: string, heading: string): string[] {
  const out: string[] = [];
  let inside = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^##\s/.test(line)) inside = line.replace(/^##\s+/, "").trim().toLowerCase() === heading.toLowerCase();
    else if (inside && line.trim()) out.push(line.trim());
  }
  return out;
}

/** A claim line: "- `a/b.ts`, `c/` · branch julio/x · until 2026-11-27". Returns null if it isn't one. */
export function parseClaim(line: string): Claim | null {
  const paths = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
  const branch = line.match(/branch\s+([^\s·,]+)/i)?.[1] ?? "";
  const until = line.match(/until\s+(\d{4}-\d{2}-\d{2})/i)?.[1] ?? "";
  return paths.length ? { paths, branch, until } : null;
}

export function parseStatus(md: string): AiStatus {
  return {
    updated: md.match(/^Updated:\s*(.+)$/m)?.[1].trim() ?? "",
    workingOn: section(md, "Working on now").filter((l) => l.startsWith("-")).map((l) => l.replace(/^-\s*/, "")),
    claims: section(md, "Claims").map(parseClaim).filter((c): c is Claim => !!c),
    // "- to Julio: please add X" asks another person's AI for a change; the briefing shows it to them.
    requests: section(md, "Requests").flatMap((l) => {
      const m = l.match(/^-\s*to\s+([^:]+):\s*(.+)$/i);
      return m ? [{ to: m[1].trim(), text: m[2].trim() }] : [];
    }),
  };
}

/** A claim counts until the end of its `until` day (UTC). One with no date doesn't count. */
export const activeClaims = (claims: Claim[], today = new Date().toISOString().slice(0, 10)) =>
  claims.filter((c) => c.until && c.until >= today);

/** True when `file` is the path or sits under it (paths ending in / are folders; others match as prefixes). */
export const covers = (path: string, file: string) => file === path || file.startsWith(path);
