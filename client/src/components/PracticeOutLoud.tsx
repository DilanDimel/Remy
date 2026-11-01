import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const FILLERS = /\b(um+|uh+|like|you know|basically|kind of|sort of)\b/gi;

/** Say it out loud: a timer, and where the browser can transcribe, what Remy heard and the filler words.
 *  Everything stays in the browser; nothing is recorded or saved. */
export function PracticeOutLoud({ goal, label = "Practice out loud" }: { goal: [number, number]; label?: string }) {
  const [secs, setSecs] = useState<number | null>(null);
  const [on, setOn] = useState(false);
  const [heard, setHeard] = useState("");
  const rec = useRef<any>(null);
  useEffect(() => { if (!on) return; const t = setTimeout(() => setSecs((s) => (s ?? 0) + 1), 1000); return () => clearTimeout(t); }, [on, secs]);
  useEffect(() => () => { rec.current?.abort(); }, []);
  const start = () => {
    setSecs(0); setHeard(""); setOn(true);
    if (!Speech) return;
    const r = new Speech();
    r.lang = "en-US"; r.continuous = true;
    r.onresult = (e: any) => setHeard([...e.results].map((x: any) => x[0].transcript).join(" "));
    r.onerror = () => {};
    rec.current = r; r.start();
  };
  const stop = () => { setOn(false); rec.current?.stop(); rec.current = null; };
  const fillers = heard.match(FILLERS) || [];
  const [lo, hi] = goal;
  return (
    <div className="stack-sm" style={{ gap: 4 }} data-testid="practice-out-loud">
      {on
        ? <button className="btn btn-ghost btn-sm" onClick={stop} data-testid="button-practice-stop"><Square size={14} /> {secs}s · Stop</button>
        : <button className="btn btn-ghost btn-sm" onClick={start} data-testid="button-practice"><Mic size={14} /> {secs === null ? label : "Try again"}</button>}
      {!on && secs !== null && (
        <div className="xs stack-sm" style={{ gap: 2 }} data-testid="practice-result">
          <span>{secs} seconds: {secs < lo ? `a bit short, aim for ${lo} to ${hi}` : secs > hi ? `a bit long, aim for ${lo} to ${hi}` : "right on time"}.</span>
          {heard && <span>{fillers.length ? `${fillers.length} filler word${fillers.length > 1 ? "s" : ""} (${[...new Set(fillers.map((f) => f.toLowerCase()))].join(", ")}). Pausing works better.` : "No filler words. Nice."}</span>}
          {heard && <span className="muted">What Remy heard: “{heard.trim()}”</span>}
          {!Speech && <span className="muted">Your browser can't transcribe, so this only times you.</span>}
        </div>
      )}
    </div>
  );
}
