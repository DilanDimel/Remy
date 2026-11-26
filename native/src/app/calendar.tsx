import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CalItem, Workspace } from "@shared/types";
import { Button, Card, Icon, Pill, Sect, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { shareFromServer } from "@/lib/files";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { CareerTime } from "@/components/CareerTime";

// Calendar, the website's page (client/src/pages/Calendar.tsx) for a phone: Remy's line, what's coming up, the month
// with a dot on busy days (tap a day for its items), and each item's details. Items you add or edit save to the same
// `calendar` list; to-dos with a due date and the weekly career time show as on the website. Google Calendar's sync
// settings and the career-time picker stay on the website for now.
const KINDS: CalItem["kind"][] = ["Deadline", "Event", "Task", "Interview", "Advising"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return h === undefined || isNaN(h) ? t : `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const daysTo = (date: string, today: string) => Math.round((new Date(date + "T12:00").getTime() - new Date(today + "T12:00").getTime()) / 864e5);
const when = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
const longDate = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const rid = (p: string) => p + Math.random().toString(36).slice(2, 10);
/** "7:30 pm", "19:30", "7pm" → "19:30"; "" stays all day; anything else is null. */
function parseTime(s: string): string | null {
  const m = s.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!s.trim()) return "";
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0);
  if (m[3]) { if (h < 1 || h > 12) return null; h = (h % 12) + (m[3].startsWith("p") ? 12 : 0); }
  return h > 23 || min > 59 ? null : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** The weekly career time, as the website lists it (CareerTime.tsx careerItems). */
function careerItems(w: Workspace, weeks = 26): CalItem[] {
  const ct = w.settings.careerTime;
  if (!ct) return [];
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((ct.day - d.getDay() + 7) % 7));
  return Array.from({ length: weeks }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + 7 * i);
    return { id: "career-" + i, title: "Career time with Remy", date: iso(x), time: ct.time, kind: "Event" as const, source: "Your weekly career time", notes: "45 minutes for one real step: a to-do, an application, or a message to someone." };
  });
}

function gcalLink(c: CalItem) {
  const d = c.date.replace(/-/g, "");
  let dates: string;
  if (c.time) {
    const [h = 0, m = 0] = c.time.split(":").map(Number);
    dates = `${d}T${c.time.replace(":", "")}00/${d}T${String(h + 1).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
  } else {
    const n = new Date(c.date + "T12:00:00"); n.setDate(n.getDate() + 1);
    dates = `${d}/${iso(n).replace(/-/g, "")}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(c.title)}&dates=${dates}&details=${encodeURIComponent(c.notes || "Added from Remy")}${c.id.startsWith("career-") ? "&recur=" + encodeURIComponent("RRULE:FREQ=WEEKLY") : ""}`;
}

export default function Calendar() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [day, setDay] = useState("");
  const [sel, setSel] = useState<CalItem | null>(null);
  const [edit, setEdit] = useState<CalItem | null>(null);
  const [err, setErr] = useState("");
  const items = useMemo(() => {
    if (!ws) return [];
    const fromTasks: CalItem[] = ws.tasks.filter((t) => t.due && !t.done).map((t) => ({ id: "task-" + t.id, title: t.title, date: t.due, time: "", kind: "Task", source: "To-do", notes: t.why, linkedId: t.id }));
    return [...ws.calendar, ...fromTasks, ...careerItems(ws)].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [ws?.calendar, ws?.tasks, ws?.settings.careerTime]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ws) return null;
  const today = iso(new Date());
  const weekEnd = iso(new Date(Date.now() + 6 * 864e5));
  // The weekly career time repeats; Coming up shows only its next one, so real deadlines aren't pushed out.
  const upcoming = items.filter((i) => i.date >= today).filter((i, n, all) => !i.id.startsWith("career-") || all.findIndex((x) => x.id.startsWith("career-")) === n).slice(0, 8);
  const big = upcoming.find((i) => i.kind === "Interview" || i.kind === "Deadline");
  const week = upcoming.filter((i) => i.date <= weekEnd).length;
  const start = new Date(month); start.setDate(1 - start.getDay());
  const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const save = async (value: CalItem[]) => { setErr(""); try { setWs(await api<Workspace>("PUT", "/api/ws/calendar", { value })); return true; } catch (e: any) { setErr(e.message); return false; } };
  const remove = async (it: CalItem) => { if (await save(ws.calendar.filter((x) => x.id !== it.id))) { tap(); setSel(null); } };
  const shift = (n: number) => { tap(); setDay(""); setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1)); };
  const dayItems = day ? items.filter((i) => i.date === day) : [];
  const row = (i: CalItem, testID: string) => {
    const d = new Date(i.date + "T12:00"), soon = i.date <= weekEnd;
    return (
      <Pressable key={i.id} testID={testID} onPress={() => { tap(); setSel(i); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: pressed ? c.surface2 : "transparent" })}>
        <View style={{ width: 44, paddingVertical: 4, borderRadius: 10, alignItems: "center", backgroundColor: soon ? c.fox : c.surface2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: soon ? c.onFox : c.mutedText, textTransform: "uppercase" }}>{d.toLocaleDateString("en-US", soon ? { weekday: "short" } : { month: "short" })}</Text>
          <Text style={{ fontFamily: font.display, fontSize: 17, color: soon ? c.onFox : c.ink }}>{d.getDate()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: font.semi }} numberOfLines={2}>{i.title}</T>
          <T kind="small">{i.kind}{i.time ? ` · ${clock(i.time)}` : ""}</T>
        </View>
        <Icon name="chev" size={18} color={c.faint} />
      </Pressable>
    );
  };
  return (
    <ScrollView testID="calendar-screen" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <Text testID="calendar-line" style={{ fontFamily: font.body, fontSize: 15, lineHeight: 21, color: c.ink, marginHorizontal: 4 }}>
        <Text style={{ fontFamily: font.bold }}>{big ? `${big.title} is ${when(daysTo(big.date, today))}.` : upcoming[0] ? `Next: ${upcoming[0].title.replace(/\.$/, "")}, ${when(daysTo(upcoming[0].date, today))}.` : "Nothing coming up yet."}</Text>
        {week ? ` ${week} thing${week === 1 ? "" : "s"} on your calendar this week.` : " A quiet week: a good time to add a coffee chat."}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Button testID="button-add-event" icon="plus" label="Add" onPress={() => setEdit({ id: rid("cal"), title: "", date: day || today, time: "", kind: "Event", source: "Added by you", notes: "" })} flex />
        <Button testID="button-paste-invite" kind="ghost" label="Paste an invite" onPress={() => go("/progress?tab=email&paste=1", "Email updates")} flex />
      </View>
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}

      <Sect title="Coming up" />
      <Card style={{ paddingHorizontal: 0, paddingVertical: 4 }} testID="calendar-week">
        {upcoming.length ? upcoming.map((i) => row(i, "button-upcoming")) : <T kind="muted" style={{ padding: 14 }}>Nothing scheduled. Save an opening with a deadline, or press Add.</T>}
      </Card>

      <Sect title={month.toLocaleDateString("en-US", { month: "long", year: "numeric" })} right={
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Pressable testID="button-prev-month" accessibilityLabel="Previous month" hitSlop={10} onPress={() => shift(-1)}><View style={{ transform: [{ scaleX: -1 }] }}><Icon name="chev" size={20} color={c.ink} /></View></Pressable>
          <Pressable testID="button-this-month" hitSlop={8} onPress={() => { tap(); const d = new Date(); d.setDate(1); setMonth(d); setDay(today); }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.foxDeep }}>Today</Text></Pressable>
          <Pressable testID="button-next-month" accessibilityLabel="Next month" hitSlop={10} onPress={() => shift(1)}><Icon name="chev" size={20} color={c.ink} /></Pressable>
        </View>} />
      <Card style={{ padding: 8 }} testID="calendar-month">
        <View style={{ flexDirection: "row" }}>{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: "center", fontFamily: font.bold, fontSize: 11.5, color: c.mutedText, paddingVertical: 4 }}>{d}</Text>)}</View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{days.map((d) => {
          const k = iso(d), out = d.getMonth() !== month.getMonth(), n = items.filter((i) => i.date === k);
          const on = k === day, isToday = k === today;
          const strong = n.some((i) => i.kind === "Interview" || i.kind === "Deadline");
          return (
            <Pressable key={k} testID="calendar-day" accessibilityLabel={`${longDate(k)}${n.length ? `, ${n.length} item${n.length === 1 ? "" : "s"}` : ""}`} onPress={() => { tap(); setDay(on ? "" : k); }}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.ink : "transparent", borderWidth: isToday && !on ? 1.5 : 0, borderColor: c.fox }}>
                <Text style={{ fontFamily: isToday || on ? font.bold : font.semi, fontSize: 15, color: on ? c.onInk : out ? c.faint : c.ink }}>{d.getDate()}</Text>
              </View>
              <View style={{ height: 5, flexDirection: "row", gap: 2 }}>{n.slice(0, 3).map((i, x) => <View key={x} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: strong && (i.kind === "Interview" || i.kind === "Deadline") ? c.fox : c.faint }} />)}</View>
            </Pressable>
          );
        })}</View>
      </Card>
      {!!day && (
        <View testID="calendar-day-items">
          <Sect title={longDate(day)} />
          <Card style={{ paddingHorizontal: 0, paddingVertical: 4 }}>
            {dayItems.length ? dayItems.map((i) => row(i, "button-day-item")) : <T kind="muted" style={{ padding: 14 }}>Nothing on this day.</T>}
          </Card>
        </View>
      )}
      <T kind="small" style={{ marginTop: 16, marginHorizontal: 4 }}>Google Calendar sync and your weekly career time are set on the website's Calendar.</T>
      <Button testID="button-calendar-website" kind="ghost" label="Open Calendar on the website" onPress={() => go("/calendar", "Calendar", { page: true })} style={{ marginTop: 8 }} />

      {sel && <Detail it={sel} onClose={() => setSel(null)} onEdit={() => { setEdit(sel); setSel(null); }} onRemove={() => remove(sel)} />}
      {edit && <Editor it={edit} isNew={!ws.calendar.some((x) => x.id === edit.id)} onClose={() => setEdit(null)} onSave={async (it) => {
        const dupe = ws.calendar.find((x) => x.id !== it.id && x.title.trim().toLowerCase() === it.title.trim().toLowerCase() && x.date === it.date);
        if (dupe) return "That item is already on your calendar.";
        const exists = ws.calendar.some((x) => x.id === it.id);
        if (await save(exists ? ws.calendar.map((x) => (x.id === it.id ? it : x)) : [...ws.calendar, it])) { success(); setEdit(null); setDay(it.date); setMonth(new Date(Number(it.date.slice(0, 4)), Number(it.date.slice(5, 7)) - 1, 1)); return ""; }
        return "That didn't save. Please try again.";
      }} />}
    </ScrollView>
  );
}

function Sheet({ children, onClose, testID }: { children: React.ReactNode; onClose: () => void; testID: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable onPress={() => {}} testID={testID} style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 12 }}>{children}</ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function Detail({ it, onClose, onEdit, onRemove }: { it: CalItem; onClose: () => void; onEdit: () => void; onRemove: () => void }) {
  const { c } = useTheme();
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const own = !it.id.startsWith("task-") && !it.id.startsWith("career-");
  const ics = () => shareFromServer(it.id.startsWith("career-") ? "/api/calendar.ics?id=career" : `/api/calendar.ics?id=${encodeURIComponent(it.id)}`, it.id.startsWith("career-") ? "career-time.ics" : "event.ics", "text/calendar").catch((e) => setErr(e.message));
  return (
    <Sheet onClose={onClose} testID="calendar-detail">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <T kind="h2" style={{ flex: 1 }}>{it.title}</T>
        <Pressable testID="button-close-event" accessibilityLabel="Close" hitSlop={10} onPress={onClose}><Icon name="x" color={c.mutedText} /></Pressable>
      </View>
      <T style={{ color: c.ink }}>{longDate(it.date)}{it.time ? ` at ${clock(it.time)}` : " (all day)"}</T>
      <T kind="small">{it.kind} · {it.source}</T>
      {!!it.notes && <T kind="small" style={{ color: c.ink }}>{it.notes}</T>}
      {it.id.startsWith("career-") && <CareerTime />}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      {!it.id.startsWith("task-") && <Button testID="button-share-ics" label={it.id.startsWith("career-") ? "Add the weekly time to my calendar" : "Add to my phone's calendar"} onPress={ics} />}
      <Button testID="link-gcal" kind="ghost" label="Add to Google Calendar" onPress={() => Linking.openURL(gcalLink(it)).catch(() => setErr("Couldn't open Google Calendar."))} />
      {it.id.startsWith("task-") && <Button testID="button-open-todos" kind="ghost" label="Open my to-dos" onPress={() => { onClose(); go("/progress?tab=todos", "Progress"); }} />}
      {own && <View style={{ flexDirection: "row", gap: 8 }}>
        <Button testID="button-edit-event" kind="ghost" label="Edit" onPress={onEdit} flex />
        <Button testID="button-remove-event" kind="ghost" label={sure ? "Tap again to remove" : "Remove"} onPress={() => (sure ? onRemove() : setSure(true))} flex />
      </View>}
    </Sheet>
  );
}

function Editor({ it, isNew, onClose, onSave }: { it: CalItem; isNew: boolean; onClose: () => void; onSave: (it: CalItem) => Promise<string> }) {
  const { c } = useTheme();
  const [v, setV] = useState(it);
  const [time, setTime] = useState(it.time ? clock(it.time) : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t = parseTime(time);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(v.date) && !isNaN(Date.parse(v.date + "T12:00"));
  const go_ = async () => { setBusy(true); setErr(await onSave({ ...v, title: v.title.trim(), time: t || "" })); setBusy(false); };
  return (
    <Sheet onClose={onClose} testID="calendar-editor">
      <T kind="h2">{isNew ? "Add to calendar" : "Edit item"}</T>
      <Field testID="input-event-title" value={v.title} onChangeText={(title) => setV({ ...v, title })} placeholder="Title" autoFocus={isNew} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1.3 }}><Field testID="input-event-date" value={v.date} onChangeText={(date) => setV({ ...v, date })} placeholder="YYYY-MM-DD" autoCapitalize="none" /></View>
        <View style={{ flex: 1 }}><Field testID="input-event-time" value={time} onChangeText={setTime} placeholder="Time (optional)" autoCapitalize="none" /></View>
      </View>
      <T kind="small">{dateOk ? longDate(v.date) : "Write the date as year-month-day, like 2026-12-03."}{t === null ? " The time should look like 2:30 PM." : t ? ` at ${clock(t)}` : ""}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{KINDS.map((k) => <Pill key={k} label={k} on={v.kind === k} onPress={() => setV({ ...v, kind: k })} testID={`pill-kind-${k.toLowerCase()}`} />)}</View>
      <Field testID="input-event-notes" value={v.notes} onChangeText={(notes) => setV({ ...v, notes })} placeholder="Notes" multiline style={{ minHeight: 80 }} />
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <Button testID="button-save-event" label="Save" onPress={go_} busy={busy} disabled={!v.title.trim() || !dateOk || t === null} />
    </Sheet>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { testID: string }) {
  const { c } = useTheme();
  return <TextInput placeholderTextColor={c.faint} accessibilityLabel={props.placeholder} {...props}
    style={[{ minHeight: 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.body, fontSize: 16, color: c.ink, textAlignVertical: props.multiline ? "top" : "center" }, props.style]} />;
}
