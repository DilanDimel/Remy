// Remy's speaking voice (Nov 25, Dilan picked "Arthur" from ElevenLabs demos over the browser's robotic default).
// Each line is made once, then kept: in memory, and sealed in R2 (./platform/r2.ts) so a deploy doesn't pay again.
// Not configured (no ELEVENLABS_API_KEY) or ElevenLabs fails → null, and Remy stays quiet (no robot browser voice).
import crypto from "node:crypto";
import { r2Get, r2Put } from "../platform/r2";

export const VOICE_ID = "3LPKEa2TICTsITcoxL7H"; // Arthur, Conversational American (ElevenLabs library)
const MODEL = "eleven_v4_turbo"; // the v4 voice Dilan picked, in its real-time version
export const MAX_CHARS = 1000;

export const voiceReady = () => !!process.env.ELEVENLABS_API_KEY;

/** The words to say: trimmed, and long replies cut at the last sentence end before MAX_CHARS. */
export function forSpeech(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_CHARS) return t;
  const cut = t.slice(0, MAX_CHARS);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > MAX_CHARS / 2 ? cut.slice(0, end + 1) : cut;
}

// shortcut: memory keeps the last 300 lines per server; R2 keeps every line for good. Add an R2 lifecycle rule if it grows.
const mem = new Map<string, Buffer>();
const keyOf = (text: string) => `voice/${VOICE_ID}/${MODEL}/${crypto.createHash("sha256").update(text).digest("hex")}`;

/** MP3 bytes of Remy saying `text`, plus whether it was already made (cached lines cost nothing). Null when unavailable. */
export async function speech(text: string, f: typeof fetch = fetch): Promise<{ mp3: Buffer; cached: boolean } | null> {
  const key = keyOf(text);
  const hit = mem.get(key) ?? (await r2Get(key).then((v) => (typeof v?.mp3 === "string" ? Buffer.from(v.mp3, "base64") : null)));
  if (hit) { remember(key, hit); return { mp3: hit, cached: true }; }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await f(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) { console.warn("voice: ElevenLabs", r.status, (await r.text()).slice(0, 200)); return null; }
    const mp3 = Buffer.from(await r.arrayBuffer());
    remember(key, mp3);
    r2Put(key, { mp3: mp3.toString("base64") });
    return { mp3, cached: false };
  } catch (e: any) {
    console.warn("voice: ElevenLabs failed:", e?.message);
    return null;
  }
}

function remember(key: string, mp3: Buffer) {
  mem.delete(key);
  mem.set(key, mp3);
  if (mem.size > 300) mem.delete(mem.keys().next().value!);
}
