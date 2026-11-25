// Remy reads a line out loud in his own voice (Arthur, from the website's POST /api/voice), like "Hear it" on the site.
// Needs the expo-audio native module: builds from before Nov 25 don't have it, so the button doesn't show there.
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import { requireOptionalNativeModule } from "expo";
import Svg, { Path } from "react-native-svg";
import { API_BASE } from "@/lib/api";
import { font } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";
import { tap } from "@/components/ui";

export const canSpeak = () => Platform.OS === "web" || !!requireOptionalNativeModule("ExpoAudio");

type Player = { play(): void; pause(): void; remove(): void; addListener(e: string, f: (s: any) => void): { remove(): void } };
let current: { player: Player; done: () => void } | null = null;

export function hush() {
  const c = current; current = null;
  if (c) { try { c.player.pause(); c.player.remove(); } catch {} c.done(); }
}

/** Plain words: no markdown, bullets or links (the website's spoken()). */
export const spoken = (md: string) => md.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>]/g, "").replace(/^\s*[•-]\s*/gm, "").replace(/\s+/g, " ").trim();

/** Plays `text` as Remy. Calls done() when it ends or is stopped; throws a plain-words error if it can't play. */
export async function say(text: string, done: () => void) {
  hush();
  const r = await fetch(API_BASE + "/api/voice", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-Remy-App": "native" },
    body: JSON.stringify({ text: spoken(text) }),
  }).catch(() => null);
  if (!r?.ok) { let m = ""; try { m = (await r!.json())?.message; } catch {} throw new Error(m || "Remy's voice isn't available right now."); }
  const { createAudioPlayer, setAudioModeAsync } = require("expo-audio") as typeof import("expo-audio");
  let uri: string;
  if (Platform.OS === "web") uri = URL.createObjectURL(await r.blob());
  else {
    const { File, Paths } = require("expo-file-system") as typeof import("expo-file-system");
    const file = new File(Paths.cache, `remy-voice-${Date.now()}.mp3`);
    file.create();
    await file.write(new Uint8Array(await r.arrayBuffer()));
    uri = file.uri;
  }
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  const player = createAudioPlayer(uri) as unknown as Player;
  const me = { player, done };
  current = me;
  player.addListener("playbackStatusUpdate", (s) => { if (s?.didJustFinish && current === me) hush(); });
  player.play();
}

/** A small speaker button: tap to hear Remy say `text`, tap again to stop. */
export function HearIt({ text, testID = "button-hear-it" }: { text: string; testID?: string }) {
  const { c } = useTheme();
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [err, setErr] = useState("");
  const live = useRef(state); live.current = state;
  useEffect(() => () => { if (live.current !== "idle") hush(); }, []); // leaving the screen stops him
  if (!canSpeak() || !text.trim()) return null;
  const press = async () => {
    tap(); setErr("");
    if (state !== "idle") { hush(); setState("idle"); return; }
    setState("loading");
    try { await say(text, () => setState("idle")); setState("playing"); }
    catch (e: any) { setState("idle"); setErr(e?.message || "Remy's voice couldn't play."); }
  };
  const label = state === "playing" ? "Stop" : state === "loading" ? "Loading…" : "Hear it";
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={state === "playing" ? "Stop Remy reading" : "Hear Remy say this"} hitSlop={8} onPress={press}
      style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 4 }}>
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={c.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d={state === "playing" ? "M6 6h12v12H6z" : "M11 5 6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07 M19.07 4.93a10 10 0 0 1 0 14.14"} />
      </Svg>
      <Text style={{ fontFamily: font.semi, fontSize: 13, color: err ? c.error : c.mutedText }}>{err || label}</Text>
    </Pressable>
  );
}
