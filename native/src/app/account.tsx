import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MemoryFact, Workspace } from "@shared/types";
import { Button, Group, Icon, Row, Sect, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { shareFromServer } from "@/lib/files";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

const now = () => new Date().toISOString();

/** Account, native (it opened the website's /accounts in a sheet): who you are, Remy's memory (approve, remove or add
 *  what he keeps in mind, the website's AI memory tab), your sources, and your data. Editing the profile itself and
 *  deleting the account still open the website's pages, where those flows live. */
export default function Account() {
  const { me, ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  if (!ws) return null;
  const p = ws.profile;
  const suggested = ws.memory.filter((m) => m.status === "suggested");
  const approved = ws.memory.filter((m) => m.status === "approved");
  const run = async (key: string, f: () => Promise<Workspace>) => {
    tap(); setBusy(key); setErr("");
    try { setWs(await f()); success(); } catch (e: any) { setErr(e.message); }
    setBusy("");
  };
  const put = (key: string, list: MemoryFact[]) => run(key, () => api<Workspace>("PUT", "/api/ws/memory", { value: list }));
  const add = () => { const text = adding.trim(); if (!text) return; setAdding(""); put("add", [...ws.memory, { id: "f" + Math.random().toString(36).slice(2, 10), text, category: "other", source: "Added by you", status: "approved", createdAt: now(), updatedAt: now() }]); };
  const download = async () => {
    tap(); setBusy("data"); setErr("");
    try { await shareFromServer("/api/export/data", "Remy-data.json", "application/json"); } catch (e: any) { setErr(e.message); }
    setBusy("");
  };
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 } as const;
  const resumeAt = ws.resume ? new Date(ws.resume.editedAt || ws.resume.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <ScrollView testID="account-screen" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.bold, fontSize: 18, color: c.foxDeep }}>{(p.name || me?.email || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}><T kind="h2" numberOfLines={1}>{p.name || "Your account"}</T><T kind="small" numberOfLines={1}>{me?.email}</T></View>
      </View>

      <Sect title="Profile" right={<Pressable testID="button-edit-profile" hitSlop={8} onPress={() => { tap(); go("/accounts?tab=profile", "Account", { page: true }); }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.fox }}>Edit</Text></Pressable>} />
      <Group>
        <Row first title="School" sub={p.school || "Not added"} testID="row-profile-school" />
        <Row title="Major and year" sub={[p.major, p.classYear].filter(Boolean).join(" · ") || "Not added"} testID="row-profile-major" />
        <Row title="What you're looking for" sub={p.targetRoles || "Not added"} testID="row-profile-roles" />
      </Group>

      <Sect title={`Remy's memory · ${approved.length}`} />
      <T kind="small" style={{ marginHorizontal: 4, marginBottom: 10 }}>What Remy keeps in mind when he helps you. Remove anything that's wrong.</T>
      {suggested.map((m) => (
        <View key={m.id} style={[card, { borderColor: c.fox, marginBottom: 10 }]} testID="memory-suggested">
          <T kind="label" style={{ color: c.foxDeep }}>Remy wants to remember</T>
          <T>{m.text}</T>
          {!!m.conflict && <T kind="small" style={{ color: c.foxDeep }}>{m.conflict}</T>}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {m.conflict ? <>
              <Button testID="button-memory-resume-right" label="My resume is right" busy={busy === m.id + "r"} onPress={() => run(m.id + "r", () => api<Workspace>("POST", `/api/memory/${m.id}/resolve`, { right: "resume" }))} style={{ height: 40, paddingHorizontal: 14 }} />
              <Button testID="button-memory-source-right" kind="ghost" label="This is right" busy={busy === m.id + "s"} onPress={() => run(m.id + "s", () => api<Workspace>("POST", `/api/memory/${m.id}/resolve`, { right: "source" }))} style={{ height: 40, paddingHorizontal: 14 }} />
            </> : <>
              <Button testID="button-approve-memory" label="Yes, remember" busy={busy === m.id} onPress={() => put(m.id, ws.memory.map((x) => (x.id === m.id ? { ...x, status: "approved", updatedAt: now() } : x)))} style={{ height: 40, paddingHorizontal: 14 }} />
              <Button testID="button-reject-memory" kind="ghost" label="No" onPress={() => put(m.id + "x", ws.memory.filter((x) => x.id !== m.id))} style={{ height: 40, paddingHorizontal: 14 }} />
            </>}
          </View>
        </View>
      ))}
      <Group>
        {approved.map((m, i) => (
          <Row key={m.id} first={i === 0} title={m.text} sub={m.source} testID="row-memory"
            right={<Pressable testID="button-delete-memory" accessibilityLabel={`Remove ${m.text}`} hitSlop={10} onPress={() => put(m.id, ws.memory.filter((x) => x.id !== m.id))}><Icon name="x" size={18} color={c.faint} /></Pressable>} />
        ))}
      </Group>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TextInput testID="input-add-memory" value={adding} onChangeText={setAdding} onSubmitEditing={add} placeholder="Add something Remy should know" placeholderTextColor={c.faint} returnKeyType="done"
          style={{ flex: 1, height: 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, fontFamily: font.body, fontSize: 15.5, color: c.ink }} />
        <Button testID="button-add-memory" label="Add" busy={busy === "add"} disabled={!adding.trim()} onPress={add} />
      </View>

      <Sect title="Sources" />
      <Group>
        <Row first title="Resume" sub={ws.resume ? `${ws.resume.fileName || "Your resume"} · ${resumeAt}` : "Not uploaded"} left={<Icon name="doc" color={c.mutedText} />} onPress={() => { tap(); router.navigate("/resume"); }} testID="row-source-resume" />
        <Row title="LinkedIn and other sources" sub="Import facts for Remy to suggest" left={<Icon name="you" color={c.mutedText} />} onPress={() => go("/accounts?tab=sources", "Account", { page: true })} testID="row-source-more" />
      </Group>

      <Sect title="Your data" />
      <Group>
        <Row first title="Download my data" sub="Everything Remy keeps, as a file" left={<Icon name="up" color={c.mutedText} />} onPress={download} right={busy === "data" ? <T kind="small">Preparing…</T> : undefined} testID="row-download-data" />
        <Row title="Delete everything" sub="Your account and all its data, for good" left={<Icon name="x" color={c.error} />} onPress={() => go("/accounts?tab=data", "Account", { page: true })} testID="row-delete-account" />
      </Group>
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 10 }}>{err}</T>}
    </ScrollView>
  );
}
