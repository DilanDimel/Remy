import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HoursEntry, Workspace } from "@shared/types";
import { Button, Icon, Pill, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// The website's Hours tab (client/src/pages/Progress.tsx Hours), native: log an activity's hours and see the totals.
const ACTIVITIES = ["Volunteering", "Shadowing", "Clinical hours", "Research", "Work shifts", "Club or leadership", "Tutoring", "Apprenticeship hours"];
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, ""));
const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function Hours() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!ws) return null;
  const list = [...(ws.hours || [])].sort((a, b) => b.date.localeCompare(a.date));
  const totals = [...list.reduce((m, h) => m.set(h.activity, (m.get(h.activity) || 0) + h.hours), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const n = parseFloat(hours);
  const ok = !!activity.trim() && n > 0 && n <= 24 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = async (value: HoursEntry[]) => { setErr(""); try { setWs(await api<Workspace>("PUT", "/api/ws/hours", { value })); success(); return true; } catch (e: any) { setErr(e.message); return false; } };
  const add = async () => {
    if (!ok) return;
    setBusy(true);
    const e: HoursEntry = { id: "h" + Math.random().toString(36).slice(2, 10), activity: activity.trim(), hours: Math.round(n * 4) / 4, date, ...(note.trim() ? { note: note.trim() } : {}) };
    if (await save([e, ...(ws.hours || [])])) { setHours(""); setNote(""); }
    setBusy(false);
  };
  const input = { height: 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, fontFamily: font.body, fontSize: 15.5, color: c.ink } as const;
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10, marginTop: 14 } as const;
  return (
    <ScrollView testID="hours-screen" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      {list.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} testID="hours-totals">
          <View style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: c.foxSoft, borderRadius: 14, padding: 12 }}><Text style={{ fontFamily: font.display, fontSize: 26, color: c.ink }}>{fmt(list.reduce((x, h) => x + h.hours, 0))}</Text><T kind="small">Hours in all</T></View>
          {totals.slice(0, 3).map(([a, t]) => <View key={a} style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 12 }}><Text style={{ fontFamily: font.display, fontSize: 26, color: c.ink }}>{fmt(t)}</Text><T kind="small" numberOfLines={1}>{a}</T></View>)}
        </View>
      )}
      <View style={card}>
        <T kind="h2">Log hours</T>
        <T kind="small">Volunteering, shadowing, clinical, research or shifts: many programs ask for totals, so keep them as you go.</T>
        <TextInput testID="input-hours-activity" value={activity} onChangeText={setActivity} placeholder="Activity, e.g. Shadowing" placeholderTextColor={c.faint} style={input} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
          {[...new Set([...totals.map(([a]) => a), ...ACTIVITIES])].map((a) => <Pill key={a} label={a} on={activity === a} onPress={() => setActivity(a)} testID="pill-hours-activity" />)}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput testID="input-hours-amount" value={hours} onChangeText={setHours} placeholder="Hours" keyboardType="decimal-pad" placeholderTextColor={c.faint} style={[input, { width: 96 }]} />
          <TextInput testID="input-hours-date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.faint} style={[input, { flex: 1 }]} />
        </View>
        <TextInput testID="input-hours-note" value={note} onChangeText={setNote} maxLength={500} placeholder="Note (optional), e.g. Dr. Lee, cardiology" placeholderTextColor={c.faint} style={input} />
        <Button testID="button-add-hours" label="Add" icon="plus" busy={busy} disabled={!ok} onPress={add} flex />
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      </View>
      {list.length ? (
        <View style={card}>
          <T kind="h2">Log</T>
          {list.map((h) => (
            <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
              <T kind="small" style={{ flex: 1, color: c.ink }}>{day(h.date)} · {h.activity} · <Text style={{ fontFamily: font.bold }}>{fmt(h.hours)} h</Text>{h.note ? <Text style={{ color: c.mutedText }}> · {h.note}</Text> : null}</T>
              <Pressable testID="button-delete-hours" accessibilityLabel={`Delete ${h.activity} on ${h.date}`} hitSlop={10} onPress={() => { tap(); save((ws.hours || []).filter((x) => x.id !== h.id)); }}><Icon name="x" size={18} color={c.faint} /></Pressable>
            </View>
          ))}
        </View>
      ) : <T kind="muted" style={{ textAlign: "center", marginTop: 24 }}>No hours yet. Add your first entry above.</T>}
    </ScrollView>
  );
}
