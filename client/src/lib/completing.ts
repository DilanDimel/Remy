import { useCallback, useEffect, useRef, useState } from "react";

/** Checked-off rows stay for a moment, struck through, then fade away. */
export const FADE_MS = 2600;
export function useCompleting() {
  const [fading, setFading] = useState<Set<string>>(() => new Set());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const mark = useCallback((id: string) => {
    setFading((s) => new Set(s).add(id));
    timers.current.push(window.setTimeout(() => setFading((s) => { const n = new Set(s); n.delete(id); return n; }), FADE_MS));
  }, []);
  return { isFading: (id: string) => fading.has(id), mark };
}
