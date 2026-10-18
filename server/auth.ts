import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import type { Me } from "@shared/types";
import { createSession, deleteSession, ensureUser, getUser, sessionUser, sha, uid } from "./db";

export const COOKIE = "__Host-or_sid";

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function setSessionCookie(res: Response, token: string, expires: number) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; Secure; HttpOnly; SameSite=Lax; Expires=${new Date(expires).toUTCString()}`,
  );
}
export function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function isLocal(req: Request) {
  const host = (req.headers.host || "").split(":")[0];
  return process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(host);
}

/** Resolve the caller. Session cookie first (Google or guest), then the
 * preview host's per-browser X-Visitor-Id header, then local test identities. */
export function identify(req: Request): Me | null {
  const token = readCookie(req, COOKIE);
  if (token) {
    const id = sessionUser(token);
    const u = id ? getUser(id) : null;
    if (u) return u;
  }
  // The preview host injects X-Visitor-Id; published sites use the session cookie only.
  const v = process.env.NODE_ENV !== "production" || process.env.OR_TRUST_VISITOR_HEADER === "1" ? req.header("x-visitor-id") : undefined;
  if (v) {
    const me: Me = { id: "v:" + sha(v).slice(0, 32), kind: "visitor", email: "", name: "", picture: "" };
    ensureUser(me);
    return me;
  }
  const t = req.header("x-or-test-user");
  if (t && isLocal(req)) {
    const me: Me = { id: "local:" + t.slice(0, 40), kind: "local", email: "", name: "", picture: "" };
    ensureUser(me);
    return me;
  }
  return null;
}

export function newGuest(res: Response): Me {
  const me: Me = { id: uid("guest:"), kind: "guest", email: "", name: "", picture: "" };
  ensureUser(me);
  const s = createSession(me.id);
  setSessionCookie(res, s.token, s.expires);
  return me;
}

let gclient: OAuth2Client | null = null;
export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || null;
}
export async function verifyGoogle(credential: string): Promise<Me> {
  const cid = googleClientId();
  if (!cid) throw Object.assign(new Error("Google sign-in is not configured on this server (Needs setup)."), { status: 503 });
  gclient ||= new OAuth2Client(cid);
  const ticket = await gclient.verifyIdToken({ idToken: credential, audience: cid });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email_verified) throw Object.assign(new Error("Google could not verify this account."), { status: 401 });
  const me: Me = { id: "g:" + p.sub, kind: "google", email: p.email || "", name: p.name || "", picture: p.picture || "" };
  ensureUser(me);
  return me;
}

export function startSession(res: Response, userId: string) {
  const s = createSession(userId);
  setSessionCookie(res, s.token, s.expires);
}
export function endSession(req: Request, res: Response) {
  const token = readCookie(req, COOKIE);
  if (token) deleteSession(token);
  clearSessionCookie(res);
}

// ---------- Supabase Auth ----------
// The browser does the OAuth / magic-link hop with Supabase and sends us the
// resulting access token; we ask Supabase who it belongs to before trusting it.
export function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  return url && anonKey ? { url, anonKey } : null;
}
let providerCache: { at: number; providers: Record<string, boolean> } | null = null;
export async function supabaseProviders(): Promise<Record<string, boolean>> {
  const cfg = supabaseConfig();
  if (!cfg) return {};
  if (providerCache && Date.now() - providerCache.at < 5 * 60_000) return providerCache.providers;
  try {
    const r = await fetch(`${cfg.url}/auth/v1/settings`, { headers: { apikey: cfg.anonKey }, signal: AbortSignal.timeout(4000) });
    const j: any = await r.json();
    const ext = j?.external || {};
    const providers = { google: !!ext.google, linkedin_oidc: !!ext.linkedin_oidc, apple: !!ext.apple, azure: !!ext.azure, email: !!ext.email && !j?.disable_signup };
    providerCache = { at: Date.now(), providers };
    return providers;
  } catch {
    return providerCache?.providers || {};
  }
}
export type SupabaseUser = { id: string; email: string; name: string; picture: string; provider: string };
export async function verifySupabase(accessToken: string): Promise<SupabaseUser> {
  const cfg = supabaseConfig();
  if (!cfg) throw Object.assign(new Error("Sign-in isn't configured on this server (Needs setup)."), { status: 503 });
  if (!accessToken) throw Object.assign(new Error("Missing sign-in token."), { status: 400 });
  const r = await fetch(`${cfg.url}/auth/v1/user`, { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Object.assign(new Error("Supabase couldn't verify this sign-in. Please try again."), { status: 401 });
  const u: any = await r.json();
  const meta = u.user_metadata || {};
  return {
    id: String(u.id),
    email: String(u.email || meta.email || ""),
    name: String(meta.full_name || meta.name || [meta.given_name, meta.family_name].filter(Boolean).join(" ") || ""),
    picture: String(meta.avatar_url || meta.picture || ""),
    provider: String(u.app_metadata?.provider || ""),
  };
}
