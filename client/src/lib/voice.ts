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

type Events = { onStart?: () => void; onEnd?: () => void; onError?: (browserError?: string) => void };
let playing: HTMLAudioElement | null = null;
let turn = 0;

/** Stops whatever Remy is saying, in his voice or the browser's. */
export function hush() {
  turn++;
  playing?.pause(); playing = null;
  window.speechSynthesis?.cancel();
}

/** Remy says `text` in his own voice (Arthur, from the server). If that isn't available, the browser's voice reads it. */
export async function say(text: string, ev: Events = {}, rate = 1.05) {
  hush();
  const mine = turn;
  if (!text) return;
  try {
    const { api } = await import("./store"); // lazy: server tests import this file, and store.tsx needs a window
    const mp3 = await api<Blob>("POST", "/api/voice", { text });
    if (mine !== turn) return; // stopped, or something newer started, while it loaded
    const a = new Audio(URL.createObjectURL(mp3));
    playing = a;
    const done = () => { URL.revokeObjectURL(a.src); if (playing === a) playing = null; };
    a.onplay = () => ev.onStart?.();
    a.onended = () => { done(); ev.onEnd?.(); };
    a.onpause = () => { if (!a.ended) { done(); ev.onEnd?.(); } };
    await a.play();
    return;
  } catch {
    playing = null;
    if (mine !== turn) return;
  }
  // Fallback: the browser's built-in voice.
  const s = window.speechSynthesis;
  if (!s) return ev.onError?.("unsupported");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US"; u.rate = rate;
  u.onstart = () => ev.onStart?.();
  u.onend = () => ev.onEnd?.();
  u.onerror = (e) => { ev.onEnd?.(); if (e.error !== "interrupted" && e.error !== "canceled") ev.onError?.(e.error); };
  s.speak(u);
}

export function speak(md: string) {
  if (md) say(spoken(md));
}
