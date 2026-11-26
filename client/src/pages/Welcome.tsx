import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, useStore } from "../lib/store";
import { ArrowLeft, Check } from "lucide-react";
import { go, useRoute } from "../lib/router";
import { Remy, Spinner, StatusChip } from "../components/common";
import { providerOn, sendMagicLink, startOAuth, type SupabaseProvider } from "../lib/supabase";
import { ThemeToggle } from "../components/ThemeToggle";
import { isNativeApp } from "../lib/native";
import Landing2 from "./Landing2";

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

/** Signed out: the landing page at /, the sign-in page at /signin.
 * The phone app has no landing page: it opens straight to sign-in (signing in creates the account). */
export default function Welcome() {
  const { path } = useRoute();
  const { betaBlocked } = useStore();
  // Everyone gets the new homepage, on phones too (Dilan, Nov 25: phones still showed the old one).
  return isNativeApp || path === "/signin" || betaBlocked ? <SignIn /> : <Landing2 />;
}

/** Where to apply to be a beta tester: the team's form, or Remy's inbox when the form isn't set yet. */
export const applyHref = (formUrl?: string) => formUrl || "mailto:hello@remyai.org?subject=Remy%20beta%20tester";

/** Invite-only beta: who can sign in, and why someone was turned away. */
function BetaNote({ onOther }: { onOther: () => void }) {
  const { config, betaBlocked, clearBeta } = useStore();
  if (!config?.beta?.on && !betaBlocked) return null;
  const href = applyHref(config?.beta?.formUrl);
  if (betaBlocked) return (
    <div className="notice notice-warn stack-sm fade-up" role="alert" data-testid="beta-blocked">
      <span className="small">{betaBlocked}</span>
      <div className="row" style={{ gap: 8 }}>
        <a className="btn btn-primary btn-sm" href={href} target="_blank" rel="noreferrer" data-testid="link-beta-apply">Apply to be a beta tester</a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { clearBeta(); onOther(); go("/signin"); }} data-testid="button-beta-other">Use a different email</button>
      </div>
    </div>
  );
  return (
    <p className="small muted" style={{ textAlign: "center" }} data-testid="beta-note">
      Remy is invite-only during the beta. Sign in with the email you applied with. Not in yet? <a className="auth-link" href={href} target="_blank" rel="noreferrer">Apply to be a beta tester</a>
    </p>
  );
}

function SignIn() {
  const { setSession, run, config, toast } = useStore();
  const [busy, setBusy] = useState<"" | Provider | "google">("");
  const [emailOpen, setEmailOpen] = useState(true); // open from the start: no extra tap to reach the email box (Nov 25)
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
    if (config?.beta?.on) return toast(`${via} sign-in isn't switched on yet. Use another option above.`, true); // no guest workspaces in the invite-only beta
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
  const magicTo = async (to: string) => {
    setBusy("Work/School Email");
    const ok = await run(() => (codes ? api("POST", "/api/auth/email/start", { email: to }) : sendMagicLink(config!, to)).then(() => true));
    if (ok) { setSent(to); setCode(""); toast(codes ? "Check your inbox for a 6-digit code" : "Check your inbox for a sign-in link"); }
    setBusy("");
  };
  const magic = () => magicTo(email.trim());
  const verify = async (c = code) => {
    setBusy("Work/School Email");
    const r = await run(() => api("POST", "/api/auth/email/verify", { email: sent, code: c }));
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  };
  const sso = (via: Provider, icon: ReactNode) => !(via === "Work/School Email" ? codes || providerOn(config, "email") : providerOn(config, SB[via])) ? null : (
    <button className="gbtn" type="button" onClick={() => enter(via)} disabled={!!busy} data-testid={`button-sso-${via.split(/\W/)[0].toLowerCase()}`}>
      {busy === via ? <Spinner /> : icon} Continue with {via === "Work/School Email" ? "Email" : via}
    </button>
  );
  const anyReal = gis || codes || ["google", "linkedin_oidc", "apple", "azure", "email"].some((p) => providerOn(config, p as SupabaseProvider));
  const ways = ["google", "linkedin_oidc", "apple", "azure"].filter((p) => providerOn(config, p as SupabaseProvider) || (p === "google" && gis)).length + (codes || providerOn(config, "email") ? 1 : 0);
  return (
    <div className="landing-screen auth-stage">
      <div className="lp-beam" aria-hidden><span className="lp-beam-floor" /></div>
      <aside className="auth-side" aria-label="What happens next">
        <span className="lp-award">{config?.beta?.on ? "Invite-only beta · looking for testers" : "Free during beta"}</span>
        <p className="auth-side-h" aria-hidden>Your career coach is one step away.</p>
        <ol className="auth-steps">
          <li><b>Sign in</b><span>{config?.beta?.on ? "With the email you applied with." : "New here? This creates your account."}</span></li>
          <li><b>Add your resume</b><span>Upload it, or Remy helps you build one.</span></li>
          <li><b>Get your plan</b><span>Openings you can get and what to do this week.</span></li>
        </ol>
      </aside>
      <div className="landing-card fade-up">
        <div className="row-between">{isNativeApp ? <span /> : <a className="btn btn-ghost auth-back" href="/"><ArrowLeft size={16} /> What Remy does</a>}<ThemeToggle /></div>
        <div className="landing">
          <Remy size={72} mood="wave" />
          <h1 className="motto">{sent && codes ? "Check your email" : "Get started with Remy"}</h1>
          <p className="sub">{sent && codes ? null : config?.beta?.on ? "Free during beta. Setup takes about 5 minutes." : "Free during beta. New or back, enter your email and Remy sends a 6-digit code."}</p>
        </div>
        <BetaNote onOther={() => { setSent(""); setEmail(""); setCode(""); }} />
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
          {!emailOpen && sso("Work/School Email", <MailMark />)}
          {emailOpen && (codes || providerOn(config, "email")) && (
            sent && codes ? (
              <form className="stack-sm fade-up" onSubmit={(e) => { e.preventDefault(); verify(); }} data-testid="email-code-form">
                <span className="small">{config?.beta?.on
                  ? <>If <strong>{sent}</strong> is on Remy's beta tester list, a 6-digit code is on its way (it expires in 10 minutes). Nothing after a few minutes? Check spam, then make sure it's the email you applied with, or <a className="auth-link" href={applyHref(config.beta.formUrl)} target="_blank" rel="noreferrer">apply here</a>.</>
                  : <>We sent a 6-digit code to <strong>{sent}</strong>. It expires in 10 minutes. Not there? Check spam or Promotions.</>}</span>
                <div className="row">
                  <input className="input" style={{ flex: 1, minWidth: 140, letterSpacing: 4 }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => { const c = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(c); if (c.length === 6 && !busy) void verify(c); /* signs in by itself at the 6th digit */ }} placeholder="123456" aria-label="6-digit code" data-testid="input-email-code" />
                  <button className="btn btn-primary auth-go" disabled={code.length !== 6 || !!busy} data-testid="button-verify-code">{busy === "Work/School Email" ? <Spinner /> : null} Sign in</button>
                </div>
                <div className="row" style={{ gap: 18 }}>
                  <button type="button" className="btn btn-ghost btn-sm auth-link" style={{ padding: 0 }} onClick={() => { void magicTo(sent); }} disabled={!!busy} data-testid="button-resend-code">Send a new code</button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => { setSent(""); setCode(""); }} data-testid="button-other-email">Use a different email</button>
                </div>
              </form>
            ) : sent ? (
              <div className="notice notice-good fade-up" data-testid="magic-link-sent"><Check size={16} /><div>We sent a sign-in link to <strong>{sent}</strong>. Open it on this device to continue.</div></div>
            ) : (
              <form className="row fade-up" onSubmit={(e) => { e.preventDefault(); magic(); }}>
                <input className="input" style={{ flex: 1, minWidth: 180 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" autoComplete="email" autoCapitalize="none" aria-label="Email address" data-testid="input-magic-email" />
                <button className="btn btn-primary auth-go" disabled={!/.+@.+\..+/.test(email) || !!busy} data-testid="button-send-magic">{busy === "Work/School Email" ? <Spinner /> : null} {codes ? "Send code" : "Send link"}</button>
              </form>
            )
          )}
          {/* Tester, Nov 25: "what's the difference between LinkedIn and Google?" None: they only sign you in. */}
          {ways > 1 && !sent && <p className="xs muted" style={{ textAlign: "center" }} data-testid="text-sso-same">They all work the same. Pick the account you use most.</p>}
          {!anyReal && <p className="small muted" style={{ textAlign: "center" }}><StatusChip label="Needs setup">Sign-in</StatusChip> No sign-in method is switched on for this server yet.</p>}
        </div>
        <div className="landing-foot">
          <p className="xs muted">Remy never asks for your passwords. <a className="auth-link" href="/policies">Privacy and terms</a></p>
        </div>
      </div>
    </div>
  );
}

const BROWSE = ["Finance", "Accounting", "Marketing", "Nursing", "Software & computer science", "Education & teaching", "Psychology & social work", "Engineering", "Journalism & communications", "Entrepreneurship"];
type Occ = { title: string; change: number; openings: number | null; wage: number | null; education: string };
export function FieldBrowser() {
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
