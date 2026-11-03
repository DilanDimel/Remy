import { GoogleCalendarCard } from "../components/GoogleCalendar";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { CalItem } from "@shared/types";
import { download, fmtDate, rid, useStore } from "../lib/store";
import { Modal, StatusChip } from "../components/common";
import { careerItems } from "../components/CareerTime";

const KINDS: CalItem["kind"][] = ["Deadline", "Event", "Task", "Interview", "Advising"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function gcalLink(c: CalItem) {
  const d = c.date.replace(/-/g, "");
  let dates: string;
  if (c.time) {
    const [h, m] = c.time.split(":").map(Number);
    const end = `${String(h + 1).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    dates = `${d}T${c.time.replace(":", "")}00/${d}T${end}`;
  } else {
    const n = new Date(c.date + "T12:00:00"); n.setDate(n.getDate() + 1);
    dates = `${d}/${iso(n).replace(/-/g, "")}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(c.title)}&dates=${dates}&details=${encodeURIComponent(c.notes || "Added from Remy")}${c.id.startsWith("career-") ? "&recur=" + encodeURIComponent("RRULE:FREQ=WEEKLY") : ""}`;
}

export default function CalendarPage() {
  const { ws, save, run, toast } = useStore();
  const w = ws!;
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [edit, setEdit] = useState<CalItem | null>(null);
  const [sel, setSel] = useState<CalItem | null>(null);
  const items = useMemo(() => {
    const fromTasks: CalItem[] = w.tasks.filter((t) => t.due && !t.done).map((t) => ({ id: "task-" + t.id, title: t.title, date: t.due, time: "", kind: "Task", source: "To-do", notes: t.why, linkedId: t.id }));
    return [...w.calendar, ...fromTasks, ...careerItems(w)].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [w.calendar, w.tasks, w.settings.careerTime]);
  const start = new Date(month); start.setDate(1 - start.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = iso(new Date());
  // The weekly career time repeats; Upcoming shows only its next one, so real deadlines and interviews aren't pushed out.
  const upcoming = items.filter((i) => i.date >= today).filter((i, n, all) => !i.id.startsWith("career-") || all.findIndex((x) => x.id.startsWith("career-")) === n).slice(0, 8);
  const saveItem = async (c: CalItem) => {
    const exists = w.calendar.some((x) => x.id === c.id);
    const dupe = w.calendar.find((x) => x.id !== c.id && x.title.trim().toLowerCase() === c.title.trim().toLowerCase() && x.date === c.date);
    if (dupe) return toast("That item is already on your calendar.", true);
    await run(() => save("calendar", exists ? w.calendar.map((x) => (x.id === c.id ? c : x)) : [...w.calendar, c]), "Saved to your Remy calendar");
    setEdit(null);
  };
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Calendar</span>
          <h1>Deadlines, events and prep — in one place.</h1>
          <p>Items you approve live here. Export them to your own calendar whenever you like.</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => download("/api/calendar.ics", "remy.ics").catch((e) => toast(e.message, true))} disabled={!w.calendar.length && !w.settings.careerTime} data-testid="button-export-ics"><Download size={16} /> Export .ics</button>
          <button className="btn btn-primary" onClick={() => setEdit({ id: rid("cal"), title: "", date: today, time: "", kind: "Event", source: "Added by you", notes: "" })} data-testid="button-add-event"><Plus size={16} /> Add</button>
        </div>
      </div>
      <GoogleCalendarCard />
      <div className="stack-lg">
        <div className="card card-pad stack">
          <div className="row-between">
            <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
            <div className="row">
              <button className="icon-btn" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); }}>Today</button>
              <button className="icon-btn" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="cal-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="xs muted" style={{ textAlign: "center", fontWeight: 700 }}>{d}</div>)}
            {days.map((d) => {
              const k = iso(d);
              const evs = items.filter((i) => i.date === k);
              return (
                <div key={k} className={`cal-cell ${d.getMonth() !== month.getMonth() ? "out" : ""} ${k === today ? "today" : ""}`}>
                  <span className="muted">{d.getDate()}</span>
                  {evs.slice(0, 4).map((e) => <button key={e.id} className={`cal-ev ${e.kind}`} onClick={() => setSel(e)} title={e.title}>{e.title}</button>)}
                  {evs.length > 4 && <span className="faint">+{evs.length - 4} more</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card card-pad stack-sm">
          <h3>Upcoming</h3>
          {upcoming.length ? <div className="upcoming-grid">{upcoming.map((i) => (
            <button key={i.id} className="pick" onClick={() => setSel(i)} data-testid="button-upcoming">
              <span className="xs muted">{fmtDate(i.date)}{i.time ? ` · ${i.time}` : ""} · {i.kind}</span>
              <strong className="small">{i.title}</strong>
            </button>
          ))}</div> : <span className="small muted">Nothing scheduled. Add deadlines from Opportunities.</span>}
        </div>
      </div>
      {sel && (
        <Modal title={sel.title} onClose={() => setSel(null)}>
          <dl className="kv"><dt>When</dt><dd>{fmtDate(sel.date)}{sel.time ? ` at ${sel.time}` : " (all day)"}</dd><dt>Type</dt><dd>{sel.kind}</dd><dt>Source</dt><dd>{sel.source}</dd></dl>
          {sel.notes && <p className="small">{sel.notes}</p>}
          <div className="row">
            <a className="btn btn-secondary btn-sm" href={gcalLink(sel)} target="_blank" rel="noreferrer" data-testid="link-gcal"><ExternalLink size={14} /> Add to Google Calendar</a>
            {sel.id.startsWith("career-") && <button className="btn btn-secondary btn-sm" onClick={() => download("/api/calendar.ics?id=career", "career-time.ics").catch((e) => toast(e.message, true))}><Download size={14} /> Repeating .ics</button>}
            {!sel.id.startsWith("task-") && !sel.id.startsWith("career-") && <>
              <button className="btn btn-secondary btn-sm" onClick={() => download(`/api/calendar.ics?id=${sel.id}`, "event.ics").catch((e) => toast(e.message, true))}><Download size={14} /> .ics</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(sel); setSel(null); }}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => { run(() => save("calendar", w.calendar.filter((x) => x.id !== sel.id)), "Removed"); setSel(null); }}><Trash2 size={14} /> Remove</button>
            </>}
          </div>
        </Modal>
      )}
      {edit && (
        <Modal title={w.calendar.some((x) => x.id === edit.id) ? "Edit item" : "Add to calendar"} onClose={() => setEdit(null)}>
          <label className="field"><span>Title</span><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} data-testid="input-event-title" /></label>
          <div className="grid-3">
            <label className="field"><span>Date</span><input className="input" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} data-testid="input-event-date" /></label>
            <label className="field"><span>Time (optional)</span><input className="input" type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} /></label>
            <label className="field"><span>Type</span><select className="select" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as CalItem["kind"] })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
          </div>
          <label className="field"><span>Notes</span><textarea className="textarea" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={!edit.title.trim() || !edit.date} onClick={() => saveItem(edit)} data-testid="button-save-event">Save</button></div>
        </Modal>
      )}
    </>
  );
}
