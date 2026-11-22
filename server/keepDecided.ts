import type { BulletChange } from "@shared/types";

/** A redo of a tailoring (e.g. after the draft-first questions) keeps every bullet the student already decided on:
 *  a change they accepted, kept their own for, or edited replaces the new suggestion for that bullet, and stays
 *  even when the new draft doesn't touch that bullet. Undecided suggestions are simply replaced. */
export function keepDecided(before: BulletChange[] | undefined, after: BulletChange[]): BulletChange[] {
  const decided = (before || []).filter((c) => c.status !== "pending" || c.edited);
  const byBullet = new Map(decided.map((c) => [c.bulletId, c]));
  const out = after.map((c) => byBullet.get(c.bulletId) ?? c);
  const used = new Set(out.map((c) => c.id));
  return [...out, ...decided.filter((c) => !used.has(c.id))];
}
