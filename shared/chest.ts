// The daily chest (owners, Nov 24): finishing all three daily quests opens it, and it holds a small surprise. Most days
// it's bonus XP; now and then it's a rare thing for Remy's office that only the chest gives. Looks only: nothing in a
// chest changes the job search. The prize is picked from the day itself, so reopening or a second tab gives the same one.
import type { GameState } from "./game";

export const CHEST_XP = 20;
export const RARE: [string, string][] = [["bonsai", "Bonsai tree"], ["goldmug", "Golden mug"], ["pennant", "Team pennant"], ["record", "Record player"]];
const seed = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Today's prize: about one day in four a rare office item not owned yet, otherwise bonus XP. */
export function chestPrize(day: string, g: Pick<GameState, "chests">): string {
  const owned = new Set(Object.values(g.chests || {}));
  const left = RARE.filter(([k]) => !owned.has(k));
  const n = seed(day);
  return left.length && n % 4 === 0 ? left[(n >>> 2) % left.length][0] : "xp";
}
export const chestXp = (g: Pick<GameState, "chests">) => Object.values(g.chests || {}).filter((p) => p === "xp").length * CHEST_XP;
export const rareOwned = (g: Pick<GameState, "chests">) => new Set(Object.values(g.chests || {}).filter((p) => p !== "xp"));
