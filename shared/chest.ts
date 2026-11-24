// The daily chest (owners, Nov 24): finishing all three daily quests opens it, and it holds a small surprise. Most days
// it's bonus XP; now and then it's a rare thing for Remy's office that only the chest gives. Looks only: nothing in a
// chest changes the job search. The prize is picked from the day itself, so reopening or a second tab gives the same one.
import type { GameState } from "./game";
import { shiftDay } from "./daily";

export const CHEST_XP = 20;
export const RARE: [string, string][] = [["bonsai", "Bonsai tree"], ["goldmug", "Golden mug"], ["pennant", "Team pennant"], ["record", "Record player"]];
const seed = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Days away before today if the student is coming back after a week or more (no guilt, a welcome), else 0. Takes the
 *  streak days (shared/daily.ts streakDays), so any real step counts as being there. A first-ever day isn't a comeback. */
export function welcomeBack(g: Pick<GameState, "days">, today: string): number {
  const prev = Object.keys(g.days || {}).filter((k) => k < today && (g.days![k]?.length || 0) > 0).sort().pop();
  if (!prev) return 0;
  let n = 0; for (let k = prev; k < today && n < 400; k = shiftDay(k, 1)) n++;
  return n >= 8 ? n - 1 : 0;
}

/** Today's prize: on a welcome-back day double bonus XP ("bigxp"); otherwise about one day in four a rare office item not
 *  owned yet, else bonus XP. */
export function chestPrize(day: string, g: Pick<GameState, "chests">, back = false): string {
  if (back) return "bigxp";
  const owned = new Set(Object.values(g.chests || {}));
  const left = RARE.filter(([k]) => !owned.has(k));
  const n = seed(day);
  return left.length && n % 4 === 0 ? left[(n >>> 2) % left.length][0] : "xp";
}
export const chestXp = (g: Pick<GameState, "chests">) => Object.values(g.chests || {}).reduce((s, p) => s + (p === "xp" ? CHEST_XP : p === "bigxp" ? 2 * CHEST_XP : 0), 0);
export const rareOwned = (g: Pick<GameState, "chests">) => new Set(Object.values(g.chests || {}).filter((p) => p !== "xp" && p !== "bigxp"));
