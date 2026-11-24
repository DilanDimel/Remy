import { Platform } from "react-native";
import { fetch as streamFetch } from "expo/fetch";

/** The Remy server. Phones talk to the live site; the web preview (used for screenshots) can point at a local one. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === "web" ? "" : "https://remyai.org")).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

/** One call to the server. The sign-in cookie rides along on its own: the phone's networking keeps it like a browser. */
export async function api<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: `/api/${string}`, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API_BASE + path, {
      method,
      credentials: "include",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), "X-Remy-App": "native" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Remy can't reach the internet right now. Check your connection and try again.", 0);
  }
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!r.ok) throw new ApiError(data?.message || "Something went wrong. Please try again.", r.status, data?.code);
  return data as T;
}

/** Send a chat message and show Remy's reply as it is written (owners' server streams `{"reply": text so far}` lines,
 * then `{"ws": …}`). `onReply` gets the whole reply so far each time. Falls back to the plain call when this phone's
 * streaming request isn't signed in, and accepts a plain JSON answer (the server sends one when nothing streamed). */
export async function streamChat<T>(body: unknown, onReply: (soFar: string) => void): Promise<T> {
  let r: Awaited<ReturnType<typeof streamFetch>>;
  try {
    r = await streamFetch(API_BASE + "/api/ai/chat?stream=1", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "text/event-stream, application/json", "Content-Type": "application/json", "X-Remy-App": "native" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Remy can't reach the internet right now. Check your connection and try again.", 0);
  }
  if (r.status === 401) return api<T>("POST", "/api/ai/chat", body);
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !/event-stream|ndjson/.test(type) || !r.body) {
    const text = await r.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!r.ok) throw new ApiError(data?.message || "Something went wrong. Please try again.", r.status, data?.code);
    return data as T;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let done: T | undefined;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: !end });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let d: any;
      try { d = JSON.parse(line); } catch { continue; }
      if (d.error) throw new ApiError(String(d.error), 502);
      if (d.ws) done = d.ws as T;
      else if (typeof d.reply === "string") onReply(d.reply);
    }
    if (end) break;
  }
  if (!done) throw new ApiError("Remy's reply was cut off. Please try again.", 502);
  return done;
}

/** A file upload as a form (`file` field plus extra fields), the way the website sends resumes and screenshots. */
export async function apiForm<T>(path: `/api/${string}`, file: { uri: string; name: string; type: string }, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for a file on the phone; the web preview needs a real Blob.
  if (Platform.OS === "web") form.append("file", await (await fetch(file.uri)).blob(), file.name);
  else form.append("file", file as any);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  let r: Response;
  try {
    r = await fetch(API_BASE + path, { method: "POST", credentials: "include", headers: { Accept: "application/json", "X-Remy-App": "native" }, body: form });
  } catch {
    throw new ApiError("Remy can't reach the internet right now. Check your connection and try again.", 0);
  }
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!r.ok) throw new ApiError(data?.message || "That upload didn't come through. Please try again.", r.status, data?.code);
  return data as T;
}
