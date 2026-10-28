import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, useStore } from "../lib/store";
import { ArrowLeft, CalendarClock, Check, FileText, Search, ShieldCheck } from "lucide-react";
import { useRoute } from "../lib/router";
import { Remy, Spinner, StatusChip } from "../components/common";
import { providerOn, sendMagicLink, startOAuth, type SupabaseProvider } from "../lib/supabase";

export function useGoogleButton(onCredential: (cred: string) => void) {
  const { config } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"off" | "loading" | "ready" | "failed">(config?.googleClientId ? "loading" : "off");
  useEffect(() => {
    const cid = config?.googleClientId;
    if (!cid) return;
    const init = () => {
      try {
        window.google.accounts.id.initialize({ client_id: cid, callback: (r: any) => onCredential(r.credential), ux_mode: "popup" });
        if (ref.current) window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", width: 360 });
        setState("ready");
      } catch {
        setState("failed");
      }
    };
    if (window.google?.accounts?.id) return init();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = init;
    s.onerror = () => setState("failed");
    document.head.appendChild(s);
  }, [config?.googleClientId]);
  return { ref, state };
}

type Provider = "Google" | "LinkedIn" | "Apple" | "Microsoft" | "Work/School Email";
const SB: Record<Exclude<Provider, "Work/School Email">, SupabaseProvider> = { Google: "google", LinkedIn: "linkedin_oidc", Apple: "apple", Microsoft: "azure" };

/** Signed out: the landing page at /, the sign-in page at /signin. */
export default function Welcome() {
  const { path } = useRoute();
  return path === "/signin" ? <SignIn /> : <Landing />;
}

function SignIn() {
  const { setSession, run, config, toast } = useStore();
  const [busy, setBusy] = useState<"" | Provider | "google">("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const gis = !!config?.googleClientId;
  const google = useGoogleButton(async (credential) => {
    setBusy("google");
    const r = await run(() => api("POST", "/api/auth/google", { credential }));
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  });
  // A button whose provider isn't switched on in Supabase opens a private guest workspace and says so,
  // rather than pretending to sign in. Only switched-on providers are shown, so this is a fallback.
  const guest = async (via: Provider) => {
    setBusy(via);
    const r = await run(() => api("POST", "/api/auth/guest"), `${via} sign-in isn't switched on yet, so Remy opened a private guest workspace on this browser.`);
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  };
  const enter = async (via: Provider) => {
    if (via === "Work/School Email") return providerOn(config, "email") ? setEmailOpen((o) => !o) : guest(via);
    const p = SB[via];
    if (!providerOn(config, p)) return guest(via);
    setBusy(via);
    await run(() => startOAuth(config!, p)); // leaves the page on success
    setBusy("");
  };
  const magic = async () => {
    setBusy("Work/School Email");
    const ok = await run(() => sendMagicLink(config!, email.trim()).then(() => true));
    if (ok) { setSent(email.trim()); toast("Check your inbox for a sign-in link"); }
    setBusy("");
  };
  const sso = (via: Provider, icon: ReactNode) => !providerOn(config, via === "Work/School Email" ? "email" : SB[via]) ? null : (
    <button className="gbtn" type="button" onClick={() => enter(via)} disabled={!!busy} data-testid={`button-sso-${via.split(/\W/)[0].toLowerCase()}`}>
      {busy === via ? <Spinner /> : icon} Continue with {via}
    </button>
  );
  const anyReal = gis || ["google", "linkedin_oidc", "apple", "azure", "email"].some((p) => providerOn(config, p as SupabaseProvider));
  return (
    <div className="landing-screen">
      <div className="landing-card fade-up">
        <a className="btn btn-ghost btn-sm" href="/" style={{ padding: 0 }}><ArrowLeft size={14} /> What Remy does</a>
        <div className="landing">
          <Remy size={72} mood="wave" />
          <h1 className="motto">Sign in to Remy</h1>
          <p className="sub">Free for students. New here? Signing in creates your account; setup takes about 5 minutes.</p>
        </div>
        <div className="sso-list">
          <div data-testid="google-signin">
            {gis && google.state !== "failed" ? (
              <>
                <div ref={google.ref} style={{ minHeight: 44, display: "flex", justifyContent: "center" }} />
                {google.state === "loading" && <span className="xs muted row" style={{ justifyContent: "center" }}><Spinner /> Loading Google sign-in…</span>}
                {busy === "google" && <span className="xs muted row" style={{ justifyContent: "center" }}><Spinner /> Signing you in…</span>}
              </>
            ) : (
              sso("Google", <GoogleG />)
            )}
          </div>
          {sso("LinkedIn", <LinkedInMark />)}
          {sso("Apple", <AppleMark />)}
          {sso("Microsoft", <MicrosoftMark />)}
          {sso("Work/School Email", <MailMark />)}
          {emailOpen && (
            sent ? (
              <div className="notice notice-good fade-up" data-testid="magic-link-sent"><Check size={16} /><div>We sent a sign-in link to <strong>{sent}</strong>. Open it on this device to continue.</div></div>
            ) : (
              <form className="row fade-up" onSubmit={(e) => { e.preventDefault(); magic(); }}>
                <input className="input" style={{ flex: 1, minWidth: 180 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@tcu.edu" aria-label="Email address" data-testid="input-magic-email" />
                <button className="btn btn-primary btn-sm" disabled={!/.+@.+\..+/.test(email) || !!busy} data-testid="button-send-magic">{busy === "Work/School Email" ? <Spinner /> : null} Send link</button>
              </form>
            )
          )}
          {!anyReal && <p className="small muted" style={{ textAlign: "center" }}><StatusChip label="Needs setup">Sign-in</StatusChip> No sign-in method is switched on for this server yet.</p>}
        </div>
        <div className="landing-foot">
          <p className="xs muted">Remy never asks for your passwords. <a href="/policies">Privacy and terms</a></p>
        </div>
      </div>
    </div>
  );
}

/** The front page: what a student gets, shown with previews built from Remy's real screens. */
function Landing() {
  const tour = useRef<HTMLElement>(null);
  const toTour = () => tour.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  return (
    <div className="lp">
      <header className="lp-top">
        <span className="logo"><Remy size={30} mood="idle" /> Remy</span>
        <nav className="row" style={{ gap: 4 }}>
          <button className="btn btn-ghost btn-sm hide-sm" onClick={toTour}>What you get</button>
          <a className="btn btn-ghost btn-sm hide-sm" href="/about">About</a>
          <a className="btn btn-primary btn-sm" href="/signin" data-testid="button-lp-signin">Sign in</a>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>Don&rsquo;t hunt for a job alone.</h1>
          <p className="lp-lede">Stop scrolling job boards for roles you can't apply to, rewriting your resume for every posting, and guessing what your major leads to. Remy is a free career coach for college students that does the searching, keeps your applications honest, and tells you what to do this week.</p>
          <div className="row" style={{ gap: 10 }}>
            <a className="btn btn-primary" href="/signin" data-testid="button-lp-start">Create your free account</a>
            <button className="btn btn-secondary" onClick={toTour}>See what you get</button>
          </div>
          <p className="xs muted">For every major and every year, freshmen included. Built by students at TCU.</p>
        </div>
        <HeroExample />
      </section>

      <section className="lp-gets" ref={tour} aria-label="What you get">
        <h2>What you get</h2>

        <div className="lp-get">
          <div className="lp-get-copy">
            <h3>Openings you can actually get</h3>
            <p>Remy reads more than 180 employers&rsquo; own career sites, from Texas companies to school districts and cities, and checks every posting against you: your year, field, location, start date and visa needs. If you can&rsquo;t apply, you don&rsquo;t see it. If you can, it tells you why.</p>
          </div>
          <div className="lp-shot" aria-hidden>
            <div className="lp-job"><div><b>Marketing Intern, Summer 2027</b><span>American retailer · Dallas, TX · closes Jan 31</span></div><span className="chip chip-live">You qualify</span></div>
            <p className="lp-why">It asks for sophomores or juniors in marketing or business. You&rsquo;re a sophomore in marketing.</p>
            <div className="lp-job"><div><b>Brand Analyst Co-op</b><span>Consumer goods · Plano, TX · closes Feb 14</span></div><span className="chip chip-live">You qualify</span></div>
            <div className="lp-job lp-hidden"><div><b>Senior Marketing Associate</b><span>Hidden: needs 3 years of experience</span></div></div>
          </div>
        </div>

        <div className="lp-get flip">
          <div className="lp-get-copy">
            <h3>A resume that fits each job and stays true</h3>
            <p>For each opening, Remy suggests changes line by line and writes a cover letter draft. Anything your own resume can&rsquo;t back up gets flagged before you accept it. You approve every word, and you send everything yourself.</p>
          </div>
          <div className="lp-shot" aria-hidden>
            <span className="xs muted">Suggested change</span>
            <p className="lp-old">Posted on the club&rsquo;s Instagram</p>
            <p className="lp-new">Grew the club&rsquo;s Instagram by planning a weekly posting calendar</p>
            <div className="row" style={{ gap: 6 }}><span className="btn btn-primary btn-sm">Accept</span><span className="btn btn-secondary btn-sm">Edit</span></div>
            <div className="lp-flag"><ShieldCheck size={15} /><span><b>Flagged:</b> &ldquo;increased followers 40%&rdquo; isn&rsquo;t on your resume. Add it only if it&rsquo;s true.</span></div>
          </div>
        </div>

        <div className="lp-get">
          <div className="lp-get-copy">
            <h3>Help when you don&rsquo;t know what you want yet</h3>
            <p>Pick a major and see the jobs it leads to, with real pay and growth numbers from the U.S. Bureau of Labor Statistics. Heard of a job but not sure what it is? Ask, and Remy explains a normal day, the hard parts and how to try it out this year.</p>
          </div>
          <FieldBrowser />
        </div>

        <div className="lp-get flip">
          <div className="lp-get-copy">
            <h3>A plan for this week, not just a list</h3>
            <p>Deadlines, next steps and the gaps Remy spots become to-dos with dates. Connect Google Calendar and they show up in a separate &ldquo;Remy&rdquo; calendar. Ask Remy anything, and it already knows your resume, your to-dos and your deadlines.</p>
          </div>
          <div className="lp-shot" aria-hidden>
            <div className="lp-todo"><span className="lp-box" /><span><b>Apply: Marketing Intern</b><span className="xs muted"> · due Jan 31</span></span></div>
            <div className="lp-todo"><span className="lp-box" /><span><b>Ask your club advisor for a reference</b><span className="xs muted"> · this week</span></span></div>
            <div className="lp-todo done"><span className="lp-box"><Check size={12} /></span><span>Add your LinkedIn</span></div>
            <div className="lp-todo"><span className="lp-box" /><span><b>Update LinkedIn: it says a different major</b></span></div>
          </div>
        </div>
      </section>

      <section className="lp-band">
        <h2>How it works</h2>
        <ol className="lp-steps">
          <li><b>Add your resume.</b> Upload it, add your LinkedIn, or answer a few questions and Remy builds your first one.</li>
          <li><b>Say what you want, or that you don&rsquo;t know yet.</b> Pick fields, places and dates, or let Remy show you where your major leads.</li>
          <li><b>Get openings and a plan.</b> Remy keeps looking every few hours and turns what it finds into to-dos and deadlines.</li>
        </ol>
      </section>

      <section className="lp-promise">
        <ShieldCheck size={22} />
        <div className="stack-sm">
          <h2>What Remy will never do</h2>
          <ul>
            <li>Make up experience, numbers or skills you don&rsquo;t have.</li>
            <li>Apply, email or message anyone for you. You send everything yourself.</li>
            <li>Ask for your passwords or sell your data. You can download or delete everything at any time.</li>
          </ul>
        </div>
      </section>

      <section className="lp-cta">
        <Remy size={56} mood="wave" />
        <h2>Ready when you are.</h2>
        <p className="muted">Free for students. No credit card. About 5 minutes to set up.</p>
        <a className="btn btn-primary" href="/signin">Create your free account</a>
      </section>
      <footer className="lp-foot xs muted"><span>Remy, made by students at Texas Christian University.</span><span><a href="/about">About the team</a> &nbsp; <a href="/policies">Privacy and terms</a></span></footer>
    </div>
  );
}

// The hero's example conversation, one per kind of student (fictional students; job numbers are real BLS figures).
const EXAMPLES: { tab: string; ask: string; items: [ReactNode, string, ReactNode][] }[] = [
  { tab: "Finance", ask: "I'm a sophomore in finance with no internship yet. Where do I start?", items: [
    [<Search size={15} />, "Accounting Summer Intern", <>at a Fort Worth railroad. You qualify: it's open to any class year and asks for a 2.75 GPA.</>],
    [<CalendarClock size={15} />, "Applications close Jan 31.", <>It's on your calendar.</>],
    [<FileText size={15} />, "To-do:", <>your treasurer bullet has no number. Add the budget you managed.</>],
  ] },
  { tab: "Nursing", ask: "I'm a sophomore in nursing. What should I do this semester?", items: [
    [<Search size={15} />, "Summer Nurse Extern", <>at a Fort Worth hospital. You qualify: it asks for students finishing year two.</>],
    [<CalendarClock size={15} />, "Applications close Feb 15.", <>It's on your calendar.</>],
    [<FileText size={15} />, "To-do:", <>add your Walgreens pharmacy work to your resume. Your LinkedIn has it; your resume doesn't.</>],
  ] },
  { tab: "Not sure yet", ask: "I'm a psychology major and I have no idea what jobs I can get.", items: [
    [<Search size={15} />, "Social and human service assistants", <>hire about 48,900 people a year. Your crisis-line volunteering fits.</>],
    [<Search size={15} />, "School and career counselors", <>earn a $64,330 median and need a master's. Want to see what a day looks like?</>],
    [<FileText size={15} />, "To-do:", <>ask one alum in counseling for a 15-minute chat.</>],
  ] },
];
function HeroExample() {
  const [i, setI] = useState(0);
  const ex = EXAMPLES[i];
  return (
    <div className="lp-hero-ex">
      <div className="row" role="tablist" aria-label="Example student" style={{ gap: 6 }}>
        {EXAMPLES.map((e, k) => <button key={e.tab} role="tab" aria-selected={k === i} className="pref-chip" aria-pressed={k === i} onClick={() => setI(k)}>{e.tab}</button>)}
      </div>
      <div className="lp-chat" aria-label="Example conversation with Remy" aria-live="polite">
        <div key={"q" + i} className="lp-msg me fade-up">{ex.ask}</div>
        <div key={"a" + i} className="lp-msg remy fade-up">
          <Remy size={30} mood="happy" />
          <div className="stack-sm">
            <span>Three things, based on your resume:</span>
            {ex.items.map(([icon, b, rest], k) => <div key={k} className="lp-item">{icon}<span><b>{b}</b> {rest}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// "What does my major lead to?" with real BLS numbers, before signing up (public data only).
const BROWSE = ["Finance", "Accounting", "Marketing", "Nursing", "Software & computer science", "Education & teaching", "Psychology & social work", "Engineering", "Journalism & communications", "Entrepreneurship"];
type Occ = { title: string; change: number; openings: number | null; wage: number | null; education: string };
function FieldBrowser() {
  const [field, setField] = useState(BROWSE[2]);
  const [jobs, setJobs] = useState<Occ[] | null>(null);
  useEffect(() => {
    let live = true;
    setJobs(null);
    fetch("/api/public/careers?field=" + encodeURIComponent(field)).then((r) => r.json()).then((d) => { if (live) setJobs(d?.[0]?.jobs?.slice(0, 3) || []); }).catch(() => live && setJobs([]));
    return () => { live = false; };
  }, [field]);
  return (
    <div className="lp-shot lp-live">
      <div className="row" style={{ gap: 6 }}>
        {BROWSE.map((f) => <button key={f} className="pref-chip" aria-pressed={f === field} onClick={() => setField(f)}>{f}</button>)}
      </div>
      <span className="xs muted">Jobs people in {field.toLowerCase()} go into, the ones that hire the most first</span>
      <div aria-live="polite" style={{ minHeight: 170 }}>
        {!jobs ? <span className="row xs muted"><Spinner /> Loading…</span> : jobs.map((o) => (
          <div key={o.title} className="lp-occ fade-up"><b>{o.title}</b><span>{[o.wage ? `$${o.wage.toLocaleString("en-US")} median pay` : "", o.openings ? `${Math.round(o.openings * 1000).toLocaleString("en-US")} openings a year` : "", o.change ? `${o.change > 0 ? "+" : ""}${o.change}% by 2035` : ""].filter(Boolean).join(" · ")}</span></div>
        ))}
      </div>
      <a className="btn btn-secondary btn-sm" href="/signin" style={{ justifySelf: "start" }}>Ask Remy what any of these is like</a>
      <span className="xs muted">Source: U.S. Bureau of Labor Statistics, 2025–35 projections.</span>
    </div>
  );
}

function LinkedInMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path fill="#fff" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.5.96 1.39 2.1 2.94 3.6 2.88 1.45-.06 2-.93 3.74-.93s2.24.93 3.77.9c1.56-.02 2.55-1.41 3.5-2.8 1.1-1.61 1.56-3.17 1.58-3.25-.03-.02-3.04-1.17-3.07-4.66ZM14.16 4.06c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.55.77-3.38 1.73-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.62Z" />
    </svg>
  );
}
function MicrosoftMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M12 1h10v10H12z" /><path fill="#00A4EF" d="M1 12h10v10H1z" /><path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}
export function MailMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}
export { LinkedInMark };

export function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
