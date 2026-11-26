import { CalendarClock } from "lucide-react";
import type { CalItem, Workspace } from "@shared/types";
import { useStore } from "../lib/store";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ampm = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
export const careerTimeLabel = (c: { day: number; time: string }) => `${DAYS[c.day]}s at ${ampm(c.time)}`;

/** The student's weekly career time as calendar entries for the next `weeks` weeks (shown, never stored). */
export function careerItems(w: Workspace, weeks = 26): CalItem[] {
  const c = w.settings.careerTime;
  if (!c) return [];
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((c.day - d.getDay() + 7) % 7));
  return Array.from({ length: weeks }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + 7 * i);
    return { id: "career-" + i, title: "Career time with Remy", date: x.toLocaleDateString("en-CA"), time: c.time, kind: "Event", source: "Your weekly career time", notes: "45 minutes for one real step: a to-do, an application, or a message to someone." };
  });
}

/** A fixed weekly time for career work, the student's own reminder instead of streaks or nagging. */
export function CareerTime({ compact = false }: { compact?: boolean }) {
  const { ws, save, run } = useStore();
  const c = ws!.settings.careerTime;
  const set = (v: { day: number; time: string } | null) => run(() => save("settings", { careerTime: v }), v ? `Career time: ${careerTimeLabel(v)}` : "Career time removed");
  return (
    <div className="stack-sm" data-testid="career-time">
      {!compact && <div className="row" style={{ gap: 8 }}><CalendarClock size={18} style={{ color: "var(--fox)" }} /><b>When will you work on your career each week?</b></div>}
      {!compact && <p className="small muted">A set time makes it easier to follow through than waiting for a reminder. 45 minutes is plenty. It shows on your Remy calendar and you can add it to Google or Apple Calendar.</p>}
      <div className="row" style={{ gap: 8 }}>
        <select className="select" style={{ width: "auto" }} value={c?.day ?? ""} onChange={(e) => e.target.value !== "" && set({ day: Number(e.target.value), time: c?.time || "19:00" })} aria-label="Day" data-testid="select-career-day">
          <option value="">Pick a day</option>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}s</option>)}
        </select>
{/* Any time, not a list (tester, Nov 25: "like an alarm at 3:30pm"). Saved when the field is left, not on every keystroke. */}
        <input type="time" className="input" style={{ width: "auto" }} key={c?.time} defaultValue={c?.time ?? "19:00"} step={300} disabled={!c} onBlur={(e) => c && /^\d\d:\d\d$/.test(e.target.value) && e.target.value !== c.time && set({ day: c.day, time: e.target.value })} aria-label="Time" data-testid="select-career-time" />
        {c && <button className="btn btn-ghost btn-sm" onClick={() => set(null)}>Remove</button>}
      </div>
    </div>
  );
}
