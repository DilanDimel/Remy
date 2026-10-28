import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, useStore } from "../lib/store";
import { BookOpen, CalendarClock, Check, Compass, FileText, Search, ShieldCheck } from "lucide-react";
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

export default function Welcome() {
  const { setSession, run, config, toast } = useStore();
  const [busy, setBusy] = useState<"" | Provider | "demo" | "google">("");
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
  // Buttons whose provider isn't switched on in Supabase open the same private
  // guest workspace as the demo, and say so, rather than pretending to sign in.
  const guest = async (via: Provider | "demo") => {
    setBusy(via);
    const r = await run(
      () => api("POST", "/api/auth/guest"),
      via === "demo" ? undefined : `${via} sign-in isn't switched on yet, so Remy opened a private guest workspace on this browser.`,
    );
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
  // Only offer sign-in options that are switched on in Supabase.
  const sso = (via: Provider, icon: ReactNode) => !providerOn(config, via === "Work/School Email" ? "email" : SB[via]) ? null : (
    <button className="gbtn" type="button" onClick={() => enter(via)} disabled={!!busy} data-testid={`button-sso-${via.split(/\W/)[0].toLowerCase()}`}>
      {busy === via ? <Spinner /> : icon} Continue with {via}
    </button>
  );
  const anyReal = gis || ["google", "linkedin_oidc", "apple", "azure", "email"].some((p) => providerOn(config, p as SupabaseProvider));
  const startRef = useRef<HTMLElement>(null);
  const toStart = () => startRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  return (
    <div className="lp">
      <header className="lp-top">
        <span className="logo"><Remy size={30} mood="idle" /> Remy</span>
        <nav className="row" style={{ gap: 4 }}>
          <a className="btn btn-ghost btn-sm hide-sm" href="#/about">About</a>
          <button className="btn btn-primary btn-sm" onClick={toStart} data-testid="button-lp-signin">Sign in</button>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>Don&rsquo;t hunt for a job alone.</h1>
          <p className="lp-lede">Remy is a career coach for college students. Give it your resume, or build one with it, and it finds internships and jobs you can actually apply to, helps you fit your resume to each one without making anything up, and keeps your deadlines in one place.</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-primary" onClick={toStart} data-testid="button-lp-start">Get started free</button>
            <button className="btn btn-secondary" onClick={() => guest("demo")} disabled={!!busy}>{busy === "demo" ? <Spinner /> : null} Look around first</button>
          </div>
          <p className="xs muted">For every major and every year, freshmen included. Built by students at TCU.</p>
        </div>
        <div className="lp-chat" aria-label="Example conversation with Remy">
          <div className="lp-msg me">I&rsquo;m a sophomore in nursing. What should I do this semester?</div>
          <div className="lp-msg remy">
            <Remy size={30} mood="happy" />
            <div className="stack-sm">
              <span>Three things, based on your resume:</span>
              <div className="lp-item"><Search size={15} /><span><b>Summer Nurse Extern</b>, a Fort Worth hospital. You qualify: it asks for students finishing year two.</span></div>
              <div className="lp-item"><CalendarClock size={15} /><span><b>Applications close Feb 15.</b> It&rsquo;s on your calendar.</span></div>
              <div className="lp-item"><FileText size={15} /><span><b>To-do:</b> add your Walgreens pharmacy work to your resume. Your LinkedIn has it; your resume doesn&rsquo;t.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-band">
        <h2>How it works</h2>
        <ol className="lp-steps">
          <li><b>Add your resume.</b> Upload it, add your LinkedIn, or answer a few questions and Remy builds your first one.</li>
          <li><b>Say what you want, or that you don&rsquo;t know yet.</b> Pick fields, places and dates. Not sure? Remy shows the jobs your major leads to and what each one is really like.</li>
          <li><b>Get openings and a plan.</b> Remy reads employers&rsquo; career sites, hides what you can&rsquo;t apply to, and turns the rest into to-dos and deadlines.</li>
        </ol>
      </section>

      <section className="lp-what">
        <div><Search size={20} /><h3>Openings you qualify for</h3><p>From more than 180 employers&rsquo; own career sites, including Texas companies, school districts and cities. Wrong year, wrong field or no visa sponsorship? It stays hidden.</p></div>
        <div><FileText size={20} /><h3>Applications that stay true</h3><p>Remy suggests changes to fit each posting and flags any line your resume can&rsquo;t back up. You approve every word.</p></div>
        <div><Compass size={20} /><h3>Help when you&rsquo;re undecided</h3><p>See the jobs your major leads to, with pay and growth from the U.S. Bureau of Labor Statistics, and ask Remy what any job is like day to day.</p></div>
        <div><BookOpen size={20} /><h3>A coach that knows you</h3><p>Ask Remy anything. It already knows your resume, your to-dos and your deadlines, so you never start from zero.</p></div>
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

      <section className="lp-start" ref={startRef}>
      <div className="landing-card">
        <div className="landing">
          <Remy size={64} mood="wave" />
          <h2 className="motto">Start with Remy</h2>
          <p className="sub">Free for students. Sign in to keep your workspace on every device.</p>
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
        </div>
        <div className="landing-foot">
          <button className="btn btn-ghost btn-sm" onClick={() => guest("demo")} disabled={!!busy} data-testid="button-explore-demo">
            {busy === "demo" ? <Spinner /> : null} Or explore the demo without signing in
          </button>
          <p className="xs muted">
            {anyReal ? "Signing in keeps your workspace across devices. " : <><StatusChip label="Needs setup">Sign-in</StatusChip>{" "}</>}
            Remy never asks for your passwords.
          </p>
        </div>
      </div>
      </section>
      <footer className="lp-foot xs muted"><span>Remy, made by students at Texas Christian University.</span><span><a href="#/about">About the team</a> &nbsp; <a href="#/policies">Privacy and terms</a></span></footer>
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
