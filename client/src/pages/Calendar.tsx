import { GoogleCalendarCard } from "../components/GoogleCalendar";
import { useMemo, useState } from "react";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Flag, Mail, Mic, Plus, Trash2 } from "lucide-react";
import { calendarPlan, type CalSuggestion } from "@shared/calendarPlan";
import { go } from "../lib/router";
import type { CalItem } from "@shared/types";
import { download, fmtDate, rid, useOwnerView, useStore } from "../lib/store";
import { Modal, Remy, StatusChip } from "../components/common";
import { CareerTime, careerItems } from "../components/CareerTime";
import { useJobs } from "../lib/jobs";
import { useIsMobile } from "../hooks/use-mobile";

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

/** "19:00" → "7:00 PM", the way setup shows times. */
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return isNaN(h) ? t : `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

const daysTo = (date: string, today: string) => Math.round((new Date(date + "T12:00").getTime() - new Date(today + "T12:00").getTime()) / 864e5);
const when = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

/** Owners: Remy's one line, from the next real deadline or interview, else the next thing on the list. */
function CalLine({ upcoming, today }: { upcoming: CalItem[]; today: string }) {
  const big = upcoming.find((i) => i.kind === "Interview" || i.kind === "Deadline");
  const week = upcoming.filter((i) => daysTo(i.date, today) <= 6).length;
  return (
    <p className="op-say" data-testid="calendar-line">
      {/* Nov 23 PM review: it said "No deadlines or interviews coming up" right above a list of five to-dos. */}
      <b>{big ? `${big.title} is ${when(daysTo(big.date, today))}.` : upcoming[0] ? `Next: ${upcoming[0].title.replace(/\.$/, "")}, ${when(daysTo(upcoming[0].date, today))}.` : "Nothing coming up yet."}</b>
      {week ? ` ${week} thing${week === 1 ? "" : "s"} on your calendar this week.` : " A quiet week: a good time to add a coffee chat."}
    </p>
  );
}

/** Owners: one "Coming up" list above the month (Dilan Nov 22: This week and Upcoming were the same thing twice).
 *  Peach like Home's Remy card; items in the next seven days are marked; each row opens the item. */
function ComingUp({ items, weekEnd, onOpen }: { items: CalItem[]; weekEnd: string; onOpen: (c: CalItem) => void }) {
  return (
    <section className="op-card" data-testid="calendar-week">
      <span className="op-kick">Coming up</span>
      {items.length ? <ul className="op-dl cal-week">{items.map((i) => {
        const d = new Date(i.date + "T12:00");
        return (
          <li key={i.id}><span className={"op-date" + (i.date <= weekEnd ? " this-week" : "")}><small>{d.toLocaleDateString("en-US", i.date <= weekEnd ? { weekday: "short" } : { month: "short" })}</small><b>{d.getDate()}</b></span>
            <button onClick={() => onOpen(i)} data-testid="button-upcoming"><strong>{i.title}</strong><span>{i.kind}{i.time ? ` · ${clock(i.time)}` : ""}</span></button></li>
        );
      })}</ul> : <p className="small muted" style={{ marginTop: 6 }}>Nothing scheduled. Save an opening with a deadline, or press Add.</p>}
    </section>
  );
}

/** Owners (Dilan, Nov 24: "a lot of dead space, AI could be using"): Remy's plan for the week beside the month, from the
 *  student's own interviews, opening deadlines and undated to-dos (shared/calendarPlan.ts). One tap puts each on the calendar. */
function RemyPlan({ steps, onAdd }: { steps: CalSuggestion[]; onAdd: (s: CalSuggestion) => Promise<void> }) {
  const [done, setDone] = useState<string[]>([]);
  const day = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const Icon = { prep: Mic, deadline: Flag, todo: CalendarPlus };
  return (
    <section className="op-card cal-plan" data-testid="calendar-remy-plan">
      <div className="cal-plan-head"><Remy size={32} mood="wave" /><span className="remy-offer-kicker"><i aria-hidden="true" />Remy's plan for your week</span></div>
      <ul>{steps.map((s) => {
        const I = Icon[s.kind]; const ok = done.includes(s.id);
        return (
          <li key={s.id}><span className="cal-plan-ic"><I size={16} /></span>
            <span className="cal-plan-txt"><b>{s.title}</b><small>{day(s.date)} · {s.why}</small></span>
            <button className="btn btn-secondary btn-sm" disabled={ok} onClick={async () => { await onAdd(s); setDone((d) => [...d, s.id]); }} data-testid={`button-plan-${s.kind}`}>
              {ok ? <><Check size={14} /> Added</> : s.kind === "todo" ? `Put on ${new Date(s.date + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}` : <><Plus size={14} /> Add</>}</button></li>
        );
      })}</ul>
    </section>
  );
}

/** Phones (Dilan, Nov 25): a week you swipe with the arrows instead of a month of empty boxes, and the picked day's items
 *  under it. Dots mark days that have something. */
function WeekStrip({ items, today, onOpen }: { items: CalItem[]; today: string; onOpen: (c: CalItem) => void }) {
  const [day, setDay] = useState(today);
  const d0 = new Date(day + "T12:00"); d0.setDate(d0.getDate() - d0.getDay());
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); return d; });
  const shift = (n: number) => { const d = new Date(day + "T12:00"); d.setDate(d.getDate() + n); setDay(iso(d)); };
  const on = items.filter((i) => i.date === day);
  return (
    <section className="card card-pad cal-week-strip" data-testid="calendar-week-strip">
      <div className="row-between">
        <h2>{d0.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <div className="row">
          <button className="icon-btn" onClick={() => shift(-7)} aria-label="Previous week" data-testid="button-week-prev"><ChevronLeft size={18} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDay(today)} data-testid="button-week-today">Today</button>
          <button className="icon-btn" onClick={() => shift(7)} aria-label="Next week" data-testid="button-week-next"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="cal-days" role="group" aria-label="Pick a day">
        {week.map((d) => { const k = iso(d); return (
          <button key={k} className={"cal-day" + (k === today ? " today" : "")} aria-pressed={k === day} onClick={() => setDay(k)} data-testid={`button-day-${k}`}>
            <small>{d.toLocaleDateString("en-US", { weekday: "narrow" })}</small><b>{d.getDate()}</b>{items.some((i) => i.date === k) ? <i aria-label="has items" /> : <i className="none" />}
          </button>); })}
      </div>
      <span className="op-kick">{new Date(day + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
      {on.length ? <ul className="cal-agenda">{on.map((i) => (
        <li key={i.id}><button className={`cal-ag ${i.kind}`} onClick={() => onOpen(i)} data-testid="button-day-item"><strong>{i.title}</strong><span>{i.kind}{i.time ? ` · ${clock(i.time)}` : ""}</span></button></li>
      ))}</ul> : <p className="small muted">Nothing on this day.</p>}
    </section>
  );
}

export default function CalendarPage() {
  const { ws, save, run, toast } = useStore();
  const owner = useOwnerView();
  const phone = useIsMobile();
  const w = ws!;
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [edit, setEdit] = useState<CalItem | null>(null);
  const [sel, setSel] = useState<CalItem | null>(null);
  const items = useMemo(() => {
    const fromTasks: CalItem[] = w.tasks.filter((t) => t.due && !t.done).map((t) => ({ id: "task-" + t.id, title: t.title, date: t.due, time: "", kind: "Task", source: "To-do", notes: t.why, linkedId: t.id }));
    return [...w.calendar, ...fromTasks, ...careerItems(w)].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [w.calendar, w.tasks, w.settings.careerTime]);
  const start = new Date(month); start.setDate(1 - start.getDay());
  // Owners: only the weeks this month needs (a 6th row of next month's days was empty space, Nov 23 review).
  const weeks = owner ? Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) : 6;
  const days = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = iso(new Date());
  // The weekly career time repeats; Upcoming shows only its next one, so real deadlines and interviews aren't pushed out.
  const upcoming = items.filter((i) => i.date >= today).filter((i, n, all) => !i.id.startsWith("career-") || all.findIndex((x) => x.id.startsWith("career-")) === n).slice(0, 8);
  const { jobs } = useJobs();
  // Owners: opening deadlines, interview prep and days for to-dos, from the student's own data (Remy's plan).
  const plan = useMemo(() => (owner ? calendarPlan({ ...w, jobs: jobs || w.jobs }, today) : []), [owner, w, jobs, today]);
  const addStep = async (s: CalSuggestion) => {
    if (s.kind === "todo") { await run(() => save("tasks", w.tasks.map((t) => (t.id === s.taskId ? { ...t, due: s.date } : t))), "On your calendar"); return; }
    await saveItem({ ...s.item, id: rid("cal") });
  };
  const saveItem = async (c: CalItem) => {
    const exists = w.calendar.some((x) => x.id === c.id);
    const dupe = w.calendar.find((x) => x.id !== c.id && x.title.trim().toLowerCase() === c.title.trim().toLowerCase() && x.date === c.date);
    if (dupe) return toast("That item is already on your calendar.", true);
    await run(() => save("calendar", exists ? w.calendar.map((x) => (x.id === c.id ? c : x)) : [...w.calendar, c]), "Saved to your Remy calendar");
    setEdit(null);
  };
  const monthCard = (
        <div className="card card-pad stack">
      <div className="row-between">
        <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <div className="row">
          <button className="icon-btn" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); }}>Today</button>
          <button className="icon-btn" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="cal-grid" style={{ "--weeks": weeks } as React.CSSProperties}>
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
  );
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Calendar</span>
          <h1><span className="title-slogan">Deadlines, events and prep — in one place.</span><span className="title-plain">Calendar</span></h1>
          {owner ? <div className="hide-phone"><CalLine upcoming={upcoming} today={today} /></div> : <p>Items you approve live here. Export them to your own calendar whenever you like.</p>}
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => go("/progress?tab=email&paste=1")} data-testid="button-paste-invite"><Mail size={16} /> Paste an interview invite</button>
          <button className="btn btn-secondary hide-phone" onClick={() => download("/api/calendar.ics", "remy.ics").catch((e) => toast(e.message, true))} disabled={!w.calendar.length && !w.settings.careerTime} data-testid="button-export-ics"><Download size={16} /> Export .ics</button>
          <button className="btn btn-primary" onClick={() => setEdit({ id: rid("cal"), title: "", date: today, time: "", kind: "Event", source: "Added by you", notes: "" })} data-testid="button-add-event"><Plus size={16} /> Add</button>
        </div>
      </div>
      {!owner && <GoogleCalendarCard />}
      {/* Owners (Nov 23 PM review): the month left and Coming up beside it, Google Calendar under the list, so the page
          fits 1440x800 instead of three full-width bands with a mostly empty grid at the bottom. */}
      <div className={owner ? "cal-owner" : "stack-lg"}>
        {owner && (phone ? <WeekStrip items={items} today={today} onOpen={setSel} /> : monthCard)}
        {owner ? <aside className="stack">{owner && upcoming.length > 0 && <ComingUp items={upcoming} weekEnd={iso(new Date(Date.now() + 6 * 864e5))} onOpen={setSel} />}
        {plan.length > 0 && <RemyPlan steps={plan} onAdd={addStep} />}
        {owner && !upcoming.length && (
          <section className="op-card stack-sm" data-testid="calendar-worth-adding">
            <h3>Worth putting on your calendar</h3>
            {!w.settings.careerTime && <CareerTime />}
            {w.settings.careerTime && <p className="small muted">{plan.length ? "Remy's plan below has a few to add." : "None of your openings list a deadline yet. Remy adds them here as postings date them."}</p>}
          </section>
        )}<GoogleCalendarCard /></aside> : monthCard}
        {!owner && <div className="card card-pad stack-sm">
          <h3>Upcoming</h3>
          {upcoming.length ? <div className="upcoming-grid">{upcoming.map((i) => (
            <button key={i.id} className="pick" onClick={() => setSel(i)} data-testid="button-upcoming">
              <span className="xs muted">{fmtDate(i.date)}{i.time ? ` · ${clock(i.time)}` : ""} · {i.kind}</span>
              <strong className="small">{i.title}</strong>
            </button>
          ))}</div> : <span className="small muted">Nothing scheduled. Add deadlines from Opportunities.</span>}
        </div>}
      </div>
      {sel && (
        <Modal title={sel.title} onClose={() => setSel(null)}>
          <dl className="kv"><dt>When</dt><dd>{fmtDate(sel.date)}{sel.time ? ` at ${sel.time}` : " (all day)"}</dd><dt>Type</dt><dd>{sel.kind}</dd><dt>Source</dt><dd>{sel.source}</dd></dl>
          {sel.notes && <p className="small" style={{ whiteSpace: "pre-line" }}>{sel.notes}</p>}
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
