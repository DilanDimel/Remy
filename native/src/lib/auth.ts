/** Reads Supabase's answer from the return link: tokens come back after "#" (implicit flow), errors after "?" or "#". */
export function parseReturn(url: string): { token?: string; error?: string } {
  const q = new URLSearchParams([url.split("?")[1]?.split("#")[0], url.split("#")[1]].filter(Boolean).join("&"));
  const error = q.get("error_description") || q.get("error") || undefined;
  return { token: error ? undefined : q.get("access_token") || undefined, error };
}
