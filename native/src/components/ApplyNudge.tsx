import { useState } from "react";
import { View } from "react-native";
import type { CalItem, TrackItem, Workspace } from "@shared/types";
import { Button, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { api } from "@/lib/api";
import { go } from "@/lib/nav";
import { useCanGo, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

const DAY = 86_400_000;
const ago = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / DAY : 0);
const rid = (p: string) => p + Math.random().toString(36).slice(2, 10);

// Real meet-people events only (saved from an event opening, or named like one), the website's MEET.
const MEET = /fair|career|info(rmation)? session|network|meet ?up|mixer|conference|expo|panel|summit|recruit|coffee chat|open house|reception|alumni/i;

/** The website's ApplyNudge (client/src/components/ApplyNudge.tsx) on the app's Home, one question at a time: first
 *  "How did your interview go?" after an interview in the last week, then "Did you meet anyone?" after an event
 *  (only while Community is open for this person), then "Did you apply?" and "Follow up?". */
export function ApplyNudge() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const canMeet = useCanGo()("/community"); // people are saved on Community, locked for students until it's released
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!ws) return null;
  const today = new Date().toLocaleDateString("en-CA");
  const recent = (x: CalItem) => x.date < today && ago(x.date + "T12:00:00") <= 7 && !x.debriefed;
  const interview = ws.calendar.find((x) => x.kind === "Interview" && recent(x));
  if (interview) return <Debrief key={interview.id} c={interview} />;
  const event = canMeet && ws.calendar.find((x) => x.kind === "Event" && recent(x) && (!!x.linkedId || MEET.test(x.title)));
  if (event) return <MetAnyone key={event.id} c={event} />;
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

const card = (c: ReturnType<typeof useTheme>["c"]) => ({ marginTop: 14, backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: `${c.fox}59`, // light orange edge all round, no thick left bar (Dilan, Nov 27)
  padding: 14, gap: 10 }) as const;
const small = { height: 40, paddingHorizontal: 14 } as const;

/** After an interview: one tap first, and each answer does something (a thank-you to-do, a note for next time, or the
 *  new date if it moved). Notes are optional. The website's Debrief. */
function Debrief({ c: ev }: { c: CalItem }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const [how, setHow] = useState("");
  const [text, setText] = useState("");
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const w = ws!;
  const who = ev.title.replace(/^interview( with)?:?\s*/i, "");
  const day = new Date(ev.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const named = /interview/i.test(who);
  const source = `Interview debrief ${ev.id}`;
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(""); try { await f(); return true; } catch (e: any) { setErr(e.message); return false; } finally { setBusy(false); } };
  const pick = (k: string) => { tap(); setHow(k); if (ago(ev.date + "T12:00:00") <= 3 && !w.tasks.some((x) => x.source === source)) run(async () => {
    const t = { id: rid("t"), title: `Send a thank-you note for your ${named ? who.replace(/^(past|your|my)\s+/i, "") : `${who} interview`} (${day})`, why: "Two or three sentences within a day: thank them, mention one thing you discussed, restate your interest.", due: new Date().toLocaleDateString("en-CA"), category: "Connect" as const, done: false, source };
    setWs(await api<Workspace>("PUT", "/api/ws/tasks", { value: [t, ...w.tasks] })); setAdded(true);
  }); };
  // Kept in its own field, not the event notes: those sync to Google Calendar and the .ics export, and a debrief is private.
  const finish = (note: string) => run(async () => {
    const full = [how, note].filter(Boolean).join(". ");
    let next = await api<Workspace>("PUT", "/api/ws/calendar", { value: w.calendar.map((x) => (x.id === ev.id ? { ...x, debriefed: true, ...(full ? { debrief: full } : {}) } : x)) });
    const t = next.tracker.find((x) => x.id === ev.linkedId);
    if (t && full) next = await api<Workspace>("PUT", "/api/ws/tracker", { value: next.tracker.map((x) => (x.id === t.id ? { ...x, notes: [x.notes, `Debrief ${ev.date}: ${full}`].filter(Boolean).join("\n").slice(-3900) } : x)) });
    setWs(next); success();
  });
  const thanks = added ? " I added a thank-you note to your to-dos." : "";
  const reply: Record<string, string> = {
    "Went well": `Nice.${thanks} What did they ask? Writing it down makes your next one easier.`,
    "Okay": `Okay is normal.${thanks} Which question felt hardest? Write it down and we'll build a better answer.`,
    "Rough": `That happens to everyone.${thanks} Note the question that threw you, so it can't again.`,
  };
  return (
    <View testID="interview-debrief" style={card(c)}>
      <T kind="small"><T kind="small" style={{ color: c.ink, fontFamily: font.bold }}>{named ? `How did "${who}" go?` : `How did your interview with ${who} go?`}</T> ({day})</T>
      {!how ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {["Went well", "Okay", "Rough"].map((k) => <Button key={k} testID={`button-debrief-${k.toLowerCase().replace(/\s/g, "-")}`} kind="ghost" label={k} onPress={() => pick(k)} style={small} />)}
          <Button testID="button-debrief-moved" kind="ghost" label="It didn't happen" onPress={() => setHow("It didn't happen")} style={small} />
        </View>
      ) : how === "It didn't happen" ? <>
        <T kind="small">Was it moved? Paste the new email and Remy updates your calendar.</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button testID="button-debrief-paste" label="Paste the new email" busy={busy} onPress={async () => { if (await finish("It was moved")) go("/progress?tab=email", "Email updates"); }} style={small} />
          <Button testID="button-debrief-canceled" kind="ghost" label="It was canceled" onPress={() => finish("It was canceled")} style={small} />
        </View>
      </> : <>
        <T kind="small">{reply[how]}</T>
        <Input testID="input-debrief" value={text} onChangeText={setText} placeholder="Optional: what they asked, what you'd do differently" maxLength={1500} multiline style={{ minHeight: 72 }} />
        <Button testID="button-save-debrief" label={text.trim() ? "Save" : "Done"} busy={busy} onPress={() => finish(text.trim())} style={small} />
      </>}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    </View>
  );
}

/** After a career fair or info session: the people met there, saved while names are fresh (the website's MetAnyone). */
function MetAnyone({ c: ev }: { c: CalItem }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const [err, setErr] = useState("");
  const name = ev.title.replace(/:\s*event$/i, "");
  const done = async () => { tap(); setErr(""); try { setWs(await api<Workspace>("PUT", "/api/ws/calendar", { value: ws!.calendar.map((x) => (x.id === ev.id ? { ...x, debriefed: true } : x)) })); return true; } catch (e: any) { setErr(e.message); return false; } };
  return (
    <View testID="event-met" style={card(c)}>
      <T kind="small"><T kind="small" style={{ color: c.ink, fontFamily: font.bold }}>Did you meet anyone at {name}?</T> Save them now while you remember names; Remy helps you follow up.</T>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button testID="button-event-met-yes" label="Yes, add them" onPress={async () => { if (await done()) go(`/community?met=${encodeURIComponent(name)}&metOn=${ev.date}`, "Community"); }} style={small} />
        <Button testID="button-event-met-no" kind="ghost" label="No" onPress={done} style={small} />
      </View>
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    </View>
  );
}
