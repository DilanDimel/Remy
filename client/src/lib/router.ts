import { useEffect, useState } from "react";

function parse() {
  const h = window.location.hash.replace(/^#/, "") || "/";
  const [path, q = ""] = h.split("?");
  return { path: path || "/", query: new URLSearchParams(q) };
}

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

export function go(to: string) {
  window.location.hash = to.startsWith("#") ? to : "#" + to;
}

/** Transient UI flags shared across pages (in memory only). */
export const uiFlags = { flyIn: false };
