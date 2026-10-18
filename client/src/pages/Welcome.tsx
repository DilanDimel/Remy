import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, useStore } from "../lib/store";
import { Remy, Spinner, StatusChip } from "../components/common";

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

export default function Welcome() {
  const { setSession, run, config } = useStore();
  const [busy, setBusy] = useState<"" | Provider | "demo" | "google">("");
  const google = useGoogleButton(async (credential) => {
    setBusy("google");
    const r = await run(() => api("POST", "/api/auth/google", { credential }));
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  });
  // Only Google sign-in is real. The other buttons open the same private guest
  // workspace as Explore demo, and say so, rather than pretending to sign in.
  const enter = async (via: Provider | "demo") => {
    setBusy(via);
    const r = await run(
      () => api("POST", "/api/auth/guest"),
      via === "demo" ? undefined : `${via} sign-in isn't connected yet, so Remy opened a private guest workspace on this browser.`,
    );
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  };
  const sso = (via: Provider, icon: ReactNode) => (
    <button className="gbtn" type="button" onClick={() => enter(via)} disabled={!!busy} data-testid={`button-sso-${via.split(/\W/)[0].toLowerCase()}`}>
      {busy === via ? <Spinner /> : icon} Continue with {via}
    </button>
  );
  return (
    <div className="landing-screen">
      <div className="landing-card fade-up">
        <div className="landing">
          <Remy size={84} mood="wave" />
          <p className="landing-name">Remy</p>
          <h1 className="motto">Don&rsquo;t Hunt for a Job Alone</h1>
          <p className="sub">Your career companion for TCU students — connecting what you study and can demonstrate to your path, opportunities, and applications.</p>
        </div>
        <div className="sso-list">
          <div data-testid="google-signin">
            {config?.googleClientId && google.state !== "failed" ? (
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
        </div>
        <div className="landing-foot">
          <button className="btn btn-ghost btn-sm" onClick={() => enter("demo")} disabled={!!busy} data-testid="button-explore-demo">
            {busy === "demo" ? <Spinner /> : null} Or explore the demo without signing in
          </button>
          <p className="xs muted">
            {config?.googleClientId ? "Google sign-in keeps your workspace across devices. " : <><StatusChip label="Needs setup">Google sign-in</StatusChip>{" "}</>}
            The other options open a private guest workspace on this browser for now. Remy never asks for your passwords.
          </p>
        </div>
      </div>
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
