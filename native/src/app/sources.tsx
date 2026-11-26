import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Me, Workspace } from "@shared/types";
import { Button, Group, Icon, Row, Sect, T, success, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { api, apiForm } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { go } from "@/lib/nav";
import { canPickFiles, pickResume } from "@/lib/pick";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Sources, native (it opened the website's Account → Sources): the resume, a LinkedIn PDF Remy reads for facts to
 *  suggest (POST /api/import/profile, the website's ProfileImport), the school email check (the website's
 *  SchoolVerify) and what was imported. Google Calendar's connect needs Google's web sign-in, so it stays on the website. */
export default function Sources() {
  const { me, ws, setWs, refresh } = useSession();
  const { config } = useConfig();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  if (!ws) return null;
  const linkedin = ws.imports.find((i) => /linkedin/i.test(i.kind));
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 } as const;
  const run = async (key: string, f: () => Promise<void>) => { tap(); setBusy(key); setErr(""); try { await f(); } catch (e: any) { setErr(e.message); } setBusy(""); };
  const imported = (r: { workspace: Workspace; added: number }) => {
    setWs(r.workspace); setText(""); setOpen(false); success();
    setNote(r.added ? `Remy found ${r.added} fact${r.added === 1 ? "" : "s"}. Approve them in Remy's memory on Account.` : "Read. Remy found nothing new to suggest.");
  };
  const upload = () => run("file", async () => { const f = await pickResume(); if (f) imported(await apiForm<{ workspace: Workspace; added: number }>("/api/import/profile", f, { kind: "LinkedIn profile (PDF)" })); });
  const paste = () => run("text", async () => imported(await api<{ workspace: Workspace; added: number }>("POST", "/api/import/profile", { kind: "LinkedIn profile (PDF)", text })));
  const domains = config?.schoolEmail.domains || ["tcu.edu"];
  const verified = me?.schoolEmail || (domains.some((d) => (me?.email || "").toLowerCase().endsWith("@" + d)) ? me?.email : "");
  const school = (f: () => Promise<{ me?: Me; sent?: boolean; email?: string }>, key: string, after?: (r: { sent?: boolean; email?: string }) => void) =>
    run(key, async () => { const r = await f(); after?.(r); if (r.me) await refresh(); });
  const ai = !!config?.ai.available;

  return (
    <ScrollView testID="sources-screen" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <T kind="muted">Facts Remy finds in an import are only suggestions. Nothing is used until you approve it.</T>

      <Sect title="Your sources" />
      <Group>
        <Row first title="Resume" sub={ws.resume ? `${ws.resume.fileName || "Your resume"} · ${day(ws.resume.uploadedAt)}` : "Not uploaded yet"} left={<Icon name="doc" color={c.mutedText} />} onPress={() => { router.back(); router.navigate("/resume"); }} testID="row-source-resume" />
        <Row title="LinkedIn" sub={linkedin ? `${linkedin.fileName} · ${day(linkedin.at)}` : "Not added yet"} left={<Icon name="you" color={c.mutedText} />} onPress={() => { tap(); setOpen(!open); }} testID="button-source-linkedin" />
        <Row title="Google Calendar" sub="Connect it on the website" left={<Icon name="book" color={c.mutedText} />} onPress={() => go("/accounts?tab=sources", "Sources", { page: true })} testID="row-source-gcal" />
      </Group>

      {open && (
        <View style={[card, { marginTop: 10 }]} testID="linkedin-import">
          <T kind="small">LinkedIn doesn't let apps read profiles, so Remy uses the PDF you download: on LinkedIn, open your profile → Resources → Save to PDF.</T>
          {canPickFiles() && <Button testID="button-import-upload" label={linkedin ? "Replace with a new PDF" : "Upload the PDF"} icon="up" busy={busy === "file"} disabled={!ai} onPress={upload} />}
          <Input testID="input-import-linkedin" value={text} onChangeText={setText} placeholder="Or paste the text here…" multiline style={{ minHeight: 90 }} />
          {text.trim().length > 0 && <Button testID="button-import-linkedin" kind="ghost" label="Read the pasted text" busy={busy === "text"} disabled={!ai || text.trim().length < 40} onPress={paste} />}
          {!ai && <T kind="small" style={{ color: c.foxDeep }}>Remy's reader is resting right now. Try again in a little while.</T>}
        </View>
      )}
      {!!note && <View style={[card, { marginTop: 10, borderColor: c.fox }]} testID="import-note"><T kind="small">{note}</T>
        <Button testID="button-import-memory" kind="ghost" label="Open Remy's memory" onPress={() => router.back()} style={{ height: 40 }} /></View>}

      <Sect title="School email" />
      <View style={card} testID={verified ? "school-verified" : "school-verify"}>
        {verified ? <>
          <T><T style={{ fontWeight: "700" }}>Verified student</T> · {verified}</T>
          {!!me?.schoolEmail && <Button testID="button-remove-school-email" kind="ghost" label="Remove" busy={busy === "rm"} onPress={() => school(() => api("DELETE", "/api/school-email"), "rm")} style={{ height: 40 }} />}
        </> : !config?.schoolEmail.ready ? <T kind="small">Verifying your school email is coming soon. Everything else in Remy works without it.</T>
        : !sentTo ? <>
          <T kind="small">Optional. Remy emails a 6-digit code to your {domains.map((d) => "@" + d).join(" or ")} address, which unlocks your school's tools.</T>
          <Input testID="input-school-email" value={email} onChangeText={setEmail} placeholder={`name@${domains[0]}`} autoCapitalize="none" keyboardType="email-address" />
          <Button testID="button-send-school-code" label="Send the code" busy={busy === "start"} disabled={!email.includes("@")} onPress={() => school(() => api("POST", "/api/school-email/start", { email }), "start", (r) => { if (r.sent) setSentTo(r.email || email); })} />
        </> : <>
          <T kind="small">We sent a code to {sentTo}. It expires in 10 minutes.</T>
          <Input testID="input-school-code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button testID="button-verify-school-code" label="Verify" busy={busy === "verify"} disabled={code.length !== 6} onPress={() => school(() => api("POST", "/api/school-email/verify", { code }), "verify")} />
            <Button testID="button-school-other" kind="ghost" label="Use a different email" onPress={() => { setSentTo(""); setCode(""); }} />
          </View>
        </>}
      </View>

      <Sect title={`Import history · ${ws.imports.length}`} />
      {ws.imports.length ? (
        <Group>
          {[...ws.imports].reverse().slice(0, 6).map((i, n) => <Row key={i.id} first={n === 0} title={i.kind} sub={`${i.fileName}${i.factsAdded ? ` · ${i.factsAdded} fact${i.factsAdded === 1 ? "" : "s"} suggested` : ""} · ${day(i.at)}`} testID="row-import" />)}
        </Group>
      ) : <T kind="small" style={{ marginHorizontal: 4 }}>Nothing imported yet. Your LinkedIn PDF shows up here.</T>}
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 10 }}>{err}</T>}
    </ScrollView>
  );
}
