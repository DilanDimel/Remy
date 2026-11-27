import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Loading, Sect, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Owners' Team & hours, native (the website's Admin → Team & hours, client/src/pages/Admin.tsx TeamTab "team"): who's
// working, hours this week / total / last 8 weeks, team hours per day, clock in/out, time you forgot, teammates, time
// entries and activity. Same /api/admin calls.
type Member = { email: string; name: string; founder: boolean };
type Entry = { id: string; member: string; start_at: string; end_at: string | null; note: string; source?: "clock" | "pr" | "auto"; ref?: string; ai_cost?: number };
type Act = { id: number; at: string; actor: string; action: string; detail: string };
type Team = { me: string; members: Member[]; tasks: { assignee: string; status: string }[]; hours: { member: string; hours: number; week: number; auto?: number }[]; weeks: { member: string; week: string; hours: number }[]; entries: Entry[]; activity: Act[]; clockedIn: string | null };
const chi = (iso: string | number) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const day = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const list = (v: string) => (v ? v.split(",").filter(Boolean) : []);
// Monday of each of the last 8 weeks (Chicago time), oldest first, to match the server's weekly totals.
const mondays = () => Array.from({ length: 8 }, (_, i) => {
  const x = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7) - 7 * (7 - i));
  return x.toLocaleDateString("en-CA");
});

export default function AdminHours() {
  const { me } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Team | null>(null);
  const [note, setNote] = useState("");
  const [past, setPast] = useState<null | { date: string; from: string; to: string; note: string }>(null);
  const [member, setMember] = useState<null | { name: string; email: string }>(null);
  const [drop, setDrop] = useState("");
  const [entries, setEntries] = useState(0);
  const [acts, setActs] = useState(9);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [said, setSaid] = useState("");
  const load = useCallback(() => api<Team>("GET", "/api/admin/team").then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  if (!me?.owner) return null;
  if (!d) return err ? <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}><T style={{ color: c.error }}>{err}</T></View> : <Loading />;
  const send = async (key: string, method: "POST" | "DELETE", path: string, body?: unknown, ok?: string) => {
    tap(); setBusy(key); setErr(""); setSaid("");
    try { setD(await api<Team>(method, path as `/api/${string}`, body)); success(); if (ok) setSaid(ok); setBusy(""); return true; } catch (e: any) { setErr(e.message); setBusy(""); return false; }
  };
  const who = (email: string) => d.members.find((m) => m.email === email);
  const nameOf = (email: string) => who(email)?.name || email.split("@")[0];
  const first = (email: string) => nameOf(email).split(" ")[0];
  // Activity details are stored with emails and ISO dates; show names and readable dates.
  const pretty = (t: string) => t.replace(/[^\s()]+@[^\s()]+\.[a-z]+/gi, (e) => nameOf(e.toLowerCase())).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (x) => day(x));
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 } as const;
  const weeks = mondays();
  const top = Math.max(1, ...d.weeks.map((w) => w.hours));
  const people = d.members.map((m) => ({ m, h: d.hours.find((x) => x.member === m.email) })).sort((a, b) => (b.h?.week || 0) - (a.h?.week || 0) || (b.h?.hours || 0) - (a.h?.hours || 0));
  const weekTotal = people.reduce((x, y) => x + (y.h?.week || 0), 0);
  const workers = people.filter((p) => (p.h?.week || 0) > 0);
  const line = !weekTotal ? "No hours logged this week yet." : workers.length === 1 ? `${weekTotal.toFixed(1)} hours this week, all ${workers[0].m.name.split(" ")[0]}'s.` : `${weekTotal.toFixed(1)} hours this week from ${workers.length} people.`;
  const working = d.members.filter((m) => d.entries.some((e) => e.member === m.email && !e.end_at));
  const week = Array.from({ length: 7 }, (_, i) => chi(Date.now() - (6 - i) * 86400_000));
  const perDay = week.map((k) => d.entries.filter((e) => chi(e.start_at) === k).reduce((x, e) => x + ((e.end_at ? +new Date(e.end_at) : Date.now()) - +new Date(e.start_at)) / 3600_000, 0));
  const dayTop = Math.max(1, ...perDay);
  // Activity grouped by day, with runs of the same thing by the same person folded into one line.
  const t0 = chi(Date.now()), y0 = chi(Date.now() - 86400_000);
  const dayLabel = (iso: string) => { const k = chi(iso); return k === t0 ? "Today" : k === y0 ? "Yesterday" : day(k); };
  const runs: { label: string; items: Act[] }[] = [];
  for (const a of d.activity) {
    const label = dayLabel(a.at), last = runs[runs.length - 1];
    if (last && last.label === label && last.items[0].actor === a.actor && last.items[0].action === a.action) last.items.push(a); else runs.push({ label, items: [a] });
  }
  const timeOk = (s: string) => /^\d{1,2}:\d{2}$/.test(s);
  const addPast = async () => {
    if (!past) return;
    const at = (t: string) => new Date(`${past.date}T${t.padStart(5, "0")}`).toISOString();
    if (await send("past", "POST", "/api/admin/hours", { start: at(past.from), end: at(past.to), note: past.note }, "Time logged")) setPast(null);
  };

  return (
    <ScrollView testID="admin-hours" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 32 }}>
      <T kind="muted"><Text style={{ fontFamily: font.bold, color: c.ink }}>{line}</Text>{working.length ? ` ${working.map((m) => m.name.split(" ")[0]).join(" and ")} ${working.length === 1 ? "is" : "are"} working now.` : ""}</T>
      {err ? <T style={{ color: c.error }}>{err}</T> : null}
      {said ? <T kind="small" style={{ color: c.sage }}>{said}</T> : null}

      <View style={card}>
        <Input testID="input-clock-note" value={note} onChangeText={setNote} placeholder={d.clockedIn ? `Working since ${when(d.clockedIn)}: what on?` : "What are you working on? (optional)"} />
        <Button testID="button-clock" kind={d.clockedIn ? "ghost" : "ink"} label={d.clockedIn ? "Clock out" : "Clock in"} busy={busy === "clock"} flex
          onPress={async () => { if (await send("clock", "POST", "/api/admin/clock", { action: d.clockedIn ? "out" : "in", note }, d.clockedIn ? "Clocked out" : "Clocked in")) setNote(""); }} />
        {past ? <View testID="past-form" style={{ gap: 8 }}>
          <Input testID="input-past-date" label="Day (YYYY-MM-DD)" value={past.date} onChangeText={(v) => setPast({ ...past, date: v })} maxLength={10} keyboardType="numbers-and-punctuation" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Input testID="input-past-from" label="From (e.g. 13:00)" value={past.from} onChangeText={(v) => setPast({ ...past, from: v })} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
            <View style={{ flex: 1 }}><Input testID="input-past-to" label="To (e.g. 15:30)" value={past.to} onChangeText={(v) => setPast({ ...past, to: v })} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
          </View>
          <Input testID="input-past-note" value={past.note} onChangeText={(v) => setPast({ ...past, note: v })} placeholder="What you worked on (optional)" />
          <T kind="small">Each person logs only their own time, up to 16 hours at once.</T>
          <Button testID="button-add-past" label="Add" icon="plus" busy={busy === "past"} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(past.date) || past.date > t0 || !timeOk(past.from) || !timeOk(past.to)} onPress={addPast} flex />
          <Button testID="button-cancel-past" kind="ghost" label="Cancel" onPress={() => setPast(null)} flex />
        </View> : <Button testID="button-open-past" kind="ghost" label="Add time you forgot" onPress={() => { tap(); setPast({ date: t0, from: "", to: "", note: "" }); }} flex />}
      </View>

      <Sect title="Everyone" />
      <T kind="small">This week · total · last 8 weeks · open to-dos</T>
      {people.map(({ m, h }) => {
        const open = d.tasks.filter((t) => list(t.assignee).includes(m.email) && t.status !== "done").length;
        const last = d.activity.find((a) => a.actor === m.email);
        return (
          <View key={m.email} testID={`hours-${m.email.split("@")[0]}`} style={card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontFamily: font.semi }}>{m.name}{m.email === d.me ? " (you)" : ""}{working.includes(m) ? " · working now" : ""}</T>
                <T kind="small" numberOfLines={1}>{last ? `${last.action.toLowerCase()}, ${ago(last.at)}` : "no activity yet"}</T>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.ink }}>{h?.week || 0} h</Text>
                <T kind="small">{h?.hours || 0} h total</T>
                {h?.auto ? <T kind="small">{h.auto} h auto, estimated</T> : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <View accessibilityRole="image" accessibilityLabel={`${m.name}: hours per week for the last 8 weeks`} style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 24, flex: 1 }}>
                {weeks.map((w) => { const n = d.weeks.find((x) => x.member === m.email && x.week === w)?.hours || 0; return <View key={w} style={{ flex: 1, height: Math.max(2, (n / top) * 22), borderRadius: 2, backgroundColor: n ? c.fox : c.line }} />; })}
              </View>
              <T kind="small">{open} open to-do{open === 1 ? "" : "s"}</T>
            </View>
            {!m.founder && m.email !== d.me ? (drop === m.email ? <View style={{ gap: 8 }}>
              <T kind="small" style={{ color: c.ink }}>Remove {m.name} from the owners' dashboard?</T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button testID={`button-remove-confirm-${m.email.split("@")[0]}`} label="Remove" busy={busy === "rm"} onPress={async () => { if (await send("rm", "DELETE", `/api/admin/members/${encodeURIComponent(m.email)}`, undefined, "Removed")) setDrop(""); }} flex />
                <Button testID="button-remove-cancel" kind="ghost" label="Keep" onPress={() => setDrop("")} flex />
              </View>
            </View> : <Pressable testID={`button-remove-${m.email.split("@")[0]}`} accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} onPress={() => { tap(); setDrop(m.email); }} style={{ alignSelf: "flex-end", padding: 4 }}><T kind="small">Remove</T></Pressable>) : null}
          </View>
        );
      })}

      <Sect title="Last 7 days, by day" />
      <View style={card}>
        <View accessibilityRole="image" accessibilityLabel={`Team hours this week: ${week.map((k, i) => `${day(k)} ${perDay[i].toFixed(1)} h`).join(", ")}`} style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 96 }}>
          {week.map((k, i) => (
            <View key={k} style={{ flex: 1, alignItems: "center", gap: 3 }}>
              <T kind="small">{perDay[i] >= 0.05 ? perDay[i].toFixed(1) : " "}</T>
              <View style={{ width: "70%", height: Math.max(2, (perDay[i] / dayTop) * 56), borderRadius: 3, backgroundColor: c.fox }} />
              <T kind="small">{day(k).split(",")[0]}</T>
            </View>
          ))}
        </View>
      </View>

      {member ? <View testID="member-form" style={card}>
        <Input testID="input-member-name" value={member.name} onChangeText={(v) => setMember({ ...member, name: v })} placeholder="Name" />
        <Input testID="input-member-email" value={member.email} onChangeText={(v) => setMember({ ...member, email: v })} placeholder="Email they sign in with" keyboardType="email-address" autoCapitalize="none" />
        <T kind="small">Everyone here can open this dashboard and sees the same board, calendar, hours and activity.</T>
        <Button testID="button-add-teammate" label="Add teammate" icon="plus" busy={busy === "member"} disabled={!member.email.includes("@")} onPress={async () => { if (await send("member", "POST", "/api/admin/members", member, "Teammate added. They see this page next time they sign in.")) setMember(null); }} flex />
        <Button testID="button-cancel-teammate" kind="ghost" label="Cancel" onPress={() => setMember(null)} flex />
      </View> : <Button testID="button-open-add-teammate" kind="ghost" label="Add teammate" icon="plus" onPress={() => { tap(); setMember({ name: "", email: "" }); }} flex />}

      <Sect title="Time entries" />
      {entries ? <>
        {d.entries.slice(0, entries).map((e) => (
          <View key={e.id} testID="time-entry" style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>{nameOf(e.member)}</Text>: {when(e.start_at)} to {e.end_at ? when(e.end_at) : "still working"}{e.end_at ? ` · ${((+new Date(e.end_at) - +new Date(e.start_at)) / 3600_000).toFixed(1)} h` : ""}{e.source === "auto" ? " · auto, estimated" : ""}</T>
              {e.note ? <T kind="small">{e.note}{e.source === "pr" ? ` (from PR${e.ai_cost ? `, $${e.ai_cost.toFixed(2)} AI` : ""})` : ""}</T> : null}
            </View>
            {e.member === d.me && e.end_at && e.source !== "auto" ? <Pressable testID={`button-remove-entry-${e.id}`} accessibilityRole="button" accessibilityLabel="Remove this entry" onPress={() => send("e" + e.id, "DELETE", `/api/admin/hours/${e.id}`, undefined, "Entry removed")} style={{ padding: 4 }}><T kind="small">Remove</T></Pressable> : null}
          </View>
        ))}
        {!d.entries.length && <T kind="small">No hours logged yet.</T>}
        {d.entries.length > entries && <Button testID="button-more-entries" kind="ghost" label="Show more" onPress={() => setEntries(entries + 20)} flex />}
      </> : <Button testID="button-open-entries" kind="ghost" label={`See time entries (${d.entries.length})`} onPress={() => { tap(); setEntries(20); }} flex />}

      <Sect title="Activity" />
      {runs.length ? <View style={card}>
        {runs.slice(0, acts).map((r, i, all) => { const a = r.items[0]; return (
          <View key={a.id} style={{ gap: 2 }}>
            {(i === 0 || all[i - 1].label !== r.label) && <T kind="label" style={{ marginTop: i ? 6 : 0 }}>{r.label}</T>}
            <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>{first(a.actor)}</Text> {a.action.toLowerCase()}{r.items.length > 1 ? ` ×${r.items.length}` : a.detail ? `: ${pretty(a.detail)}` : ""} <Text style={{ color: c.mutedText }}>· {ago(a.at)}</Text></T>
          </View>); })}
        {runs.length > acts && <Button testID="button-all-activity" kind="ghost" label="Show more" onPress={() => setActs(acts + 20)} flex />}
      </View> : <T kind="small">No activity yet. Adding to-dos, finishing them, meetings and hours all show up here.</T>}
    </ScrollView>
  );
}
