// Feature releases (Nov 24, Dilan): every new feature is built owners-only, and owners release it from Admin → Beta
// without a deploy. A feature is "owners" (students don't see it), "locked" (students see it in the menu with a lock and
// a "coming in a future update" teaser) or "released" (everyone). Add new features here with release: "owners".
export type Release = "owners" | "locked" | "released";
export const RELEASES: Release[] = ["owners", "locked", "released"];

/** follows: released together with that feature (Dilan, Nov 24: Rewards is part of The Big Upgrade, one flip). */
export type Feature = { key: string; label: string; path: string; release: Release; teaser: string; follows?: string };
export const FEATURES: Feature[] = [
  // The whole owner redesign (html.redesign-2 and every useOwnerView() gate), released to students in one step (Nov 24).
  // It has no page, so "locked" means the same as owners-only here.
  { key: "redesign", label: "The Big Upgrade: the new Remy and Rewards (whole app)", path: "", release: "owners", teaser: "" },
  { key: "interview", label: "Interview", path: "/interview", release: "locked", teaser: "Practice a real mock interview with Remy for the jobs you want, out loud, with feedback on every answer." },
  { key: "community", label: "Community", path: "/community", release: "locked", teaser: "Keep track of everyone you meet, and Remy tells you what to say, when to follow up and how to stay in touch." },
  // The phone app (native/), released to students on its own (Dilan, Nov 24). No page; until "released" students who sign
  // in to the app see "The new app is almost here" and a link to the website.
  { key: "app", label: "Phone app", path: "", release: "owners", teaser: "" },
  // Remy's World (Nov 24): Remy goes to a café, library and home by the student's time of day (shared/places.ts). No page.
  { key: "places", label: "Remy's places: café, library and home", path: "", release: "owners", teaser: "" },
  { key: "rewards", label: "Rewards", path: "/rewards", release: "owners", teaser: "Everything you can earn in Remy, in one place.", follows: "redesign" },
];

export type Releases = Record<string, Release>;
/** Each feature's state: an owner's saved choice when there is one, otherwise the default above. */
export function releasesOf(saved: unknown): Releases {
  const s = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  const own = (f: Feature): Release => (RELEASES.includes(s[f.key] as Release) ? (s[f.key] as Release) : f.release);
  const r: Releases = Object.fromEntries(FEATURES.map((f) => [f.key, own(f)]));
  for (const f of FEATURES) if (f.follows) r[f.key] = r[f.follows] === "released" ? "released" : f.release;
  return r;
}
/** What one person sees: owners in owner view get everything; others get the feature's state. */
export const accessOf = (r: Releases, key: string, ownerView: boolean): "open" | "locked" | "hidden" => {
  const st = r[key] ?? "owners";
  return ownerView || st === "released" ? "open" : st === "locked" ? "locked" : "hidden";
};
export const featureAt = (path: string) => FEATURES.find((f) => f.path && path.startsWith(f.path));
/** Students get the redesign once owners release it. */
export const redesignOut = (r: Releases) => r.redesign === "released";
/** Students can use the phone app once owners release it; owners always can. */
export const appOut = (r: Releases) => r.app === "released";
