import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { PACE, speechFeedback } from "@shared/speech";

const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

/** Say it out loud: a timer, and where the browser can transcribe, what Remy heard: pace, filler words, whether it
 *  was recited word for word, and which names or numbers from the script were skipped (shared/speech.ts).
 *  Everything stays in the browser; nothing is recorded or saved. */
export function PracticeOutLoud({ goal, label = "Practice out loud", script = "" }: { goal: [number, number]; label?: string; script?: string }) {
  const [secs, setSecs] = useState<number | null>(null);
  const [on, setOn] = useState(false);
  const [heard, setHeard] = useState("");
  const rec = useRef<any>(null);
  const span = useRef<{ first: number; last: number }>({ first: 0, last: 0 }); // when words were first and last heard
  useEffect(() => { if (!on) return; const t = setTimeout(() => setSecs((s) => (s ?? 0) + 1), 1000); return () => clearTimeout(t); }, [on, secs]);
  useEffect(() => () => { rec.current?.abort(); }, []);
  const start = () => {
    setSecs(0); setHeard(""); setOn(true); span.current = { first: 0, last: 0 };
    if (!Speech) return;
    const r = new Speech();
    r.lang = "en-US"; r.continuous = true;
    r.onresult = (e: any) => {
      const now = Date.now();
      if (!span.current.first) span.current.first = now;
      span.current.last = now;
      setHeard([...e.results].map((x: any) => x[0].transcript).join(" "));
    };
    r.onerror = () => {};
    rec.current = r; r.start();
  };
  const stop = () => { setOn(false); rec.current?.stop(); rec.current = null; };
  // Talking time, not the stopwatch (+1s for the first words before the first result). Android's recognizer repeats
  // results, which would inflate word counts, so pace and "word for word" aren't shown there.
  const talked = span.current.first ? (span.current.last - span.current.first) / 1000 + 1 : secs || 0;
  const android = /Android/i.test(navigator.userAgent);
  const fb0 = speechFeedback(heard, talked, script);
  const fb = android ? { ...fb0, wpm: null, recited: null } : fb0;
  const fillers = fb.fillers;
  const [lo, hi] = goal;
  return (
    <div className="stack-sm" style={{ gap: 4 }} data-testid="practice-out-loud">
      {on
        ? <button className="btn btn-ghost btn-sm" onClick={stop} data-testid="button-practice-stop"><Square size={14} /> {secs}s · Stop</button>
        : <button className="btn btn-ghost btn-sm" onClick={start} data-testid="button-practice"><Mic size={14} /> {secs === null ? label : "Try again"}</button>}
      {!on && secs !== null && (
        <div className="xs stack-sm" style={{ gap: 2 }} data-testid="practice-result">
          <span>{secs} seconds: {secs < lo ? `a bit short, aim for ${lo} to ${hi}` : secs > hi ? `a bit long, aim for ${lo} to ${hi}` : "right on time"}.</span>
          {fb.wpm !== null && <span data-testid="practice-pace">About {fb.wpm} words a minute: {fb.pace === "fast" ? `you're rushing a little. Slow down and pause between ideas (aim for ${PACE.slow + 20} to ${PACE.fast - 15}).` : fb.pace === "slow" ? `on the slow side. Try a little faster so it sounds like talking, not reading (aim for ${PACE.slow + 20} to ${PACE.fast - 15}).` : "a natural pace."}</span>}
          {fb.recited !== null && fb.recited >= 0.85 && <span data-testid="practice-recited">You said it almost word for word. That's good for learning it, but in a real conversation it can sound memorized: hit the same points in your own words.</span>}
          {fb.missed.length > 0 && <span data-testid="practice-missed">You skipped: {fb.missed.join(", ")}. Those are the details people remember.</span>}
          {heard && <span>{fillers.length ? `${fillers.length} filler word${fillers.length > 1 ? "s" : ""} (${[...new Set(fillers.map((f) => f.toLowerCase()))].join(", ")}). Pausing works better.` : "No filler words. Nice."}</span>}
          {heard && <span className="muted">What Remy heard: “{heard.trim()}”</span>}
          {!Speech && <span className="muted">Your browser can't transcribe, so this only times you.</span>}
          {heard && <span className="muted">Remy hears your words and timing, not your tone. To check how you sound, record yourself on your phone once and listen back.</span>}
        </div>
      )}
    </div>
  );
}
