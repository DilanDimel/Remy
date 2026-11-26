import { useEffect, useState } from "react";

// Clean addresses (/accounts?tab=data), using the browser's history. The server answers every
// page path with the app (server/static.ts), so a reload or a shared link opens the right page.
const CHANGE = "remy:route";

function parse() {
  return { path: window.location.pathname || "/", query: new URLSearchParams(window.location.search) };
}

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener("popstate", on);
    window.addEventListener(CHANGE, on);
    return () => { window.removeEventListener("popstate", on); window.removeEventListener(CHANGE, on); };
  }, []);
  return r;
}

// The app scrolls inside <main id="main"> on wide screens and the window elsewhere; handle both.
const pane = () => document.getElementById("main");
const scrollY = () => pane()?.scrollTop || window.scrollY;
const scrollTo = (y: number) => { pane()?.scrollTo(0, y); window.scrollTo(0, y); };

const clean = (to: string) => "/" + to.replace(/^#?\/*/, "");

/** Scrolls to the element named by the address's #part (e.g. /policies#beta-terms), waiting briefly for the page to render.
 *  Returns false when there's no such part, so the caller scrolls to the top instead. */
function scrollToHash(instant = false) {
  let id = "";
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return false; }
  if (!id || id.startsWith("/")) return false;
  let tries = 0;
  const to = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start", behavior: instant || matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    else if (++tries < 20) setTimeout(to, 50);
  };
  requestAnimationFrame(to);
  return true;
}

// A newer Remy is live: the next page change loads it fresh, with no Reload/Later bar (Dilan, Nov 25). `safe` says
// nothing is mid-save or mid-reply; drafts (useDraft) and an open tailor conversation are kept in storage, so they survive.
let freshLoad: (() => boolean) | null = null;
let lastPage = location.pathname + location.search;
export function loadFreshOnNextPage(safe: () => boolean) { freshLoad = safe; }

export function go(to: string) {
  const url = clean(to);
  if (freshLoad?.() && url.split("#")[0] !== location.pathname + location.search) { location.assign(url); return; }
  // Same page without a #part: drop a leftover #part so the page goes to the top (e.g. back to /resume?tab=prep).
  if (url === location.pathname + location.search && location.hash) history.replaceState(history.state, "", url);
  if (url !== location.pathname + location.search + location.hash) {
    // Remember where this page was scrolled, so Back returns to the same spot in a list.
    history.replaceState({ ...history.state, y: scrollY() }, "");
    history.pushState(null, "", url);
  }
  lastPage = location.pathname + location.search;
  window.dispatchEvent(new Event(CHANGE));
  if (!scrollToHash()) scrollTo(0);
}

/** Changes the address without adding a Back step (for redirects). */
export function replaceRoute(to: string) {
  history.replaceState(null, "", clean(to));
  lastPage = location.pathname + location.search;
  window.dispatchEvent(new Event(CHANGE));
}

/** Once at start-up: old #/ links still work, and clicks on in-app links change pages without a reload. */
export function startRouter() {
  const fromHash = () => location.hash.startsWith("#/") && replaceRoute(location.hash);
  fromHash();
  window.addEventListener("hashchange", fromHash);
  // Opened straight on a #section (new tab, shared link, reload): jump there, and again once fonts and data have settled.
  if (scrollToHash(true)) setTimeout(() => scrollToHash(true), 700);
  history.scrollRestoration = "manual";
  window.addEventListener("popstate", () => {
    // Back/Forward to another page (not a #section on this one) loads the new build too; the address is already that page.
    const now = location.pathname + location.search, moved = now !== lastPage;
    lastPage = now;
    if (moved && freshLoad?.()) { location.reload(); return; }
    // A same-page #link (the landing page's "Jump to" pills) also fires popstate: go to that section, not the top.
    if (history.state?.y == null && scrollToHash()) return;
    const y = history.state?.y || 0;
    // Lists can take a moment to render; retry briefly until the page is tall enough.
    let tries = 0;
    const to = () => { scrollTo(y); if (scrollY() < y - 2 && ++tries < 20) setTimeout(to, 50); };
    requestAnimationFrame(to);
  });
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a");
    const href = a?.getAttribute("href");
    if (!a || !href || a.target || a.hasAttribute("download") || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) return;
    e.preventDefault();
    go(href);
  });
}

/** Transient UI flags shared across pages (in memory only). */
export const uiFlags = { flyIn: false };
