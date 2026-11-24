import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keptUntracked } from "@shared/progress";
import type { Task, TrackItem, TrackStatus, Workspace } from "@shared/types";
import { Button, Card, Group, Icon, Logo, Pill, Row, Sect, Segmented, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";

// Progress, the website's page (client/src/pages/Progress.tsx) for a phone: the applications board and the to-dos are
// native; Email updates and Hours open the website's tabs for now (handoff P2.4: complex parts can stay in the web sheet).
type Tab = "tracker" | "todos";
const STATUSES: TrackStatus[] = ["Saved", "Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply", "Withdrawn"];
const STATUS_HELP: Partial<Record<TrackStatus, string>> = {
  Received: "The employer confirmed they got it. Not an interview.",
  "Heard back": "A person wrote back (asked for more, offered a quick call). Not an interview yet.",
  Interview: "An interview invitation. Not an offer.",
  "No reply": "You stopped waiting: no answer after you applied.",
  Offer: "A written offer of employment or internship.",
};
const LANES: [string, TrackStatus[]][] = [["Saved", ["Saved"]], ["Applied", ["Applied", "Received"]], ["Heard back", ["Heard back"]], ["Interview", ["Interview"]], ["Offer", ["Offer"]], ["Closed", ["Rejected", "No reply", "Withdrawn"]]];
const lastAt = (t: TrackItem) => t.events[t.events.length - 1]?.at || "";
const daysSince = (iso: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 864e5) : 0);
/** Sent more than a week ago with no news since: worth a short follow-up (the website's quiet()). */
const quiet = (t: TrackItem) => (t.status === "Applied" || t.status === "Received") && daysSince(lastAt(t)) >= 7;
const rid = (p: string) => p + Math.random().toString(36).slice(2, 10);
const shortDate = (d: string) => new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function Progress() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "todos" ? "todos" : "tracker");
  const { ws } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (!ws) return null;
  const mail = ws.suggestions.filter((s) => s.state === "open").length;
  const hours = (ws.hours || []).reduce((x, h) => x + h.hours, 0);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView testID="progress-screen" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <Segmented testID="tab-progress" value={tab} onChange={setTab} options={[{ key: "tracker", label: "Applications" }, { key: "todos", label: "To-dos" }]} />
        {tab === "tracker" ? <Tracker ws={ws} /> : <Todos ws={ws} />}
        <Sect title="More in Progress" />
        <Group>
          <Row first testID="row-progress-email" title={`Email updates${mail ? ` (${mail})` : ""}`} sub="Paste an interview invite, offer or rejection, and confirm the update" subLines={2} left={<Icon name="chat" />} onPress={() => go("/progress?tab=email", "Email updates")} />
          <Row testID="row-progress-hours" title="Hours" sub={hours ? `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, "")} hours logged` : "Log volunteering, shadowing or shifts"} left={<Icon name="heart" />} onPress={() => go("/progress?tab=hours", "Hours")} />
        </Group>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Remy's line from the real counts, as on the website (ProgressLine). */
function line(ws: Workspace, kept: number) {
  if (!ws.tracker.length) return kept ? `**${kept} opening${kept === 1 ? "" : "s"} saved, none applied yet.** Tailor one and apply, and Remy tracks it from there.` : "**Nothing tracked yet.** Approve tailored materials and Remy adds the opening here.";
  const sent = ws.tracker.filter((t) => !["Saved", "Withdrawn"].includes(t.status)).length;
  const replies = ws.tracker.filter((t) => ["Heard back", "Interview", "Offer", "Rejected"].includes(t.status)).length;
  const q = ws.tracker.filter(quiet).sort((a, b) => lastAt(a).localeCompare(lastAt(b)))[0];
  return `**${sent} application${sent === 1 ? "" : "s"} out, ${replies} ${replies === 1 ? "reply" : "replies"} in.**${q ? ` ${q.company} hasn't answered in ${daysSince(lastAt(q))} days, so a short follow-up is worth it.` : ""}`;
}

function Tracker({ ws }: { ws: Workspace }) {
  const { setWs } = useSession();
  const { c } = useTheme();
  const { jobs } = useJobs();
  const kept = keptUntracked(ws, jobs || []);
  const [open, setOpen] = useState("");
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ company: "", role: "" });
  const [err, setErr] = useState("");
  const save = async (value: TrackItem[]) => { setErr(""); try { setWs(await api<Workspace>("PUT", "/api/ws/tracker", { value })); return true; } catch (e: any) { setErr(e.message); return false; } };
  const add = async () => {
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    if (ws.tracker.some((t) => same(t.company, n.company) && same(t.role, n.role))) return setErr("You're already tracking that application.");
    const at = new Date().toISOString();
    if (await save([{ id: rid("tr"), company: n.company.trim(), role: n.role.trim(), status: "Applied", notes: "", events: [{ id: rid("ev"), at, status: "Applied", source: "Manual" }] }, ...ws.tracker])) { success(); setAdding(false); setN({ company: "", role: "" }); }
  };
  const [head, ...rest] = line(ws, kept.length).split("**").filter(Boolean);
  const item = open ? ws.tracker.find((t) => t.id === open) : undefined;
  return (
    <View>
      <Text testID="progress-line" style={{ fontFamily: font.body, fontSize: 15, lineHeight: 21, color: c.ink, marginTop: 16, marginHorizontal: 4 }}><Text style={{ fontFamily: font.bold }}>{head}</Text>{rest.join("")}</Text>
      {adding ? (
        <Card style={{ gap: 10, marginTop: 14 }} testID="track-form">
          <T style={{ fontFamily: font.bold }}>Track an application</T>
          <Field testID="input-track-company" value={n.company} onChangeText={(company) => setN({ ...n, company })} placeholder="Company" autoFocus />
          <Field testID="input-track-role" value={n.role} onChangeText={(role) => setN({ ...n, role })} placeholder="Role" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button testID="button-cancel-tracking" kind="ghost" label="Cancel" onPress={() => { setAdding(false); setErr(""); }} flex />
            <Button testID="button-save-tracking" label="Save" onPress={add} disabled={!n.company.trim()} flex />
          </View>
        </Card>
      ) : <Button testID="button-add-tracking" kind="ghost" icon="plus" label="Track an application" onPress={() => setAdding(true)} style={{ marginTop: 14 }} />}
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8, marginHorizontal: 4 }}>{err}</T>}
      {LANES.map(([lane, st]) => {
        const items = ws.tracker.filter((t) => st.includes(t.status));
        const keep = lane === "Saved" ? kept : [];
        if (lane === "Closed" && !items.length) return null;
        return (
          <View key={lane} testID={`lane-${lane.toLowerCase().replace(" ", "-")}`}>
            <Sect title={`${lane} · ${items.length + keep.length}`} />
            {items.length + keep.length ? <Group>
              {items.map((t, i) => (
                <Row key={t.id} first={i === 0} testID="button-board-card" title={t.role || t.company} subLines={2} onPress={() => setOpen(t.id)}
                  sub={`${t.company}${quiet(t) ? ` · ${daysSince(lastAt(t))} days, no reply` : t.status !== lane && lane !== "Closed" ? ` · ${t.status.toLowerCase()}` : lane === "Closed" ? ` · ${t.status}` : ""}`}
                  left={<Logo company={t.company} size={32} />} right={quiet(t) ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.fox }} /> : undefined} />
              ))}
              {keep.map((j, i) => <Row key={j.id} first={!items.length && i === 0} testID="button-board-kept" title={j.title} sub={`${j.company} · kept`} left={<Logo company={j.company} url={j.applyUrl} size={32} />} onPress={() => router.push({ pathname: "/job", params: { id: j.id } })} />)}
            </Group> : <T kind="small" style={{ marginHorizontal: 4, color: c.faint }}>{lane === "Offer" ? "Waits here" : "None yet"}</T>}
          </View>
        );
      })}
      {item && <TrackDetail t={item} ws={ws} save={save} onClose={() => setOpen("")} />}
    </View>
  );
}

/** One application: its status (every change is a timeline event, "Manual correction" as on the website), the timeline
 *  with any quoted email evidence, notes, its materials, and stop tracking. */
function TrackDetail({ t, ws, save, onClose }: { t: TrackItem; ws: Workspace; save: (v: TrackItem[]) => Promise<boolean>; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState(t.notes);
  const [sure, setSure] = useState(false);
  const setStatus = (status: TrackStatus) => { if (status === t.status) return; tap(); save(ws.tracker.map((x) => (x.id === t.id ? { ...x, status, events: [...x.events, { id: rid("ev"), at: new Date().toISOString(), status, source: "Manual correction" }] } : x))); };
  const close = () => { if (notes !== t.notes) save(ws.tracker.map((x) => (x.id === t.id ? { ...x, notes } : x))); onClose(); };
  const interview = t.status === "Interview" && !ws.calendar.some((e) => e.linkedId === t.id);
  return (
    <Modal transparent animationType="slide" visible onRequestClose={close}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable onPress={() => {}} testID="track-detail" style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Logo company={t.company} size={40} />
                <View style={{ flex: 1 }}><T kind="h2">{t.company}</T>{!!t.role && <T kind="small">{t.role}</T>}</View>
                <Pressable testID="button-close-track" accessibilityLabel="Close" hitSlop={10} onPress={close}><Icon name="x" color={c.mutedText} /></Pressable>
              </View>
              <T kind="label" style={{ color: c.mutedText }}>Status</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{STATUSES.map((s) => <Pill key={s} label={s} on={s === t.status} onPress={() => setStatus(s)} testID={`pill-status-${s.toLowerCase().replace(" ", "-")}`} />)}</View>
              {!!STATUS_HELP[t.status] && <T kind="small">{STATUS_HELP[t.status]}</T>}
              {interview && <Card style={{ gap: 8 }} testID="interview-date"><T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>An interview with {t.company}!</Text> Add its date on the website's Calendar and Remy turns Home into a prep plan the two days before.</T>
                <Button testID="button-interview-calendar" kind="ghost" label="Add it to the calendar" onPress={() => { onClose(); setTimeout(() => go("/calendar", "Calendar"), 250); }} /></Card>}
              <T kind="label" style={{ color: c.mutedText, marginTop: 4 }}>Timeline</T>
              <View style={{ gap: 10 }} testID="track-timeline">{[...t.events].reverse().map((e) => (
                <View key={e.id} style={{ borderLeftWidth: 2, borderLeftColor: c.line, paddingLeft: 10, gap: 2 }}>
                  <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>{e.status}</Text> · {shortDate(e.at)} · {e.source.split(" · ")[0]}</T>
                  {!!e.evidence && <T kind="small" style={{ fontStyle: "italic" }}>"{e.evidence}"</T>}
                </View>
              ))}</View>
              <Field testID="input-track-notes" value={notes} onChangeText={setNotes} placeholder="Notes" multiline style={{ minHeight: 80 }} />
              {!!t.applicationId && <Button testID="button-open-materials" kind="ghost" label="Open materials" onPress={() => { close(); setTimeout(() => go(`/resume?tab=tailor&app=${t.applicationId}`), 250); }} />}
              <Button testID="button-stop-tracking" kind="ghost" label={sure ? "Tap again to stop tracking" : "Stop tracking"} onPress={() => { if (!sure) return setSure(true); save(ws.tracker.filter((x) => x.id !== t.id)).then((ok) => ok && onClose()); }} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function Todos({ ws }: { ws: Workspace }) {
  const { setWs } = useSession();
  const { c } = useTheme();
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [doneNow, setDoneNow] = useState<string[]>([]); // ticked here, kept in the list for a moment
  const [err, setErr] = useState("");
  const call = async (f: () => Promise<Workspace>) => { setErr(""); try { setWs(await f()); return true; } catch (e: any) { setErr(e.message); return false; } };
  const add = async () => {
    const t: Task = { id: rid("t"), title: title.trim(), why: "", due: "", category: "Prepare", done: false, source: "Added by you" } as Task;
    if (await call(() => api<Workspace>("PUT", "/api/ws/tasks", { value: [t, ...ws.tasks] }))) { success(); setTitle(""); }
  };
  const toggle = (t: Task) => {
    if (!t.done) { success(); setDoneNow((d) => [...d, t.id]); setTimeout(() => setDoneNow((d) => d.filter((x) => x !== t.id)), 1500); } else tap();
    call(() => api<Workspace>("PATCH", `/api/tasks/${t.id}`, { done: !t.done }));
  };
  const remove = (t: Task) => { tap(); call(() => api<Workspace>("PUT", "/api/ws/tasks", { value: ws.tasks.filter((x) => x.id !== t.id) })); };
  const fading = (t: Task) => doneNow.includes(t.id);
  const open = ws.tasks.filter((t) => !t.done);
  const doneCount = ws.tasks.filter((t) => t.done && !fading(t)).length;
  const today = new Date().toLocaleDateString("en-CA"), week = new Date(Date.now() + 6 * 864e5).toLocaleDateString("en-CA");
  const list = ws.tasks.filter((t) => !t.done || fading(t) || showDone)
    .sort((a, b) => Number(a.done && !fading(a)) - Number(b.done && !fading(b)) || (a.due || "9999").localeCompare(b.due || "9999"));
  const tiles: [number, string][] = [[open.filter((t) => t.due && t.due < today).length, "Overdue"], [open.filter((t) => t.due && t.due >= today && t.due <= week).length, "This week"], [open.length, "Open"], [ws.tasks.length - open.length, "Done"]];
  return (
    <View>
      <View testID="todo-tiles" style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>{tiles.map(([n, l]) => (
        <View key={l} style={{ flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingVertical: 10, alignItems: "center" }}>
          <Text style={{ fontFamily: font.display, fontSize: 20, color: l === "Overdue" && n ? c.foxDeep : c.ink }}>{n}</Text>
          <Text style={{ fontFamily: font.semi, fontSize: 11.5, color: c.mutedText }}>{l}</Text>
        </View>
      ))}</View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <View style={{ flex: 1 }}><Field testID="input-new-todo" value={title} onChangeText={setTitle} placeholder="Add a to-do" returnKeyType="done" onSubmitEditing={() => title.trim() && add()} /></View>
        <Button testID="button-add-todo" label="Add" onPress={add} disabled={!title.trim()} />
      </View>
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8, marginHorizontal: 4 }}>{err}</T>}
      <View style={{ marginTop: 14 }}>
        {list.length ? <Group>{list.map((t, i) => (
          <View key={t.id} testID="row-todo" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: fading(t) ? 0.55 : 1 }}>
            <Pressable testID="checkbox-task" accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={`Mark ${t.title} done`} onPress={() => toggle(t)} hitSlop={10}
              style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.done ? c.fox : c.line, backgroundColor: t.done ? c.fox : "transparent", alignItems: "center", justifyContent: "center" }}>
              {t.done && <Icon name="check" size={14} color={c.onFox} strokeWidth={3} />}
            </Pressable>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: font.semi, textDecorationLine: t.done ? "line-through" : "none" }}>{t.title}</T>
              <T kind="small" numberOfLines={2}>{[t.due ? (t.due < today && !t.done ? `Overdue · ${shortDate(t.due)}` : shortDate(t.due)) : "", t.why, t.source].filter(Boolean).join(" · ")}</T>
            </View>
            <Pressable testID="button-delete-todo" accessibilityLabel={`Delete ${t.title}`} hitSlop={10} onPress={() => remove(t)}><Icon name="x" size={18} color={c.faint} /></Pressable>
          </View>
        ))}</Group> : <T kind="muted" style={{ marginHorizontal: 4 }}>{doneCount ? "All caught up. Everything on your list is done." : "No to-dos yet. Add one above, or build your path to get suggestions."}</T>}
      </View>
      {doneCount > 0 && <Button testID="button-show-done" kind="ghost" label={`${showDone ? "Hide" : "Show"} completed (${doneCount})`} onPress={() => setShowDone((v) => !v)} style={{ marginTop: 10 }} />}
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { testID: string }) {
  const { c } = useTheme();
  return <TextInput placeholderTextColor={c.faint} accessibilityLabel={props.placeholder} {...props}
    style={[{ minHeight: 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.body, fontSize: 16, color: c.ink, textAlignVertical: props.multiline ? "top" : "center" }, props.style]} />;
}
