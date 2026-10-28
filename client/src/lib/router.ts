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

const clean = (to: string) => "/" + to.replace(/^#?\/*/, "");

export function go(to: string) {
  const url = clean(to);
  if (url !== location.pathname + location.search) history.pushState(null, "", url);
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event(CHANGE));
}

/** Changes the address without adding a Back step (for redirects). */
export function replaceRoute(to: string) {
  history.replaceState(null, "", clean(to));
  window.dispatchEvent(new Event(CHANGE));
}

/** Once at start-up: old #/ links still work, and clicks on in-app links change pages without a reload. */
export function startRouter() {
  const fromHash = () => location.hash.startsWith("#/") && replaceRoute(location.hash);
  fromHash();
  window.addEventListener("hashchange", fromHash);
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
