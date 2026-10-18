import { useEffect, useRef, useState } from "react";
import { Compass, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";
import { api, useStore } from "../lib/store";
import { Pip, Spinner, StatusChip } from "../components/common";

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

export default function Welcome() {
  const { setSession, run, config } = useStore();
  const [busy, setBusy] = useState<"" | "demo" | "google">("");
  const google = useGoogleButton(async (credential) => {
    setBusy("google");
    const r = await run(() => api("POST", "/api/auth/google", { credential }));
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  });
  const explore = async () => {
    setBusy("demo");
    const r = await run(() => api("POST", "/api/auth/guest"));
    if (r) setSession(r.me, r.workspace);
    setBusy("");
  };
  return (
    <div className="welcome">
      <section className="welcome-art">
        <span className="logo">offer<b>ready.</b></span>
        <div className="stack-lg">
          <Pip size={88} mood="wave" />
          <h1>Your story, ready for what's next.</h1>
          <p style={{ maxWidth: "44ch" }}>
            Offer Ready turns your real experience into a plan, the right openings, and truthful applications — then helps you follow through.
          </p>
          <div className="stack" style={{ maxWidth: 440 }}>
            {[
              [FileCheck2, "Tailored resumes and cover letters that never invent experience"],
              [Compass, "A personal path built from your background and goals"],
              [ShieldCheck, "You approve everything. Nothing is sent without you."],
            ].map(([Icon, t]: any) => (
              <div key={t} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                <Icon size={18} style={{ marginTop: 3 }} />
                <span style={{ color: "rgba(255,255,255,.9)" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="xs" style={{ color: "rgba(255,255,255,.6)" }}>Built for the TCU Neeley AI Forward case competition.</p>
      </section>
      <section className="welcome-form">
        <div className="welcome-box">
          <div className="stack-sm">
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}>Welcome</h2>
            <p className="muted small">Sign in to keep your workspace, or explore with a private demo workspace on this browser.</p>
          </div>

          <div className="stack-sm" data-testid="google-signin">
            {config?.googleClientId ? (
              <>
                <div ref={google.ref} style={{ minHeight: 44, display: "flex", justifyContent: "center" }} />
                {google.state === "loading" && <span className="xs muted row"><Spinner /> Loading Google sign-in…</span>}
                {google.state === "failed" && <span className="xs" style={{ color: "var(--error)" }}>Google sign-in couldn't load here. Use Explore demo instead.</span>}
                {busy === "google" && <span className="xs muted row"><Spinner /> Signing you in…</span>}
              </>
            ) : (
              <>
                <button className="btn btn-secondary btn-lg btn-block" disabled data-testid="button-google-disabled">
                  <GoogleG /> Continue with Google
                </button>
                <span className="row xs muted"><StatusChip label="Needs setup" /> Google sign-in isn't configured on this server yet.</span>
              </>
            )}
          </div>

          <div className="row" style={{ gap: 12 }}><div className="divider" style={{ flex: 1 }} /><span className="xs muted">or</span><div className="divider" style={{ flex: 1 }} /></div>

          <button className="btn btn-primary btn-lg btn-block" onClick={explore} disabled={!!busy} data-testid="button-explore-demo">
            {busy === "demo" ? <Spinner /> : <Sparkles size={18} />} Explore demo
          </button>
          <p className="xs muted">
            Explore demo creates a private workspace for this browser. Upload your own resume or try the sample student. You can sign in with Google later to keep it.
          </p>
          <div className="notice small">
            <ShieldCheck size={16} style={{ color: "var(--plum)", marginTop: 2 }} />
            <div>Offer Ready never asks for your passwords and doesn't log in to LinkedIn, Handshake or school systems for you. You choose what to upload or paste.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

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
