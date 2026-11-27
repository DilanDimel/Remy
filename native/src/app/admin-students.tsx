import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { acceptDraft } from "@shared/acceptEmail";
import { Button, Loading, Sect, Segmented, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Owners' Students, native (the website's Admin → Students, client/src/pages/Admin.tsx BetaTab + Applications +
// FunnelCard + UsedCard): who's in, student counts, sign-up steps, Insider check-ins, a student's details, Add by email,
// the form's applications (accept with the "You're in" email, next cohort, decline) and who's applying. The sign-in
// switch and feature releases are on the dashboard's first screen. Same /api/admin calls.
type AppStatus = "new" | "accepted" | "next" | "declined";
type BetaRow = { email: string };
type BetaData = { on: boolean; open: boolean; emailReady: boolean; list: BetaRow[] };
type Person = { email: string; name: string; school: string; major: string; classYear: string; goal: string; stuck: string; tools: string; source: string; status: AppStatus; onList: boolean; cohort: string; appliedAt: string | null; signedUpAt: string | null; days: number; lastDay: string | null; insider: { joinedAt: string } | null };
type Counts = { total: number; today: number; week: number; month: number; activeToday: number; activeWeek: number; setUp: number; resume: number; team: number };
type StudentsData = { counts?: Counts; people: Person[]; surveys: { question: string; answer: string; email: string; at: string }[] };
type Split = { label: string; applied: number; accepted: number };
type Funnel = { applied: number; accepted: number; next: number; declined: number; waiting: number; feedback: number; on_list: number; signed_in: number; set_up: number; active_week: number; bySchool: Split[]; byYear: Split[]; bySource: Split[]; byStuck: Split[] };
type Application = { email: string; name: string; school: string; major: string; classYear: string; goal: string; stuck: string; tools: string; feedback: string; source: string; terms: string; status: AppStatus; cohort: string; decidedBy: string; decidedAt: string | null; receivedAt: string };
type Used = { features: { name: string; students: number; uses: number }[]; ai: { calls: number; failed: number; avgMs: number } };
const APP_TABS: { key: AppStatus; label: string }[] = [{ key: "new", label: "New" }, { key: "accepted", label: "Accepted" }, { key: "next", label: "Next" }, { key: "declined", label: "Declined" }];
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : one + "s"}`;
const pctOf = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const day = (d: string) => new Date(d.length === 10 ? d + "T12:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
// Beta testers and Beta Insiders are one group: anyone on the old tester list joins Insider on their next visit.
const insider = (p: Person) => !!p.insider || p.onList || (!!p.appliedAt && p.status === "accepted");
const stage = (p: Person): string => p.insider ? `Insider since ${day(p.insider.joinedAt)}`
  : p.signedUpAt && insider(p) ? "Insider from next visit"
  : p.signedUpAt && p.days >= 3 ? "Invited to Insider" : p.signedUpAt ? `${p.days} of 3 days` : p.status === "accepted" || p.onList ? "Hasn't signed in" : p.status === "next" ? "Next cohort" : p.status === "declined" ? "Declined" : "Applied";

export default function AdminStudents() {
  const { me } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<BetaData | null>(null);
  const [st, setSt] = useState<StudentsData | null>(null);
  const [fun, setFun] = useState<Funnel | null>(null);
  const [used, setUsed] = useState<Used | null>(null);
  const [apps, setApps] = useState<{ applications: Application[]; hookReady: boolean } | null>(null);
  const [view, setView] = useState<"everyone" | "insiders" | "applied">("everyone");
  const [find, setFind] = useState("");
  const [open, setOpen] = useState("");
  const [drop, setDrop] = useState("");
  const [shown, setShown] = useState(30);
  const [panel, setPanel] = useState<"" | "apps" | "add" | "more">("");
  const [add, setAdd] = useState({ emails: "", note: "", notify: true });
  const [show, setShow] = useState<AppStatus>("new");
  const [cohort, setCohort] = useState("Cohort 1");
  const [fb, setFb] = useState(false);
  const [draft, setDraft] = useState<{ a: Application; subject: string; message: string } | null>(null);
  const [askClear, setAskClear] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [said, setSaid] = useState("");
  const loadSt = useCallback(() => api<StudentsData>("GET", "/api/admin/students").then(setSt).catch(() => {}), []);
  useEffect(() => {
    if (!me?.owner) return;
    api<BetaData>("GET", "/api/admin/beta").then(setD).catch((e) => setErr(e.message));
    void loadSt();
    api<Funnel>("GET", "/api/admin/funnel").then(setFun).catch(() => {});
  }, [me?.owner, loadSt]);
  useEffect(() => {
    if (panel === "apps" && !apps) api<{ applications: Application[]; hookReady: boolean }>("GET", "/api/admin/beta/applications").then(setApps).catch((e) => setErr(e.message));
    if (panel === "more" && !used) api<Used>("GET", "/api/admin/overview").then(setUsed).catch(() => {});
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me?.owner) return null;
  if (!d) return err ? <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}><T style={{ color: c.error }}>{err}</T></View> : <Loading />;
  const act = async (key: string, f: () => Promise<string | void>) => { tap(); setBusy(key); setErr(""); setSaid(""); try { const ok = await f(); success(); if (ok) setSaid(ok); } catch (x: any) { setErr(x.message); } setBusy(""); };
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 } as const;
  const people = st?.people || [];
  const insiders = people.filter(insider), applied = people.filter((p) => p.status === "new" || p.status === "next");
  const everyone = people.filter((p) => p.signedUpAt).sort((a, b) => (b.signedUpAt || "").localeCompare(a.signedUpAt || ""));
  const k = st?.counts;
  const rows = (view === "everyone" ? everyone : view === "insiders" ? insiders : applied).filter((p) => !find || `${p.name} ${p.email} ${p.school} ${p.major}`.toLowerCase().includes(find.toLowerCase()));
  const signedIn = insiders.filter((p) => p.signedUpAt).length;
  const rates = (st?.surveys || []).filter((x) => /^[1-5]$/.test(x.answer)).map((x) => Number(x.answer));
  const words = (st?.surveys || []).filter((x) => !/^[1-5]$/.test(x.answer));
  const Steps = ({ items }: { items: [string, number, string][] }) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{items.map(([l, n, note]) => (
      <View key={l} style={{ flexBasis: "30%", flexGrow: 1, backgroundColor: c.bg, borderRadius: radius.card, padding: 10, gap: 1 }}>
        <Text style={{ fontFamily: font.display, fontSize: 20, color: c.ink }}>{n}</Text><T kind="label">{l}</T><T kind="small">{note}</T>
      </View>))}</View>
  );
  const remove = (email: string) => act("rm", async () => { const r = await api<{ list: BetaRow[] }>("DELETE", `/api/admin/beta/${encodeURIComponent(email)}` as `/api/${string}`); setD({ ...d, list: r.list }); setDrop(""); setOpen(""); await loadSt(); return "Removed"; });
  const accept = () => act("add", async () => {
    const r = await api<BetaData & { added: string[]; already: string[]; wrong: string[]; invited: string[] }>("POST", "/api/admin/beta", { emails: add.emails, note: add.note, notify: add.notify && d.emailReady });
    setD({ ...d, list: r.list }); setAdd({ ...add, emails: "" }); await loadSt();
    return [`${r.added.length} accepted`, r.invited.length ? `${r.invited.length} emailed` : "", r.already.length ? `${r.already.length} already on the list` : "", r.wrong.length ? `not emails: ${r.wrong.join(", ")}` : ""].filter(Boolean).join(" · ");
  });
  const decide = (a: Application, status: AppStatus, mail?: { subject: string; message: string }) => act("app-" + a.email, async () => {
    const r = await api<{ applications: Application[]; list: BetaRow[]; invited: boolean; emailError: string }>("POST", `/api/admin/beta/applications/${encodeURIComponent(a.email)}` as `/api/${string}`, { status, cohort: status === "accepted" ? (a.status === "accepted" && a.cohort ? a.cohort : cohort) : "", ...(mail ? { notify: true, ...mail } : {}) });
    setApps({ ...apps!, applications: r.applications }); setD({ ...d, list: r.list }); setDraft(null);
    if (r.emailError) throw new Error(r.emailError);
    return status === "accepted" ? `${a.name || a.email} accepted${r.invited ? " and emailed" : ""}: they can sign in now` : status === "next" ? "Moved to next cohort" : status === "declined" ? "Declined" : "Moved back to New";
  });
  const all = apps?.applications || [];
  const appRows = all.filter((a) => a.status === show && (!fb || /^yes/i.test(a.feedback)));
  const tally = (key: "stuck" | "source" | "goal") => Object.entries(all.reduce<Record<string, number>>((m, a) => { const x = a[key] || "—"; m[x] = (m[x] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]).slice(0, 5);
  const table = (title: string, rs: Split[]) => (
    <View style={{ gap: 4 }}><T kind="label">{title}</T>
      {rs.map((r) => <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><T kind="small" style={{ flex: 1, color: c.ink }} numberOfLines={1}>{r.label}</T><T kind="small">{r.applied} applied · {r.accepted} in</T></View>)}
      {!rs.length && <T kind="small">No applications yet.</T>}
    </View>
  );

  return (
    <ScrollView testID="admin-students" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 32 }}>
      <T kind="muted">{k ? <Text style={{ fontFamily: font.bold, color: c.ink }}>{plural(k.total, "student profile")}. </Text> : null}{k ? `${k.today} new today, ${k.week} this week. ` : ""}{plural(insiders.length, "Beta Insider")}{applied.length ? `, ${plural(applied.length, "application")} waiting for a decision.` : `, ${signedIn} signed in.`}</T>
      <T kind="small">{d.open ? "Open to everyone." : d.on ? "Invite-only." : "Anyone can sign in."} The sign-in switch and feature releases are on the dashboard's first screen.</T>
      {err ? <T style={{ color: c.error }}>{err}</T> : null}
      {said ? <T kind="small" style={{ color: c.sage }}>{said}</T> : null}

      <Segmented testID="students-panel" value={panel || "list"} onChange={(v) => { setPanel(v === "list" ? "" : v); setSaid(""); }}
        options={[{ key: "list", label: "Who's in" }, { key: "apps", label: `Applied${applied.length ? ` ${applied.length}` : ""}` }, { key: "add", label: "Add" }, { key: "more", label: "Stats" }]} />

      {panel === "" && <>
        <Segmented testID="students-view" value={view} onChange={(v) => { setView(v); setShown(30); }} options={[{ key: "everyone", label: `All ${everyone.length}` }, { key: "insiders", label: `Insiders ${insiders.length}` }, { key: "applied", label: `Applied ${applied.length}` }]} />
        <Input testID="input-students-search" value={find} onChangeText={setFind} placeholder="Search a name, email, school or major" autoCapitalize="none" />
        {!st && <Loading />}
        {rows.slice(0, shown).map((p) => (
          <View key={p.email} style={card}>
            <Pressable testID="row-student" accessibilityRole="button" accessibilityState={{ expanded: open === p.email }} onPress={() => { tap(); setOpen(open === p.email ? "" : p.email); setDrop(""); }} style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <T style={{ flex: 1, fontFamily: font.semi }} numberOfLines={1}>{p.name || p.email}</T>
                <T kind="small" style={{ color: p.insider ? c.fox : c.mutedText }}>{stage(p)}</T>
              </View>
              <T kind="small" numberOfLines={1}>{[p.name ? p.email : "", view === "everyone" && p.signedUpAt ? `joined ${ago(p.signedUpAt)}` : "", p.school, p.classYear, p.major].filter(Boolean).join(" · ")}{p.goal ? ` · wants ${p.goal}` : ""}</T>
            </Pressable>
            {open === p.email && <View testID="student-detail" style={{ gap: 4, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }}>
              <T kind="small" style={{ color: c.ink }}>{stage(p)}{p.cohort ? ` · ${p.cohort}` : ""}{p.signedUpAt ? ` · signed up ${ago(p.signedUpAt)} · used Remy on ${plural(p.days, "day")}${p.lastDay ? `, last ${day(p.lastDay)}` : ""}` : ""}</T>
              {([["Trying to land", p.goal], ["Stuck on", p.stuck], ["Also uses", p.tools], ["Heard from", p.source]] as const).map(([l, v]) => <T key={l} kind="small"><Text style={{ fontFamily: font.bold, color: c.ink }}>{l}:</Text> {v || "—"}</T>)}
              {p.appliedAt ? <T kind="small">On file since {ago(p.appliedAt)}</T> : null}
              {p.onList ? (drop === p.email ? <View style={{ gap: 8 }}>
                <T kind="small" style={{ color: c.ink }}>Take {p.email} off the sign-in list? They won't be able to sign in while Remy is invite-only (their saved work stays).</T>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button testID="button-student-remove-confirm" label="Take off" busy={busy === "rm"} onPress={() => remove(p.email)} flex />
                  <Button testID="button-student-remove-cancel" kind="ghost" label="Keep" onPress={() => setDrop("")} flex />
                </View>
              </View> : <Button testID="button-student-remove" kind="ghost" label="Take off the sign-in list" onPress={() => { tap(); setDrop(p.email); }} />) : null}
            </View>}
          </View>
        ))}
        {st && !rows.length && <T kind="small">{find ? "Nobody matches." : view === "everyone" ? "No accounts yet." : view === "insiders" ? "No insiders yet. Students are invited after 3 days of use, once Remy is open to everyone." : "No applications waiting."}</T>}
        {rows.length > shown && <Button testID="button-more-students" kind="ghost" label="Show more" onPress={() => setShown(shown + 30)} flex />}

        <Sect title="Student profiles" right={k && k.team > 0 ? <T kind="small">Team ({k.team}) not counted</T> : undefined} />
        <View testID="student-counts" style={card}>{k ? <Steps items={[["Profiles", k.total, `${k.month} in 30 days`], ["Today", k.today, "new"], ["7 days", k.week, "new"], ["Active", k.activeWeek, `${k.activeToday} today`], ["Set up", k.setUp, `${k.resume} with a resume`]]} /> : <Loading />}</View>
        <Sect title="From sign-up to using Remy" />
        <View testID="beta-steps" style={card}>{fun ? <Steps items={([["Applied", fun.applied], ["Accepted", fun.on_list], ["Signed in", fun.signed_in], ["Set up", fun.set_up], ["This week", fun.active_week]] as [string, number][]).map(([l, n], i, a) => [l, n, i ? pctOf(n, a[i - 1][1]) : " "])} /> : <Loading />}</View>
        <Sect title="Insider check-ins" right={rates.length ? <T kind="small">{(rates.reduce((x, y) => x + y, 0) / rates.length).toFixed(1)} of 5 useful</T> : undefined} />
        <View testID="insider-checkins" style={card}>
          {words.slice(0, 30).map((x, i) => <View key={i} style={{ gap: 2 }}><T kind="small" style={{ color: c.ink }}>{x.answer}</T><T kind="small">{x.email.split("@")[0]} · {ago(x.at)}</T></View>)}
          {st && !words.length && <T kind="small">No answers yet. Insiders get three questions a week after they join, then every two weeks. Remy brings them here.</T>}
        </View>
      </>}

      {panel === "add" && <View testID="add-emails" style={card}>
        <T kind="small">Makes them Beta Insiders (the secret pin and the check-ins) on their next visit, and lets them sign in if Remy goes back to invite-only.</T>
        <Input testID="input-beta-emails" value={add.emails} onChangeText={(v) => setAdd({ ...add, emails: v })} placeholder="Emails, one per line or separated by commas" multiline autoCapitalize="none" keyboardType="email-address" style={{ minHeight: 90 }} />
        <Input testID="input-beta-note" value={add.note} onChangeText={(v) => setAdd({ ...add, note: v })} placeholder="Note, e.g. Cohort 1 · tcu-table (optional)" maxLength={200} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Switch testID="switch-beta-notify" value={add.notify && d.emailReady} disabled={!d.emailReady} onValueChange={(v) => setAdd({ ...add, notify: v })} />
          <T kind="small" style={{ flex: 1 }}>Email them “You're in” with the sign-in link{d.emailReady ? "" : " (email isn't set up on this server)"}</T>
        </View>
        <Button testID="button-beta-add" label="Accept" icon="plus" busy={busy === "add"} disabled={!add.emails.trim()} onPress={accept} flex />
      </View>}

      {panel === "apps" && (!apps ? <Loading /> : <>
        {!apps.hookReady && <T kind="small" style={{ color: c.foxDeep }}>The form isn't connected yet: set OR_BETA_HOOK_SECRET on the server and add the script from docs/beta-form-hook.gs to the form.</T>}
        {all.length > 0 && <View style={card}>{(["stuck", "goal", "source"] as const).map((x) => <T key={x} kind="small"><Text style={{ fontFamily: font.bold, color: c.ink }}>{x === "stuck" ? "Stuck on" : x === "goal" ? "Wants" : "Heard from"}:</Text> {tally(x).map(([v, n]) => `${v} (${n})`).join(" · ")}</T>)}</View>}
        <Segmented testID="apps-tab" value={show} onChange={setShow} options={APP_TABS.map((t) => ({ key: t.key, label: `${t.label} ${all.filter((a) => a.status === t.key).length}` }))} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Switch testID="switch-apps-feedback" value={fb} onValueChange={setFb} />
          <T kind="small" style={{ flex: 1 }}>Only those who'll give feedback</T>
        </View>
        <Input testID="input-apps-cohort" label="Accept into" value={cohort} onChangeText={setCohort} />
        {appRows.map((a) => (
          <View key={a.email} testID="row-application" style={card}>
            <T style={{ fontFamily: font.semi }}>{a.name || "(no name)"}</T>
            <T kind="small">{[a.email, a.school, a.classYear, a.major].filter(Boolean).join(" · ")}</T>
            <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>Wants:</Text> {a.goal || "—"} · <Text style={{ fontFamily: font.bold }}>Stuck on:</Text> {a.stuck || "—"} · <Text style={{ fontFamily: font.bold }}>Uses:</Text> {a.tools || "—"}</T>
            <T kind="small">Feedback each week: {a.feedback || "—"} · Heard from: {a.source || "—"} · Applied {ago(a.receivedAt)}{a.decidedAt ? ` · ${a.status}${a.cohort ? ` (${a.cohort})` : ""} by ${a.decidedBy} ${ago(a.decidedAt)}` : ""}{/18|parent/i.test(a.terms) ? "" : " · age/terms box not confirmed"}</T>
            {draft?.a.email === a.email ? <View testID="accept-email" style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }}>
              <T kind="small">To: {a.email} · from the Remy email. Edit anything before it goes.</T>
              <Input testID="input-accept-subject" value={draft.subject} onChangeText={(v) => setDraft({ ...draft, subject: v })} maxLength={150} />
              <Input testID="input-accept-message" value={draft.message} onChangeText={(v) => setDraft({ ...draft, message: v })} multiline maxLength={5000} style={{ minHeight: 200 }} />
              {!d.emailReady && <T kind="small" style={{ color: c.foxDeep }}>Email isn't set up on this server, so this can't be sent from here. Accept without email and send it from the Remy inbox instead.</T>}
              <Button testID="button-accept-send" label={a.status === "accepted" ? "Send email" : "Accept & send email"} busy={busy === "app-" + a.email} disabled={!d.emailReady || !draft.message.trim()} onPress={() => decide(a, "accepted", { subject: draft.subject, message: draft.message })} flex />
              {a.status !== "accepted" && <Button testID="button-accept-quiet" kind="ghost" label="Accept without email" onPress={() => decide(a, "accepted")} flex />}
              <Button testID="button-accept-cancel" kind="ghost" label="Cancel" onPress={() => setDraft(null)} flex />
            </View> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button testID="button-app-accept" label={a.status === "accepted" ? "Email them" : "Accept"} disabled={!!busy} onPress={() => { tap(); setDraft({ a, ...acceptDraft({ name: a.name, email: a.email, cohort: a.status === "accepted" && a.cohort ? a.cohort : cohort }) }); }} />
              {a.status !== "next" && <Button testID="button-app-next" kind="ghost" label="Next cohort" disabled={!!busy} onPress={() => decide(a, "next")} />}
              {a.status !== "declined" && <Button testID="button-app-decline" kind="ghost" label="Decline" disabled={!!busy} onPress={() => decide(a, "declined")} />}
              {a.status !== "new" && <Button testID="button-app-new" kind="ghost" label="Back to New" disabled={!!busy} onPress={() => decide(a, "new")} />}
            </View>}
          </View>
        ))}
        {!appRows.length && <T kind="small">{all.length ? "Nothing here with these filters." : "No applications yet. They appear here seconds after someone submits the form."}</T>}
        {show === "declined" && all.some((a) => a.status === "declined") && (askClear ? <View style={card}>
          <T kind="small" style={{ color: c.ink }}>Delete every declined application? Do this once the cohort has closed. It can't be undone.</T>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button testID="button-clear-declined-confirm" label="Delete declined" busy={busy === "clear"} onPress={() => act("clear", async () => { const r = await api<{ deleted: number; applications: Application[] }>("DELETE", "/api/admin/beta/applications"); setApps({ ...apps, applications: r.applications }); setAskClear(false); return `${r.deleted} declined application${r.deleted === 1 ? "" : "s"} deleted`; })} flex />
            <Button testID="button-clear-declined-cancel" kind="ghost" label="Keep" onPress={() => setAskClear(false)} flex />
          </View>
        </View> : <Button testID="button-clear-declined" kind="ghost" label="Delete declined (after the cohort closes)" onPress={() => { tap(); setAskClear(true); }} flex />)}
      </>)}

      {panel === "more" && <>
        {fun ? <View testID="beta-funnel" style={card}>
          <T kind="h2">Founding Cohort</T>
          <T kind="small">From the form to students using Remy this week. Counts only.</T>
          <Steps items={[["Applied", fun.applied, `${fun.waiting} waiting · ${fun.next} next · ${fun.declined} declined`], ["Accepted", fun.on_list, `${fun.accepted} from the form`], ["Signed in", fun.signed_in, `${pctOf(fun.signed_in, fun.on_list)} of accepted`], ["Set up", fun.set_up, `${pctOf(fun.set_up, fun.signed_in)} of signed in`], ["This week", fun.active_week, `${pctOf(fun.active_week, fun.set_up)} of set up`]]} />
          {table("By school", fun.bySchool)}{table("By class year", fun.byYear)}{table("Heard about Remy from", fun.bySource)}{table("Where they're stuck", fun.byStuck)}
          <T kind="small">{fun.feedback} of {fun.applied} said they'll give feedback each week.</T>
        </View> : <Loading />}
        <View testID="admin-features" style={card}>
          <T kind="h2">What students used this week</T>
          {used ? <>
            {used.features.map((x) => <View key={x.name} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><T kind="small" style={{ flex: 1, color: c.ink }} numberOfLines={1}>{x.name}</T><T kind="small">{plural(x.students, "student")} · {x.uses}×</T></View>)}
            {!used.features.length && <T kind="small">Nothing yet this week.</T>}
            <T kind="small">AI calls: {used.ai.calls}, {used.ai.failed} failed, {(used.ai.avgMs / 1000).toFixed(1)} s on average.</T>
          </> : <Loading />}
        </View>
      </>}
    </ScrollView>
  );
}
