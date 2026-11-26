import type { AppConfig } from "@shared/types";

// Google sign-in runs on Remy's own server (server/platform/oauth.ts); email uses Remy's 6-digit codes. No Supabase.
export type SsoProvider = "google" | "linkedin_oidc" | "apple" | "azure";

export function providerOn(config: AppConfig | null, p: SsoProvider | "email") {
  return p !== "email" && !!(config?.ownSignin as Record<string, boolean> | undefined)?.[p];
}

/** Leaves the page for the provider's consent screen; the server signs in and comes back to "/". */
export function startOAuth(provider: SsoProvider) {
  location.href = `/api/auth/oauth/${provider === "google" ? "google" : "linkedin"}/start`;
}
