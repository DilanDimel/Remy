import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Contact, OutreachDraft, Workspace } from "@shared/types";
import { sameOrg } from "@shared/org";
import { Button, Remy, Sect, T, success, tap } from "@/components/ui";
import { Input, useSave } from "@/components/setup/common";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { useOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Community, native (it opened the website's /community; client/src/pages/Community.tsx, the owner layout): Remy's
// line, one nudge, alumni, the people you met with Remy's keep-in-touch advice, drafts, and Add a contact. Remy never
// sends anything: an approved email opens in the student's own mail app.
const rid = (p: string) => p + Math.random().toString(36).slice(2, 10);
const todayKey = () => new Date().toLocaleDateString("en-CA");
const fmt = (d: string) => new Date(d.length === 10 ? d + "T12:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const initialsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "•";
const blank = () => ({ name: "", title: "", org: "", email: "", why: "", met: "", metOn: todayKey() });
type Form = ReturnType<typeof blank>;

export default function CommunityScreen() {
  const { ws } = useSession();
  const owner = useOwnerView();
  if (ws && !owner) return <Redirect href={{ pathname: "/web", params: { path: "/community", title: "Community" } } as any} />;
  return ws ? <People /> : null;
}

/** Days since they were last in touch (met or wrote), or null. */
function lastTouch(w: Workspace, p: Contact): number | null {
  const dates = [p.metOn || "", ...w.outreach.filter((o) => o.contactId === p.id).map((o) => o.createdAt.slice(0, 10))].filter(Boolean).sort();
  const last = dates[dates.length - 1];
  return last ? Math.max(0, Math.floor((Date.now() - Date.parse(last + "T12:00")) / 864e5)) : null;
}

/** The website's keepInTouch: a thank-you within two days, then a check-in about every six weeks, and one thing to talk about. */
function keepInTouch(w: Workspace, p: Contact, openings: number) {
  const today = todayKey();
  const sent = w.outreach.filter((o) => o.contactId === p.id && o.status !== "draft").map((o) => o.createdAt.slice(0, 10)).sort().pop();
  const first = p.name.split(" ")[0];
  let when: string;
  if (!sent && p.metOn && Date.parse(today) - Date.parse(p.metOn) <= 2 * 864e5) when = "Send a thank-you today or tomorrow, while they remember you.";
  else if (!sent) when = `Write ${first} a short hello this week.`;
  else {
    const next = new Date(Date.parse(sent + "T12:00") + 42 * 864e5).toLocaleDateString("en-CA");
    when = next <= today ? "Check in now: it's been six weeks since your last email." : `Check in around ${fmt(next)} with a short update.`;
  }
  const talk = openings ? `The ${openings === 1 ? "opening" : `${openings} openings`} at ${p.org} on your list: ask what the team is like.`
    : p.met ? `Something you talked about at ${p.met}, then one question about their work${p.org ? ` at ${p.org}` : ""}.`
    : `What their work${p.org ? ` at ${p.org}` : ""} is like day to day, and how they got there.`;
  return { when, talk };
}

function People() {
  const { ws } = useSession();
  const save = useSave();
  const { jobs } = useJobs();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ met?: string; metOn?: string }>();
  const w = ws!;
  // From Home's "Did you meet anyone at …?": the form opens with where and when filled in, and they stay for the next person.
  const fromEvent = params.met ? { met: String(params.met).slice(0, 200), metOn: /^\d{4}-\d{2}-\d{2}$/.test(params.metOn || "") ? params.metOn! : todayKey() } : null;
  const [form, setForm] = useState<Form | null>(fromEvent ? { ...blank(), ...fromEvent } : null);
  const [event, setEvent] = useState(fromEvent);
  const [notNow, setNotNow] = useState("");
  const [review, setReview] = useState<OutreachDraft | null>(null);
  const [asking, setAsking] = useState<Contact | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const openAt = (org: string) => jobs.filter((j) => org && sameOrg(j.company, org) && !w.hiddenJobIds.includes(j.id));
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 } as const;
  const run = async (f: () => Promise<unknown>) => { setErr(""); try { await f(); return true; } catch (e: any) { setErr(e.message); return false; } };
  const writeTo = async (p: Contact) => {
    const d: OutreachDraft = { id: rid("o"), contactId: p.id, to: p.email, subject: "", body: "", status: "draft", createdAt: new Date().toISOString() };
    tap(); if (await run(() => save("outreach", [...w.outreach, d]))) setReview(d);
  };
  const remove = (p: Contact) => { tap(); void run(() => save("contacts", w.contacts.filter((x) => x.id !== p.id))); };

  const unwritten = w.contacts.filter((p) => !w.outreach.some((o) => o.contactId === p.id));
  const metNew = unwritten.filter((p) => p.met && p.metOn).sort((a, b) => (b.metOn || "").localeCompare(a.metOn || ""))[0];
  const hiring = unwritten.find((p) => p.org && openAt(p.org).length);
  const nudge = metNew ? { c: metNew, title: `Thank ${metNew.name.split(" ")[0]} for meeting you`, why: `You met at ${metNew.met} on ${fmt(metNew.metOn!)}.` }
    : hiring ? { c: hiring, title: `Ask ${hiring.name.split(" ")[0]} about ${hiring.org}`, why: `${hiring.org} has ${openAt(hiring.org).length} opening${openAt(hiring.org).length === 1 ? "" : "s"} on your list.` } : null;
  const warm = w.contacts.map((p) => ({ p, d: lastTouch(w, p) })).filter((x) => x.d !== null).sort((a, b) => a.d! - b.d!)[0];
  const p = w.profile;
  const school = p.school || "your school";
  const role = (p.targetRoles || "").split(",")[0].trim().toLowerCase();
  const alums = w.contacts.filter((x) => /\balum/i.test(x.why) || /\balum/i.test(x.title)).length;

  return (
    <ScrollView testID="community-screen" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
      <T kind="muted">
        <Text style={{ fontFamily: font.bold, color: c.ink }}>{w.contacts.length ? `${w.contacts.length} ${w.contacts.length === 1 ? "person" : "people"} can help you.` : "Start with one person."}</Text>
        {w.contacts.length ? (warm ? ` You were last in touch with ${warm.p.name.split(" ")[0]}${warm.d! < 1 ? " today" : ` ${warm.d} day${warm.d === 1 ? "" : "s"} ago`}, so start there.` : "") : " A recruiter from a fair, a professor or an alum: Remy helps you write to them."}
      </T>
      <Button testID="button-add-contact" label="Add a contact" icon="plus" onPress={() => { tap(); setForm(blank()); }} flex />
      {!!note && <T kind="small" style={{ color: c.sage }}>{note}</T>}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}

      {nudge && nudge.c.id !== notNow && (
        <View testID="community-nudge" style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]}>
          <Text style={kick(c)}>Remy's nudge</Text>
          <T kind="h2">{nudge.title}</T>
          <T kind="small">{nudge.why} Remy drafts it; you edit and send it from your own email.</T>
          <Button testID="button-nudge-draft" label="Draft it for me" icon="zap" onPress={() => { tap(); setAsking(nudge.c); }} flex />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button testID="button-nudge-write" kind="ghost" label="Write it myself" onPress={() => writeTo(nudge.c)} flex />
            <Button testID="button-nudge-not-now" kind="ghost" label="Not now" onPress={() => { tap(); setNotNow(nudge.c.id); }} flex />
          </View>
        </View>
      )}

      <View testID="community-alumni" style={card}>
        <Text style={kick(c)}>Alumni from {school}</Text>
        <T style={{ fontFamily: font.semi }}>{alums ? `${alums} ${alums === 1 ? "alum" : "alumni"} in your people.` : "Alumni answer students from their own school."}</T>
        <T kind="small">Remy will connect you with {school} alumni in {role || "your field"} automatically once your school shares its alumni directory. Until then, find them on LinkedIn and add the ones you write to.</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button testID="link-alumni-linkedin" kind="ghost" label="Find on LinkedIn" onPress={() => Linking.openURL(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.school || ""} ${role}`.trim())}`)} flex />
          <Button testID="button-add-alum" kind="ghost" label="Add an alum" onPress={() => { tap(); setForm({ ...blank(), why: `${p.school || "School"} alum` }); }} flex />
        </View>
      </View>

      <Sect title="People you met" />
      {w.contacts.length ? w.contacts.map((x) => {
        const d = lastTouch(w, x), open = openAt(x.org), g = keepInTouch(w, x, open.length);
        return (
          <View key={x.id} testID="card-contact" style={card}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: font.bold, color: c.foxDeep }}>{initialsOf(x.name)}</Text></View>
              <View style={{ flex: 1 }}><T style={{ fontFamily: font.bold }}>{x.name}</T><T kind="small" numberOfLines={2}>{x.title}{x.org ? ` · ${x.org}` : ""}</T></View>
            </View>
            {d !== null && <View accessibilityLabel="How recently you were in touch" style={{ height: 4, borderRadius: 2, backgroundColor: c.surface2 }}><View style={{ width: `${d < 7 ? 90 : d < 30 ? 60 : d < 90 ? 35 : 15}%`, height: 4, borderRadius: 2, backgroundColor: c.fox }} /></View>}
            {!!x.met && <T kind="small">Met at {x.met}{x.metOn ? ` · ${fmt(x.metOn)}` : ""}</T>}
            {!!x.why && <T kind="small" style={{ color: c.ink }}>{x.why}</T>}
            <View testID="contact-guide" style={{ gap: 4 }}>
              <T kind="small"><Text style={{ fontFamily: font.bold, color: c.ink }}>Next </Text>{g.when}</T>
              <T kind="small"><Text style={{ fontFamily: font.bold, color: c.ink }}>Talk about </Text>{g.talk}</T>
            </View>
            {open.length > 0 && <Pressable testID="contact-openings" onPress={() => router.push({ pathname: "/job", params: { id: open[0].id } } as any)}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.fox }}>{open.length} opening{open.length > 1 ? "s" : ""} at {x.org} →</Text></Pressable>}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button testID="button-write-outreach" label="Write" icon="doc" onPress={() => writeTo(x)} flex />
              <Button testID="button-draft-outreach" kind="ghost" label="Draft it" icon="zap" onPress={() => { tap(); setAsking(x); }} flex />
            </View>
            <Pressable testID="button-remove-contact" accessibilityRole="button" onPress={() => remove(x)} style={{ alignSelf: "center", padding: 6 }}><T kind="small">Remove {x.name.split(" ")[0]}</T></Pressable>
          </View>
        );
      }) : (
        <View testID="community-starters" style={{ gap: 10 }}>
          {([["Recruiter", "Someone from a career fair", "A two-minute chat counts. Remy reminds you to thank them the next day.", { met: "Career fair" }],
            ["Professor", "A professor in your major", "They know who's hiring and write the references.", { title: "Professor", org: p.school || "" }],
            ["Alum", "An alum in your field", "Alumni answer students from their own school more than anyone else.", { why: "Alum in my field" }]] as const).map(([k, t, why, pre]) => (
            <Pressable key={k} testID={`button-starter-${k.toLowerCase()}`} accessibilityRole="button" onPress={() => { tap(); setForm({ ...blank(), ...pre }); }} style={[card, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: font.bold, color: c.foxDeep }}>{k[0]}</Text></View>
              <View style={{ flex: 1, gap: 2 }}><T style={{ fontFamily: font.bold }}>{t}</T><T kind="small">{why}</T><Text style={{ fontFamily: font.bold, fontSize: 13.5, color: c.fox, marginTop: 2 }}>+ Add someone like this</Text></View>
            </Pressable>
          ))}
        </View>
      )}

      {w.outreach.length > 0 && <>
        <Sect title="Drafts" />
        <View style={card}>{w.outreach.map((d, i) => {
          const who = w.contacts.find((x) => x.id === d.contactId);
          return (
            <Pressable key={d.id} testID="button-review-draft" accessibilityRole="button" onPress={() => { tap(); setReview(d); }} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
              <View style={{ flex: 1 }}><T style={{ fontFamily: font.semi }} numberOfLines={1}>{d.subject || "No subject yet"}</T><T kind="small" numberOfLines={1}>To {who?.name || "someone"} · {fmt(d.createdAt)}</T></View>
              <T kind="small" style={{ fontFamily: font.bold, color: d.status === "draft" ? c.mutedText : c.sage }}>{d.status === "draft" ? "Draft" : d.status === "approved" ? "Approved" : "Opened"}</T>
            </Pressable>
          );
        })}</View>
      </>}

      <Modal visible={!!form} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setForm(null); setEvent(null); }}>
        {form && <AddContact form={form} setForm={setForm} event={event} onDone={(said, again) => { setNote(said); if (again && event) setForm({ ...blank(), ...event }); else { setForm(null); setEvent(null); } }} onClose={() => { setForm(null); setEvent(null); }} />}
      </Modal>
      <Modal visible={!!review} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReview(null)}>
        {review && <Review draft={review} onClose={() => setReview(null)} />}
      </Modal>
      <Modal visible={!!asking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAsking(null)}>
        {asking && <DraftFor contact={asking} onClose={(d) => { setAsking(null); if (d) setReview(d); }} />}
      </Modal>
    </ScrollView>
  );
}

const kick = (c: ReturnType<typeof useTheme>["c"]) => ({ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" as const, color: c.foxDeep });

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14 }}>
        <T kind="title">{title}</T>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The website's Add a contact, with the thank-you reminder the day after they met. */
function AddContact({ form, setForm, event, onDone, onClose }: { form: Form; setForm: (f: Form) => void; event: { met: string; metOn: string } | null; onDone: (said: string, again: boolean) => void; onClose: () => void }) {
  const { ws } = useSession();
  const save = useSave();
  const { c } = useTheme();
  const [thank, setThank] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Form) => (v: string) => setForm({ ...form, [k]: v });
  const add = async () => {
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setErr("That email doesn't look right. Fix it or leave it empty."); return; }
    const today = todayKey();
    const metOn = /^\d{4}-\d{2}-\d{2}$/.test(form.metOn) && form.metOn <= today ? form.metOn : today;
    const met = form.met.trim();
    setBusy(true); setErr("");
    try {
      let w = await save("contacts", [...ws!.contacts, { id: rid("c"), ...form, name: form.name.trim(), met, metOn: met ? metOn : "", tags: [], label: "Student provided" }]);
      if (thank && met) {
        const next = new Date(Date.parse(metOn) + 864e5).toISOString().slice(0, 10);
        w = await save("tasks", [{ id: rid("t"), title: `Send ${form.name.trim()} a short thank-you`, why: `You met at ${met}. Two or three sentences: thank them, mention one thing you talked about, and ask to stay in touch.`, due: next < today ? today : next, category: "Connect" as const, done: false, source: "Community", link: "/community" }, ...w.tasks]);
      }
      success();
      onDone(event ? `Saved ${form.name.trim()}. Add another person from ${event.met}, or close.` : `Saved ${form.name.trim()}${thank && met ? ", with a thank-you reminder in your to-dos" : ""}.`, !!event);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Add a contact">
      <Input testID="input-contact-new-name" label="Name" value={form.name} onChangeText={set("name")} />
      <Input testID="input-contact-new-title" label="Title" value={form.title} onChangeText={set("title")} />
      <Input testID="input-contact-new-org" label="Organization" value={form.org} onChangeText={set("org")} />
      <Input testID="input-contact-new-email" label="Email (optional)" value={form.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" />
      <Input testID="input-contact-new-met" label="Where did you meet? (optional)" value={form.met} onChangeText={set("met")} placeholder="e.g. TCU fall career fair" maxLength={200} />
      {!!form.met.trim() && <>
        <Input testID="input-contact-new-meton" label="When (YYYY-MM-DD)" value={form.metOn} onChangeText={set("metOn")} maxLength={10} keyboardType="numbers-and-punctuation" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Switch testID="check-thank-you" value={thank} onValueChange={setThank} trackColor={{ true: c.fox, false: c.line }} />
          <T kind="small" style={{ flex: 1, color: c.ink }}>Remind me to send a thank-you</T>
        </View>
      </>}
      <Input testID="input-contact-new-why" label="Why this person?" value={form.why} onChangeText={set("why")} placeholder="e.g. Works in M&A; said to reach out about summer roles" multiline style={{ minHeight: 80 }} />
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <Button testID="button-save-contact" label="Save contact" onPress={add} busy={busy} disabled={!form.name.trim()} flex />
      <Button testID="button-cancel-contact" kind="ghost" label={event ? "Done" : "Cancel"} onPress={onClose} flex />
    </Sheet>
  );
}

/** "Draft it for me": the website's four questions in one sheet, then Remy writes it (POST /api/ai/outreach). */
function DraftFor({ contact, onClose }: { contact: Contact; onClose: (d?: OutreachDraft) => void }) {
  const { setWs } = useSession();
  const { c } = useTheme();
  const first = contact.name.split(/\s+/)[0];
  const qs = [
    { key: "ask", q: `What would you like from ${first}?`, ph: `A 20-minute chat about their path, advice on recruiting for ${contact.org || "their field"}…` },
    { key: "interest", q: `What about ${first}'s path interests you most?`, ph: [contact.title, contact.org].filter(Boolean).join(" at ") },
    { key: "you", q: "What should I mention about you?", ph: "A class, project, club or internship that connects to their work" },
    { key: "when", q: "When are you usually free for a call? (optional)", ph: "e.g. Tuesday and Thursday afternoons" },
  ];
  const [a, setA] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const write = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ draft: OutreachDraft; workspace: Workspace }>("POST", "/api/ai/outreach", { contactId: contact.id, answers: qs.map((x) => ({ q: x.q, a: (a[x.key] || "").trim() })).filter((x) => x.a) });
      setWs(r.workspace); success(); onClose(r.draft);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title={`Email to ${contact.name}`}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Remy size={40} icon /><T kind="small" style={{ flex: 1 }}>A few quick questions and I'll draft the whole email. No blanks to fill in, and nothing is sent.</T></View>
      {qs.map((x) => <Input key={x.key} testID={`input-outreach-${x.key}`} label={x.q} value={a[x.key] || ""} onChangeText={(v) => setA({ ...a, [x.key]: v })} placeholder={x.ph} multiline maxLength={400} />)}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <Button testID="button-outreach-write" label={busy ? "Writing your email…" : "Write my email"} icon="zap" onPress={write} busy={busy} flex />
      <Button testID="button-outreach-cancel" kind="ghost" label="Cancel" onPress={() => onClose()} flex />
    </Sheet>
  );
}

/** Review before anything is sent: edit, Remy's feedback, approve, then open it in their own email. */
function Review({ draft, onClose }: { draft: OutreachDraft; onClose: () => void }) {
  const { ws } = useSession();
  const save = useSave();
  const { c } = useTheme();
  const [d, setD] = useState(draft);
  const [tips, setTips] = useState<string[] | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const p = ws!.contacts.find((x) => x.id === d.contactId);
  const persist = async (patch: Partial<OutreachDraft>) => {
    const next = { ...d, ...patch };
    setD(next);
    await save("outreach", ws!.outreach.map((x) => (x.id === d.id ? next : x)));
  };
  const act = async (key: string, f: () => Promise<void>) => { tap(); setBusy(key); setErr(""); try { await f(); } catch (e: any) { setErr(e.message); } setBusy(""); };
  const coach = () => act("coach", async () => setTips((await api<{ tips: string[] }>("POST", "/api/ai/outreach-feedback", { contactId: d.contactId, subject: d.subject, body: d.body })).tips));
  const mailto = `mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(d.to)}&su=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  return (
    <Sheet title="Review before anything is sent">
      <T kind="small">Remy doesn't send email. After you approve, it opens the message in your own email so you send it yourself.</T>
      <T kind="small" style={{ color: c.ink }}><Text style={{ fontFamily: font.bold }}>To </Text>{p?.name}{d.to ? ` <${d.to}>` : " (no email saved: type it in your email app, or send the note on LinkedIn)"}</T>
      <Input testID="input-outreach-subject" label="Subject" value={d.subject} onChangeText={(v) => setD({ ...d, subject: v, status: "draft" })} />
      <Input testID="input-outreach-body" label="Full message" value={d.body} onChangeText={(v) => setD({ ...d, body: v, status: "draft" })} multiline style={{ minHeight: 200 }} />
      {!d.body.trim() && <T kind="small">Write it in your own words: who you are, one real reason you're reaching out to {p?.name.split(" ")[0] || "them"}, and a small ask like a 15-minute chat. Remy comments; it won't rewrite it.</T>}
      <Button testID="button-outreach-feedback" kind="ghost" label="Get Remy's feedback" icon="zap" busy={busy === "coach"} disabled={d.body.trim().split(/\s+/).length < 15} onPress={coach} />
      {tips && <View testID="outreach-tips" style={{ gap: 6 }}>{tips.map((t) => <T key={t} kind="small" style={{ color: c.ink }}>• {t}</T>)}</View>}
      {!!d.linkedin && <View style={{ gap: 6 }}><T kind="label">LinkedIn note (under 200 characters)</T>
        <Text selectable testID="text-linkedin-note" style={{ fontFamily: font.body, fontSize: 14.5, color: c.ink, backgroundColor: c.surface2, borderRadius: 10, padding: 12 }}>{d.linkedin}</Text></View>}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      {d.status === "draft"
        ? <Button testID="button-approve-outreach" label="Approve message" onPress={() => act("approve", async () => { await persist({ status: "approved", approvedAt: new Date().toISOString() }); success(); })} busy={busy === "approve"} disabled={!d.body.trim()} flex />
        : <>
          <Button testID="link-open-mail" label="Open in my email app" icon="arrow" onPress={() => act("mail", async () => { await Linking.openURL(mailto); await persist({ status: "handed-off" }); })} flex />
          <Button testID="link-open-gmail" kind="ghost" label="Open in Gmail" onPress={() => act("gmail", async () => { await Linking.openURL(gmail); await persist({ status: "handed-off" }); })} flex />
        </>}
      <Button testID="button-review-close" kind="ghost" label="Save and close" onPress={() => act("close", async () => { if (d.subject !== draft.subject || d.body !== draft.body) await persist({}); onClose(); })} flex />
    </Sheet>
  );
}
