import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Workspace } from "@shared/types";
import { Button, Card, Chip, Icon, T } from "@/components/ui";
import { api, apiForm } from "@/lib/api";
import { canPickFiles, pickResume } from "@/lib/pick";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { Input, Nav, Say } from "./common";

/** Setup's resume step: a PDF or Word file from the phone (`POST /api/resume/upload`, builds from Nov 24 on), or pasted
 *  text (`POST /api/resume/text`). Building a resume with Remy, and uploading on older builds, open the website's setup
 *  in the sheet, which refreshes the account when it closes. */
export function ResumeStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const w = ws!;
  const r = w.resume;
  // With a file picker, the paste box waits behind a button so the step fits on one screen.
  const [paste, setPaste] = useState(!r && !canPickFiles());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const read = async () => {
    setBusy(true); setError("");
    try { setWs(await api<Workspace>("POST", "/api/resume/text", { text })); setPaste(false); setText(""); } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  const upload = async () => {
    setError("");
    try {
      const f = await pickResume();
      if (!f) return;
      setBusy(true);
      setWs(await apiForm<Workspace>("/api/resume/upload", f));
      setPaste(false);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  const files = canPickFiles();
  const how = r ? `${r.doc.sections.length} section${r.doc.sections.length === 1 ? "" : "s"}${r.parsedBy === "ai" ? ", checked against your file" : r.parsedBy === "builder" ? ", built with Remy" : ""}` : "";
  return (
    <View style={{ gap: 20 }}>
      <Say title="Start with your resume">About 5 minutes. Your resume is what I build everything on, and I only use what's on it.</Say>
      {busy && (
        <Card testID="resume-reading" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <ActivityIndicator color={c.fox} />
          <View style={{ flex: 1 }}><T style={{ fontFamily: font.bold }}>Reading your resume</T><T kind="small">About 20 seconds. Remy checks each line against your file.</T></View>
        </Card>
      )}
      {files && <Button testID="button-upload-resume" label={r ? "Upload a new file" : "Upload my resume (PDF or Word)"} icon="up" onPress={upload} busy={busy} flex />}
      {r && (
        <Card testID="resume-loaded" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="doc" color={c.fox} />
          <View style={{ flex: 1 }}><T numberOfLines={1}>{r.fileName}</T><T kind="small">{how}</T></View>
          <Chip text="Added" tone="live" />
        </Card>
      )}
      {paste ? (
        <View style={{ gap: 10 }}>
          <Input testID="input-resume-text" label={r ? "Paste a new version" : "Paste your resume"} value={text} onChangeText={setText} multiline
            placeholder="Open your resume, select all, copy, and paste it here…" style={{ minHeight: 180 }} />
          <T kind="small">{text.length < 200 ? "Paste the whole resume: it needs at least a few lines." : "Remy reads it and you check every line on the next step."}</T>
          <Button testID="button-submit-resume-text" label="Read this resume" onPress={read} busy={busy} disabled={text.length < 200} flex />
          {r && <Button testID="button-cancel-paste" kind="ghost" label="Keep the one I have" onPress={() => setPaste(false)} flex />}
        </View>
      ) : (
        <Button testID="button-replace-resume" kind="ghost" label={r ? "Paste a new version" : "Paste the text instead"} onPress={() => setPaste(true)} flex />
      )}
      <Card testID="button-upload-on-website" onPress={() => go("/", "Set up Remy", { page: true })} style={{ backgroundColor: c.foxSoft, borderColor: c.foxSoft, gap: 4 }}>
        <T style={{ fontFamily: font.bold }}>{files ? "No resume yet? Build one with Remy" : r ? "Upload a file instead" : "Upload a file, or build one with Remy"}</T>
        <T kind="small" style={{ color: c.ink }}>{files ? "Most freshmen start here: a few taps and short answers, and only what you say goes on it. Opens the website's setup here." : r ? "PDF or Word. Opens the website's setup here; you come back when you close it." : "No resume yet? Most freshmen start here: a few taps and short answers, and only what you say goes on it. PDF and Word uploads open the website's setup here."}</T>
      </Card>
      <T kind="small">Remy never asks for your passwords. LinkedIn, your transcript and your school email can be added on the website later.</T>
      <Nav note={error || (!r ? "Add your resume to continue." : undefined)} onBack={onBack}
        next={<Button testID="button-ob-next-sources" label="Continue" icon="arrow" onPress={onNext} disabled={!r || busy} flex />} />
    </View>
  );
}
