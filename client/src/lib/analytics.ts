// PostHog: where students get stuck (pages, actions, errors) and masked replays. Privacy page "Automatic problem
// reports" promises: all text and typing hidden in replays, no team in replays, off with Do Not Track.
import type { PostHog } from "posthog-js/dist/module.full.no-external";
import type { AppConfig, Me } from "@shared/types";
import { tidyPath } from "./signals";

let ph: PostHog | null = null;
let starting = false;
const queued: [string, Record<string, unknown>?][] = [];

const dnt = () => typeof navigator !== "undefined" && (navigator.doNotTrack === "1" || (window as any).doNotTrack === "1" || (navigator as any).globalPrivacyControl === true);

/** Signed-in, published site only. Loaded lazily so it never slows the first page. */
export function startAnalytics(me: Me, config: AppConfig | null) {
  const key = config?.posthog?.key;
  if (ph && ph.get_distinct_id() !== me.id) ph.identify(me.id, { owner: !!me.owner }); // signed in again as someone else
  if (ph || starting || !key || config?.hosting !== "published" || me.kind === "guest" || me.kind === "visitor" || dnt()) return;
  starting = true;
  // The full bundle carries replay and error capture, so no PostHog scripts load from outside (only settings JSON).
  import("posthog-js/dist/module.full.no-external").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: config!.posthog!.host,
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_exceptions: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      respect_dnt: true,
      disable_surveys: true,
      // The team is never recorded; their events still count (filtered out in PostHog as test accounts).
      disable_session_recording: !!me.owner,
      session_recording: { maskAllInputs: true, maskTextSelector: "*", blockSelector: "img, canvas, video, [data-ph-block]" },
      // Page addresses only, never what's after "?" (search words, sign-in codes).
      before_send: (e) => {
        if (!e) return e;
        for (const k of ["$current_url", "$referrer", "$pathname"]) if (typeof e.properties?.[k] === "string") e.properties[k] = String(e.properties[k]).split("?")[0].split("#")[0];
        return e;
      },
    });
    posthog.identify(me.id, { owner: !!me.owner });
    ph = posthog;
    for (const [name, props] of queued.splice(0)) posthog.capture(name, props);
  }).catch(() => { starting = false; });
}

/** A finished action (non-GET request that worked), named by its tidy path, e.g. "POST /api/resume/upload". */
export function trackAction(method: string, url: string) {
  if (method === "GET" || /^\/api\/(signals|client-error|admin|auth\/me)/.test(url)) return;
  const name = `${method} ${tidyPath(url)}`;
  if (ph) ph.capture(name);
  else if (starting && queued.length < 50) queued.push([name]);
  // Signing out: the next person on this computer starts as a stranger.
  if (url === "/api/auth/logout") { ph?.reset(); try { sessionStorage.clear(); } catch {} } // incl. a half-finished Remy conversation
}

/** A named moment with a few plain values, e.g. track("rated", { place: "export", helpful: true }). */
export function track(name: string, props: Record<string, string | number | boolean>) { ph?.capture(name, props); }

export function trackDownload(url: string) {
  const fmt = url.match(/format=(\w+)/)?.[1];
  const name = `DOWNLOAD ${tidyPath(url)}`;
  if (ph) ph.capture(name, fmt ? { format: fmt } : undefined);
}

/** Errors React catches never reach window.onerror, so the error boundary reports them here too. */
export function trackError(where: string, error: unknown) {
  ph?.captureException(error instanceof Error ? error : new Error(String(error)), { where });
}
