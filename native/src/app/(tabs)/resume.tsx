import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ResumeDoc, Workspace } from "@shared/types";
import { CATS, issues, ranges, toolsRegex, type Cat } from "@shared/markup";
import { reviewResume, type BulletRef } from "@shared/review";
import { isListSection } from "@shared/bullets";
import { Button, Icon, Loading, Remy, Screen, Sect, T, success, tap } from "@/components/ui";
import { ContactDates, EditLine } from "@/components/ResumeEdit";
import { api, apiForm } from "@/lib/api";
import { canPickFiles, pickResume } from "@/lib/pick";
import { shareFromServer } from "@/lib/files";
import { go } from "@/lib/nav";
import { useRefreshAll, useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme, type Colors } from "@/lib/theme";
import { radius } from "@/lib/tokens";

type Step = { b: BulletRef; kind: "numbers" | "verbs" };
const HL: Record<Cat, keyof Colors> = { action: "hlAction", hard: "hlHard", soft: "hlSoft", number: "hlNumber", result: "hlResult" };
const clean = (t: string) => t.trim().replace(/^[•\-–*]\s*/, "");

/** One resume line with the website's colour marks (shared/markup.ts) and its flags. */
function Line({ text, tools, flags, onPress, c, testID }: { text: string; tools: RegExp; flags: string[]; onPress?: () => void; c: Colors; testID: string }) {
  const t = clean(text);
  const parts: { s: string; cat?: Cat }[] = [];
  let at = 0;
  for (const [s, e, cat] of ranges(t, tools)) { if (s > at) parts.push({ s: t.slice(at, s) }); parts.push({ s: t.slice(s, e), cat }); at = e; }
  if (at < t.length) parts.push({ s: t.slice(at) });
  return (
    <Pressable disabled={!onPress} onPress={onPress} testID={testID} style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
      <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: c.mutedText }}>•</Text>
      <Text style={{ flex: 1, fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: c.ink }}>
        {parts.map((p, i) => <Text key={i} style={p.cat ? { backgroundColor: c[HL[p.cat]] } : undefined}>{p.s}</Text>)}
        {flags.map((f) => <Text key={f} style={{ fontFamily: font.bold, fontSize: 11.5, color: c.foxDeep }}>{"  "}{f}</Text>)}
      </Text>
    </Pressable>
  );
}

/** Remy's fact-only rewrites, one line at a time (the website's BulletFix): he rewrites the line from what it and its entry
 *  already say; if he can't do that honestly he asks one short question. Accept saves at once; Edit lets the student
 *  change his words; Skip moves on. */
function FixFlow({ steps: given, start, onClose }: { steps: Step[]; start: number; onClose: () => void }) {
  // The list as it was when opened: a fixed line drops out of the live list, which would shift every later line.
  const [steps] = useState(given);
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(start);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"auto" | "ask" | "ready" | "saving">("auto");
  const [answer, setAnswer] = useState("");
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [fixed, setFixed] = useState(0);
  const step = steps[i];
  useEffect(() => {
    if (!step) return;
    let live = true;
    setDraft(""); setAnswer(""); setEditing(false); setErr(""); setState("auto");
    api<{ draft: string }>("POST", "/api/resume/bullet-draft", { kind: step.kind, text: clean(step.b.text), answer: "" })
      .then((r) => { if (live) { setDraft(r.draft); setState("ready"); } }, () => { if (live) setState("ask"); });
    return () => { live = false; };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => setI((n) => n + 1);
  const ask = async () => {
    setErr(""); setState("saving");
    try { const r = await api<{ draft: string }>("POST", "/api/resume/bullet-draft", { kind: step!.kind, text: clean(step!.b.text), answer }); setDraft(r.draft); setState("ready"); }
    catch (e: any) { setErr(e.message); setState("ask"); }
  };
  const accept = async () => {
    if (!ws?.resume || !draft.trim()) return;
    setState("saving"); setErr("");
    const doc: ResumeDoc = JSON.parse(JSON.stringify(ws.resume.doc));
    for (const s of doc.sections) for (const e of s.entries) for (const b of e.bullets) if (b.id === step!.b.id) b.text = draft.trim();
    try { setWs(await api<Workspace>("PUT", "/api/resume/doc", { doc, base: ws.resume.editedAt || ws.resume.uploadedAt })); success(); setFixed((n) => n + 1); next(); }
    catch (e: any) { setErr(e.message); setState("ready"); }
  };
  const box = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 8 } as const;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 16, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }} testID="resume-fix-flow">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Remy size={36} icon />
        <View style={{ flex: 1 }}><T kind="h2">Remy's fixes</T><T kind="small" style={{ color: c.mutedText }}>{step ? `Line ${i + 1} of ${steps.length}` : "Done"}</T></View>
        <Pressable testID="button-fix-close" accessibilityLabel="Close" hitSlop={10} onPress={onClose}><Icon name="x" size={22} color={c.mutedText} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ gap: 14, paddingTop: 18 }} keyboardShouldPersistTaps="handled">
        {!step ? (
          <View style={[box, { alignItems: "center" }]}>
            <T kind="h2">{fixed ? `${fixed} line${fixed === 1 ? "" : "s"} improved` : "All done"}</T>
            <T kind="muted" style={{ textAlign: "center" }}>Every change used only words already on your resume. Download it from the Resume tab.</T>
            <Button testID="button-fix-done" label="Back to my resume" onPress={onClose} style={{ marginTop: 8 }} />
          </View>
        ) : <>
          <View style={box}>
            <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, color: c.mutedText }}>{step.b.where.toUpperCase()}</Text>
            <T>“{clean(step.b.text)}”</T>
            <T kind="small" style={{ color: c.foxDeep }}>{step.kind === "numbers" ? "No number yet" : "Starts weak"}</T>
          </View>
          {state === "auto" && <View style={[box, { flexDirection: "row", alignItems: "center", gap: 10 }]} testID="bullet-fix-auto"><ActivityIndicator color={c.fox} /><T kind="small" style={{ flex: 1 }}>Remy is rewriting this line from what you already wrote…</T></View>}
          {(state === "ask" || (state === "saving" && !draft)) && (
            <View style={box}>
              <T kind="small">{step.kind === "numbers" ? "Is there a real number here? How many people, events, dollars, hours or percent. Only if you know it." : "I can't tell your part from this line alone, so I won't guess. What did you do here? A few words is enough."}</T>
              <TextInput testID={step.kind === "numbers" ? "input-bullet-number" : "input-bullet-action"} value={answer} onChangeText={setAnswer} placeholder={step.kind === "numbers" ? "e.g. 40 members, $5,000" : "e.g. wrote and scheduled the posts"} placeholderTextColor={c.faint}
                style={{ height: 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12, fontFamily: font.body, fontSize: 15.5, color: c.ink }} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button testID="button-draft-bullet" label="Draft" busy={state === "saving"} onPress={ask} />
                <Button testID="button-skip-line" kind="ghost" label="Skip" onPress={next} />
              </View>
            </View>
          )}
          {!!draft && (state === "ready" || state === "saving") && (
            <View style={[box, { borderColor: c.fox }]}>
              <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, color: c.fox }}>REMY'S VERSION</Text>
              {editing
                ? <TextInput testID="input-draft-edit" value={draft} onChangeText={setDraft} multiline autoFocus style={{ minHeight: 80, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, padding: 10, fontFamily: font.body, fontSize: 15.5, color: c.ink, textAlignVertical: "top" }} />
                : <T>{draft}</T>}
              <T kind="small" style={{ color: c.mutedText }}>Only words already on your resume. Nothing changes until you accept.</T>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Button testID="button-use-draft" label={editing ? "Use my version" : "Accept"} busy={state === "saving"} onPress={accept} />
                {!editing && <Button testID="button-edit-draft" kind="ghost" label="Edit" onPress={() => { tap(); setEditing(true); }} />}
                <Button testID="button-skip-line" kind="ghost" label="Skip" onPress={next} />
              </View>
            </View>
          )}
          {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
        </>}
      </ScrollView>
    </View>
  );
}

/** Resume & CV, native (handoff P1.6): the file and its downloads, Remy's checks, the resume with the website's colour
 *  marks and flags, and his one-line-at-a-time fixes. Tap a line to change it, and fix contact details and dates, here in the app. */
export default function Resume() {
  const { ws, setWs } = useSession();
  const refresh = useRefreshAll();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState(true);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [fix, setFix] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ id: string; text: string; where: string } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  // The resume shows its top part until opened, so the tab isn't one long scroll (Dilan, Nov 25).
  const [whole, setWhole] = useState(false);
  const doc = ws?.resume?.doc;
  const tools = useMemo(() => (doc ? toolsRegex(doc) : /$^/), [doc]);
  const review = useMemo(() => (doc ? reviewResume(doc, { listLike: true }) : { todo: [], good: [] }), [doc]);
  // The lines Remy can fix, numbers first then weak starts, each line once (the website's order).
  const steps: Step[] = useMemo(() => {
    const seen = new Set<string>(), out: Step[] = [];
    for (const k of ["numbers", "verbs"] as const) for (const it of review.todo) if (it.kind === k) for (const b of it.bullets) if (!seen.has(b.id)) { seen.add(b.id); out.push({ b, kind: k }); }
    return out;
  }, [review]);
  // Opened by "Let's fix them" (Home's offer) or My Path's "Add a real number" (openResumeFix): straight into the fixes.
  const { fix: fixNow, at } = useLocalSearchParams<{ fix?: string; at?: string }>();
  useEffect(() => { if (fixNow && steps.length) setFix(0); }, [fixNow, at, steps.length > 0]);
  if (!ws) return <Loading />;
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };
  const open = (q = "") => go(`/resume${q}`, "Resume", { page: true });
  // A PDF or Word file from the phone (builds from Nov 24 on); older builds open the website's Resume page instead.
  const files = canPickFiles();
  const upload = async () => {
    setErr("");
    try {
      const f = await pickResume();
      if (!f) return;
      setBusy("upload");
      setWs(await apiForm<Workspace>("/api/resume/upload", f)); success();
    } catch (e: any) { setErr(e.message); }
    setBusy("");
  };
  const replace = () => Alert.alert("Upload a new version?", "Remy reads the new file and checks it again. Your current one is replaced.", [
    { text: "Cancel", style: "cancel" }, { text: "Choose a file", onPress: () => void upload() },
  ]);
  const download = async (fmt: "pdf" | "docx") => {
    tap(); setErr(""); setBusy(fmt);
    const base = (doc?.contact.name || "Resume").replace(/\s+/g, "_");
    try { await shareFromServer(`/api/resume/export?format=${fmt}`, `${base}_Resume.${fmt}`, fmt === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); }
    catch (e: any) { setErr(e.message); }
    setBusy("");
  };

  if (!ws.resume || !doc) return (
    <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 12 }}>
      <T kind="display">Resume</T>
      <T kind="muted">Add your resume and Remy reads it, checks it, and helps you tailor it for each opening.</T>
      <Button testID="button-add-resume" label={files ? "Upload my resume (PDF or Word)" : "Add my resume"} icon="arrow" busy={busy === "upload"} onPress={() => (files ? void upload() : open())} flex />
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    </Screen>
  );

  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, marginTop: 14 } as const;
  const stepOf = (id: string) => steps.findIndex((s) => s.b.id === id);
  const when = new Date(ws.resume.editedAt || ws.resume.uploadedAt);
  return (
    <>
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ marginTop: 8 }}>Resume</T>
      <T kind="muted"><Text style={{ fontFamily: font.bold }}>Your resume, kept true.</Text> Every change Remy suggests uses only what you already wrote, and you approve each one.</T>
      {note && (
        <View style={[card, { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: c.surface2, borderColor: c.surface2 }]} testID="resume-phone-note">
          <T kind="small" style={{ flex: 1 }}>Tap any line to change it. Big rewrites are easier on a laptop.</T>
          <Pressable testID="button-dismiss-note" onPress={() => { tap(); setNote(false); }} hitSlop={8}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.fox }}>Got it</Text></Pressable>
        </View>
      )}

      <View style={card} testID="resume-file-card">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Icon name="doc" size={22} color={c.foxDeep} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15.5, color: c.ink }}>{ws.resume.fileName || "Your resume"}</Text>
            <T kind="small" style={{ color: c.mutedText }}>{ws.resume.editedAt ? "Edited" : "Uploaded"} {when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{ws.resume.confirmedAt ? " · Confirmed" : ""}</T>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Button testID="button-download-pdf" label="PDF" icon="up" busy={busy === "pdf"} onPress={() => download("pdf")} />
          <Button testID="button-download-docx" kind="ghost" label="Word" busy={busy === "docx"} onPress={() => download("docx")} />
          {files && <Button testID="button-resume-upload" kind="ghost" label="Upload new" busy={busy === "upload"} onPress={replace} />}
          <Button testID="button-resume-more" kind="ghost" label={files ? "Edit" : "Replace or edit"} onPress={() => open("?tab=base")} />
        </View>
        {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}
      </View>

      <View style={card} testID="resume-review">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Remy size={32} icon />
          <T kind="h2" style={{ flex: 1 }}>{review.todo.length ? `${review.todo.length} thing${review.todo.length === 1 ? "" : "s"} to fix` : "Looks good"}</T>
        </View>
        {/* Titles only on a phone: the whys mention the website's Edit tab, and Remy's fixes below explain each line. */}
        {review.todo.map((it) => <View key={it.kind + it.title} style={{ flexDirection: "row", gap: 8, marginTop: 8 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fox, marginTop: 7 }} /><T kind="small" style={{ flex: 1 }}>{it.title}</T></View>)}
        {!review.todo.length && review.good.map((g) => <View key={g} style={{ flexDirection: "row", gap: 6, marginTop: 6 }}><Icon name="check" size={15} color={c.sage} /><T kind="small" style={{ flex: 1 }}>{g}</T></View>)}
        {steps.length > 0 && <Button testID="button-fix-lines" label={`Remy can fix ${steps.length} line${steps.length === 1 ? "" : "s"}`} icon="arrow" flex onPress={() => setFix(0)} style={{ marginTop: 14 }} />}
        {review.todo.some((it) => it.kind === "contact" || it.kind === "dates") && <Button testID="button-fix-on-site" kind="ghost" label="Fix contact and dates" flex onPress={() => { tap(); setContactOpen(true); }} style={{ marginTop: 8 }} />}
      </View>

      <Sect title="Your resume" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {CATS.map(([k, label]) => <View key={k} style={{ backgroundColor: c[HL[k]], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontFamily: font.semi, fontSize: 12, color: c.ink }}>{label}</Text></View>)}
      </View>
      <View style={[card, { marginTop: 0 }, !whole && { maxHeight: 420, overflow: "hidden" }]} testID="resume-read-view">
        {!!doc.contact.name && <Text style={{ fontFamily: font.display, fontSize: 22, color: c.ink, textAlign: "center" }}>{doc.contact.name}</Text>}
        <T kind="small" style={{ textAlign: "center", color: c.mutedText }}>{[doc.contact.email, doc.contact.phone, doc.contact.location].filter(Boolean).join(" · ")}</T>
        {doc.sections.map((s) => {
          const list = isListSection(s.heading, true);
          return (
            <View key={s.id} style={{ marginTop: 16 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 12.5, letterSpacing: 0.8, color: c.mutedText, borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: 4 }}>{(s.heading || "Section").toUpperCase()}</Text>
              {s.entries.map((e) => (
                <View key={e.id} style={{ marginTop: 10 }}>
                  {(!!e.org || !!e.dates) && <View style={{ flexDirection: "row", gap: 8 }}><Text style={{ flex: 1, fontFamily: font.bold, fontSize: 15, color: c.ink }}>{e.org}</Text><Text style={{ fontFamily: font.body, fontSize: 13, color: c.mutedText }}>{e.dates}</Text></View>}
                  {(!!e.role || !!e.location) && <Text style={{ fontFamily: font.body, fontSize: 14, fontStyle: "italic", color: c.mutedText }}>{[e.role, e.location].filter(Boolean).join(" · ")}</Text>}
                  {e.bullets.filter((b) => b.text.trim()).map((b) => {
                    const flags = list ? [] : issues(b.text);
                    const at = stepOf(b.id);
                    return <Line key={b.id} testID={at >= 0 ? "resume-line-flagged" : "resume-line"} text={b.text} tools={tools} flags={flags} c={c} onPress={() => { tap(); if (at >= 0) setFix(at); else setEdit({ id: b.id, text: b.text, where: [e.role, e.org].filter(Boolean).join(", ") || s.heading }); }} />;
                  })}
                </View>
              ))}
            </View>
          );
        })}
        {doc.skills.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 12.5, letterSpacing: 0.8, color: c.mutedText, borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: 4 }}>SKILLS</Text>
            {doc.skills.map((k) => <T key={k.id} kind="small" style={{ marginTop: 6 }}>{!!k.label && <Text style={{ fontFamily: font.bold }}>{k.label}: </Text>}{k.items}</T>)}
          </View>
        )}
      </View>

      <Button testID="button-resume-whole" kind="ghost" label={whole ? "Show less" : "Show the whole resume"} flex onPress={() => setWhole(!whole)} style={{ marginTop: 8 }} />
      <Button testID="button-tailor" label="Tailor my resume for an opening" icon="arrow" flex onPress={() => go("/resume?tab=tailor", "Tailor")} style={{ marginTop: 14 }} />
    </Screen>
    <Modal visible={fix !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFix(null)}>
      {fix !== null && <FixFlow steps={steps} start={fix} onClose={() => setFix(null)} />}
    </Modal>
    <Modal visible={!!edit} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEdit(null)}>
      {edit && <EditLine {...edit} onClose={() => setEdit(null)} />}
    </Modal>
    <Modal visible={contactOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setContactOpen(false)}>
      {contactOpen && <ContactDates doc={doc} todo={review.todo} onClose={() => setContactOpen(false)} />}
    </Modal>
    </>
  );
}
