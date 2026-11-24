// Daily path (redesign stage 7, owners first, Nov 22 2026). My Path as a place students come back to every day:
// a road map of their field (roles, skills, exams, the forecast, their semesters, internship season), a short daily
// round of real cards, a forgiving daily streak, and the weekly career quest as "big moves". Logic: shared/daily.ts
// and shared/game.ts. Every stop and card comes from data Remy already has (road files with sources, BLS, O*NET,
// live openings, the student's plan and to-dos); nothing is invented to fill the map.
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Award, BookOpen, Briefcase, CalendarRange, Check, Compass, Flag, Flame, Lock, Plus, Snowflake, Sparkles, TrendingDown, TrendingUp, Wrench, X, Zap } from "lucide-react";
import type { Job, PathPlan, Workspace } from "@shared/types";
import { NEED_LABEL, ROADS, roadFor, YEARS, yearNumber, type Road } from "@shared/roads";
import { seasonFor, SEASON_SOURCE } from "@shared/seasons";
import { levelOf, xpOf, type GameState } from "@shared/game";
import { CARD_LABEL, CARD_XP, dailyStreak, dayKey, streakDays, weekDots, withCard, type DailyCard } from "@shared/daily";
import { api, rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { useJobs } from "../lib/jobs";
import { Spinner } from "./common";
import { OrgLogo } from "./OrgLogo";

export type Occ = { soc: string; title: string; change: number; openings: number | null; wage: number | null; education: string; aiShare: number | null; link: string };
export type FutureData = { source: string; allJobsGrowth: number; fields: { field: string; growing: Occ[]; shrinking: Occ[]; total: number; fasterThanAverage: number }[] };
type Duties = { soc: string; title: string; duties: string[]; dutiesSource: { url: string; attribution: string } | null; outlook: { quote: string; url: string } | null };

export const stateOf = (w: Workspace): GameState => w.game || { weeks: {} };
export const money = (n: number) => "$" + n.toLocaleString("en-US");
const occFacts = (o: Occ) => [o.wage ? `${money(o.wage)} median pay` : "", o.openings ? `about ${Math.round(o.openings * 1000).toLocaleString("en-US")} openings a year` : "", `${o.change > 0 ? "+" : ""}${o.change}% by 2035`].filter(Boolean).join(" · ");
// A stable pick for the day, so a reload shows the same card.
const seedOf = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Career data the map and the cards share: jobs in the student's field (BLS) and the field's 10-year outlook. */
export function useFieldData(field = "") {
  const { ws } = useStore();
  const p = ws!.profile;
  // A field the student picks to look at ("Your field" menu) brings that field's jobs and outlook, not their own major's.
  const q = encodeURIComponent(field);
  const [careers, setCareers] = useState<{ field: string; jobs: Occ[] }[] | null>(null);
  const [future, setFuture] = useState<FutureData | null>(null);
  useEffect(() => {
    let live = true;
    api<{ field: string; jobs: Occ[] }[]>("GET", `/api/careers?field=${q}`).then((d) => live && setCareers(d), () => live && setCareers([]));
    api<FutureData>("GET", `/api/future?field=${q}`).then((d) => live && setFuture(d), () => {});
    return () => { live = false; };
  }, [p.major, p.targetRoles, p.interests, q]);
  return { careers, future };
}

/* ------------------------------------------------------------------ the streak and today's round, at the top */

export function DailyHeader({ onPlay }: { onPlay: () => void }) {
  const { ws } = useStore();
  const w = ws!, g = stateOf(w);
  const s = dailyStreak(streakDays(w)), dots = weekDots(streakDays(w));
  const xp = xpOf(w, g), lv = levelOf(xp, g.bestLevel);
  const pct = lv.max ? 100 : Math.round((100 * (xp - lv.floor)) / Math.max(1, lv.next - lv.floor));
  const today = g.days?.[dayKey()] || [];
  const left = Math.max(0, 3 - today.length);
  return (
    <section className="dp-top" aria-label="Today">
      <div className="dp-today">
        <div className="dp-today-text">
          <span className="dp-kicker">{left ? "Today's round" : "Round done"}</span>
          <h2>{left === 3 ? "3 cards, about 3 minutes" : left ? `${left} card${left > 1 ? "s" : ""} left today` : "You're done for today"}</h2>
          <p>{left ? "New openings to sort, one job to decode, one forecast to call. Each one moves your road." : "Your streak is safe. New openings come in overnight."}</p>
        </div>
        <ol className="dp-today-cards">
          {(["openings", "role", "forecast"] as DailyCard[]).map((c) => (
            <li key={c} className={today.includes(c) ? "on" : ""}><span>{today.includes(c) ? <Check size={14} strokeWidth={3} /> : null}</span>{CARD_LABEL[c]}</li>
          ))}
        </ol>
        <button className="btn btn-primary dp-start" onClick={onPlay} data-testid="button-start-round">{left === 3 ? "Start" : left ? "Keep going" : "Play again"} <ArrowRight size={16} /></button>
      </div>
      <div className="dp-streak" data-testid="daily-streak">
        <div className="dp-streak-n">
          <Flame size={34} className={s.days ? "lit" : ""} fill="currentColor" />
          <div><b>{s.days}</b><span>day streak</span></div>
        </div>
        <ol className="dp-dots" aria-label="The last seven days">
          {dots.map((d) => <li key={d.key} className={d.status} title={d.status}><i>{d.status === "done" ? <Check size={11} strokeWidth={3.5} /> : d.status === "freeze" ? <Snowflake size={11} /> : null}</i>{d.label}</li>)}
        </ol>
        <div className="dp-streak-meta">
          <span><Snowflake size={14} /> {s.freezes} freeze{s.freezes === 1 ? "" : "s"}</span>
          <span><Zap size={14} /> Level {lv.n} · {lv.name}</span>
        </div>
        <div className="dp-xp" title={`${xp} XP`}><i style={{ width: `${pct}%` }} /></div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ the road map */

type Kind = "role" | "step" | "skill" | "cert" | "forecast" | "season" | "semester" | "checkpoint";
export type Stop = { id: string; kind: Kind; year: number; title: string; sub: string; status: "done" | "now" | "open" | "locked"; progress: number; occ?: Occ; cred?: Road["credentials"][number]; source?: string; items?: string[]; optional?: boolean };
export const KIND: Record<Kind, { label: string; icon: ReactNode }> = {
  role: { label: "Know the role", icon: <Compass size={26} /> },
  step: { label: "Milestone", icon: <Flag size={24} /> },
  skill: { label: "Skill", icon: <Wrench size={24} /> },
  cert: { label: "Exam or certification", icon: <Award size={26} /> },
  forecast: { label: "Forecast", icon: <TrendingUp size={26} /> },
  season: { label: "Internship season", icon: <CalendarRange size={24} /> },
  semester: { label: "Your semester", icon: <BookOpen size={24} /> },
  checkpoint: { label: "Year checkpoint", icon: <Sparkles size={24} /> },
};
const credYear = (c: Road["credentials"][number]) => (c.need === "job" ? 5 : /after|graduat|hired|work/i.test(c.when) ? 5 : c.need === "optional" ? 3 : 4);

// Road steps are sentences; the map shows the part before the first aside.
export const shortTitle = (s: Stop) => (s.kind === "step" ? s.title.split(/[;(]| — /)[0].trim() : s.title);
function useNarrow() {
  const q = "(max-width: 959px)";
  const [n, setN] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q), f = () => setN(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return n;
}

export function buildStops(w: Workspace, road: Road | undefined, careers: { field: string; jobs: Occ[] }[] | null, future: FutureData | null, plan?: PathPlan): Stop[] {
  const year = Math.min(5, Math.max(1, yearNumber(w.profile.classYear) || 1));
  const g = stateOf(w), known = new Set((g.known || []).map((k) => k.toLowerCase()));
  const task = (t: string) => w.tasks.find((x) => x.title.toLowerCase() === t.toLowerCase());
  const forecastCards = Object.values(g.days || {}).filter((d) => d.includes("forecast")).length;
  type Raw = Omit<Stop, "status" | "progress"> & { p: number };
  const raw: Raw[] = [];
  const push = (s: Raw) => raw.push(s);
  // Roles in the field, two a year for the first three years: the career exposure that used to sit in a list.
  const jobs = careers?.[0]?.jobs || [];
  jobs.slice(0, 6).forEach((o, i) => push({ id: "role-" + o.soc, kind: "role", year: Math.min(3, 1 + Math.floor(i / 2)), title: o.title, sub: occFacts(o), occ: o, p: known.has(o.title.toLowerCase()) ? 1 : 0 }));
  road?.steps.forEach((s, i) => push({ id: "step-" + i, kind: "step", year: s.year, title: s.what, sub: s.optional ? "Optional · many people skip it" : `Usually ${YEARS[s.year].toLowerCase()}`, source: s.source, optional: s.optional, p: task(s.what)?.done ? 1 : task(s.what) ? 0.5 : 0 }));
  // Skills postings ask for, from the road file, plus the ones Remy's path suggested for this student.
  const skills = [...(road?.skills || []).slice(0, 5)];
  plan?.skills.filter((s) => !/cert|exam|licen/i.test(s.type) && !skills.some((k) => k.toLowerCase().includes(s.name.toLowerCase().slice(0, 8)))).slice(0, 2).forEach((s) => skills.push(s.name));
  skills.forEach((k, i) => push({ id: "skill-" + i, kind: "skill", year: Math.min(4, 2 + Math.floor(i / 2)), title: k, sub: road?.skills?.includes(k) ? "Entry-level postings in your field ask for it" : "Suggested for your direction", source: road?.skills?.includes(k) ? road?.skillsSource : undefined, p: task(`Learn: ${k}`)?.done ? 1 : task(`Learn: ${k}`) ? 0.5 : 0 }));
  road?.credentials.filter((c) => !/^No license needed/.test(c.name)).forEach((c, i) => push({ id: "cert-" + i, kind: "cert", year: credYear(c), title: c.name, sub: NEED_LABEL[c.need], cred: c, source: c.source, optional: c.need === "optional", p: task(`Look into: ${c.name}`)?.done ? 1 : task(`Look into: ${c.name}`) ? 0.5 : 0 }));
  const f0 = future?.fields[0];
  if (f0) push({ id: "forecast", kind: "forecast", year: Math.min(year, 4), title: `Where ${f0.field} is heading`, sub: `${f0.fasterThanAverage} of ${f0.total} jobs grow faster than average`, p: Math.min(1, forecastCards / 5) });
  const season = seasonFor([w.profile.major, w.profile.targetRoles].join(" "));
  if (season) push({ id: "season", kind: "season", year: Math.min(year, 4), title: `${season.label} internship season`, sub: season.open ? `Open now · ${season.window}` : `Opens in ${season.opens} · ${season.window}`, source: SEASON_SOURCE, p: Math.min(1, w.savedJobIds.length / 5) });
  plan?.academic.filter((a) => a.note === "Entered by you").slice(0, 2).forEach((a, i) => push({ id: "sem-" + a.id, kind: "semester", year: Math.min(4, year + i), title: a.term, sub: `${a.items.length} course${a.items.length === 1 ? "" : "s"} you planned`, items: a.items, p: 0 }));
  const order: Kind[] = ["role", "semester", "forecast", "step", "skill", "season", "cert"];
  const out: Stop[] = [];
  for (let y = 1; y <= 5; y++) {
    const here = raw.filter((s) => s.year === y).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    if (!here.length) continue;
    // Past years count as done only for calendar steps; a role, skill or credential is done when the student did it.
    const learnt = (s: Raw) => s.p >= 1 || (y < year && !["role", "skill", "cert"].includes(s.kind));
    here.forEach((s) => out.push({ ...s, status: learnt(s) ? "done" : y > year ? "locked" : "open", progress: learnt(s) ? 1 : s.p }));
    if (y < 5) out.push({ id: "check-" + y, kind: "checkpoint", year: y, title: `${YEARS[y]} checkpoint`, sub: "Remy's review of the year and the plan for the next", status: y < year ? "done" : y > year ? "locked" : "open", progress: 0 });
  }
  const now = out.find((s) => s.year === year && s.status === "open" && s.kind !== "checkpoint");
  if (now) now.status = "now";
  return out;
}

export function RoadMap({ onPlay }: { onPlay: () => void }) {
  const { ws } = useStore();
  const w = ws!, p = w.profile;
  const mine = roadFor(p.major, p.path) || roadFor([p.targetRoles, p.interests].join(" "), p.path);
  const [key, setKey] = useState(mine?.key || "");
  const road = ROADS.find((r) => r.key === key);
  const { careers, future } = useFieldData(road && road.key !== mine?.key ? road.label : "");
  const stops = useMemo(() => buildStops(w, road, careers, future, w.plan), [w, road, careers, future]);
  const year = Math.min(5, Math.max(1, yearNumber(p.classYear) || 1));
  const [sel, setSel] = useState<string>("");
  const [opened, setOpened] = useState<number[]>([]); // past years start folded so the map opens on this year
  const picked = stops.find((s) => s.id === sel) || stops.find((s) => s.status === "now") || stops[0];
  const narrow = useNarrow();
  const choose = (id: string) => { setSel(narrow && sel === id ? "" : id); if (narrow) setTimeout(() => document.querySelector(".dp-inline")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60); };
  if (!careers) return <div className="card card-pad row"><Spinner /> <span className="muted">Laying out your road…</span></div>;
  // Zigzag like a trail: the stop's column offset follows a gentle wave.
  const wave = [0, 1, 2, 1, 0, -1, -2, -1];
  let i = 0;
  const years = [...new Set(stops.map((s) => s.year))];
  return (
    <div className="dp-roadwrap" data-testid="road-map">
      <div className="dp-road">
        <div className="dp-road-head">
          <div><b>{road ? `The ${road.label.toLowerCase()} road` : "Pick a field"}</b><span>{stops.filter((s) => s.status === "done").length} of {stops.length} stops · tap one to open it</span></div>
          <select className="input" value={key} onChange={(e) => { setKey(e.target.value); setSel(""); }} aria-label="Field" data-testid="select-road">
            {!road && <option value="">Choose a field</option>}
            {ROADS.filter((r) => !r.parent).map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === mine?.key ? " (yours)" : ""}</option>)}
            {ROADS.filter((r) => r.parent).map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === mine?.key ? " (yours)" : ""}</option>)}
          </select>
        </div>
        {years.map((y) => {
          const ys = stops.filter((s) => s.year === y), done = ys.filter((s) => s.status === "done").length;
          const folded = y < year && !opened.includes(y);
          if (folded) { i += ys.length; return (
            <section key={y} className="dp-unit past folded" aria-label={YEARS[y]}>
              <button className="dp-unit-head" onClick={() => setOpened([...opened, y])} aria-expanded={false}>
                <div><span>{done === ys.length ? "Done" : `${ys.length - done} to catch up`}</span><b>{YEARS[y]}</b></div>
                <em>{done} / {ys.length} · Show</em>
              </button>
            </section>
          ); }
          return (
            <section key={y} className={"dp-unit" + (y === year ? " here" : y < year ? " past" : "")} aria-label={YEARS[y]}>
              <header className="dp-unit-head">
                <div><span>{y < year ? "Done" : y === year ? "You are here" : "Coming up"}</span><b>{YEARS[y]}</b></div>
                <em>{done} / {ys.length}</em>
              </header>
              <ol className="dp-stops">
                {ys.map((s) => {
                  const off = wave[i++ % wave.length];
                  return (
                    <Fragment key={s.id}>
                    <li style={{ ["--off" as string]: off }} className={"dp-stop " + s.status + (picked?.id === s.id ? " sel" : "")}>
                      {s.status === "now" && <span className="dp-go">{(["openings", "role", "forecast"] as const).every((c) => stateOf(w).days?.[dayKey()]?.includes(c)) ? "Next" : "Start"}</span>}
                      <button className={"dp-node k-" + s.kind} onClick={() => choose(s.id)} aria-label={`${KIND[s.kind].label}: ${s.title}`} aria-pressed={picked?.id === s.id} data-testid="road-stop">
                        {s.status !== "done" && s.progress > 0 && <svg className="dp-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="100" strokeDasharray={`${s.progress * 100} 100`} /></svg>}
                        {s.status === "done" ? <Check size={30} strokeWidth={3} /> : s.status === "locked" ? <span className="dp-lockico">{KIND[s.kind].icon}</span> : KIND[s.kind].icon}
                      </button>
                      <span className="dp-label"><b>{shortTitle(s)}</b><small>{KIND[s.kind].label}</small></span>
                    </li>
                    {/* On a phone the stop opens right under itself, like a trail popover, instead of below the whole map. */}
                    {narrow && sel === s.id && <li className="dp-inline">{<StopDetail s={s} future={future} onPlay={onPlay} />}</li>}
                    </Fragment>
                  );
                })}
              </ol>
            </section>
          );
        })}
        <p className="dp-foot">Usual timelines, mostly Texas rules. Each stop links to where it came from; check it and your advisor before you plan around a step.</p>
      </div>
      <div className="dp-detail-col">{!narrow && picked && <StopDetail s={picked} future={future} onPlay={onPlay} />}</div>
    </div>
  );
}

export function StopDetail({ s, future, onPlay }: { s: Stop; future: FutureData | null; onPlay: () => void }) {
  const { ws, save, run } = useStore();
  const w = ws!;
  const [d, setD] = useState<Duties | null>(null);
  useEffect(() => { setD(null); if (s.occ) api<Duties>("GET", `/api/occupation/${encodeURIComponent(s.occ.soc)}`).then(setD, () => {}); }, [s.occ?.soc]);
  const addTask = (title: string, why: string) => w.tasks.some((t) => t.title === title) ? undefined : run(() => save("tasks", [{ id: rid("t"), title, why, due: "", category: "Prepare", done: false, source: "Added from My Path" }, ...w.tasks]), "Added to your to-dos");
  const taskTitle = s.kind === "skill" ? `Learn: ${s.title}` : s.kind === "cert" ? `Look into: ${s.title}` : s.kind === "step" ? s.title : "";
  const onList = taskTitle && w.tasks.find((t) => t.title === taskTitle);
  const f0 = future?.fields[0];
  const roles = (w.profile.targetRoles || "").split(/,\s*/).filter(Boolean);
  return (
    <aside className="dp-detail" aria-live="polite" data-testid="stop-detail">
      <div className="dp-detail-tags">
        <span className={"dp-tag k-" + s.kind}>{KIND[s.kind].label}</span>
        <span className={"dp-tag st-" + s.status}>{s.status === "done" ? "Done" : s.status === "locked" ? `Usually ${YEARS[s.year].toLowerCase()}` : s.progress > 0 ? `${Math.round(s.progress * 100)}% there` : s.status === "now" ? "Up next" : "Open"}</span>
        {s.optional && <span className="dp-tag">Optional</span>}
      </div>
      <h3>{shortTitle(s)}</h3>
      {s.kind === "role" && s.occ && (
        <>
          <div className="dp-facts">
            <div><b>{s.occ.change > 0 ? "+" : ""}{s.occ.change}%</b><span>growth by 2035</span></div>
            {s.occ.wage ? <div><b>{money(Math.round(s.occ.wage / 1000))}k</b><span>median pay</span></div> : null}
            {s.occ.openings ? <div><b>{Math.round(s.occ.openings * 1000).toLocaleString("en-US")}</b><span>openings a year</span></div> : null}
          </div>
          <div className="dp-sect"><span>What they do</span>
            {d ? (d.duties.length ? <ul>{d.duties.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul> : <p className="small muted">The government doesn't list duties for this exact job.</p>) : <p className="small muted row"><Spinner /> Loading duties…</p>}
          </div>
          <div className="dp-actions">
            <button className="btn btn-primary btn-sm" onClick={() => go(`/opportunities?role=${encodeURIComponent(s.title)}`)}><Briefcase size={14} /> See openings</button>
            {!roles.some((r) => r.toLowerCase() === s.title.toLowerCase()) && <button className="btn btn-secondary btn-sm" onClick={() => run(() => save("profile", { ...w.profile, targetRoles: [...roles, s.title].join(", ") }), `Remy will look for ${s.title} openings too`)}>Add to my search</button>}
          </div>
          <p className="dp-src">Duties: {d?.dutiesSource ? <a href={d.dutiesSource.url} target="_blank" rel="noreferrer">O*NET, U.S. Department of Labor</a> : "O*NET"} · numbers: <a href={s.occ.link} target="_blank" rel="noreferrer">BLS</a></p>
        </>
      )}
      {s.kind === "forecast" && f0 && (
        <>
          <p className="dp-lead">{f0.fasterThanAverage} of {f0.total} {f0.field} jobs are expected to grow faster than the average U.S. job ({future!.allJobsGrowth}%).</p>
          <div className="dp-sect"><span><TrendingUp size={14} /> Growing fastest</span><ul className="dp-rows">{f0.growing.slice(0, 3).map((o) => <li key={o.soc}><b>{o.title}</b><em className="up">+{o.change}%</em></li>)}</ul></div>
          {f0.shrinking.length > 0 && <div className="dp-sect"><span><TrendingDown size={14} /> Shrinking</span><ul className="dp-rows">{f0.shrinking.slice(0, 2).map((o) => <li key={o.soc}><b>{o.title}</b><em className="down">{o.change}%</em></li>)}</ul></div>}
          <p className="small muted">One Higher or lower card a day moves this stop. Five cards finish it.</p>
          <div className="dp-actions"><button className="btn btn-primary btn-sm" onClick={onPlay}>Play a forecast card <ArrowRight size={14} /></button><button className="btn btn-secondary btn-sm" onClick={() => go("/path?tab=career")}>Full outlook</button></div>
          <p className="dp-src">{future!.source}</p>
        </>
      )}
      {s.kind === "cert" && s.cred && (
        <>
          <p className="dp-lead">{s.cred.who}</p>
          {s.cred.why && <div className="dp-sect"><span>Why people get it</span><p>{s.cred.why}</p></div>}
          {s.cred.learn && <div className="dp-sect"><span>What you learn</span><p>{s.cred.learn}</p></div>}
          {s.cred.when && <div className="dp-sect"><span>When</span><p>{s.cred.when}</p></div>}
        </>
      )}
      {s.kind === "skill" && <p className="dp-lead">{s.sub}. Remy's Posting X-ray and skill cards will show where it comes up in real openings near you.</p>}
      {s.kind === "step" && shortTitle(s) !== s.title && <p className="dp-lead">{s.title}.</p>}
      {s.kind === "season" && (() => { const se = seasonFor([w.profile.major, w.profile.targetRoles].join(" "))!; return (
        <>
          <p className="dp-lead">{se.open ? `It's ${se.label.toLowerCase()} internship season now (${se.window}).` : `${se.label} internships usually recruit ${se.window}. That's ${se.monthsUntil} month${se.monthsUntil === 1 ? "" : "s"} away.`} {se.note}</p>
          <div className="dp-meter"><span>{Math.min(5, w.savedJobIds.length)} of 5 openings saved</span><div className="dp-xp"><i style={{ width: `${Math.min(100, w.savedJobIds.length * 20)}%` }} /></div></div>
          <div className="dp-actions"><button className="btn btn-primary btn-sm" onClick={onPlay}>Sort today's openings <ArrowRight size={14} /></button></div>
        </>
      ); })()}
      {s.kind === "semester" && (
        <>
          <p className="dp-lead">The courses you planned for {s.title}.</p>
          <ul className="dp-rows">{s.items?.map((c) => <li key={c}><b>{c}</b></li>)}</ul>
          <div className="dp-actions"><button className="btn btn-secondary btn-sm" onClick={() => go("/path?tab=skills")}>Edit your course plan</button></div>
        </>
      )}
      {s.kind === "checkpoint" && <p className="dp-lead">{s.status === "locked" ? "Opens when you get here." : "When every stop this year is done, Remy looks back at the year with you and plans the next one."}</p>}
      {taskTitle && s.status !== "done" && (
        <div className="dp-actions">{onList ? <span className="dp-tag st-done"><Check size={13} /> {onList.done ? "Done" : "On your to-dos"}</span> : <button className="btn btn-secondary btn-sm" onClick={() => addTask(taskTitle, `${KIND[s.kind].label} on your road, usually ${YEARS[s.year].toLowerCase()}`)} data-testid="button-stop-todo"><Plus size={14} /> Add to my to-dos</button>}</div>
      )}
      {s.source && s.kind !== "role" && <p className="dp-src"><a href={s.source} target="_blank" rel="noreferrer">Source</a></p>}
    </aside>
  );
}

/* ------------------------------------------------------------------ today's round */

export function Round({ onClose }: { onClose: () => void }) {
  const { ws, save, setWs, run } = useStore();
  const w = ws!;
  const { jobs, fits } = useJobs();
  const { careers, future } = useFieldData();
  const today = dayKey();
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [before] = useState(() => dailyStreak(streakDays(w)).days);
  // Already played today (the app's Path card says so): show today's result instead of dealing the round again from 1 of 3.
  const [already] = useState(() => (["openings", "role", "forecast"] as const).every((k) => stateOf(w).days?.[today]?.includes(k)));
  // Openings Remy hasn't heard about from the student yet, best fit first. Fixed once loaded, so a Keep doesn't reshuffle.
  const [pool, setPool] = useState<Job[] | null>(null);
  useEffect(() => {
    if (!jobs || pool) return;
    setPool(jobs.filter((j) => j.kind !== "event" && !w.hiddenJobIds.includes(j.id) && !w.savedJobIds.includes(j.id) && !w.jobFeedback?.[j.id] && !fits[j.id]?.excluded && !fits[j.id]?.closed)
      .sort((a, b) => (fits[b.id]?.score || 0) - (fits[a.id]?.score || 0)).slice(0, 4));
  }, [jobs]);
  const cards: DailyCard[] = pool?.length ? ["openings", "role", "forecast"] : ["role", "forecast"];
  const finish = async (card: DailyCard, said: string) => {
    setLog((l) => [...l, said]);
    const g = stateOf(ws!);
    await save("game", withCard(g, card, today)).catch(() => {});
    setStep((n) => n + 1);
  };
  const done = already || step >= cards.length;
  const card = cards[step];
  if (!pool || !careers || !future) return <div className="dp-round"><div className="card card-pad row"><Spinner /> <span className="muted">Dealing today's cards…</span></div></div>;
  return (
    <div className="dp-round" data-testid="daily-round">
      {!done && (
        <div className="dp-round-top">
          <button className="icon-btn" onClick={onClose} aria-label="Back to your road"><X size={20} /></button>
          <div className="dp-xp big" role="progressbar" aria-valuenow={step} aria-valuemax={cards.length}><i style={{ width: `${(step / cards.length) * 100}%` }} /></div>
          <b>{step + 1} of {cards.length}</b>
        </div>
      )}
      {!done && card === "openings" && <OpeningsCard jobs={pool} onDone={(n) => finish("openings", n)} put={(j, body) => run(() => api<Workspace>("PUT", `/api/jobs/${j.id}/interest`, body)).then((r) => r && setWs(r))} fits={fits} />}
      {!done && card === "role" && <RoleCard key={"role" + step} careers={careers} onDone={(said) => finish("role", said)} />}
      {!done && card === "forecast" && <ForecastCard future={future} onDone={(said) => finish("forecast", said)} />}
      {done && <RoundDone before={before} log={log} onClose={onClose} />}
    </div>
  );
}

function CardShell({ kind, title, children }: { kind: DailyCard; title: string; children: ReactNode }) {
  const ico = kind === "openings" ? <Briefcase size={16} /> : kind === "role" ? <Compass size={16} /> : <TrendingUp size={16} />;
  return (
    <section className="dp-card">
      <span className="dp-card-kind">{ico} {CARD_LABEL[kind]} · about 1 minute</span>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

// Postings can list ten cities; the card shows the first and a count.
const place = (loc: string) => { const all = (loc || "").split(";").map((x) => x.trim()).filter(Boolean); return all.length > 1 ? `${all[0]} +${all.length - 1} more` : all[0] || ""; };

function OpeningsCard({ jobs, fits, put, onDone }: { jobs: Job[]; fits: Record<string, { score?: number; why?: string }>; put: (j: Job, body: object) => Promise<unknown>; onDone: (said: string) => void }) {
  const [i, setI] = useState(0);
  const [kept, setKept] = useState(0);
  const [fly, setFly] = useState<"" | "l" | "r">("");
  const j = jobs[i];
  const act = async (keep: boolean) => {
    if (!j || fly) return;
    setFly(keep ? "r" : "l");
    await put(j, keep ? { rating: 5, keep: true } : { rating: 1, hide: true });
    if (keep) setKept((n) => n + 1);
    setTimeout(() => { setFly(""); setI((n) => n + 1); }, 220);
  };
  // The arrow-key tip only where there's a keyboard and a mouse, not on a phone.
  const [keys] = useState(() => typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") act(true); if (e.key === "ArrowLeft") act(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  if (!j) return (
    <CardShell kind="openings" title={`Sorted. You kept ${kept}.`}>
      <ul className="dp-changed"><li><Check size={16} /> Kept openings are saved{kept ? ", with deadlines on your calendar when they have one" : ""}</li><li><Check size={16} /> Your passes teach Remy what to stop showing you</li></ul>
      <button className="btn btn-primary dp-wide" onClick={() => onDone(kept ? `Kept ${kept} new opening${kept > 1 ? "s" : ""}` : `Sorted ${jobs.length} new openings`)}>Next card <ArrowRight size={16} /></button>
    </CardShell>
  );
  const why = fits[j.id]?.why;
  return (
    <CardShell kind="openings" title="Keep the ones you'd really apply to">
      <div className="dp-swipe">
        {jobs[i + 1] && <div className="dp-job back" aria-hidden="true" />}
        <article className={"dp-job" + (fly ? " fly-" + fly : "")}>
          <div className="dp-job-co"><OrgLogo key={j.id} company={j.company} url={j.applyUrl} className="dp-mono" text={(j.company || "?").slice(0, 2).toUpperCase()} /><div><b>{j.company || "An employer"}</b><span>{[place(j.location), j.format && !place(j.location).toLowerCase().includes(j.format.toLowerCase()) ? j.format : ""].filter(Boolean).join(" · ")}</span></div></div>
          <h3>{j.title}</h3>
          {why && <p>{why}</p>}
          {(j.applyUrl || j.sourceUrl) && <a className="dp-job-link" href={j.applyUrl || j.sourceUrl} target="_blank" rel="noreferrer">See the posting <ArrowRight size={14} /></a>}
          <span className="dp-job-n">{i + 1} of {jobs.length}{keys ? " · arrow keys work too" : ""}</span>
        </article>
      </div>
      <div className="dp-pair">
        <button className="btn btn-secondary" onClick={() => act(false)} data-testid="round-pass"><X size={18} /> Pass</button>
        <button className="btn btn-primary" onClick={() => act(true)} data-testid="round-keep"><Check size={18} /> Keep</button>
      </div>
    </CardShell>
  );
}

function RoleCard({ careers, onDone }: { careers: { field: string; jobs: Occ[] }[]; onDone: (said: string) => void }) {
  const { ws, save } = useStore();
  const known = new Set((stateOf(ws!).known || []).map((k) => k.toLowerCase()));
  const all = careers.flatMap((c) => c.jobs);
  const [pick] = useState(() => { const fresh = all.filter((o) => !known.has(o.title.toLowerCase())); const list = fresh.length >= 1 ? fresh : all; return list[seedOf(dayKey()) % Math.max(1, list.length)]; });
  const [d, setD] = useState<Duties | null | "none">(null);
  const [ans, setAns] = useState<string | null>(null);
  useEffect(() => { if (!pick) { setD("none"); return; } api<Duties>("GET", `/api/occupation/${encodeURIComponent(pick.soc)}`).then((x) => setD(x.duties.length ? x : "none"), () => setD("none")); }, [pick?.soc]);
  const opts = useMemo(() => { if (!pick) return []; const others = all.filter((o) => o.soc !== pick.soc); const s = seedOf(pick.soc); const three = [0, 1, 2].map((k) => others[(s + k * 5) % Math.max(1, others.length)]).filter(Boolean); return [...new Map([pick, ...three].map((o) => [o.soc, o])).values()].sort((a, b) => seedOf(a.soc + "x") - seedOf(b.soc + "x")); }, [pick?.soc]);
  if (!pick || d === "none") return <CardShell kind="role" title="No role to decode today"><button className="btn btn-primary dp-wide" onClick={() => onDone("")}>Next card</button></CardShell>;
  if (!d) return <CardShell kind="role" title="Which job is this?"><p className="row muted"><Spinner /> Loading the duties…</p></CardShell>;
  const right = ans === pick.soc;
  const choose = (soc: string) => { if (ans) return; setAns(soc); const g = stateOf(ws!); save("game", { ...g, known: [...new Set([...(g.known || []), pick.title])] }).catch(() => {}); };
  return (
    <CardShell kind="role" title="Which job spends its days on this?">
      <ol className="dp-duties">{d.duties.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ol>
      <div className="dp-opts">{opts.map((o) => <button key={o.soc} className={"dp-opt" + (ans ? (o.soc === pick.soc ? " right" : o.soc === ans ? " wrong" : " dim") : "")} onClick={() => choose(o.soc)} disabled={!!ans}>{o.title}</button>)}</div>
      {ans && (
        <div className={"dp-result " + (right ? "good" : "close")}>
          <b>{right ? `Right: ${pick.title.toLowerCase()}.` : `It's ${pick.title.toLowerCase()}.`}</b>
          <span>{occFacts(pick)}.</span>
          <span className="dp-src">Duties: <a href={d.dutiesSource?.url} target="_blank" rel="noreferrer">O*NET, U.S. Department of Labor</a> · numbers: <a href={pick.link} target="_blank" rel="noreferrer">BLS</a></span>
          <button className="btn btn-primary dp-wide" onClick={() => onDone(`Learned what ${pick.title.toLowerCase()} do`)}>Next card <ArrowRight size={16} /></button>
        </div>
      )}
    </CardShell>
  );
}

function ForecastCard({ future, onDone }: { future: FutureData; onDone: (said: string) => void }) {
  const f0 = future.fields[0];
  const list = f0 ? [...f0.growing, ...f0.shrinking] : [];
  const [pick] = useState(() => list[seedOf(dayKey() + "f") % Math.max(1, list.length)]);
  const [ans, setAns] = useState<"up" | "down" | null>(null);
  if (!pick) return <CardShell kind="forecast" title="No forecast today"><button className="btn btn-primary dp-wide" onClick={() => onDone("")}>Finish</button></CardShell>;
  const faster = pick.change > future.allJobsGrowth;
  const right = ans !== null && (ans === "up") === faster;
  return (
    <CardShell kind="forecast" title={`${pick.title}: faster or slower growth than the average job?`}>
      <div className="dp-vs">
        <div><span>All U.S. jobs</span><b>+{future.allJobsGrowth}%</b><small>by 2035</small></div>
        <i>vs</i>
        <div className={ans ? (faster ? "up" : "down") : ""}><span>{pick.title}</span><b>{ans ? `${pick.change > 0 ? "+" : ""}${pick.change}%` : "?"}</b><small>by 2035</small></div>
      </div>
      {!ans ? (
        <div className="dp-pair">
          <button className="btn btn-secondary" onClick={() => setAns("down")} data-testid="round-slower"><TrendingDown size={18} /> Slower</button>
          <button className="btn btn-primary" onClick={() => setAns("up")} data-testid="round-faster"><TrendingUp size={18} /> Faster</button>
        </div>
      ) : (
        <div className={"dp-result " + (right ? "good" : "close")}>
          <b>{right ? "You called it." : "Not this time."} {faster ? `${pick.change > future.allJobsGrowth * 2 ? "More than twice" : "Faster than"} the average.` : pick.change < 0 ? "It's expected to shrink." : "Slower than the average."}</b>
          <span>{occFacts(pick)}.</span>
          <span className="dp-src">{future.source}</span>
          <button className="btn btn-primary dp-wide" onClick={() => onDone(`${pick.title}: ${pick.change > 0 ? "+" : ""}${pick.change}% by 2035`)}>Finish today's round <ArrowRight size={16} /></button>
        </div>
      )}
    </CardShell>
  );
}

function RoundDone({ before, log, onClose }: { before: number; log: string[]; onClose: () => void }) {
  const { ws } = useStore();
  const g = stateOf(ws!);
  const s = dailyStreak(streakDays(ws!)), dots = weekDots(streakDays(ws!));
  const n = (g.days?.[dayKey()] || []).length;
  return (
    <div className="dp-done">
      <section className="dp-card dp-done-hero">
        <Flame size={72} className="lit" fill="currentColor" />
        <b className="dp-big">{s.days}</b>
        <span className="dp-big-l">{s.days > before ? (before ? "day streak, one more than this morning" : "day streak. It starts today.") : "day streak"}</span>
        <ol className="dp-dots lg">{dots.map((d) => <li key={d.key} className={d.status}><i>{d.status === "done" ? <Check size={13} strokeWidth={3.5} /> : d.status === "freeze" ? <Snowflake size={13} /> : null}</i>{d.label}</li>)}</ol>
        <p>{s.freezes ? `You have ${s.freezes} freeze${s.freezes > 1 ? "s" : ""}: miss a day and your streak holds.` : "Every 7 days in a row earns a freeze that covers a missed day."}</p>
      </section>
      <section className="dp-card">
        <h3>What changed today</h3>
        <ul className="dp-changed">{log.filter(Boolean).map((l) => <li key={l}><Check size={16} /> {l}</li>)}<li><Zap size={16} /> +{n * CARD_XP} XP toward your next level</li></ul>
        <div className="dp-actions"><button className="btn btn-primary" onClick={onClose}>Back to your road <ArrowRight size={16} /></button></div>
      </section>
    </div>
  );
}
