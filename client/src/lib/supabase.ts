import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "@shared/types";

// Supabase Auth handles the OAuth hop (Google, LinkedIn, Apple, Microsoft) and
// email magic links. Supabase's session is only used once: its access token is
// handed to our server, which verifies it and starts Remy's own cookie session.

export type SupabaseProvider = "google" | "linkedin_oidc" | "apple" | "azure";
type Intent = "signin" | "connect-linkedin";
const INTENT_KEY = "remy-auth-intent";

let client: SupabaseClient | null = null;
function sb(cfg: NonNullable<AppConfig["supabase"]>) {
  client ||= createClient(cfg.url, cfg.anonKey, { auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true } });
  return client;
}

const returnUrl = () => `${location.origin}/`;

export function providerOn(config: AppConfig | null, p: SupabaseProvider | "email") {
  return !!config?.supabase?.providers[p];
}

/** Leaves the page for the provider's consent screen; comes back to returnUrl(). */
export async function startOAuth(config: AppConfig, provider: SupabaseProvider, intent: Intent = "signin") {
  try { localStorage.setItem(INTENT_KEY, intent); } catch {}
  const { error } = await sb(config.supabase!).auth.signInWithOAuth({
    provider,
    options: { redirectTo: returnUrl(), scopes: provider === "azure" ? "email" : undefined },
  });
  if (error) throw error;
}

export async function sendMagicLink(config: AppConfig, email: string) {
  try { localStorage.setItem(INTENT_KEY, "signin"); } catch {}
  const { error } = await sb(config.supabase!).auth.signInWithOtp({ email, options: { emailRedirectTo: returnUrl() } });
  if (error) throw error;
}

/** Called on page load. If we just came back from Supabase (?code=… or ?error=…),
 * finishes the exchange and returns the access token plus what it was for. */
export async function finishSupabaseRedirect(config: AppConfig | null): Promise<{ intent: Intent; accessToken: string } | null> {
  const q = new URLSearchParams(location.search);
  const code = q.get("code");
  const err = q.get("error_description") || q.get("error");
  if (!code && !err) return null;
  const clean = () => history.replaceState(null, "", `${location.pathname}${location.hash || "#/"}`);
  let intent: Intent = "signin";
  try { intent = (localStorage.getItem(INTENT_KEY) as Intent) || "signin"; localStorage.removeItem(INTENT_KEY); } catch {}
  if (err || !config?.supabase) {
    clean();
    throw new Error(err ? `Sign-in didn't finish: ${err}` : "Sign-in isn't configured on this server.");
  }
  try {
    const { data, error } = await sb(config.supabase).auth.exchangeCodeForSession(code!);
    if (error || !data.session) throw error || new Error("Sign-in didn't return a session.");
    const accessToken = data.session.access_token;
    // Remy keeps its own session from here; drop the local Supabase copy.
    await sb(config.supabase).auth.signOut({ scope: "local" }).catch(() => {});
    return { intent, accessToken };
  } finally {
    clean();
  }
}
