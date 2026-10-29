import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { API_BASE, api, useStore } from "../lib/store";
import { Spinner } from "./common";

const RESULT: Record<string, [string, boolean]> = {
  connected: ["Google Calendar connected. Your Remy deadlines and events are in a calendar called “Remy”.", false],
  cancelled: ["Google Calendar wasn't connected.", true],
  failed: ["Google Calendar couldn't be connected. Please try again.", true],
  expired: ["That took too long. Please connect Google Calendar again.", true],
};

/** Connect / disconnect Remy's own "Remy" calendar in the student's Google account. */
export function useGoogleCalendar() {
  const { config, me, toast, run } = useStore();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const available = !!config?.googleCalendar;
  const signedIn = me?.kind === "google" || me?.kind === "supabase" || me?.kind === "local";
  useEffect(() => {
    if (!available || !me) return;
    api<{ connected: boolean }>("GET", "/api/calendar/google").then((r) => setConnected(r.connected), () => setConnected(false));
    // Coming back from Google's consent screen: say how it went, then tidy the address bar.
    const m = location.search.match(/[?&]gcal=(\w+)/);
    if (m && RESULT[m[1]]) {
      toast(...RESULT[m[1]]);
      history.replaceState(null, "", location.pathname + location.search.replace(/[?&]gcal=\w+/, "").replace(/^&/, "?").replace(/\?$/, ""));
    }
  }, [available, me?.id]);
  const connect = (back: "setup" | "calendar") => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
    location.href = `${API_BASE}/api/calendar/connect?back=${back}&tz=${encodeURIComponent(tz)}`;
  };
  const disconnect = async () => {
    if (!confirm("Disconnect Google Calendar? This deletes the “Remy” calendar from your Google Calendar.")) return;
    setBusy(true);
    const r = await run(() => api<{ removed: boolean }>("DELETE", "/api/calendar/google"));
    setBusy(false);
    if (!r) return;
    setConnected(false);
    toast(r.removed ? "Disconnected. The Remy calendar was deleted from your Google Calendar." : "Disconnected. Google wouldn't let Remy delete its calendar (access was already removed), so delete “Remy” in Google Calendar yourself.", !r.removed);
  };
  return { available, signedIn, connected, busy, connect, disconnect };
}

export function GoogleCalendarCard() {
  const g = useGoogleCalendar();
  if (!g.available) return null;
  return (
    <div className="conn-row" data-testid="gcal-card">
      <span className="conn-ico gcal" aria-hidden><b>31</b></span>
      <div className="grow">
        <b>Google Calendar</b>
        <span>{g.connected ? "Your Remy items appear in a calendar called “Remy”, updated automatically. Remy can't see your other calendars." : "Put your Remy deadlines and events in your own Google Calendar. Remy only manages its own “Remy” calendar and deletes it if you disconnect or delete your account."}</span>
      </div>
      {g.connected === null ? <Spinner />
        : g.connected ? <><span className="conn-badge done"><Check size={13} /> Connected</span><button className="btn btn-ghost btn-sm" onClick={g.disconnect} disabled={g.busy} data-testid="button-gcal-disconnect">{g.busy && <Spinner />} Disconnect</button></>
        : g.signedIn ? <button className="btn btn-secondary btn-sm" onClick={() => g.connect("calendar")} data-testid="button-gcal-connect">Connect</button>
        : <span className="conn-badge">Sign in to connect</span>}
    </div>
  );
}
