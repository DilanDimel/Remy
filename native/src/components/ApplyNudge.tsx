import { useState } from "react";
import { View } from "react-native";
import type { TrackItem, Workspace } from "@shared/types";
import { Button, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

const DAY = 86_400_000;
const ago = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / DAY : 0);
const rid = (p: string) => p + Math.random().toString(36).slice(2, 10);

/** The website's ApplyNudge (client/src/components/ApplyNudge.tsx) on the app's Home, one question at a time:
 *  "Did you apply?" 2+ days after approving a tailored resume, and "Follow up?" after 2+ weeks with no news.
 *  shortcut: the website also asks for an interview debrief and who you met at an event first; those stay web-only for now. */
export function ApplyNudge() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!ws) return null;
  const approvedAt = (t: TrackItem) => ws.applications.find((a) => a.id === t.applicationId)?.versions.at(-1)?.at;
  const ask = ws.tracker.find((t) => t.status === "Saved" && t.applicationId && ago(approvedAt(t)) >= 2 && !(t.askedAt && ago(t.askedAt) < 5));
  const lastEvent = (t: TrackItem) => t.events.reduce((m, e) => (e.at > m ? e.at : m), "");
  const quiet = !ask && ws.tracker.find((t) => (t.status === "Applied" || t.status === "Heard back") && !t.followUp && ago(lastEvent(t)) >= 14);
  const item = ask || quiet;
  if (!item) return null;
  const name = item.role ? `${item.role} at ${item.company}` : item.company;
  const update = async (patch: Partial<TrackItem>, task?: { title: string; why: string }) => {
    tap(); setBusy(true); setErr("");
    try {
      let w = await api<Workspace>("PUT", "/api/ws/tracker", { value: ws.tracker.map((t) => (t.id === item.id ? { ...t, ...patch } : t)) });
      if (task) w = await api<Workspace>("PUT", "/api/ws/tasks", { value: [{ id: rid("t"), ...task, due: "", category: "Connect", done: false, source: "Follow-up (Home)" }, ...w.tasks] });
      setWs(w); success();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <View testID="apply-nudge" style={{ marginTop: 14, backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 }}>
      {ask ? <>
        <T kind="small"><T kind="small" style={{ color: c.ink, fontFamily: font.bold }}>Did you apply for {name}?</T> You approved your tailored resume {Math.floor(ago(approvedAt(item)))} days ago.</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button testID="button-nudge-applied" label="Yes, I applied" busy={busy} onPress={() => update({ status: "Applied", events: [...item.events, { id: rid("ev"), at: new Date().toISOString(), status: "Applied", source: "Manual (asked on Home)" }] })} style={{ height: 40, paddingHorizontal: 14 }} />
          <Button testID="button-nudge-later" kind="ghost" label="Not yet" onPress={() => update({ askedAt: new Date().toISOString() })} style={{ height: 40, paddingHorizontal: 14 }} />
        </View>
      </> : <>
        <T kind="small"><T kind="small" style={{ color: c.ink, fontFamily: font.bold }}>No news from {name} in {Math.floor(ago(lastEvent(item)))} days.</T> A short, polite follow-up to the recruiter or a contact there is normal after about two weeks.</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button testID="button-nudge-followup" label="Add a follow-up to-do" busy={busy} onPress={() => update({ followUp: "added" }, { title: `Send a short follow-up about ${name}`, why: "Two weeks without news: a two-line note restating your interest is normal and often gets a reply." })} style={{ height: 40, paddingHorizontal: 14 }} />
          <Button testID="button-nudge-dismiss" kind="ghost" label="Not needed" onPress={() => update({ followUp: "dismissed" })} style={{ height: 40, paddingHorizontal: 14 }} />
        </View>
      </>}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    </View>
  );
}
