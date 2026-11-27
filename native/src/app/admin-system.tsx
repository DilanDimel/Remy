import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Loading, Sect, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Owners' System, native (the website's Admin → System, client/src/pages/Admin.tsx SystemTab + SavedOpeningsMove):
// is everything up, what AI costs, database space and transfer, emails and texts, and the saved-openings table switch.
type Services = {
  server: { commit: string; branch: string; startedAt: string; uptimeMin: number; memoryMb: number; memoryLimitMb: number };
  errors: { server: number; browser: number };
  ai: { available: false } | { available: true; error?: string; label?: string; account?: { left: number; bought: number; spent: number } | null; usage?: number | null; limit?: number | null; remaining?: number | null; usageDaily?: number | null; usageWeekly?: number | null; usageMonthly?: number | null };
  aiChain: { available: boolean; model: string; via: string; ownerTrial?: string };
};
type Storage = { usedMb: number; limitMb: number; percent: number; tables: { name: string; mb: number; rows: number }[]; workspaces: { n: number; avg_kb: number; max_kb: number; p90_kb: number }; transfer: { monthMb: number; limitGb: number; days: { day: string; mb: number }[] }; backup?: { configured: boolean; lastAt: string | null; lastFull: string | null } };
type Overview = { ai: { calls: number; failed: number }; texts?: { mode: "twilio" | "test"; recent: unknown[] }; emails?: { ready: boolean; reminders: number; digest: number; digestsWeek: number; nudges?: { sent: number; yes: number } } };
type Mode = "off" | "copy" | "owners" | "everyone";
type JobsMove = { mode: Mode; accounts: number; copied: number; left: number; differ: number; skipped: number; jobsInWorkspaces: number; jobsInTable: number };
const MOVE_SAY: Record<Mode, string> = {
  off: "Off. Saved openings live only inside each account, as before.",
  copy: "Copying. Every save also writes the openings to their own table, and each hourly check copies 10 more accounts. Nothing is read from the table yet.",
  owners: "Owners read from the table. Students still read their account's own copy. Check owners' openings for a day before Everyone.",
  everyone: "Everyone's copied openings are read from the table. Accounts still keep their own copy until a later update removes it.",
};
const MODE_NAME: Record<Mode, string> = { off: "Off", copy: "Copy", owners: "Owners", everyone: "Everyone" };
const ASK: Partial<Record<Mode, string>> = {
  copy: "Start copying saved openings into their own table? Remy takes a fresh full backup first, then copies 10 accounts an hour. Accounts keep their own copy, and Off undoes it at once.",
  everyone: "Read every student's saved openings from the new table? Owners should have checked theirs for a day. Each account still keeps its own copy, and Owners or Off switches back at once.",
};
const money = (n?: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);

const backupAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
export default function AdminSystem() {
  const { me } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Services | null>(null);
  const [s, setS] = useState<Storage | null>(null);
  const [o, setO] = useState<Overview | null>(null);
  const [m, setM] = useState<JobsMove | null>(null);
  const [all, setAll] = useState(false);
  const [ask, setAsk] = useState<Mode | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api<Services>("GET", "/api/admin/services").then(setD).catch((x) => setErr(x.message));
    api<Storage>("GET", "/api/admin/storage").then(setS).catch((x) => setErr(x.message));
    api<Overview>("GET", "/api/admin/overview").then(setO).catch(() => {});
    api<JobsMove>("GET", "/api/admin/student-jobs").then(setM).catch(() => {});
  }, []);
  useEffect(load, [load]);
  if (!me?.owner) return null;
  if (!d || !s) return err ? <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}><T style={{ color: c.error }}>{err}</T></View> : <Loading />;

  const up = d.server.uptimeMin < 90 ? `${d.server.uptimeMin} min` : d.server.uptimeMin < 2880 ? `${Math.round(d.server.uptimeMin / 60)} h` : `${Math.round(d.server.uptimeMin / 1440)} days`;
  const ai = d.ai.available && !d.ai.error ? d.ai : null;
  const tp = Math.round((100 * s.transfer.monthMb) / 1024 / s.transfer.limitGb);
  const memP = d.server.memoryLimitMb ? d.server.memoryMb / d.server.memoryLimitMb : 0;
  // The account balance is what runs out (every key draws from it); the live key's own cap is a second limit.
  const aiLeft = ai?.account ? Math.min(ai.account.left, ai.remaining ?? Infinity) : ai?.remaining ?? null;
  const aiLow = !!ai && ((!!ai.account && ai.account.left < 2) || (ai.limit != null && ai.remaining != null && ai.remaining < ai.limit * 0.2));
  const backupLate = !!s.backup && (!s.backup.configured || !s.backup.lastAt || Date.now() - new Date(s.backup.lastAt).getTime() > 36 * 3_600_000);
  const watch = [backupLate && "nightly backups aren't running", tp >= 80 && "data transfer is over the plan", s.percent >= 80 && "the database is almost full", memP >= 0.8 && "memory is almost full", aiLow && "AI money is running low"].filter(Boolean) as string[];
  const maxDay = Math.max(1, ...s.transfer.days.map((x) => x.mb));
  const dayLimit = (s.transfer.limitGb * 1024) / 30;
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 } as const;
  const pick = async (mode: Mode, sure = false) => {
    if (!m || mode === m.mode) return;
    const needs = mode === "everyone" ? ASK.everyone : m.mode === "off" ? ASK.copy : undefined;
    if (needs && !sure) { tap(); setAsk(mode); return; }
    tap(); setBusy(mode); setErr("");
    try { setM(await api<JobsMove>("POST", "/api/admin/student-jobs", { mode })); success(); setAsk(null); } catch (x: any) { setErr(x.message); }
    setBusy("");
  };

  const Tile = ({ big, label, sub, warn, testID }: { big: string; label: string; sub: string; warn?: boolean; testID?: string }) => (
    <View testID={testID} style={{ ...card, flexBasis: "47%", flexGrow: 1, gap: 4, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontFamily: font.display, fontSize: 22, color: c.ink }}>{big}</Text>
        <View accessibilityLabel={warn ? "needs a look" : "fine"} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: warn ? c.fox : c.sage }} />
      </View>
      <T kind="label">{label}</T>
      <T kind="small" style={{ color: c.mutedText }}>{sub}</T>
    </View>
  );
  const Line = ({ a, b, z }: { a: string; b: string; z?: string }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
      <T kind="small" style={{ flex: 1 }} numberOfLines={1}>{a}</T>
      <T kind="small" style={{ fontFamily: font.semi }}>{b}</T>
      {z ? <T kind="small" style={{ color: c.mutedText, minWidth: 76, textAlign: "right" }}>{z}</T> : null}
    </View>
  );

  return (
    <ScrollView testID="admin-system" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 32 }}>
      <View style={{ gap: 4 }}>
        <T kind="title">System</T>
        <T style={{ color: c.mutedText }}>{watch.length ? `Everything is up. To watch: ${watch.join(", ")}.` : "Everything is up and within its plan."}</T>
      </View>
      {err ? <T style={{ color: c.error }}>{err}</T> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Tile big="Up" label="Server" sub={`version ${d.server.commit || "local"} · running ${up}`} />
        <Tile big={`${d.server.memoryMb} MB`} label="Memory in use" sub={`of ${d.server.memoryLimitMb} MB on the plan`} warn={memP >= 0.8} />
        <Tile testID="system-ai-money" big={ai ? (aiLeft != null ? money(aiLeft) : "No cap") : "—"} label="AI money left" warn={aiLow}
          sub={!ai ? (d.ai.available && d.ai.error) || "OPENROUTER_API_KEY isn't set" : ai.account ? `${money(ai.account.spent)} spent of ${money(ai.account.bought)}` : "Only this key's cap"} />
        <Tile big={`${s.percent}%`} label="Database space" sub={`${s.usedMb} of ${s.limitMb} MB · avg account ${s.workspaces.avg_kb} KB`} warn={s.percent >= 80} />
      </View>

      <><Sect title="Data transfer this month" />
        <View testID="system-transfer" style={card}>
          <T kind="small" style={{ color: c.mutedText }}>{(s.transfer.monthMb / 1024).toFixed(1)} GB of {s.transfer.limitGb} GB · {tp}%</T>
          {s.transfer.days.length > 0 && (
            <View accessibilityRole="image" accessibilityLabel={`Data read per day: ${s.transfer.days.map((x) => `${x.day.slice(5)} ${x.mb} MB`).join(", ")}`}
              style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 72 }}>
              {s.transfer.days.map((x) => <View key={x.day} style={{ flex: 1, height: Math.max(2, (x.mb / maxDay) * 64), borderRadius: 2, backgroundColor: x.mb > dayLimit ? c.fox : c.line }} />)}
            </View>
          )}
          <T kind="small" style={{ color: c.mutedText }}>Orange days read more than the plan allows per day ({Math.round(dayLimit)} MB). Every page a student opens reads their account, so account size drives this.</T>
        </View>
      </>

      <><Sect title="Biggest tables" />
        <View style={card}>
          {(all ? s.tables : s.tables.slice(0, 5)).map((t) => <Line key={t.name} a={t.name} b={`${t.mb} MB`} z={`${t.rows.toLocaleString()} rows`} />)}
          {all ? <T kind="small" style={{ color: c.mutedText }}>{s.workspaces.n} accounts stored · 90% under {s.workspaces.p90_kb} KB · largest {s.workspaces.max_kb} KB. Started {new Date(d.server.startedAt).toLocaleString()}.</T> : null}
          {s.backup ? (
            <View testID="system-backup">
              <Line a="Backup" b={!s.backup.configured ? "not set up" : s.backup.lastAt ? backupAgo(s.backup.lastAt) : "none yet"}
                z={!s.backup.configured ? "no R2 settings" : s.backup.lastFull ? `full copy ${s.backup.lastFull}` : ""} />
            </View>
          ) : null}
          {s.tables.length > 5 ? <Button testID="button-all-tables" kind="ghost" label={all ? "Show fewer" : `All ${s.tables.length}`} onPress={() => { tap(); setAll(!all); }} flex /> : null}
        </View>
      </>

      <><Sect title="AI" />
        <View testID="system-ai" style={card}>
          <T kind="small" style={{ color: c.mutedText }}>{d.aiChain.available ? "On" : "Off"} · {d.aiChain.via} · {d.aiChain.model}{d.aiChain.ownerTrial ? ` · owners are trying ${d.aiChain.ownerTrial}` : ""}</T>
          <Line a="Calls this week" b={o ? String(o.ai.calls) : "…"} z={o ? `${o.ai.failed} failed` : ""} />
          <Line a="Spend this week" b={ai ? money(ai.usageWeekly) : "—"} z={ai ? `today ${money(ai.usageDaily)}` : ""} />
          {ai ? <Line a="Spend this month" b={money(ai.usageMonthly)} /> : null}
        </View>
      </>

      <><Sect title="Emails & texts" />
        <View testID="admin-texts" style={card}>
          <Line a="Errors last 24 h" b={String(d.errors.server + d.errors.browser)} />
          {o?.emails ? <>
            <Line a="Deadline reminders" b={o.emails.ready ? `${o.emails.reminders} students` : "off"} />
            <Line a="Weekly digest" b={o.emails.ready ? `${o.emails.digestsWeek} this week · ${o.emails.digest} get it` : "off"} />
            {o.emails.nudges ? <Line a="Match emails (owners)" b={`${o.emails.nudges.sent} sent · ${o.emails.nudges.yes} Yes`} /> : null}
            {!o.emails.ready ? <T kind="small" style={{ color: c.mutedText }}>Set SMTP_URL on the server to send reminders and digests.</T> : null}
          </> : null}
          {o?.texts ? <Line a="Urgent texts" b={o.texts.mode === "test" ? "test mode: nothing is sent" : `Twilio · ${o.texts.recent.length} recent`} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button testID="link-digitalocean" kind="ghost" label="DigitalOcean" onPress={() => Linking.openURL("https://cloud.digitalocean.com/apps")} />
            <Button testID="link-openrouter" kind="ghost" label="OpenRouter credits" onPress={() => Linking.openURL("https://openrouter.ai/settings/credits")} />
          </View>
        </View>
      </>

      {m ? (
        <><Sect title="Saved openings table" />
          <View testID="system-student-jobs" style={card}>
            <T kind="small">{MOVE_SAY[m.mode]}</T>
            {m.mode !== "off" ? <>
              <Line a="Accounts copied" b={`${m.copied} of ${m.accounts}`} z={`${m.left} to go`} />
              <Line a="Openings in the table" b={m.jobsInTable.toLocaleString()} z={`${m.jobsInWorkspaces.toLocaleString()} in accounts`} />
              <Line a="Different from the account" b={String(m.differ)} z={`${m.skipped} left out`} />
            </> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["off", "copy", "owners", "everyone"] as const).map((x) => (
                <Button key={x} testID={`button-student-jobs-${x}`} kind={m.mode === x ? "ink" : "ghost"} label={MODE_NAME[x]} busy={busy === x}
                  disabled={x === "everyone" && m.mode !== "owners" && m.mode !== "everyone"} onPress={() => pick(x)} />
              ))}
            </View>
            {ask ? (
              <View testID="system-confirm" style={{ gap: 10, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
                <T kind="small">{ASK[ask]}</T>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button testID="button-student-jobs-confirm" label="Yes, switch" busy={busy === ask} onPress={() => pick(ask, true)} flex />
                  <Button testID="button-student-jobs-cancel" kind="ghost" label="Cancel" onPress={() => setAsk(null)} flex />
                </View>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <Button testID="button-system-refresh" kind="ghost" icon="undo" label="Refresh" onPress={() => { tap(); load(); }} flex />
    </ScrollView>
  );
}
