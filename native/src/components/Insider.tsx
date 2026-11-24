import { File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Workspace } from "@shared/types";
import { INSIDER_SURVEY, insiderEligible, insiderSurveyDue } from "@shared/beta";
import { Button, Remy, T, success, tap } from "@/components/ui";
import { Chips, Input } from "@/components/setup/common";
import { api } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { go } from "@/lib/nav";
import { useOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Beta Insider on Home (handoff P2.6; the website's components/Insider.tsx): after a few days of use Remy invites the
// student to be one of his closest testers (a secret pin), and insiders get three quick questions every two weeks.
// "Not now" hides it for a week on this phone.

const WEEK = 7 * 864e5;
const laterFile = () => new File(Paths.document, "remy-insider-later.txt");
const SOURCES = ["A friend", "Instagram", "LinkedIn", "A class or professor", "Career center", "Somewhere else"];

export function InsiderCard() {
  const { ws } = useSession();
  const { config } = useConfig();
  const owner = useOwnerView();
  const { c } = useTheme();
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState<"" | "join" | "survey">("");
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    let at = 0;
    try { const f = laterFile(); if (f.exists) at = Number(f.textSync() || 0); } catch { /* no file system (web preview) */ }
    setHidden(Date.now() - at < WEEK);
  }, []);
  if (!ws || !(owner || config?.beta?.open)) return null;
  const today = config?.today || new Date().toISOString().slice(0, 10);
  const due = insiderSurveyDue(ws, today);
  if (joined) return (
    <View testID="insider-joined" style={{ marginTop: 14, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14 }}>
      <Remy size={40} icon />
      <T style={{ flex: 1 }}>You're a Beta Insider. Your secret pin is on Rewards.</T>
      <Button testID="button-insider-see-pin" kind="ghost" label="See it" onPress={() => go("/rewards")} style={{ height: 40, paddingHorizontal: 14 }} />
    </View>
  );
  if (hidden || !(insiderEligible(ws) || due)) return null;
  const later = () => { tap(); try { const f = laterFile(); if (!f.exists) f.create(); void f.write(String(Date.now())).catch(() => {}); } catch { /* still hidden for now */ } setHidden(true); };
  return (
    <View testID="insider-card" style={{ marginTop: 14, gap: 10, backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Remy size={40} icon />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: c.ink }}>{due ? "Two minutes for Remy?" : "Want to shape what Remy builds next?"}</Text>
          <T kind="small">{due ? "Three quick questions about the last two weeks. The team reads every answer."
            : "You've been using Remy for a few days. Join Beta Insider: a secret pin, a real say in what the team builds next, and three quick questions every two weeks."}</T>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
        <Button testID="button-insider-later" kind="ghost" label="Not now" onPress={later} style={{ height: 40, paddingHorizontal: 14 }} />
        <Button testID={due ? "button-insider-survey" : "button-insider-join"} label={due ? "Answer 3 questions" : "Join Beta Insider"} onPress={() => setOpen(due ? "survey" : "join")} style={{ height: 40, paddingHorizontal: 14 }} />
      </View>
      <Modal visible={!!open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen("")}>
        {open === "join" ? <Join onClose={(ok) => { setOpen(""); if (ok) setJoined(true); }} /> : open === "survey" ? <Survey onClose={() => setOpen("")} /> : null}
      </Modal>
    </View>
  );
}

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <T kind="title">{title}</T>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Joining asks what the old Founding Cohort form asked; everything is optional (the website's Join). */
function Join({ onClose }: { onClose: (joined: boolean) => void }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const p = ws!.profile;
  const [a, setA] = useState({ goal: p.goal || "", stuck: p.worries || "", tools: "", source: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const from = [p.school, p.major, p.classYear].filter(Boolean).join(", ");
  const join = async () => {
    setBusy(true); setErr("");
    try { setWs(await api<Workspace>("POST", "/api/insider", { answers: a })); success(); onClose(true); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Join Beta Insider">
      <T kind="muted">Four quick questions so the team knows what you need.{from ? ` We'll use ${from} from your profile.` : ""}</T>
      <Input testID="input-insider-goal" label="What are you trying to land next?" value={a.goal} onChangeText={(v) => setA({ ...a, goal: v })} maxLength={300} placeholder="e.g. A summer internship in finance" />
      <Input testID="input-insider-stuck" label="Where are you stuck right now?" value={a.stuck} onChangeText={(v) => setA({ ...a, stuck: v })} maxLength={300} placeholder="e.g. Getting past the resume screen" />
      <Input testID="input-insider-tools" label="What else do you use for your search?" value={a.tools} onChangeText={(v) => setA({ ...a, tools: v })} maxLength={300} placeholder="e.g. LinkedIn, Handshake" />
      <View style={{ gap: 8 }}>
        <T style={{ fontFamily: font.bold }}>How did you hear about Remy?</T>
        <Chips options={SOURCES} value={a.source ? [a.source] : []} onChange={(v) => setA({ ...a, source: v[0] || "" })} multi={false} testID="insider-source" />
      </View>
      <T kind="small">Insiders get a secret pin and three quick questions every two weeks. Only the Remy team sees your answers.</T>
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <Button testID="button-insider-join-confirm" label="Join" onPress={join} busy={busy} flex />
      <Button testID="button-insider-join-cancel" kind="ghost" label="Not now" onPress={() => onClose(false)} flex />
    </Sheet>
  );
}

/** The two-weekly check-in: a 1 to 5 rating and two short answers (the website's Survey). */
function Survey({ onClose }: { onClose: () => void }) {
  const { setWs } = useSession();
  const { c } = useTheme();
  const [a, setA] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (i: number, v: string) => setA((x) => x.map((y, j) => (j === i ? v : y)));
  const send = async (answers: string[]) => {
    setBusy(true); setErr("");
    try { setWs(await api<Workspace>("POST", "/api/insider/survey", { answers })); if (answers.some(Boolean)) success(); onClose(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Beta Insider check-in">
      <View style={{ gap: 8 }}>
        <T style={{ fontFamily: font.bold }}>{INSIDER_SURVEY[0]}</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["1", "2", "3", "4", "5"].map((n) => { const on = a[0] === n; return (
            <Pressable key={n} testID={`button-insider-rate-${n}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${n} of 5`} onPress={() => { tap(); set(0, n); }}
              style={{ flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: on ? c.onInk : c.ink }}>{n}</Text>
            </Pressable>); })}
        </View>
      </View>
      {[1, 2].map((i) => <Input key={i} testID={`input-insider-q${i + 1}`} label={INSIDER_SURVEY[i]} value={a[i]!} onChangeText={(v) => set(i, v)} maxLength={600} multiline style={{ minHeight: 80 }} />)}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <Button testID="button-insider-send" label="Send" onPress={() => send(a)} busy={busy} disabled={!a.some((x) => x.trim())} flex />
      <Button testID="button-insider-skip" kind="ghost" label="Skip this time" onPress={() => send([])} disabled={busy} flex />
    </Sheet>
  );
}
