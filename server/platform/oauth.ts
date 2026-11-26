// Remy's own Google and LinkedIn sign-in (OpenID Connect, code flow with the client secret on the server),
// so sign-in no longer goes through Supabase. The provider proves the email; the account is found by that email.
import crypto from "node:crypto";
import type { Me } from "@shared/types";

export type OAuthProvider = "google" | "linkedin";
type Spec = { authorize: string; token: string; userinfo: string; scope: string; id: () => string; secret: () => string };

const SPECS: Record<OAuthProvider, Spec> = {
  // The "Remy calendar" client in Google Cloud also signs people in (its redirect list has our callback).
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    id: () => process.env.GOOGLE_SIGNIN_CLIENT_ID || process.env.GCAL_CLIENT_ID || "",
    secret: () => process.env.GOOGLE_SIGNIN_CLIENT_SECRET || process.env.GCAL_CLIENT_SECRET || "",
  },
  linkedin: {
    authorize: "https://www.linkedin.com/oauth/v2/authorization",
    token: "https://www.linkedin.com/oauth/v2/accessToken",
    userinfo: "https://api.linkedin.com/v2/userinfo",
    scope: "openid profile email",
    id: () => process.env.LINKEDIN_CLIENT_ID || "",
    secret: () => process.env.LINKEDIN_CLIENT_SECRET || "",
  },
};

export const isProvider = (p: string): p is OAuthProvider => p === "google" || p === "linkedin";
export const oauthReady = (p: OAuthProvider) => !!(SPECS[p].id() && SPECS[p].secret());
/** Which buttons use Remy's own sign-in: set OWN_SIGNIN=google,linkedin once each is tested (keys match Supabase's). */
export function ownSignin(): { google: boolean; linkedin_oidc: boolean } {
  const on = (process.env.OWN_SIGNIN || "").split(",").map((s) => s.trim());
  return { google: on.includes("google") && oauthReady("google"), linkedin_oidc: on.includes("linkedin") && oauthReady("linkedin") };
}

export function authorizeUrl(p: OAuthProvider, redirect: string, state: string): string {
  const q = new URLSearchParams({ response_type: "code", client_id: SPECS[p].id(), redirect_uri: redirect, scope: SPECS[p].scope, state });
  if (p === "google") q.set("prompt", "select_account");
  return `${SPECS[p].authorize}?${q}`;
}

export type OAuthUser = { sub: string; email: string; name: string; picture: string };
/** Swaps the code for a token, then asks the provider who it is. Only a verified email is trusted. */
export async function finishOAuth(p: OAuthProvider, code: string, redirect: string): Promise<OAuthUser> {
  const s = SPECS[p];
  const t = await fetch(s.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id: s.id(), client_secret: s.secret() }),
    signal: AbortSignal.timeout(10_000),
  });
  const tok: any = await t.json().catch(() => ({}));
  if (!t.ok || !tok.access_token) throw Object.assign(new Error("Sign-in didn't finish. Please try again."), { status: 401 });
  const u = await fetch(s.userinfo, { headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(10_000) });
  const info: any = await u.json().catch(() => ({}));
  return userFrom(info);
}
export function userFrom(info: any): OAuthUser {
  // Both send email_verified (LinkedIn sometimes as the string "true"); an unverified address could be someone else's.
  const verified = info?.email_verified === true || info?.email_verified === "true";
  const email = String(info?.email || "").trim().toLowerCase();
  if (!info?.sub || !email || !verified) throw Object.assign(new Error("That account has no verified email, so Remy can't sign you in with it. Try email sign-in instead."), { status: 401 });
  return { sub: String(info.sub), email, name: String(info.name || [info.given_name, info.family_name].filter(Boolean).join(" ") || ""), picture: String(info.picture || "") };
}

// shortcut: in-memory, one server instance; a sign-in that spans a deploy just asks to try again. Move to the DB if Remy runs 2+ instances.
const TEN_MIN = 10 * 60_000;
type Pending = { p: OAuthProvider; exp: number; app?: { challenge: string; handoff: string } };
const pending = new Map<string, Pending>();
const tickets = new Map<string, { me: Me; challenge: string; exp: number }>();
const sweep = (now: number) => { for (const m of [pending, tickets] as Map<string, { exp: number }>[]) for (const [k, v] of m) if (v.exp < now) m.delete(k); };
const token = () => crypto.randomBytes(24).toString("base64url");

export function newState(p: OAuthProvider, app?: { challenge: string; handoff: string }, now = Date.now()): string {
  sweep(now);
  const s = token();
  pending.set(s, { p, exp: now + TEN_MIN, app });
  return s;
}
/** Once only: the provider's state must be one we made, for this provider, in the last 10 minutes. */
export function takeState(state: string, p: OAuthProvider, now = Date.now()): Pending | null {
  const v = pending.get(state);
  pending.delete(state);
  return v && v.p === p && v.exp >= now ? v : null;
}

/** The phone app gets a one-time code (through remy://auth) that only works with the secret it kept (PKCE, plain). */
export function newTicket(me: Me, challenge: string, now = Date.now()): string {
  sweep(now);
  const code = token();
  tickets.set(code, { me, challenge, exp: now + TEN_MIN });
  return code;
}
export function redeemTicket(code: string, verifier: string, now = Date.now()): Me | null {
  const t = tickets.get(code);
  if (!t) return null;
  tickets.delete(code);
  const a = Buffer.from(verifier), b = Buffer.from(t.challenge);
  return t.exp >= now && a.length === b.length && crypto.timingSafeEqual(a, b) ? t.me : null;
}
