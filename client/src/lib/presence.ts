// Using Remy (Admin → Team & hours): owners only. One beat a minute while Remy is on screen and the owner clicked,
// typed, scrolled or tapped in the last minute. Page address only. Students never send anything.
import type { Me } from "@shared/types";
import { api } from "./store";
import { isNativeApp } from "./native";

let started = false;
let lastInput = 0;

export function startPresence(me: Me | null) {
  if (started || !me?.owner || typeof window === "undefined") return;
  // Robot browsers (tests) and the app's own website sheets (the app sends its own beats) don't count.
  if (navigator.webdriver || isNativeApp || /RemyApp/.test(navigator.userAgent)) return;
  started = true;
  const seen = () => { lastInput = Date.now(); };
  for (const e of ["pointerdown", "keydown", "scroll", "touchstart", "wheel"]) addEventListener(e, seen, { passive: true, capture: true });
  seen();
  setInterval(() => {
    if (document.visibilityState !== "visible" || Date.now() - lastInput > 60_000) return;
    const device = matchMedia("(max-width: 690px), (pointer: coarse)").matches ? "phone" : "desktop";
    api("POST", "/api/team/presence", { device, path: location.pathname }).catch(() => {});
  }, 60_000);
}
