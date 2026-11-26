import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Loading, Sect, Segmented, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { connectGoogleCalendar } from "@/components/GoogleCalendar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Owners' Board & calendar, native (the website's Admin → Board & calendar, client/src/pages/Admin.tsx TeamTab): the team's
// to-dos by column with move/delete and Add, and the team's meetings with who's going, RSVP, Add and delete.
// Same /api/admin calls. The website drags cards; here each card has Back/Next buttons.
type Status = "todo" | "doing" | "done";
type Answer = "yes" | "maybe" | "no";
type Task = { id: string; title: string; assignee: string; due: string; notes: string; status: Status; done_by: string; done_at: string | null };
type Event = { id: string; title: string; date: string; time: string; who: string; created_by: string; assignees: string; rsvps: Record<string, Answer> };
type Member = { email: string; name: string };
type Team = { me: string; members: Member[]; tasks: Task[]; events: Event[]; calendar: { available: boolean; connectedBy: string } };
const COLS: [Status, string][] = [["todo", "To do"], ["doing", "In progress"], ["done", "Done"]];
const ANSWERS: [Answer, string][] = [["yes", "Going"], ["maybe", "Maybe"], ["no", "Can't go"]];
const list = (s: string | string[]) => ([] as string[]).concat(s).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const day = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const HISTORY_AFTER = 3 * 864e5;

export default function AdminTeam() {
  const { me } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Team | null>(null);
  const [col, setCol] = useState<Status>("todo");
  const [task, setTask] = useState({ title: "", assignee: [] as string[], due: "" });
  const [ev, setEv] = useState({ title: "", date: "", time: "", who: "", assignees: [] as string[] });
  const [adding, setAdding] = useState(false);
  const [askCal, setAskCal] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api<Team>("GET", "/api/admin/team").then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  if (!me?.owner) return null;
  if (!d) return err ? <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}><T style={{ color: c.error }}>{err}</T></View> : <Loading />;
  const send = async (key: string, method: "POST" | "DELETE", path: string, body?: unknown) => {
    tap(); setBusy(key); setErr("");
    try { setD(await api<Team>(method, path as `/api/${string}`, body)); success(); setBusy(""); return true; } catch (e: any) { setErr(e.message); setBusy(""); return false; }
  };
  const first = (email: string) => (d.members.find((m) => m.email === email)?.name || email.split("@")[0]).split(" ")[0];
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 } as const;
  const t0 = today();
  const old = (t: Task) => t.status === "done" && !!t.done_at && Date.now() - new Date(t.done_at).getTime() > HISTORY_AFTER;
  const shown = d.tasks.filter((t) => t.status === col && !old(t));
  const open = d.tasks.filter((t) => t.status !== "done");
  const upcoming = d.events.filter((e) => e.date >= t0);
  const dateOk = (s: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
  const People = ({ value, onChange, testID }: { value: string[]; onChange: (v: string[]) => void; testID: string }) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{d.members.map((m) => { const on = value.includes(m.email); return (
      <Pressable key={m.email} testID={testID} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(on ? value.filter((x) => x !== m.email) : [...value, m.email]); }}
        style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: "center", borderWidth: 1, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface }}>
        <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: on ? c.onInk : c.ink }}>{m.name.split(" ")[0]}</Text></Pressable>); })}</View>
  );

  return (
    <ScrollView testID="admin-team" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
      <T kind="muted"><Text style={{ fontFamily: font.bold, color: c.ink }}>{open.length} to-do{open.length === 1 ? "" : "s"} open.</Text>{upcoming[0] ? ` Next meeting: ${upcoming[0].title}, ${day(upcoming[0].date)}.` : " No meetings coming up."}</T>
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}

      <Sect title="Board" />
      <View style={card}>
        <Input testID="input-task-title" value={task.title} onChangeText={(v) => setTask({ ...task, title: v })} placeholder="Add a to-do for the team…" />
        {!!task.title.trim() && <>
          <People testID="chip-task-person" value={task.assignee} onChange={(v) => setTask({ ...task, assignee: v })} />
          <Input testID="input-task-due" value={task.due} onChangeText={(v) => setTask({ ...task, due: v })} placeholder="Due date, YYYY-MM-DD (optional)" maxLength={10} keyboardType="numbers-and-punctuation" />
        </>}
        <Button testID="button-add-task" label="Add" icon="plus" busy={busy === "add"} disabled={!task.title.trim() || !dateOk(task.due)} onPress={async () => { if (await send("add", "POST", "/api/admin/tasks", task)) setTask({ title: "", assignee: [], due: "" }); }} />
      </View>
      <Segmented testID="board-column" value={col} onChange={(v) => { tap(); setCol(v); }} options={COLS.map(([k, l]) => ({ key: k, label: `${l} ${d.tasks.filter((t) => t.status === k && !old(t)).length}` }))} />
      {shown.map((t) => {
        const i = COLS.findIndex(([s]) => s === t.status);
        const late = t.due && t.status !== "done" && t.due < t0;
        const move = (s: Status) => send("m" + t.id, "POST", "/api/admin/tasks", { id: t.id, status: s });
        return (
          <View key={t.id} testID="team-task" style={card}>
            <T style={{ fontFamily: font.semi }}>{t.title}</T>
            {!!t.notes && <T kind="small">{t.notes}</T>}
            <T kind="small">{list(t.assignee).map(first).join(", ") || "Anyone"}{t.due ? ` · ${late ? "Late, " : "Due "}${day(t.due)}` : ""}{t.status === "done" && t.done_by ? ` · done by ${first(t.done_by)}` : ""}</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {i > 0 && <Button testID="button-task-back" kind="ghost" label={`← ${COLS[i - 1][1]}`} onPress={() => move(COLS[i - 1][0])} style={{ height: 38, paddingHorizontal: 12 }} />}
              {i < 2 && <Button testID="button-task-next" kind={i === 1 ? "ink" : "ghost"} label={`${COLS[i + 1][1]} →`} busy={busy === "m" + t.id} onPress={() => move(COLS[i + 1][0])} style={{ height: 38, paddingHorizontal: 12 }} />}
              <Pressable testID="button-task-delete" accessibilityRole="button" accessibilityLabel={`Delete ${t.title}`} onPress={() => send("d" + t.id, "DELETE", `/api/admin/tasks/${t.id}`)} style={{ marginLeft: "auto", justifyContent: "center", padding: 6 }}><T kind="small">Delete</T></Pressable>
            </View>
          </View>
        );
      })}
      {!shown.length && <T kind="small" style={{ textAlign: "center" }}>{col === "done" ? "Finished to-dos land here." : "Nothing here."}</T>}

      <Sect title="Meetings" />
      {upcoming.map((e) => {
        const count = (a: Answer) => Object.values(e.rsvps).filter((x) => x === a).length;
        const waiting = d.members.filter((m) => !e.rsvps[m.email]).length;
        return (
          <View key={e.id} testID="team-meeting" style={card}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ alignItems: "center", width: 48 }}><Text style={{ fontFamily: font.bold, fontSize: 15, color: c.fox }}>{day(e.date)}</Text><T kind="small">{e.time}</T></View>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontFamily: font.semi }}>{e.title}</T>
                <T kind="small">{[e.who && `With ${e.who}`, list(e.assignees).length ? list(e.assignees).map(first).join(", ") : "", `added by ${first(e.created_by)}`].filter(Boolean).join(" · ")}</T>
                <T kind="small" style={{ color: c.ink }}>{count("yes")} going{count("maybe") ? `, ${count("maybe")} maybe` : ""}{count("no") ? `, ${count("no")} can't go` : ""}{waiting ? `, ${waiting} haven't answered` : ""}</T>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>{ANSWERS.map(([a, l]) => { const on = e.rsvps[d.me] === a; return (
              <Pressable key={a} testID={`rsvp-${a}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => send("r" + e.id, "POST", `/api/admin/events/${e.id}/rsvp`, { answer: on ? "" : a })}
                style={{ flex: 1, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface }}>
                <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: on ? c.onInk : c.ink }}>{l}</Text></Pressable>); })}</View>
            <Pressable testID="button-meeting-delete" accessibilityRole="button" onPress={() => send("x" + e.id, "DELETE", `/api/admin/events/${e.id}`)} style={{ alignSelf: "flex-end", padding: 4 }}><T kind="small">Delete</T></Pressable>
          </View>
        );
      })}
      {!upcoming.length && <T kind="small">Nothing scheduled. Add a meeting with a professor, the career center or the team, and everyone can say if they're going.</T>}
      {adding ? (
        <View testID="meeting-form" style={card}>
          <Input testID="input-meeting-title" label="Meeting" value={ev.title} onChangeText={(v) => setEv({ ...ev, title: v })} placeholder="e.g. Career Center partnership" />
          <Input testID="input-meeting-who" label="With whom (outside the team)" value={ev.who} onChangeText={(v) => setEv({ ...ev, who: v })} />
          <T kind="small">Teammates</T>
          <People testID="chip-meeting-person" value={ev.assignees} onChange={(v) => setEv({ ...ev, assignees: v })} />
          <Input testID="input-meeting-date" label="Date (YYYY-MM-DD)" value={ev.date} onChangeText={(v) => setEv({ ...ev, date: v })} maxLength={10} keyboardType="numbers-and-punctuation" />
          <Input testID="input-meeting-time" label="Time (optional, e.g. 14:30)" value={ev.time} onChangeText={(v) => setEv({ ...ev, time: v })} maxLength={5} keyboardType="numbers-and-punctuation" />
          <Button testID="button-add-meeting" label="Add meeting" busy={busy === "ev"} disabled={!ev.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)} onPress={async () => { if (await send("ev", "POST", "/api/admin/events", ev)) { setEv({ title: "", date: "", time: "", who: "", assignees: [] }); setAdding(false); } }} flex />
          <Button testID="button-cancel-meeting" kind="ghost" label="Cancel" onPress={() => setAdding(false)} flex />
        </View>
      ) : <Button testID="button-open-meeting" kind="ghost" label="Add a meeting" icon="plus" onPress={() => { tap(); setAdding(true); }} flex />}
      {d.calendar.available && (
        <View testID="team-gcal" style={card}>
          <T kind="small">{d.calendar.connectedBy ? `Meetings go to the Remy team Google Calendar automatically, with who's going. Connected by ${first(d.calendar.connectedBy)}.` : "Connect the team's shared Google account and every meeting here appears on its Remy team calendar, with the headcount."}</T>
          {d.calendar.connectedBy ? (askCal ? <>
            <T kind="small" style={{ color: c.ink }}>Disconnect the team Google Calendar? The Remy team calendar will be deleted from that Google account.</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button testID="button-team-gcal-disconnect-confirm" label="Disconnect" busy={busy === "cal"} onPress={async () => { tap(); setBusy("cal"); setErr(""); try { setD((await api<{ team: Team }>("DELETE", "/api/admin/calendar")).team); setAskCal(false); success(); } catch (x: any) { setErr(x.message); } setBusy(""); }} flex />
              <Button testID="button-team-gcal-cancel" kind="ghost" label="Keep it" onPress={() => setAskCal(false)} flex />
            </View>
          </> : <Button testID="button-team-gcal-disconnect" kind="ghost" label="Disconnect" onPress={() => { tap(); setAskCal(true); }} />)
            : <Button testID="button-team-gcal" label="Connect Google Calendar" icon="book" busy={busy === "cal"} onPress={async () => { tap(); setBusy("cal"); setErr(""); try { if (await connectGoogleCalendar(true)) { await load(); success(); } } catch (x: any) { setErr(x.message); } setBusy(""); }} />}
        </View>
      )}
    </ScrollView>
  );
}
