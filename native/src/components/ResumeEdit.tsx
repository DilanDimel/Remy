import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ResumeDoc, Workspace } from "@shared/types";
import type { ReviewItem } from "@shared/review";
import { addStoryEntry } from "@shared/storyEntry";
import { Button, Icon, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

/** Saves a changed copy of the resume the way Remy's fixes do (PUT /api/resume/doc with the version it was read from). */
function useSaveDoc() {
  const { ws, setWs } = useSession();
  return async (change: (d: ResumeDoc) => void) => {
    if (!ws?.resume) return;
    const doc: ResumeDoc = JSON.parse(JSON.stringify(ws.resume.doc));
    change(doc);
    setWs(await api<Workspace>("PUT", "/api/resume/doc", { doc, base: ws.resume.editedAt || ws.resume.uploadedAt }));
    success();
  };
}

function Sheet({ title, sub, onClose, children, testID }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; testID: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }} testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 16, paddingHorizontal: 16 }}>
        <View style={{ flex: 1 }}><T kind="h2">{title}</T>{!!sub && <T kind="small" style={{ color: c.mutedText }}>{sub}</T>}</View>
        <Pressable testID="button-sheet-close" accessibilityLabel="Close" hitSlop={10} onPress={onClose}><Icon name="x" size={22} color={c.mutedText} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, testID, multiline, placeholder, keyboard }: { label: string; value: string; onChange: (v: string) => void; testID: string; multiline?: boolean; placeholder?: string; keyboard?: "email-address" | "phone-pad" | "url" }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: font.semi, fontSize: 13, color: c.mutedText }}>{label}</Text>
      <TextInput testID={testID} value={value} onChangeText={onChange} multiline={multiline} placeholder={placeholder} placeholderTextColor={c.faint} keyboardType={keyboard} autoCapitalize={keyboard ? "none" : "sentences"} autoCorrect={!keyboard}
        style={{ minHeight: multiline ? 96 : 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0, fontFamily: font.body, fontSize: 15.5, lineHeight: multiline ? 22 : undefined, color: c.ink, textAlignVertical: multiline ? "top" : "center" }} />
    </View>
  );
}

/** Change one resume line by hand, on the phone (it used to open the website's editor). Your own words, so no claims check. */
export function EditLine({ id, text, where, onClose }: { id: string; text: string; where: string; onClose: () => void }) {
  const { c } = useTheme();
  const save = useSaveDoc();
  const [value, setValue] = useState(text.trim().replace(/^[•\-–*]\s*/, ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (change: (d: ResumeDoc) => void) => {
    setBusy(true); setErr("");
    try { await save(change); onClose(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const each = (d: ResumeDoc, f: (bullets: { id: string; text: string }[], i: number) => void) => {
    for (const s of d.sections) for (const e of s.entries) { const i = e.bullets.findIndex((b) => b.id === id); if (i >= 0) f(e.bullets, i); }
  };
  const remove = () => Alert.alert("Delete this line?", "It comes off your resume. You can add it back on the website's editor.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => void run((d) => each(d, (b, i) => b.splice(i, 1))) },
  ]);
  return (
    <Sheet title="Edit a line" sub={where} onClose={onClose} testID="sheet-edit-line">
      <Field label="Your line" value={value} onChange={setValue} testID="input-edit-line" multiline />
      <T kind="small" style={{ color: c.mutedText }}>Tip: start with what you did and add a real number if you have one.</T>
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button testID="button-save-line" label="Save" busy={busy} disabled={!value.trim() || value.trim() === text.trim()} onPress={() => run((d) => each(d, (b, i) => { b[i]!.text = value.trim(); }))} />
        <Button testID="button-cancel-line" kind="ghost" label="Cancel" onPress={onClose} />
        <View style={{ flex: 1 }} />
        <Pressable testID="button-delete-line" accessibilityRole="button" hitSlop={8} onPress={() => { tap(); remove(); }} style={{ justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 14.5, color: c.error }}>Delete line</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/** Contact details and missing dates in one sheet: what Remy's check flags (shared/review.ts), fixed on the phone. */
export function ContactDates({ doc, todo, onClose }: { doc: ResumeDoc; todo: ReviewItem[]; onClose: () => void }) {
  const { c } = useTheme();
  const save = useSaveDoc();
  const [contact, setContact] = useState(doc.contact);
  const undated = todo.flatMap((t) => (t.kind === "dates" ? t.entries : []));
  const [dates, setDates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof ResumeDoc["contact"]) => (v: string) => setContact((x) => ({ ...x, [k]: v }));
  const changed = (Object.keys(contact) as (keyof ResumeDoc["contact"])[]).some((k) => contact[k] !== doc.contact[k]) || Object.values(dates).some((v) => v.trim());
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await save((d) => {
        d.contact = { ...d.contact, ...Object.fromEntries(Object.entries(contact).map(([k, v]) => [k, v.trim()])) };
        for (const s of d.sections) for (const e of s.entries) if (dates[e.id]?.trim()) e.dates = dates[e.id]!.trim();
      });
      onClose();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const box = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 12 } as const;
  return (
    <Sheet title="Contact and dates" sub="Employers look for these first" onClose={onClose} testID="sheet-contact-dates">
      <View style={box}>
        <Field label="Name" value={contact.name} onChange={set("name")} testID="input-contact-name" />
        <Field label="Email" value={contact.email} onChange={set("email")} testID="input-contact-email" keyboard="email-address" placeholder="you@example.com" />
        <Field label="Phone" value={contact.phone} onChange={set("phone")} testID="input-contact-phone" keyboard="phone-pad" placeholder="(555) 201-4410" />
        <Field label="City, state" value={contact.location} onChange={set("location")} testID="input-contact-location" placeholder="Dallas, TX" />
        <Field label="LinkedIn or website" value={contact.links} onChange={set("links")} testID="input-contact-links" keyboard="url" placeholder="linkedin.com/in/you" />
      </View>
      {undated.length > 0 && (
        <View style={box}>
          <T kind="label">Missing dates</T>
          {undated.map((u) => <Field key={u.entryId} label={u.label} value={dates[u.entryId] || ""} onChange={(v) => setDates((d) => ({ ...d, [u.entryId]: v }))} testID="input-entry-dates" placeholder="Sep 2025 – now" />)}
        </View>
      )}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <Button testID="button-save-contact" label="Save" busy={busy} disabled={!changed} onPress={submit} flex />
    </Sheet>
  );
}

const KINDS: [string, string][] = [["internship", "Internship"], ["job", "Job"], ["club", "Club or team"], ["volunteer", "Volunteering"], ["project", "Project"]];

/** Add an experience by telling the story (Julio's user testing, Nov 27: students know what they did but can't squeeze it
 *  into two lines). The phone keyboard's own mic does the talking; Remy drafts 1-2 lines from only those words
 *  (POST /api/resume/story, the builder's draft and honesty check), and the student keeps, edits or drops each one. */
export function StoryEntry({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const save = useSaveDoc();
  const [f, setF] = useState({ kind: "internship", org: "", role: "", start: "", end: "", city: "", story: "" });
  const [lines, setLines] = useState<{ text: string; keep: boolean; source: string }[] | null>(null);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const draft = async () => {
    tap(); setBusy(true); setErr("");
    try {
      const r = await api<{ lines: { text: string; source: string }[]; by: "ai" | "rules" }>("POST", "/api/resume/story", f);
      setLines(r.lines.map((l) => ({ text: l.text, source: l.source, keep: true })));
      setRules(r.by === "rules");
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const kept = (lines || []).filter((l) => l.keep && l.text.trim() && !/\[[^\]]*\]/.test(l.text));
  const blanks = (lines || []).some((l) => l.keep && /\[[^\]]*\]/.test(l.text));
  const add = async () => {
    setBusy(true); setErr("");
    try { await save((d) => { d.sections = addStoryEntry(d, f, kept.map((l) => l.text)).sections; }); onClose(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Add an experience" sub="Tell the story. Remy writes the lines." onClose={onClose} testID="sheet-story-entry">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {KINDS.map(([k, label]) => {
          const on = f.kind === k;
          return <Pressable key={k} testID={`chip-story-${k}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { tap(); set("kind")(k); }}
            style={{ borderRadius: 16, paddingHorizontal: 12, height: 32, justifyContent: "center", backgroundColor: on ? c.ink : c.surface2 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: on ? c.onInk : c.ink }}>{label}</Text></Pressable>;
        })}
      </View>
      <Field label="Where" value={f.org} onChange={set("org")} testID="input-story-org" placeholder="Company, club or place" />
      <Field label="Your role" value={f.role} onChange={set("role")} testID="input-story-role" placeholder="e.g. Finance Intern" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Start" value={f.start} onChange={set("start")} testID="input-story-start" placeholder="Jun 2026" /></View>
        <View style={{ flex: 1 }}><Field label="End" value={f.end} onChange={set("end")} testID="input-story-end" placeholder="Aug 2026" /></View>
      </View>
      <Field label="What did you do there? The whole story is fine." value={f.story} onChange={(v) => { set("story")(v); setLines(null); }} testID="input-story-text" multiline placeholder="A normal day, what you worked on, anything that changed because of you…" />
      <T kind="small" style={{ color: c.mutedText, marginTop: -6 }}>Rather talk? Tap the mic on your keyboard. Remy only uses what you say.</T>
      {!lines && <Button testID="button-story-draft" label="Write my resume lines" icon="arrow" kind="fox" flex busy={busy} disabled={f.story.trim().length < 20 || !f.org.trim()} onPress={draft} />}
      {lines && (
        <View style={{ gap: 10 }} testID="story-lines">
          <T kind="h2">Remy's lines</T>
          {rules && <T kind="small" style={{ color: c.mutedText }}>Remy's writer wasn't available, so these are your own sentences, tidied up. Edit them however you like.</T>}
          {!lines.length && <T kind="small">Remy couldn't find a full sentence to use. Add a little more about what you did.</T>}
          {lines.map((l, i) => (
            <View key={i} style={{ gap: 6, borderWidth: 1, borderColor: c.line, borderRadius: radius.card, padding: 12, backgroundColor: c.surface, opacity: l.keep ? 1 : 0.55 }} testID="story-line">
              <TextInput testID="input-story-line" value={l.text} multiline onChangeText={(t) => setLines((x) => x!.map((y, n) => (n === i ? { ...y, text: t } : y)))}
                style={{ fontFamily: font.semi, fontSize: 15, lineHeight: 21, color: c.ink, padding: 0 }} />
              {/\[[^\]]*\]/.test(l.text) && <T kind="small" style={{ color: c.foxDeep }}>Replace the [blank] with the real number, or delete it.</T>}
              {!!l.source && <T kind="small" style={{ color: c.mutedText }} numberOfLines={2}>From your words: "{l.source}"</T>}
              <Pressable testID="button-story-keep" accessibilityRole="checkbox" accessibilityState={{ checked: l.keep }} hitSlop={6} onPress={() => { tap(); setLines((x) => x!.map((y, n) => (n === i ? { ...y, keep: !y.keep } : y))); }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: l.keep ? c.sage : c.mutedText }}>{l.keep ? "✓ Keeping this line" : "Not using this line (tap to keep)"}</Text>
              </Pressable>
            </View>
          ))}
          <Button testID="button-story-add" label={`Add to my resume${kept.length ? ` (${kept.length} line${kept.length === 1 ? "" : "s"})` : ""}`} kind="fox" flex busy={busy} disabled={!kept.length || blanks} onPress={add} />
          <Button testID="button-story-redo" kind="ghost" label="Change my story" flex onPress={() => setLines(null)} />
        </View>
      )}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    </Sheet>
  );
}
