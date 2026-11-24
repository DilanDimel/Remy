// Remy's World (Dilan, Nov 24): Remy leaves the office for other places. Each one opens from a real step, and he goes
// where it makes sense for the student's time of day: café in the morning, office by day, library in the evening,
// home at night. A place the student hasn't opened yet falls back to the office. Owners only (shared/features.ts "places").
import type { Workspace } from "./types";
import { dailyStreak, streakDays } from "./daily";

export type PlaceKey = "office" | "cafe" | "library" | "home";
export type Place = { key: PlaceKey; name: string; how: string; link: string; open: (w: Workspace) => boolean };

export const PLACES: Place[] = [
  { key: "office", name: "Office", how: "", link: "/path", open: () => true },
  { key: "cafe", name: "Corner Café", how: "Add your first person in Community", link: "/community", open: (w) => (w.contacts || []).length > 0 },
  { key: "library", name: "Library", how: "Decode 3 jobs on My Path", link: "/path?play=1", open: (w) => (w.game?.known || []).length >= 3 },
  { key: "home", name: "Remy's home", how: "Keep a 7-day streak", link: "/path", open: (w) => dailyStreak(streakDays(w)).best >= 7 },
];

export const openPlaces = (w: Workspace) => new Set(PLACES.filter((p) => p.open(w)).map((p) => p.key));

/** Where the day puts him: 6-10 café, 10-17 office, 17-21 library, 21-6 home. */
export const placeOfHour = (hour: number): PlaceKey => (hour >= 6 && hour < 10 ? "cafe" : hour >= 10 && hour < 17 ? "office" : hour >= 17 && hour < 21 ? "library" : "home");

/** Where Remy is now: the student's pick if it's open, else where the day puts him if that's open, else the office. */
export function placeNow(hour: number, open: Set<PlaceKey>, pick?: PlaceKey | null): PlaceKey {
  if (pick && open.has(pick)) return pick;
  const want = placeOfHour(hour);
  return open.has(want) ? want : "office";
}
