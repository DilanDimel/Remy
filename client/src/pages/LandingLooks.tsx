import { useEffect, useState } from "react";
import { Remy } from "../components/common";
import { ThemeToggle } from "../components/ThemeToggle";
import { TEAM } from "./Info";
import Landing2, { type HeroProps } from "./Landing2";

// Owner-only preview: three candidate homepage looks plus today's, switchable from a bar at the top, so the team can
// compare before choosing. shortcut: the choice lives in this browser (localStorage); delete the losers once the team picks.
const LOOKS = [
  { id: "try", label: "Try it now" },
  { id: "sunrise", label: "Sunrise" },
  { id: "notebook", label: "Notebook" },
  { id: "current", label: "Current" },
] as const;
type Look = (typeof LOOKS)[number]["id"];
const KEY = "remy.lpLook";

const faces = TEAM.slice(0, 4);
function Faces({ note }: { note: string }) {
  return (
    <div className="lk-proof">
      <span className="lk-faces">{faces.map((m) => m.photo ? <img key={m.name} src={m.photo} alt="" width={40} height={40} /> : <span key={m.name}>{m.name.split(" ").map((w) => w[0]).join("")}</span>)}</span>
      {note}
    </div>
  );
}

function JobCard({ className = "" }: { className?: string }) {
  return (
    <div className={"lk-card " + className}>
      <div className="lk-job"><div><b>Marketing Intern, Summer 2027</b><span>Dallas, TX &middot; closes Jan 31</span></div><span className="lk-ok">You qualify</span></div>
      <p className="lk-why">It asks for sophomores in marketing. That&rsquo;s you.</p>
    </div>
  );
}

function Ctas({ start, startLabel, ext, inside, beta }: HeroProps) {
  return (
    <div className="lp2-ctas">
      <a className="lp2-btn lp2-btn-lg" href={start} {...ext} data-testid="button-lp-start">{startLabel}</a>
      {!inside && <a className="lp2-btn lp2-btn-lg lk-ghost" href="/signin">{beta ? "Already in? Sign in" : "I have an account"}</a>}
    </div>
  );
}

function SunriseHero(p: HeroProps) {
  return (
    <section className="lk-hero lk-sunrise-hero">
      <div className="lk-sun" aria-hidden />
      <div>
        <p className="lk-pill">Free for college students &middot; in beta</p>
        <h1>Don&rsquo;t hunt for a job <em>alone.</em></h1>
        <p className="lp2-lede">Remy finds openings you can actually get, keeps your resume honest, and tells you what to do this week.</p>
        <Ctas {...p} />
        <Faces note="Made by a small team in Fort Worth, Texas" />
      </div>
      <div className="lk-stage" aria-hidden>
        <Remy size={230} mood="wave" className="lk-fox" />
        <div className="lk-card lk-f3">3 new openings fit you</div>
        <JobCard className="lk-f1" />
        <div className="lk-card lk-f2"><b>This week</b><div className="lk-todo"><i />Apply: Marketing Intern</div><div className="lk-todo"><i />Ask your advisor for a reference</div></div>
      </div>
    </section>
  );
}

const MAJORS = ["Marketing", "Finance", "Nursing", "Engineering", "Psychology & social work"];
const YEARS = ["freshman", "sophomore", "junior", "senior"];
type Occ = { title: string; change: number; wage: number | null };
function TryHero(p: HeroProps) {
  const [major, setMajor] = useState(MAJORS[0]);
  const [year, setYear] = useState(YEARS[1]);
  const [jobs, setJobs] = useState<Occ[] | null>(null);
  useEffect(() => {
    let live = true;
    setJobs(null);
    fetch("/api/public/careers?field=" + encodeURIComponent(major)).then((r) => r.json()).then((d) => live && setJobs(d?.[0]?.jobs?.slice(0, 2) || [])).catch(() => live && setJobs([]));
    return () => { live = false; };
  }, [major]);
  return (
    <section className="lk-hero lk-try-hero">
      <h1>Find the jobs you can actually get.</h1>
      <p className="lp2-lede">Tell Remy your year and major. It reads 180+ employers&rsquo; own career sites and shows what fits you.</p>
      <div className="lk-ask">
        <p><Remy size={28} mood="happy" /> I&rsquo;m a{" "}
          <select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>{" "}studying{" "}
          <select aria-label="Major" value={major} onChange={(e) => setMajor(e.target.value)}>{MAJORS.map((m) => <option key={m}>{m}</option>)}</select>
        </p>
        <a className="lp2-btn lp2-btn-lg" href={p.start} {...p.ext} data-testid="button-lp-start">{p.inside ? "Open my Remy" : "Show me my matches"}</a>
      </div>
      <div className="lk-chips" role="group" aria-label="Pick a major">{MAJORS.map((m) => <button key={m} type="button" className="lk-chip" aria-pressed={m === major} onClick={() => setMajor(m)}>{m}</button>)}</div>
      <div className="lk-results">
        <div className="lk-card"><p className="lk-small">Openings that fit a {year}</p><JobCard className="lk-flat" /></div>
        <div className="lk-card lk-lift"><div className="lk-say"><Remy size={34} mood="happy" /><p><b>Your next step:</b> add the budget you ran as treasurer. That bullet has no number yet.</p></div></div>
        <div className="lk-card" aria-live="polite"><p className="lk-small">Where {major.toLowerCase()} leads</p>
          {!jobs ? <p className="lk-occ"><span>Loading&hellip;</span></p> : jobs.map((o) => <p key={o.title} className="lk-occ"><b>{o.title}</b><span>{[o.wage ? `$${o.wage.toLocaleString("en-US")} median` : "", o.change ? `${o.change > 0 ? "+" : ""}${o.change}% by 2035` : ""].filter(Boolean).join(" · ")}</span></p>)}
        </div>
      </div>
      <p className="lk-note">Openings and next step are examples. Career numbers are live from the U.S. Bureau of Labor Statistics.</p>
    </section>
  );
}

function NotebookHero(p: HeroProps) {
  return (
    <section className="lk-hero lk-notebook-hero">
      <div>
        <p className="lk-hand">hey, it&rsquo;s Remy &rarr;</p>
        <h1>Don&rsquo;t hunt for a job <span className="lk-mark">alone.</span></h1>
        <p className="lp2-lede">A career coach for college students: openings you can actually get, a resume that stays true, and what to do this week.</p>
        <Ctas {...p} />
        <Faces note="Made in Fort Worth, Texas. We read every message." />
      </div>
      <div className="lk-desk" aria-hidden>
        <div className="lk-paper lk-p1">
          <p className="lk-small">Your resume, line 3</p>
          <p className="lk-old">Posted on the club&rsquo;s Instagram</p>
          <p className="lk-new">Grew the club&rsquo;s Instagram with a weekly posting calendar</p>
          <p className="lk-flag"><b>Flagged:</b> &ldquo;followers up 40%&rdquo; isn&rsquo;t on your resume.</p>
        </div>
        <p className="lk-hand lk-a1">I won&rsquo;t make things up</p>
        <JobCard className="lk-paper lk-p2" />
        <div className="lk-sticky"><i />this week:<br />&#9744; apply to the Dallas internship<br />&#9744; ask my advisor for a reference</div>
        <Remy size={92} mood="happy" className="lk-doodle" />
      </div>
    </section>
  );
}

const HEROES = { sunrise: SunriseHero, try: TryHero, notebook: NotebookHero };

export default function LandingLooks() {
  const [look, setLook] = useState<Look>(() => { try { return (localStorage.getItem(KEY) as Look) || "try"; } catch { return "try"; } });
  const pick = (l: Look) => { setLook(l); try { localStorage.setItem(KEY, l); } catch { /* private mode: just this visit */ } };
  return (
    <>
      <div className="lk-bar" role="region" aria-label="Owner preview: homepage looks">
        <span className="lk-bar-t">Owner preview &middot; visitors still see today&rsquo;s homepage</span>
        <div className="lk-seg" role="group" aria-label="Homepage look">
          {LOOKS.map((l) => <button key={l.id} type="button" aria-pressed={look === l.id} onClick={() => pick(l.id)} data-testid={`look-${l.id}`}>{l.label}</button>)}
        </div>
        {look !== "current" && <ThemeToggle className="lk-theme" label />}
      </div>
      {look === "notebook" && <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap" />}
      {look === "current" ? <Landing2 /> : <Landing2 key={look} className={`lk lk-${look}`} hero={HEROES[look]} />}
    </>
  );
}
