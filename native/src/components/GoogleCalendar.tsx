import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { parseReturn } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { useSession } from "@/lib/session";
import { handoffKey, openReturnSheet } from "@/lib/sheet";
import { useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

/** Connects Remy's own "Remy" calendar (or, with team, the owners' "Remy team" calendar) in Google's sign-in sheet,
 *  then finishes with this app's own signed-in call. Returns false when the person closed the sheet. */
export async function connectGoogleCalendar(team = false): Promise<boolean> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  const key = handoffKey();
  const { url } = await api<{ url: string }>("POST", "/api/calendar/app-start", { tz, team, handoff: key });
  const back = await openReturnSheet(url, key);
  if (!back) return false;
  const { code, error } = parseReturn(back);
  if (!code) throw new Error(error === "cancelled" ? "Google Calendar wasn't connected." : error === "expired" ? "That took too long. Please connect Google Calendar again." : "Google Calendar couldn't be connected. Please try again.");
  await api("POST", "/api/calendar/app-finish", { code });
  return true;
}

/** The website's GoogleCalendarCard, native: connect, or disconnect (which deletes the "Remy" calendar) after a yes. */
export function GoogleCalendarCard() {
  const { me } = useSession();
  const { config } = useConfig();
  const { c } = useTheme();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const available = !!config?.googleCalendar;
  const signedIn = me?.kind === "google" || me?.kind === "supabase" || me?.kind === "local";
  useEffect(() => {
    if (available && me) api<{ connected: boolean }>("GET", "/api/calendar/google").then((r) => setConnected(r.connected), () => setConnected(false));
  }, [available, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!available) return null;
  const run = async (f: () => Promise<void>) => { tap(); setBusy(true); setMsg(null); try { await f(); } catch (e: any) { setMsg({ text: e.message, bad: true }); } setBusy(false); };
  const connect = () => run(async () => {
    if (!(await connectGoogleCalendar())) return;
    setConnected(true); success();
    setMsg({ text: "Google Calendar connected. Your Remy deadlines and events are in a calendar called “Remy”." });
  });
  const disconnect = () => run(async () => {
    const r = await api<{ removed: boolean }>("DELETE", "/api/calendar/google");
    setConnected(false); setAsk(false); success();
    setMsg(r.removed ? { text: "Disconnected. The Remy calendar was deleted from your Google Calendar." } : { text: "Disconnected. Google wouldn't let Remy delete its calendar (access was already removed), so delete “Remy” in Google Calendar yourself.", bad: true });
  });
  return (
    <View testID="gcal-card" style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 }}>
      <T kind="small">{connected ? "Your Remy items appear in a calendar called “Remy”, updated automatically. Remy can't see your other calendars." : "Put your Remy deadlines and events in your own Google Calendar. Remy only manages its own “Remy” calendar and deletes it if you disconnect or delete your account."}</T>
      {connected === null ? null
        : connected ? (ask ? <>
            <T kind="small" style={{ color: c.ink }}>Disconnect Google Calendar? This deletes the “Remy” calendar from your Google Calendar.</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button testID="button-gcal-disconnect-confirm" label="Disconnect" busy={busy} onPress={disconnect} flex />
              <Button testID="button-gcal-disconnect-cancel" kind="ghost" label="Keep it" onPress={() => setAsk(false)} flex />
            </View>
          </> : <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <T kind="label" style={{ flex: 1, color: c.sage }}>Connected</T>
            <Button testID="button-gcal-disconnect" kind="ghost" label="Disconnect" onPress={() => { tap(); setAsk(true); }} />
          </View>)
        : signedIn ? <Button testID="button-gcal-connect" label="Connect Google Calendar" icon="book" busy={busy} onPress={connect} />
        : <T kind="small" style={{ color: c.mutedText }}>Sign in to connect.</T>}
      {msg ? <T kind="small" style={{ color: msg.bad ? c.error : c.ink }}>{msg.text}</T> : null}
    </View>
  );
}
