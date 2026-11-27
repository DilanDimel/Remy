// Estimated hours ("auto, estimated" on the owners' Team & hours board) from work that leaves a timestamp: commits,
// opened PRs and Dilan's Claude threads. The rule (also in docs/ai/hours/README.md): one person's events less than
// 60 minutes apart are one stretch of work; a stretch starts 15 minutes before its first event, ends 15 minutes after
// its last, and counts at least 30 minutes. Time someone clocked or logged themselves always wins over an estimate.

/** One timestamped piece of someone's work: [who (first name in docs/ai/owners.json), ISO time, what it was]. */
export type Ev = [who: string, at: string, what: string];
export type Block = { who: string; start: string; end: string; note: string };

const MIN = 60_000;
/** What a Claude thread with no commit counts as (its own title stays private: the repo is public). */
export const GENERAL = "Planning and company work with Claude";
export const RULE = { gap: 60 * MIN, pad: 15 * MIN, least: 30 * MIN };

/** Short words for what a stretch was: its distinct commit and PR titles, merges and bookkeeping left out. */
function noteFor(whats: string[]) {
  const seen = new Map<string, string>();
  for (const w of whats) {
    const t = w.replace(/^Opened PR #\d+: /, "").replace(/\s*\(#\d+\)$/, "").trim();
    // A PR title and its commit often say the same thing, one cut shorter: the first 50 letters decide.
    if (t && !/^Merge\b|^Status:|^Update docs\/ai/i.test(t)) seen.set(t.toLowerCase().slice(0, 50), t);
  }
  const list = [...seen.values()].sort((a, b) => Number(a === GENERAL) - Number(b === GENERAL));
  if (!list.length) return whats.length ? "Bookkeeping and merges" : "";
  const shown = list.slice(0, 3).join("; ");
  return (list.length > 3 ? `${shown}; and ${list.length - 3} more` : shown).slice(0, 300);
}

/** Groups each person's events into stretches of work by the rule above. */
export function toBlocks(evs: Ev[]): Block[] {
  const byWho = new Map<string, { at: number; what: string }[]>();
  for (const [who, at, what] of evs) {
    const t = Date.parse(at);
    if (who && Number.isFinite(t)) byWho.set(who, [...(byWho.get(who) || []), { at: t, what }]);
  }
  const out: Block[] = [];
  for (const [who, list] of byWho) {
    list.sort((a, b) => a.at - b.at);
    let run: typeof list = [];
    const close = () => {
      if (!run.length) return;
      const start = run[0].at - RULE.pad, end = Math.max(run[run.length - 1].at + RULE.pad, start + RULE.least);
      out.push({ who, start: new Date(start).toISOString(), end: new Date(end).toISOString(), note: noteFor(run.map((e) => e.what)) });
      run = [];
    };
    for (const e of list) {
      if (run.length && e.at - run[run.length - 1].at > RULE.gap) close();
      run.push(e);
    }
    close();
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** The parts of a stretch outside the busy intervals (time the person clocked or logged), 10 minutes or longer. */
export function clip(b: { start: string; end: string }, busy: { start: number; end: number }[]): { start: string; end: string }[] {
  let parts = [{ s: Date.parse(b.start), e: Date.parse(b.end) }];
  for (const x of busy) parts = parts.flatMap((p) => (x.end <= p.s || x.start >= p.e ? [p] : [{ s: p.s, e: x.start }, { s: x.end, e: p.e }]));
  return parts.filter((p) => p.e - p.s >= 10 * MIN).map((p) => ({ start: new Date(p.s).toISOString(), end: new Date(p.e).toISOString() }));
}
