// Pop-ups that open by themselves (new pin, level up, milestone, "what changed") take turns: one at a time, and none
// during setup or the tour (tester, Nov 25: a badge covered the tour). Each asks for a turn; the first to ask gets it.
import { useEffect, useState } from "react";
import { useStore } from "./store";
import { tourOn } from "../components/Tour";

let holder: string | null = null;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());

/** True while this pop-up may show. `want` says it has something to show; it waits while another one is open. */
export function useMomentTurn(id: string, want: boolean) {
  const { ws } = useStore();
  const quiet = !ws || !ws.onboarding.done || tourOn(ws);
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const free = want && !quiet && (holder === null || holder === id);
  useEffect(() => {
    if (free && holder === null) { holder = id; tell(); }
    if (!free && holder === id) { holder = null; tell(); }
  }, [free, id]);
  useEffect(() => () => { if (holder === id) { holder = null; tell(); } }, [id]);
  return free;
}
