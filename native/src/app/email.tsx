import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Suggestion, Workspace } from "@shared/types";
import { Button, Icon, T, success } from "@/components/ui";
import { api } from "@/lib/api";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

/** Email updates, native (the website's Progress → Email updates): paste a recruiting email, Remy reads it and suggests
 *  the status, and nothing changes until the student confirms. Remy doesn't read their inbox.
 *  shortcut: confirming applies Remy's suggested status as is; changing the status, company or tracker row first still
 *  opens the website's box ("Change it first"), which has those menus. */
export default function EmailUpdates() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  if (!ws) return null;
  const run = async <R,>(key: string, f: () => Promise<R>) => { setBusy(key); setErr(""); try { return await f(); } catch (e: any) { setErr(e.message); } finally { setBusy(""); } };
  const classify = (id: string) => run(id, async () => setWs((await api<{ workspace: Workspace }>("POST", `/api/inbox/${id}/classify`)).workspace));
  const read = () => run("paste", async () => {
    const w = await api<Workspace>("POST", "/api/inbox/paste", { from: "", subject: "", body });
    setWs(w); setBody("");
    if (w.inbox[0]) setWs((await api<{ workspace: Workspace }>("POST", `/api/inbox/${w.inbox[0].id}/classify`)).workspace);
  });
  const resolve = (s: Suggestion, action: "apply" | "dismiss") => run(s.id + action, async () => {
    setWs(await api<Workspace>("POST", `/api/suggestions/${s.id}/resolve`, { action, status: s.proposed, trackId: s.trackId, company: s.company, role: s.role, ...(s.proposed === "Interview" ? { date: s.date || "", time: s.time || "" } : {}) }));
    success();
  });
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10, marginTop: 14 } as const;
  return (
    <ScrollView testID="email-screen" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <View style={[card, { marginTop: 0 }]} testID="email-hero">
        <T kind="h2">Got an interview invite, an offer or a rejection?</T>
        <T kind="small">Paste it and Remy updates your applications, and puts an interview on your calendar. Nothing changes until you confirm. Remy doesn't read your inbox.</T>
        <TextInput testID="input-email-body" value={body} onChangeText={setBody} multiline placeholder={"From: recruiting@company.com\nSubject: Interview invitation\n\nHi, we'd like to invite you to…"} placeholderTextColor={c.faint}
          style={{ minHeight: 140, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, padding: 12, fontFamily: font.body, fontSize: 15, lineHeight: 21, color: c.ink, textAlignVertical: "top" }} />
        <Button testID="button-submit-email" label="Read it" busy={busy === "paste"} disabled={body.trim().length < 30} onPress={read} flex />
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      </View>
      {ws.inbox.map((msg) => {
        const s = ws.suggestions.find((x) => x.messageId === msg.id && x.state !== "dismissed");
        const t = s?.state === "applied" ? ws.tracker.find((x) => x.id === s.trackId) : undefined;
        const unclear = s && s.rulesSay === "Unclear" && (!s.aiSays || s.aiSays === "Unclear");
        return (
          <View key={msg.id} style={card} testID="card-email">
            <View><Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{msg.subject || "(no subject)"}</Text><T kind="small" numberOfLines={1}>{msg.from}</T></View>
            <T kind="small" numberOfLines={6}>{msg.body}</T>
            {!s && <Button testID="button-classify" kind="ghost" label="Suggest a status" busy={busy === msg.id} onPress={() => classify(msg.id)} />}
            {s?.state === "applied" && <View style={{ flexDirection: "row", gap: 8 }}><Icon name="check" size={16} color={c.sage} /><T kind="small" style={{ flex: 1 }}>Done: {t?.company || s.company} marked {s.proposed}. The quoted sentence is saved as evidence.</T></View>}
            {s?.state === "open" && (
              <View style={{ backgroundColor: c.foxSoft, borderRadius: 14, padding: 12, gap: 8 }} testID="suggestion">
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{unclear ? "This email doesn't clearly change your status" : `Suggested: ${s.company} → ${s.proposed}`}</Text>
                {!!s.evidence && <T kind="small">“{s.evidence}”</T>}
                {s.proposed === "Interview" && !!s.date && <T kind="small">Interview {s.date}{s.time ? ` at ${s.time}` : ""}{s.zone ? ` (${s.zone})` : ""}: it goes on your calendar.</T>}
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {!unclear && <Button testID="button-apply-suggestion" label="Confirm" busy={busy === s.id + "apply"} onPress={() => resolve(s, "apply")} style={{ height: 40, paddingHorizontal: 14 }} />}
                  <Button testID="button-change-suggestion" kind="ghost" label="Change it first" onPress={() => go("/progress?tab=email", "Email updates", { page: true })} style={{ height: 40, paddingHorizontal: 14 }} />
                  <Button testID="button-dismiss-suggestion" kind="ghost" label="Dismiss" busy={busy === s.id + "dismiss"} onPress={() => resolve(s, "dismiss")} style={{ height: 40, paddingHorizontal: 14 }} />
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
