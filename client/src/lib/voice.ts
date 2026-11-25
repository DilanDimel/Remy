import { useEffect, useRef, useState } from "react";

// Owners (Nov 23, "Remy feels alive"): talk to Remy out loud. The browser hears you (where it can), sends what it heard
// when you stop talking, and Remy reads his answer back. Nothing is recorded or uploaded by us.
const Speech = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
export const canListen = !!Speech;

/** Plain words for why the browser stopped listening (SpeechRecognition error codes), or null when it's nothing to show. */
export function micProblem(code: string): string | null {
  if (code === "not-allowed" || code === "service-not-allowed") return "Your browser blocked the microphone. Click the mic or lock icon in the address bar, allow it, then try again.";
  if (code === "audio-capture") return "I couldn't find a microphone. Plug one in or check your sound settings, then try again.";
  if (code === "no-speech") return "I didn't hear anything. Try again a little closer to the mic.";
  if (code === "network") return "Your browser's speech service isn't reachable right now. You can type instead.";
  return null; // "aborted" is us stopping it
}

/** One spoken message: `partial` shows what it's hearing, `done` gets the final words when you stop talking. */
export function useVoice(partial: (t: string) => void, done: (t: string) => void, problem: (msg: string) => void) {
  const [on, setOn] = useState(false);
  const rec = useRef<any>(null);
  useEffect(() => () => rec.current?.abort(), []);
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    if (!Speech) return;
    hush(); // don't hear Remy talking over you
    let heard = "";
    const r = new Speech();
    r.lang = "en-US"; r.continuous = false; r.interimResults = true;
    r.onresult = (e: any) => { heard = [...e.results].map((x: any) => x[0].transcript).join(" "); partial(heard); };
    r.onerror = (e: any) => { const m = micProblem(e.error); if (m) problem(m); };
    r.onend = () => { setOn(false); rec.current = null; if (heard.trim()) done(heard.trim()); };
    rec.current = r; setOn(true);
    try { r.start(); } catch { setOn(false); rec.current = null; }
  };
  return { on, toggle };
}

/** Plain words for reading aloud: no markdown, bullets or links. */
export const spoken = (md: string) => md.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>]/g, "").replace(/^\s*[•-]\s*/gm, "").replace(/\s+/g, " ").trim();

type Events = { onStart?: () => void; onEnd?: () => void; onError?: (why: string) => void };
// One shared player. Phones only let audio play if it starts on a tap, and Remy's voice arrives a moment after it,
// so the first tap anywhere plays a split second of silence on this player; after that it may play later on its own.
const player = typeof Audio !== "undefined" ? new Audio() : null;
const SILENT = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAABgAAAykAWlpaWlpaWlpaWlpaWlpaWnt7e3t7e3t7e3t7e3t7e3t7nJycnJycnJycnJycnJycnL29vb29vb29vb29vb29vb293t7e3t7e3t7e3t7e3t7e3t7/////////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQCowAAAAAAAAMpso+sIAAAAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NAxKQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEowAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
let unlocked = false;
function unlock() {
  if (unlocked || !player || !player.paused) return;
  player.src = SILENT;
  player.play().then(() => { unlocked = true; }, () => {});
}
if (typeof document !== "undefined") for (const e of ["pointerdown", "touchend", "keydown"]) document.addEventListener(e, unlock, { capture: true, passive: true });

let turn = 0;
let current: Events | null = null;
let url = "";

/** Stops whatever Remy is saying. */
export function hush() {
  turn++;
  player?.pause();
  const c = current; current = null; c?.onEnd?.();
}

/** Remy says `text` in his own voice (Arthur, from the server). Nothing else ever speaks for him. */
export async function say(text: string, ev: Events = {}) {
  hush();
  unlock(); // a "Hear it" tap counts as the tap
  const mine = turn;
  if (!text) return;
  try {
    if (!player) throw new Error("no audio");
    const { api } = await import("./store"); // lazy: server tests import this file, and store.tsx needs a window
    const mp3 = await api<Blob>("POST", "/api/voice", { text });
    if (mine !== turn) return; // stopped, or something newer started, while it loaded
    if (url) URL.revokeObjectURL(url);
    player.src = url = URL.createObjectURL(mp3);
    player.onended = () => { if (mine === turn) { current = null; ev.onEnd?.(); } };
    current = ev;
    await player.play();
    ev.onStart?.();
    return;
  } catch (e) {
    if (mine !== turn) return;
    current = null;
    // No robot fallback (Dilan, Nov 25): say why it stayed quiet, and log it for the owners' Errors page.
    ev.onError?.((e as Error)?.name || "voice");
    import("../components/ErrorBoundary").then((m) => m.reportClientError("voice", e)).catch(() => {});
  }
}

export function speak(md: string) {
  if (md) say(spoken(md));
}
