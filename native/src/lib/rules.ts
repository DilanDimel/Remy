// The website's rules for who sees what, in one pure file so they can be tested without a phone.
// The logic itself lives in shared/ (features, beta); this file only puts it in the website's order (client/src/App.tsx).
import type { AppConfig, Me, Workspace } from "../../../shared/types";
import { accessOf, appOut, featureAt, redesignOut, releasesOf } from "../../../shared/features.ts";
import { termsFor } from "../../../shared/beta.ts";

export type Status = "loading" | "signed-out" | "beta-blocked" | "ready" | "error";

/** Owners in owner view: they see every unreleased feature and the owner tools (the website's useOwnersOnly()). */
export const ownersOnly = (me: Me | null, ws: Workspace | null) => !!me?.owner && ws?.settings?.ownerView !== false;

/** "Show the redesigned Remy": owners in owner view, and every signed-in student once The Big Upgrade is released
 *  (the website's useOwnerView()). */
export const redesignFor = (me: Me | null, ws: Workspace | null, config: AppConfig | null) =>
  ownersOnly(me, ws) || (!!me && redesignOut(releasesOf(config?.features)));

/** One feature's state for this person: "open", "locked" (shown with a lock and the coming-soon card) or "hidden". */
export const accessFor = (me: Me | null, ws: Workspace | null, config: AppConfig | null, key: string) =>
  accessOf(releasesOf(config?.features), key, ownersOnly(me, ws));

/** Can this person use the page a link opens? False for a locked or hidden feature (Interview, Community for
 *  students), so suggestions, pins and buttons never send a student to a "coming soon" wall (the website's useCanGo). */
export const canGoFor = (me: Me | null, ws: Workspace | null, config: AppConfig | null, link: string) => {
  const f = featureAt(link.split(/[?#]/)[0] || "");
  return !f || accessFor(me, ws, config, f.key) === "open";
};

/** The phone app has its own switch in Admin → Beta → Feature releases (`app`, Owners only by default). Owners always
 *  get in, in either view, so they can switch to student view and check it; everyone else gets in once Dilan releases
 *  `app`, and until then is told it's coming. */
export const appOpenFor = (me: Me | null, config: AppConfig | null) =>
  !!me?.owner || (!!me && appOut(releasesOf(config?.features)));

export type Gate = "loading" | "sign-in" | "beta" | "terms" | "setup" | "not-yet" | "tabs";
/** Which screen comes first, in the website's order: signed out → sign-in; not on the beta list → beta screen; terms
 *  not agreed → terms; not set up → setup; then the app. The config has to be loaded to know the current terms. */
export function gateFor(status: Status, me: Me | null, ws: Workspace | null, config: AppConfig | null): Gate {
  if (status === "loading") return "loading";
  if (status === "signed-out" || status === "error" || !me) return "sign-in";
  if (status === "beta-blocked") return "beta";
  if (!ws || !config) return "loading";
  if (!appOpenFor(me, config)) return "not-yet";
  if (ws.betaAgreed?.version !== termsFor(config.beta?.open).version) return "terms";
  if (!ws.onboarding?.done) return "setup";
  return "tabs";
}

/** The account's theme, the same rule as the website (client/src/lib/store.tsx): a theme the student picked wins;
 *  otherwise the phone's setting. Older accounts stored "light" by default, which the server turns into "system". */
export function themeOf(settings: { theme?: string; themeChosen?: boolean } | undefined, phoneDark: boolean): "light" | "dark" {
  const t = settings?.theme;
  if ((settings?.themeChosen || (t && t !== "system")) && (t === "light" || t === "dark")) return t;
  return phoneDark ? "dark" : "light";
}
