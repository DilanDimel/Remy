import { useState } from "react";
import { Check, Mail } from "lucide-react";
import type { Me, Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { Spinner } from "./common";

/** The school with the alumni list, as students write it on a resume or profile. */
export const atAlumniSchool = (w: Workspace) => /\bTCU\b|texas christian/i.test(w.profile.school);
/** A verified TCU student (@tcu.edu sign-in or code): only then do TCU-only tools (Stellic, TCU account) show, so a resume can't make them appear. */
export const atTcu = (me: Me | null) => !!schoolVerified(me, ["tcu.edu"]);

/** Verified = signed in with a school address, or proved one with a code. */
export function schoolVerified(me: Me | null, domains: string[]) {
  if (!me) return "";
  if (me.schoolEmail) return me.schoolEmail;
  return domains.some((d) => me.email.toLowerCase().endsWith("@" + d)) ? me.email : "";
}

/** "Verify your TCU email to see TCU alumni": email → 6-digit code → verified. Optional everywhere it's shown. */
export function SchoolVerify({ onSkip }: { onSkip?: () => void }) {
  const { me, ws, config, run, setSession } = useStore();
  const domains = config?.schoolEmail.domains || ["tcu.edu"];
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const verified = schoolVerified(me, domains);
  const signedIn = me?.kind === "google" || me?.kind === "supabase" || me?.kind === "local";
  const call = async (fn: () => Promise<{ me?: Me; sent?: boolean; email?: string }>, ok?: string) => {
    setBusy(true);
    const r = await run(fn, ok);
    setBusy(false);
    if (r?.me) setSession(r.me, ws);
    return r;
  };

  if (verified) {
    return (
      <div className="conn-row" data-testid="school-verified">
        <span className="conn-ico" aria-hidden><Check size={18} /></span>
        <div className="grow"><b>Verified student</b><span>{verified}</span></div>
        {me?.schoolEmail && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => call(() => api("DELETE", "/api/school-email"), "School email removed")} data-testid="button-remove-school-email">Remove</button>}
      </div>
    );
  }
  return (
    <div className="card card-pad stack-sm" data-testid="school-verify">
      <b className="row"><Mail size={16} /> Verify your school email <span className="muted xs">(optional)</span></b>
      {!config?.schoolEmail.ready ? (
        <p className="small muted">Verifying your school email is coming soon. Everything else in Remy works without it.</p>
      ) : !signedIn ? (
        <p className="small muted">Sign in first, so the verification stays with your account.</p>
      ) : !sentTo ? (
        <>
          <p className="small muted">Remy emails a 6-digit code to your {domains.map((d) => "@" + d).join(" or ")} address. Verifying unlocks your school's tools and alumni. Remy supports {domains.join(", ")} for now; more schools are coming.</p>
          <div className="row">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${domains[0]}`} aria-label="School email" data-testid="input-school-email" />
            <button className="btn btn-primary btn-sm" disabled={busy || !email.includes("@")} onClick={async () => { const r = await call(() => api("POST", "/api/school-email/start", { email })); if (r?.sent) setSentTo(r.email || email); }} data-testid="button-send-school-code">{busy && <Spinner />} Send code</button>
          </div>
        </>
      ) : (
        <>
          <p className="small muted">We sent a code to <b>{sentTo}</b>. It expires in 10 minutes.</p>
          <div className="row">
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" aria-label="Verification code" data-testid="input-school-code" />
            <button className="btn btn-primary btn-sm" disabled={busy || code.length !== 6} onClick={() => call(() => api("POST", "/api/school-email/verify", { code }), "You're verified")} data-testid="button-verify-school-code">{busy && <Spinner />} Verify</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setSentTo(""); setCode(""); }}>Use a different email</button>
          </div>
        </>
      )}
      {onSkip && <div><button className="btn btn-ghost btn-sm" onClick={onSkip} data-testid="button-skip-school-verify">Skip for now</button></div>}
    </div>
  );
}
