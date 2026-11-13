// Automatic signals for the owners' dashboard, so problems show up even when nobody presses "Send feedback".
// Counts only (which page, which button got rage-clicked, 👍/👎 per feature) plus error reports; never what a
// student typed or what's on their screen. Sent in small batches; only signed-in students are counted (the server checks).
import { API_BASE } from "./store";

const events: string[] = [];
const problems: { where: string; message: string }[] = [];
const seenProblem = new Map<string, number>();
let started = false;

/** Ids, emails and numbers in a path become placeholders, so "/api/jobs/j8f2…/check" counts as one place. */
export const tidyPath = (p: string) => p.split("?")[0].replace(/\/[a-z]*\d[\w-]{5,}/gi, "/:id").replace(/\/[^/]+@[^/]+/g, "/:email").slice(0, 80);

export function count(name: string) {
  if (events.length < 200) events.push(name.slice(0, 90));
}

/** An error worth a look on the dashboard; the same one is sent at most once a minute from this browser. */
export function problem(where: string, message: string) {
  const key = where + "|" + message;
  const now = Date.now();
  if (now - (seenProblem.get(key) || 0) < 60_000 || problems.length >= 20) return;
  seenProblem.set(key, now);
  problems.push({ where: where.slice(0, 120), message: message.slice(0, 300) });
}

/** Called by api(): requests that failed on the server, never reached it, or took very long. */
export function apiResult(method: string, url: string, status: number, ms: number) {
  const where = `${method} ${tidyPath(url)}`;
  if (url.startsWith("/api/signals") || url.startsWith("/api/client-error")) return;
  if (status === 0) problem(where, "Request didn't reach Remy (network dropped or server restarting)");
  else if (status >= 500) problem(where, `Request failed (${status})`);
  // AI answers (tailoring, coach, plans, searches) normally take a while; only flag them when far slower than usual.
  else {
    const limit = /\/(ai|assistant|chat|discover|tailor|builder|generate|audit|fit|explain|import|classify|followup|resume\/upload|resume\/text)\b/.test(url) ? 45_000 : 8000;
    if (ms > limit) problem(where, `Slow: took over ${limit / 1000} seconds`);
  }
}

function flush(beacon = false) {
  if (!events.length && !problems.length) return;
  const body = JSON.stringify({ events: events.splice(0, 200), problems: problems.splice(0, 20) });
  try {
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(`${API_BASE}/api/signals`, new Blob([body], { type: "application/json" }));
    else fetch(`${API_BASE}/api/signals`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

/** Starts once, after sign-in: errors outside React, rage clicks, batches every 20 seconds and when the tab closes. */
export function startSignals() {
  if (started) return;
  started = true;
  // A browser extension's own crash (crypto wallets, ad blockers) isn't Remy's problem.
  const extension = (x: unknown) => /(chrome|moz|safari-web)-extension:\/\//.test(String(x || ""));
  addEventListener("error", (e) => {
    const ev = e as ErrorEvent;
    if (extension(ev.filename) || extension(ev.error?.stack)) return;
    problem(location.pathname, `Page error: ${String(ev.message || "unknown")}`);
  });
  addEventListener("unhandledrejection", (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    if (extension(r?.stack)) return;
    if (r?.status !== undefined) return; // an answer from Remy's server: shown to the student, and failures were already reported by api()
    problem(location.pathname, `Unhandled: ${String(r?.message || r || "unknown").slice(0, 200)}`);
  });
  // Rage click: 3+ clicks on the same thing within a second usually means it looks clickable but doesn't work.
  let last: { el: Element | null; n: number; t: number } = { el: null, n: 0, t: 0 };
  addEventListener("click", (e) => {
    const el = (e.target as Element | null)?.closest("button, a, [role=button], [data-testid], input, label") || (e.target as Element | null);
    const now = Date.now();
    last = el === last.el && now - last.t < 1000 ? { el, n: last.n + 1, t: now } : { el, n: 1, t: now };
    if (last.n === 3 && el) {
      // Only the developer-given id or the tag name: never visible text or aria-labels, which can hold what a student wrote.
      const id = el.getAttribute("data-testid") || el.tagName.toLowerCase();
      count(`rage:${tidyPath(location.pathname)}:${id.slice(0, 40)}`);
    }
  }, true);
  setInterval(() => flush(), 20_000);
  addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
}
