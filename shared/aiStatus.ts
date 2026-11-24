// Reads the AI status files in docs/ai/status/ (see docs/ai/README.md). Used by `npm run check:ai`,
// `npm run ai:brief` and the owners' dashboard, so all three agree on claims and requests.

export type Claim = { paths: string[]; branch: string; until: string };
/** Asked by the file's owner: "- dilan-3 to Julio (2026-11-24): add a usage field to /api/me". */
export type Request = { id: string; to: string; date: string; text: string };
/** Answered in the receiver's own file: "- dilan-3 · done · #340 · added it". */
export type Answer = { id: string; state: "seen" | "doing" | "done" | "declined"; pr: string; note: string };
export type AiStatus = { updated: string; workingOn: string[]; claims: Claim[]; requests: Request[]; answers: Answer[] };

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

/** Folder of one-file-per-item "Working on now" entries beside a status file: docs/ai/status/lead.md → docs/ai/status/lead/.
 *  Each thread writes its own file, so parallel threads never edit the same lines (like shared/news/). */
export const entriesDir = (status: string) => status.replace(/\.md$/, "/");
/** One entry file as one "Working on now" line. */
const entryLine = (md: string) => md.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).join(" ").replace(/^-\s*/, "");

/** A status file plus the contents of its entries folder (see entriesDir). */
export function parseStatus(md: string, entries: string[] = []): AiStatus {
  return {
    updated: md.match(/^Updated:\s*(.+)$/m)?.[1].trim() ?? "",
    workingOn: [...section(md, "Working on now").filter((l) => l.startsWith("-")).map((l) => l.replace(/^-\s*/, "")), ...entries.map(entryLine).filter(Boolean)],
    claims: section(md, "Claims").map(parseClaim).filter((c): c is Claim => !!c),
    requests: section(md, "Requests").flatMap((l) => {
      const m = l.match(/^-\s*([a-z]+-\d+)\s+to\s+([^(:]+?)\s*\((\d{4}-\d{2}-\d{2})\):\s*(.+)$/i);
      return m ? [{ id: m[1].toLowerCase(), to: m[2].trim(), date: m[3], text: m[4].trim() }] : [];
    }),
    answers: section(md, "Answers").flatMap((l) => {
      const id = l.match(/^-\s*([a-z]+-\d+)\b/i)?.[1].toLowerCase();
      const state = l.match(/\b(seen|doing|done|declined)\b/i)?.[1].toLowerCase() as Answer["state"] | undefined;
      if (!id || !state) return [];
      const parts = l.split("·").map((x) => x.trim());
      return [{ id, state, pr: l.match(/#(\d+)/)?.[1] ?? "", note: parts.length > 2 ? parts.slice(2).filter((x) => !/^#\d+$/.test(x)).join(" · ") : "" }];
    }),
  };
}

/** A claim counts until the end of its `until` day (UTC). One with no date doesn't count. */
export const activeClaims = (claims: Claim[], today = new Date().toISOString().slice(0, 10)) =>
  claims.filter((c) => c.until && c.until >= today);

/** True when `file` is the path or sits under it (paths ending in / are folders; others match as prefixes). */
export const covers = (path: string, file: string) => file === path || file.startsWith(path);

export type Tracked = Request & {
  from: string;
  state: "sent" | Answer["state"];
  pr: string;
  note: string;
  /** Sent a day or more ago and nobody has answered. */
  overdue: boolean;
  /** Marked done without a PR number to prove it. */
  noProof: boolean;
};
/** Every request with its answer from the receiver's own file: the proof that it was seen and acted on. */
export function trackRequests(files: { name: string; status: AiStatus }[], today = new Date().toISOString().slice(0, 10)): Tracked[] {
  return files.flatMap(({ name, status }) => status.requests.map((r) => {
    const to = files.find((f) => f.name.toLowerCase() === r.to.toLowerCase());
    const a = to?.status.answers.find((x) => x.id === r.id);
    const state = a?.state ?? "sent";
    return { ...r, from: name, state, pr: a?.pr ?? "", note: a?.note ?? "", overdue: state === "sent" && r.date < today, noProof: state === "done" && !a?.pr };
  }));
}
