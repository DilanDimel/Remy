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

/** onError gets plain words for the person (why Remy stayed quiet). */
type Events = { onStart?: () => void; onEnd?: () => void; onError?: (why: string) => void };
// Played through Web Audio, not an <audio> element: iPhones (Safari and the app's web view) refused the MP3 as a blob
// source ("no supported source"). Phones also only allow sound that starts on a tap, and Remy's voice arrives a moment
// after it, so the first tap anywhere wakes the sound engine; after that he may speak on his own (a chat reply).
let ctx: AudioContext | null = null;
function unlock() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    // Safari 17+: play like a media app, so the silent switch doesn't mute Remy.
    const session = (navigator as any).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
    ctx ??= new AC();
    if (ctx.state !== "running") {
      ctx.resume().catch(() => {});
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
    }
  } catch {}
}
if (typeof document !== "undefined") for (const e of ["pointerdown", "touchend", "keydown"]) document.addEventListener(e, unlock, { capture: true, passive: true });

let turn = 0;
let current: Events | null = null;
let source: AudioBufferSourceNode | null = null;

/** Stops whatever Remy is saying. */
export function hush() {
  turn++;
  try { source?.stop(); } catch {}
  source = null;
  const c = current; current = null; c?.onEnd?.();
}

/** Remy says `text` in his own voice (Arthur, from the server). Nothing else ever speaks for him. */
export async function say(text: string, ev: Events = {}) {
  hush();
  unlock(); // a "Hear it" tap counts as the tap
  const mine = turn;
  if (!text) return;
  let got = "";
  try {
    if (!ctx) throw new Error("This browser can't play sound.");
    const { api } = await import("./store"); // lazy: server tests import this file, and store.tsx needs a window
    const mp3 = await api<Blob>("POST", "/api/voice", { text });
    got = ` (${mp3.type || "no type"}, ${mp3.size} bytes)`;
    const audio = await ctx.decodeAudioData(await mp3.arrayBuffer());
    if (mine !== turn) return; // stopped, or something newer started, while it loaded
    if (ctx.state !== "running") await ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = audio; s.connect(ctx.destination);
    s.onended = () => { if (source === s) { source = null; current = null; ev.onEnd?.(); } };
    source = s; current = ev;
    s.start(0);
    ev.onStart?.();
  } catch (e) {
    if (mine !== turn) return;
    current = null;
    // No robot fallback (Dilan, Nov 25): say why it stayed quiet, in plain words.
    // The server saying no (voice off or out of credits = 503, too many this hour = 429) is expected: its own message, no error log.
    const refused = (e as any)?.status === 503 || (e as any)?.status === 429;
    ev.onError?.(refused ? (e as Error).message : "Remy's voice couldn't play. Check your sound is on and your phone isn't on silent, then try again.");
    if (refused) return;
    const err = new Error(`${(e as Error)?.message || e}${got}${ctx ? ` [audio ${ctx.state}]` : ""}`);
    import("../components/ErrorBoundary").then((m) => m.reportClientError("voice", err)).catch(() => {});
  }
}

export function speak(md: string) {
  if (md) say(spoken(md));
}

// Recorded narration (owners first, Nov 27 proposal): Remy reads the tour's and setup's fixed lines aloud. The words
// stay on screen as the caption. Each fixed line is made once and then served from the server's voice cache, so
// replaying it costs nothing. Mute is remembered on this device.
const NARRATION_KEY = "remy:narration";
export function useNarration(allowed: boolean) {
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(NARRATION_KEY) === "off"; } catch { return false; } });
  const on = allowed && !muted;
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(NARRATION_KEY, next ? "off" : "on"); } catch {}
    if (next) hush();
  };
  /** Reads `line` once each time it changes, while narration is on; stops when the screen goes away. */
  const useLine = (line: string | null) => {
    useEffect(() => { if (on && line) say(spoken(line)); }, [on, line]);
    useEffect(() => () => hush(), []);
  };
  return { allowed, muted, toggle, useLine };
}
