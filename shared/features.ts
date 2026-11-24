// Feature releases (Nov 24, Dilan): every new feature is built owners-only, and owners release it from Admin → Beta
// without a deploy. A feature is "owners" (students don't see it), "locked" (students see it in the menu with a lock and
// a "coming in a future update" teaser) or "released" (everyone). Add new features here with release: "owners".
export type Release = "owners" | "locked" | "released";
export const RELEASES: Release[] = ["owners", "locked", "released"];

export type Feature = { key: string; label: string; path: string; release: Release; teaser: string };
export const FEATURES: Feature[] = [
  // The whole owner redesign (html.redesign-2 and every useOwnerView() gate), released to students in one step (Nov 24).
  // It has no page, so "locked" means the same as owners-only here.
  { key: "redesign", label: "The Big Upgrade: the new Remy (whole app)", path: "", release: "owners", teaser: "" },
  { key: "interview", label: "Interview", path: "/interview", release: "locked", teaser: "Practice a real mock interview with Remy for the jobs you want, out loud, with feedback on every answer." },
  { key: "community", label: "Community", path: "/community", release: "locked", teaser: "Keep track of everyone you meet, and Remy tells you what to say, when to follow up and how to stay in touch." },
  { key: "rewards", label: "Rewards", path: "/rewards", release: "owners", teaser: "Everything you can earn in Remy, in one place." },
];

export type Releases = Record<string, Release>;
/** Each feature's state: an owner's saved choice when there is one, otherwise the default above. */
export function releasesOf(saved: unknown): Releases {
  const s = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  return Object.fromEntries(FEATURES.map((f) => [f.key, RELEASES.includes(s[f.key] as Release) ? (s[f.key] as Release) : f.release]));
}
/** What one person sees: owners in owner view get everything; others get the feature's state. */
export const accessOf = (r: Releases, key: string, ownerView: boolean): "open" | "locked" | "hidden" => {
  const st = r[key] ?? "owners";
  return ownerView || st === "released" ? "open" : st === "locked" ? "locked" : "hidden";
};
export const featureAt = (path: string) => FEATURES.find((f) => f.path && path.startsWith(f.path));
/** Students get the redesign once owners release it. */
export const redesignOut = (r: Releases) => r.redesign === "released";
