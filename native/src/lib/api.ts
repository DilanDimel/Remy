import { Platform } from "react-native";

/** The Remy server. Phones talk to the live site; the web preview (used for screenshots) can point at a local one. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === "web" ? "" : "https://remyai.org")).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

/** One call to the server. The sign-in cookie rides along on its own: the phone's networking keeps it like a browser. */
export async function api<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: `/api/${string}`, body?: unknown): Promise<T> {
  let r: Response;
  // A request that hangs (bad network, sleeping server) must not leave a screen loading forever.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    r = await fetch(API_BASE + path, {
      signal: ctl.signal,
      method,
      credentials: "include",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), "X-Remy-App": "native" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Remy can't reach the internet right now. Check your connection and try again.", 0);
  } finally { clearTimeout(timer); }
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!r.ok) throw new ApiError(data?.message || "Something went wrong. Please try again.", r.status, data?.code);
  return data as T;
}
