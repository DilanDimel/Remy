import { useEffect, useRef, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { go } from "../lib/router";
import { useOwnerView, useStore } from "../lib/store";
import { BetaBadge, Remy } from "../components/common";
import { ThemeToggle } from "../components/ThemeToggle";
import { TEAM } from "./Info";
import { FieldBrowser, LinkedInMark, applyHref } from "./Welcome";

export const INSTAGRAM = "https://www.instagram.com/coachremyai/";
export const LINKEDIN = "https://www.linkedin.com/company/remyai-org/";

function InstagramMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The simpler front page (owners only until Dilan releases it): one message, the real app, the real team, our socials. */
function Top({ inside, what = "#what" }: { inside: boolean; what?: string }) {
  return (
    <header className="lp2-top">
      <a className="logo" href="/" aria-label="Remy home">Remy <BetaBadge /></a>
      <nav className="lp2-nav" aria-label="Main">
        <a className="hide-sm" href={what}>What Remy does</a>
        <a className="hide-sm" href="/about">About</a>
        <ThemeToggle className="lp2-theme" />
        <a className="lp2-btn lp2-btn-sm" href={inside ? "/" : "/signin"} data-testid="button-lp-signin">{inside ? "Open my Remy" : "Sign in"}</a>
      </nav>
    </header>
  );
}

/** "Where does my major lead?" with real BLS numbers, public (moved off the homepage to keep it short). Owners only for now. */
export function Careers() {
  const { me, ws } = useStore();
  if (!useOwnerView()) return <Landing2Fallback />;
  return (
    <div className={PAGE}>
      <div className="lp2-w">
        <Top inside={!!(me && ws?.started)} what="/welcome#what" />
        <main className="lp2-careers">
          <h1>Where does your major lead?</h1>
          <p className="lp2-sub">Pick a major and see the jobs people go into, with real pay and growth from the U.S. Bureau of Labor Statistics.</p>
          <FieldBrowser />
        </main>
      </div>
    </div>
  );
}

// The light/dark "Try it now" look Dilan picked (Nov 22); its colours live in the .lk-try block of index.css.
const PAGE = "lp2 lk lk-try";
const MAJORS = ["Marketing", "Finance", "Nursing", "Engineering", "Psychology & social work"];
const YEARS = ["freshman", "sophomore", "junior", "senior"];
type Occ = { title: string; change: number; wage: number | null };

export default function Landing2() {
  const { config, me, ws } = useStore();
  const inside = !!(me && ws?.started);
  const beta = !!config?.beta?.on && !inside;
  const start = inside ? "/" : beta ? applyHref(config?.beta?.formUrl) : "/signin";
  const startLabel = inside ? "Open my Remy" : beta ? "Apply to be a beta tester" : "Create your free account";
  const ext: Record<string, string> = beta ? { target: "_blank", rel: "noreferrer" } : {};
  const out = { target: "_blank", rel: "noreferrer" };
  const page = useRef<HTMLDivElement>(null);
  const [major, setMajor] = useState(MAJORS[0]);
  const [year, setYear] = useState(YEARS[1]);
  const [jobs, setJobs] = useState<Occ[] | null>(null);
  useEffect(() => {
    let live = true;
    setJobs(null);
    fetch("/api/public/careers?field=" + encodeURIComponent(major)).then((r) => r.json()).then((d) => live && setJobs(d?.[0]?.jobs?.slice(0, 3) || [])).catch(() => live && setJobs([]));
    return () => { live = false; };
  }, [major]);
  // Sections ease in as they scroll into view (CSS keeps them visible when motion is reduced or JS is off).
  useEffect(() => {
    const els = page.current?.querySelectorAll(".rv") || [];
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((list) => { for (const x of list) if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return (
    <div className={PAGE} ref={page}>
      <div className="lp2-w">
        <Top inside={inside} />

        <main>
          <section className="lk-hero lk-try-hero">
            <div className="lk-top">
            <div>
            <h1>Find the jobs you can actually get.</h1>
            <p className="lp2-lede">Tell Remy your year and major. It reads 180+ employers&rsquo; own career sites and shows what fits you.</p>
            <div className="lk-ask">
              <p>I&rsquo;m a{" "}
                <select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)} data-testid="select-lp-year">{YEARS.map((y) => <option key={y}>{y}</option>)}</select>{" "}studying{" "}
                <select aria-label="Major" value={major} onChange={(e) => setMajor(e.target.value)} data-testid="select-lp-major">{MAJORS.map((m) => <option key={m}>{m}</option>)}</select>
              </p>
              <a className="lp2-btn lp2-btn-lg" href={start} {...ext} data-testid="button-lp-start">{inside ? "Open my Remy" : "Show me my matches"}</a>
            </div>
            </div>
            <figure className="lk-remy" aria-hidden>
              <span className="lk-bubble">Hi, I&rsquo;m Remy. Tell me your year and major and I&rsquo;ll show you what fits.</span>
              <span className="lk-medal"><Remy size={250} mood="wave" /></span>
            </figure>
            </div>
            <div className="lk-chips" role="group" aria-label="Pick a major">{MAJORS.map((m) => <button key={m} type="button" className="lk-chip" aria-pressed={m === major} onClick={() => setMajor(m)} data-testid={`chip-lp-major-${m.split(" ")[0].toLowerCase()}`}>{m}</button>)}</div>
            <div className="lk-results">
              <div className="lk-card"><p className="lk-small">Openings that fit a {year}</p>
                <div className="lk-job"><div><b>Marketing Intern, Summer 2027</b><span>Dallas, TX &middot; closes Jan 31</span></div><span className="lk-ok">You qualify</span></div>
                <p className="lk-why">It asks for sophomores in marketing. That&rsquo;s you.</p>
                <div className="lk-job lk-hide"><div><b>Senior Marketing Associate</b><span>Hidden: needs 3 years of experience</span></div></div>
              </div>
              <div className="lk-card lk-say"><p className="lk-small">Remy&rsquo;s next step for you</p>
                <p className="lk-step">Add the budget you ran as treasurer.</p>
                <p className="lk-why">That bullet has no number yet. A real figure makes it stand out.</p>
                <p className="lk-check"><Check size={14} /> Takes about two minutes</p>
              </div>
              <div className="lk-card" aria-live="polite"><p className="lk-small">Where {major.toLowerCase()} leads</p>
                {!jobs ? <p className="lk-occ"><span>Loading&hellip;</span></p> : jobs.map((o) => <p key={o.title} className="lk-occ"><b>{o.title}</b><span>{[o.wage ? `$${o.wage.toLocaleString("en-US")} median` : "", o.change ? `${o.change > 0 ? "+" : ""}${o.change}% by 2035` : ""].filter(Boolean).join(" · ")}</span></p>)}
              </div>
            </div>
            <p className="lk-note">The opening and next step are examples. Career numbers are live from the U.S. Bureau of Labor Statistics.</p>
          </section>
        </main>
      </div>

      <section className="lp2-sec" id="what" aria-labelledby="what-h">
        <div className="lp2-w">
          <h2 id="what-h">What Remy does</h2>
          <div className="lp2-three rv">
            <div>
              <span className="lk-num">01</span><h3>Openings you can actually get</h3><p>Remy reads 180+ employers&rsquo; own career sites and checks each posting against your year, field, location, start date and visa needs. Postings you can&rsquo;t apply to are hidden, and every opening says why it fits you.</p>
              <div className="lp-shot" aria-hidden>
                <div className="lp-job"><div><b>Marketing Intern, Summer 2027</b><span>Dallas, TX &middot; closes Jan 31</span></div><span className="chip chip-live">You qualify</span></div>
                <p className="lp-why">It asks for sophomores in marketing. You&rsquo;re a sophomore in marketing.</p>
                <div className="lp-job lp-hidden"><div><b>Senior Marketing Associate</b><span>Hidden: needs 3 years of experience</span></div></div>
              </div>
            </div>
            <div>
              <span className="lk-num">02</span><h3>A resume that fits each job and stays true</h3><p>Line-by-line suggestions for each opening. Anything your resume can&rsquo;t back up gets flagged, and you approve every word before it&rsquo;s used.</p>
              <div className="lp-shot" aria-hidden>
                <p className="lp-old">Posted on the club&rsquo;s Instagram</p>
                <p className="lp-new">Grew the club&rsquo;s Instagram with a weekly posting calendar</p>
                <div className="lp-flag"><ShieldCheck size={15} /><span><b>Flagged:</b> &ldquo;followers up 40%&rdquo; isn&rsquo;t on your resume.</span></div>
              </div>
            </div>
            <div>
              <span className="lk-num">03</span><h3>A plan for this week</h3><p>Deadlines and next steps become dated to-dos, in your Google Calendar if you like. Ask Remy anything; it knows your resume and your deadlines.</p>
              <div className="lp-shot" aria-hidden>
                <div className="lp-todo"><span className="lp-box" /><span><b>Apply: Marketing Intern</b><span className="xs muted"> &middot; due Jan 31</span></span></div>
                <div className="lp-todo"><span className="lp-box" /><span><b>Ask your advisor for a reference</b></span></div>
                <div className="lp-todo done"><span className="lp-box"><Check size={12} /></span><span>Add your LinkedIn</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="how-h">
        <div className="lp2-w">
          <h2 id="how-h">Three steps, about five minutes</h2>
          <ol className="lk-steps rv">
            <li><b>Add your resume.</b> Upload it, add your LinkedIn, or answer a few questions and Remy builds your first one.</li>
            <li><b>Say what you want, or that you don&rsquo;t know yet.</b> Pick fields, places and dates, or let Remy show you where your major leads.</li>
            <li><b>Get openings and a plan.</b> Remy checks for new openings about once a day and turns what it finds into to-dos and deadlines.</li>
          </ol>
          <div className="lk-nevers" aria-label="What Remy will never do">
            <ShieldCheck size={18} /><b>Remy never</b>
            <span>makes up experience</span><span>applies or messages anyone for you</span><span>asks for passwords or sells your data</span>
          </div>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="team-h">
        <div className="lp2-w">
          <div className="lp2-row">
            <div><h2 id="team-h">The people behind Remy</h2><p>A small team in Fort Worth, Texas. We read every message beta testers send.</p></div>
            <a className="lp2-more" href="/about">About the team <span aria-hidden>&rarr;</span></a>
          </div>
          <ul className="lp2-team rv">
            {TEAM.map((m) => (
              <li key={m.name}>
                {m.photo ? <img src={m.photo} alt="" width={200} height={200} loading="lazy" /> : <span className="lp2-ini" aria-hidden>{m.name.split(" ").map((w) => w[0]).join("")}</span>}
                <b>{m.name}</b><span>{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="follow-h">
        <div className="lp2-w">
          <div className="lp2-follow-head">
            <div><h2 id="follow-h">Follow along</h2><p className="lp2-sub">Job-search tips, what we shipped this week, and the occasional fox.</p></div>
          </div>
          <div className="lp2-social">
            <a href={INSTAGRAM} {...out} data-testid="link-instagram"><InstagramMark size={26} /><span><b>Instagram</b><span>@coachremyai</span></span><span className="lp2-go" aria-hidden>&rarr;</span></a>
            <a href={LINKEDIN} {...out} data-testid="link-linkedin"><LinkedInMark /><span><b>LinkedIn</b><span>RemyAI company page</span></span><span className="lp2-go" aria-hidden>&rarr;</span></a>
          </div>
        </div>
      </section>

      <section className="lp2-sec lp2-end">
        <div className="lp2-w">
          <span className="lk-medal lk-medal-sm"><Remy size={84} mood="wave" /></span>
          <h2>Ready when you are.</h2>
          <p>Free, no credit card. About five minutes to set up.</p>
          <a className="lp2-btn lp2-btn-lg" href={start} {...ext}>{startLabel}</a>
        </div>
      </section>

      <div className="lp2-w">
        <footer className="lp2-foot">
          <span>&copy; 2026 RemyAI LLC &middot; Fort Worth, Texas</span>
          <nav aria-label="Footer">
            <a href="/about">About</a><a href="mailto:hello@remyai.org">hello@remyai.org</a>
            <a href={INSTAGRAM} {...out}>Instagram</a><a href={LINKEDIN} {...out}>LinkedIn</a>
            <a href="/policies">Privacy</a><a href="/policies#beta-terms">Beta terms</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** Not an owner: /careers isn't released yet, so send them home. */
function Landing2Fallback() {
  useEffect(() => { go("/"); }, []);
  return null;
}
