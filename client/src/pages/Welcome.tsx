import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, useStore } from "../lib/store";
import { ArrowLeft, CalendarClock, Check, FileText, Search, ShieldCheck } from "lucide-react";
import { useRoute } from "../lib/router";
import { BetaBadge, Remy, Spinner, StatusChip } from "../components/common";
import { providerOn, sendMagicLink, startOAuth, type SupabaseProvider } from "../lib/supabase";
import { ThemeToggle } from "../components/ThemeToggle";

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
        if (ref.current) window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", width: Math.min(360, ref.current.offsetWidth || 360) });
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
  const [code, setCode] = useState("");
  const codes = !!config?.emailCodes;
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
    if (via === "Work/School Email") return codes || providerOn(config, "email") ? setEmailOpen((o) => !o) : guest(via);
    const p = SB[via];
    if (!providerOn(config, p)) return guest(via);
    setBusy(via);
    await run(() => startOAuth(config!, p)); // leaves the page on success
    setBusy("");
  };
  const magic = async () => {
    setBusy("Work/School Email");
    const ok = await run(() => (codes ? api("POST", "/api/auth/email/start", { email: email.trim() }) : sendMagicLink(config!, email.trim())).then(() => true));
    if (ok) { setSent(email.trim()); setCode(""); toast(codes ? "Check your inbox for a 6-digit code" : "Check your inbox for a sign-in link"); }
    setBusy("");
  };
  const verify = async () => {
    setBusy("Work/School Email");
    const r = await run(() => api("POST", "/api/auth/email/verify", { email: sent, code }));
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  };
  const sso = (via: Provider, icon: ReactNode) => !(via === "Work/School Email" ? codes || providerOn(config, "email") : providerOn(config, SB[via])) ? null : (
    <button className="gbtn" type="button" onClick={() => enter(via)} disabled={!!busy} data-testid={`button-sso-${via.split(/\W/)[0].toLowerCase()}`}>
      {busy === via ? <Spinner /> : icon} Continue with {via === "Work/School Email" ? "Email" : via}
    </button>
  );
  const anyReal = gis || codes || ["google", "linkedin_oidc", "apple", "azure", "email"].some((p) => providerOn(config, p as SupabaseProvider));
  return (
    <div className="landing-screen auth-stage">
      <div className="lp-beam" aria-hidden><span className="lp-beam-floor" /></div>
      <aside className="auth-side" aria-label="What happens next">
        <span className="lp-award">Free while Remy is in beta</span>
        <p className="auth-side-h" aria-hidden>Your career coach is one step away.</p>
        <ol className="auth-steps">
          <li><b>Sign in</b><span>New here? This creates your account.</span></li>
          <li><b>Add your resume</b><span>Upload it, or Remy helps you build one.</span></li>
          <li><b>Get your plan</b><span>Openings you can get and what to do this week.</span></li>
        </ol>
      </aside>
      <div className="landing-card fade-up">
        <div className="row-between"><a className="btn btn-ghost auth-back" href="/"><ArrowLeft size={16} /> What Remy does</a><ThemeToggle /></div>
        <div className="landing">
          <Remy size={72} mood="wave" />
          <h1 className="motto">Sign in to Remy</h1>
          <p className="sub">Free for students while Remy is in beta. New here? Signing in creates your account; setup takes about 5 minutes.</p>
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
            sent && codes ? (
              <form className="stack-sm fade-up" onSubmit={(e) => { e.preventDefault(); verify(); }} data-testid="email-code-form">
                <span className="small">We emailed a 6-digit code to <strong>{sent}</strong>. It works on any device and expires in 10 minutes. Not there? Check spam or Promotions.</span>
                <div className="row">
                  <input className="input" style={{ flex: 1, minWidth: 140, letterSpacing: 4 }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" aria-label="6-digit code" data-testid="input-email-code" />
                  <button className="btn btn-primary auth-go" disabled={code.length !== 6 || !!busy} data-testid="button-verify-code">{busy === "Work/School Email" ? <Spinner /> : null} Sign in</button>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setSent("")}>Use a different email or send a new code</button>
              </form>
            ) : sent ? (
              <div className="notice notice-good fade-up" data-testid="magic-link-sent"><Check size={16} /><div>We sent a sign-in link to <strong>{sent}</strong>. Open it on this device to continue.</div></div>
            ) : (
              <form className="row fade-up" onSubmit={(e) => { e.preventDefault(); magic(); }}>
                <input className="input" style={{ flex: 1, minWidth: 180 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Any email address" autoComplete="email" autoCapitalize="none" aria-label="Email address" data-testid="input-magic-email" />
                <button className="btn btn-primary auth-go" disabled={!/.+@.+\..+/.test(email) || !!busy} data-testid="button-send-magic">{busy === "Work/School Email" ? <Spinner /> : null} {codes ? "Send code" : "Send link"}</button>
              </form>
            )
          )}
          {!anyReal && <p className="small muted" style={{ textAlign: "center" }}><StatusChip label="Needs setup">Sign-in</StatusChip> No sign-in method is switched on for this server yet.</p>}
        </div>
        <div className="landing-foot">
          <p className="xs muted">Remy never asks for your passwords. <a className="auth-link" href="/policies">Privacy and terms</a></p>
        </div>
      </div>
    </div>
  );
}

/** The front page: what a student gets, shown with previews built from Remy's real screens. */
function Landing() {
  const tour = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const toTour = () => tour.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  // Sections fade up as they scroll into view (CSS keeps everything visible when motion is reduced or JS is off).
  useEffect(() => {
    const els = page.current?.querySelectorAll(".rv") || [];
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((list) => { for (const x of list) if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);
  // Dark tiles light up where the pointer is (a soft spotlight, as on huly.io).
  const spotlight = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = (e.target as Element).closest?.(".lp-tile") as HTMLElement | null;
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${e.clientX - r.left}px`);
    t.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div className="lp" ref={page}>
      <header className={"lp-top" + (scrolled ? " scrolled" : "")}>
        <span className="logo"><Remy size={30} mood="idle" /> Remy <BetaBadge /></span>
        <nav className="row" style={{ gap: 4 }}>
          <button className="btn btn-ghost btn-sm hide-sm" onClick={toTour}>What you get</button>
          <a className="btn btn-ghost btn-sm hide-sm" href="/about">About</a>
          <ThemeToggle />
          <a className="btn btn-primary btn-sm" href="/signin" data-testid="button-lp-signin">Sign in</a>
        </nav>
      </header>

      <section className="lp-hero lp-dark">
        <div className="lp-beam" aria-hidden><span className="lp-beam-line" /><span className="lp-beam-floor" /></div>
        <div className="lp-hero-copy">
          <span className="lp-award">Built by TCU students · Won first at TCU Neeley AI Forward, job recruitment category</span>
          <h1>Don&rsquo;t hunt for a job <span className="lp-accent">alone.</span></h1>
          <p className="lp-lede">A free career coach for college students: openings you can actually get, a resume that stays true, and what to do this week.</p>
          <div className="lp-ctas">
            <a className="btn btn-lg lp-glow-btn" href="/signin" data-testid="button-lp-start">Create your free account</a>
            <button className="btn btn-lg lp-ghost-btn" onClick={toTour}>See what you get</button>
          </div>
          <p className="xs lp-fine">Free beta · every major and every year, freshmen included</p>
        </div>
        <HeroExample />
      </section>
      <div className="lp-ticker" aria-hidden>
        <div className="lp-ticker-track">
          {[0, 1].map((n) => <span key={n}>{TICKER.map((t) => <b key={t}>{t}</b>)}</span>)}
        </div>
      </div>

      <section className="lp-bento-sec" ref={tour} aria-label="What you get">
        <div className="lp-gets-head rv">
          <span className="lp-kicker">What you get</span>
          <h2>One coach for the whole search</h2>
          <nav className="lp-jump" aria-label="Jump to">
            <a href="#get-openings"><b>1</b> Openings</a><a href="#get-resume"><b>2</b> Honest resume</a><a href="#get-plan"><b>3</b> Weekly plan</a><a href="#get-explore"><b>4</b> Explore careers</a>
          </nav>
        </div>
        <div className="lp-bento" onPointerMove={spotlight}>
          <article className="lp-tile wide rv" id="get-openings">
            <div className="lp-tile-copy">
              <span className="lp-num">01</span>
              <h3>Openings you can actually get</h3>
              <p>Remy reads 180+ employers&rsquo; own career sites and checks each posting against your year, field, location, start date and visa needs. If you can&rsquo;t apply, you don&rsquo;t see it. If you can, it says why.</p>
            </div>
            <div className="lp-shot" aria-hidden>
              <span className="lp-ex-tag">Example</span>
              <div className="lp-job"><div><b>Marketing Intern, Summer 2027</b><span>American retailer · Dallas, TX · closes Jan 31</span></div><span className="chip chip-live">You qualify</span></div>
              <p className="lp-why">It asks for sophomores or juniors in marketing or business. You&rsquo;re a sophomore in marketing.</p>
              <div className="lp-job lp-hidden"><div><b>Senior Marketing Associate</b><span>Hidden: needs 3 years of experience</span></div></div>
            </div>
          </article>
          <article className="lp-tile rv" id="get-resume">
            <div className="lp-tile-copy">
              <span className="lp-num">02</span>
              <h3>A resume that fits each job and stays true</h3>
              <p>Line-by-line suggestions for each opening. Anything your resume can&rsquo;t back up gets flagged. You approve every word.</p>
            </div>
            <div className="lp-shot" aria-hidden>
              <span className="lp-ex-tag">Example</span>
              <p className="lp-old">Posted on the club&rsquo;s Instagram</p>
              <p className="lp-new">Grew the club&rsquo;s Instagram with a weekly posting calendar</p>
              <div className="lp-flag"><ShieldCheck size={15} /><span><b>Flagged:</b> &ldquo;followers up 40%&rdquo; isn&rsquo;t on your resume.</span></div>
            </div>
          </article>
          <article className="lp-tile rv" id="get-plan">
            <div className="lp-tile-copy">
              <span className="lp-num">03</span>
              <h3>A plan for this week</h3>
              <p>Deadlines and next steps become dated to-dos, in your Google Calendar if you like. Ask Remy anything; it knows your resume and deadlines.</p>
            </div>
            <div className="lp-shot" aria-hidden>
              <span className="lp-ex-tag">Example</span>
              <div className="lp-todo"><span className="lp-box" /><span><b>Apply: Marketing Intern</b><span className="xs muted"> · due Jan 31</span></span></div>
              <div className="lp-todo"><span className="lp-box" /><span><b>Ask your advisor for a reference</b></span></div>
              <div className="lp-todo done"><span className="lp-box"><Check size={12} /></span><span>Add your LinkedIn</span></div>
            </div>
          </article>
          <article className="lp-tile wide rv" id="get-explore">
            <div className="lp-tile-copy">
              <span className="lp-num">04</span>
              <h3>Help when you don&rsquo;t know what you want yet</h3>
              <p>Pick a major and see the jobs it leads to, with real pay and growth from the U.S. Bureau of Labor Statistics. Try it here.</p>
            </div>
            <FieldBrowser />
          </article>
        </div>
      </section>

      <section className="lp-band">
        <span className="lp-kicker">How it works</span>
        <h2>Three steps, about five minutes</h2>
        <ol className="lp-steps rv">
          <li><b>Add your resume.</b> Upload it, add your LinkedIn, or answer a few questions and Remy builds your first one.</li>
          <li><b>Say what you want, or that you don&rsquo;t know yet.</b> Pick fields, places and dates, or let Remy show you where your major leads.</li>
          <li><b>Get openings and a plan.</b> Remy checks for new openings about once a day and turns what it finds into to-dos and deadlines.</li>
        </ol>
        <div className="lp-nevers rv" aria-label="What Remy will never do">
          <ShieldCheck size={18} /><b>Remy never</b>
          <span>makes up experience</span><span>applies or messages anyone for you</span><span>asks for passwords or sells your data</span>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-in rv">
        <Remy size={56} mood="wave" />
        <h2>Ready when you are.</h2>
        <p>Free while Remy is in beta. No credit card. About 5 minutes to set up.</p>
        <a className="btn btn-primary btn-lg" href="/signin">Create your free account</a>
        </div>
      </section>
      <footer className="lp-foot">
        <div className="lp-foot-brand">
          <span className="logo"><Remy size={26} mood="idle" /> Remy <BetaBadge /></span>
          <p className="small">A free career coach for college students. Made by students at Texas Christian University.</p>
        </div>
        <nav aria-label="Product"><b>Product</b><a href="#get-openings">Openings</a><a href="#get-resume">Honest resume</a><a href="#get-explore">Explore careers</a><a href="#get-plan">Weekly plan</a></nav>
        <nav aria-label="Company"><b>Company</b><a href="/about">About the team</a><a href="mailto:remy.careercoach@gmail.com">remy.careercoach@gmail.com</a><a href="/signin">Sign in</a></nav>
        <nav aria-label="Legal"><b>Legal</b><a href="/policies">Privacy policy</a><a href="/policies#beta-terms">Beta terms</a></nav>
        <p className="lp-foot-bottom xs">© 2026 Remy. In beta: features may change, and unfinished ones are marked &ldquo;Coming soon&rdquo;.</p>
      </footer>
    </div>
  );
}

const TICKER = ["Openings you qualify for", "Honest resume tailoring", "Cover letter drafts", "Weekly plan", "Deadlines on your calendar", "Interview practice", "Careers by major", "Hours log", "Follow-up nudges"];

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
  const [typing, setTyping] = useState(true);
  const [picked, setPicked] = useState(false);
  const [hold, setHold] = useState(false); // paused while the visitor's pointer or focus is on it
  const [seen, setSeen] = useState(true); // and while it's scrolled out of view
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([x]) => setSeen(x.isIntersecting));
    io.observe(box.current);
    return () => io.disconnect();
  }, []);
  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ex = EXAMPLES[i];
  // Remy "types" for a moment, then answers; the examples take turns until the visitor picks one.
  useEffect(() => {
    if (calm) { setTyping(false); return; }
    setTyping(true);
    const t = setTimeout(() => setTyping(false), 1100);
    return () => clearTimeout(t);
  }, [i, calm]);
  useEffect(() => {
    if (calm || picked || hold || !seen) return;
    const t = setTimeout(() => setI((k) => (k + 1) % EXAMPLES.length), 7500);
    return () => clearTimeout(t);
  }, [i, picked, calm, hold, seen]);
  return (
    <div className="lp-hero-ex">
      <div className="row lp-tabs" role="tablist" aria-label="Example student" style={{ gap: 6 }}>
        {EXAMPLES.map((e, k) => <button key={e.tab} role="tab" aria-selected={k === i} className="pref-chip" aria-pressed={k === i} onClick={() => { setPicked(true); setI(k); }}>{e.tab}</button>)}
      </div>
      {/* Every example sits in the same grid cell (only the current one shows), so the box is as tall as the longest one
          and nothing below it moves when Remy answers or the examples take turns. */}
      <div className="lp-chat" ref={box} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)} aria-label="Example conversation with Remy">
        {EXAMPLES.map((e, k) => (
          <div key={e.tab} className="lp-chat-slot" aria-hidden={k !== i} style={{ visibility: k === i ? "visible" : "hidden" }}>
            <div key={"q" + (k === i ? i : "x")} className={"lp-msg me" + (k === i ? " fade-up" : "")}>{e.ask}</div>
            <div className="lp-answer">
              <div key={"a" + (k === i ? i : "x")} className={"lp-msg remy" + (k === i && !typing ? " fade-up" : "")} style={{ visibility: k === i && typing ? "hidden" : undefined }}>
                <Remy size={30} mood="happy" />
                <div className="stack-sm">
                  <span>Three things, based on your resume:</span>
                  {e.items.map(([icon, b, rest], n) => <div key={n} className={"lp-item" + (k === i ? " lp-drop" : "")} style={{ animationDelay: `${120 + n * 160}ms` }}>{icon}<span><b>{b}</b> {rest}</span></div>)}
                </div>
              </div>
              {k === i && typing && (
                <div className="lp-msg remy lp-typing-row fade-up" aria-label="Remy is typing">
                  <Remy size={30} mood="think" />
                  <div className="lp-typing"><i /><i /><i /></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <span className="xs muted lp-ex-note">Example with a fictional student. Career numbers are from the U.S. Bureau of Labor Statistics.</span>
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
