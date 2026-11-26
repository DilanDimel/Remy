/** Reads the sign-in answer from the return link: a PKCE code after "?", errors after "?" or "#". */
export function parseReturn(url: string): { code?: string; error?: string } {
  const q = new URLSearchParams([url.split("?")[1]?.split("#")[0], url.split("#")[1]].filter(Boolean).join("&"));
  const error = q.get("error_description") || q.get("error") || undefined;
  return { code: error ? undefined : q.get("code") || undefined, error };
}

/** PKCE secret: stays in the app, so another app that catches the remy:// return link can't use the code without it.
 *  shortcut: "plain" method (the verifier is only ever sent to Remy's server over HTTPS, in the browser sheet and the
 *  exchange); move to S256 if expo-crypto joins a native build. */
export function newVerifier(): string {
  const bytes = new Uint8Array(48);
  const c = (globalThis as any).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}
