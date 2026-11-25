// Format check in the app (owners first, Nov 25, 2026): the website's findings as a phone card, and the three clean
// formats as a sheet of big rows, each opening its PDF in the phone's viewer before the student picks it.
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FormatFinding, ResumeLayout, ResumeLook, Workspace } from "@shared/types";
import { Button, Icon, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { shareFromServer } from "@/lib/files";
import { useOwnersOnly, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

type Format = { findings: FormatFinding[]; layout: ResumeLayout | null; look: ResumeLook | null; student: boolean };
const LOOKS: { id: ResumeLook; name: string; why: string }[] = [
  { id: "classic", name: "Classic", why: "Serif, centred name, ruled headings" },
  { id: "modern", name: "Modern", why: "Clean sans, name on the left" },
  { id: "compact", name: "Compact", why: "Smaller margins for a full page" },
];

export function FormatCard() {
  const owner = useOwnersOnly();
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<Format | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const key = `${ws?.resume?.uploadedAt}|${ws?.resume?.editedAt}|${ws?.resume?.style?.look}|${ws?.profile.classYear}`;
  useEffect(() => { if (owner && ws?.resume) api<Format>("GET", "/api/resume/format").then(setF).catch(() => setF(null)); }, [owner, key]);
  if (!owner || !f) return null;
  const look = ws?.resume?.style?.look;
  const name = LOOKS.find((l) => l.id === look)?.name;
  const worst = f.findings.filter((x) => x.level !== "tip");
  const edge = { bad: c.error, fix: c.fox, tip: c.line } as const;
  const preview = async (l: ResumeLook) => {
    setErr(""); setBusy("see-" + l);
    try { await shareFromServer(`/api/resume/format/preview?look=${l}`, `Resume_${l}.pdf`, "application/pdf"); } catch (e: any) { setErr(e.message); }
    setBusy("");
  };
  const pick = async (l: ResumeLook | null) => {
    setErr(""); setBusy("use-" + (l || "own"));
    try { setWs(await api<Workspace>("POST", "/api/resume/format", { look: l })); success(); setSheet(false); } catch (e: any) { setErr(e.message); }
    setBusy("");
  };
  return (
    <View testID="format-card" style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, marginTop: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: worst.length && !name ? c.foxSoft : c.surface2, alignItems: "center", justifyContent: "center" }}><Icon name="doc" size={18} color={c.foxDeep} /></View>
        <T kind="h2" style={{ flex: 1 }}>{name ? `${name} format` : worst.length ? "Your format is costing you" : "Format looks right"}</T>
      </View>
      {f.findings.slice(0, 3).map((x) => (
        <View key={x.id} testID={`format-${x.id}`} style={{ borderLeftWidth: 3, borderLeftColor: edge[x.level], paddingLeft: 10, marginTop: 10 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{x.title}</Text>
          <T kind="small" style={{ color: c.mutedText }}>{x.detail}</T>
        </View>
      ))}
      {f.findings.length > 3 && <T kind="small" style={{ color: c.mutedText, marginTop: 8 }}>{f.findings.length - 3} more on the website's Resume page.</T>}
      <Button testID="button-see-formats" kind={worst.length && !name ? "fox" : "ghost"} label={name ? "Change format" : "See 3 clean formats"} icon="arrow" flex onPress={() => setSheet(true)} style={{ marginTop: 14 }} />
      <Modal visible={sheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 12 }} testID="format-sheet">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T kind="title" style={{ flex: 1 }}>Pick a format</T>
            <Pressable testID="button-close-formats" hitSlop={10} onPress={() => { tap(); setSheet(false); }}><Text style={{ fontFamily: font.bold, fontSize: 15, color: c.fox }}>Done</Text></Pressable>
          </View>
          <T kind="muted">Same words, nothing added. One column, so job sites read it in order. Tap Preview to see it full size.</T>
          {LOOKS.map((l) => (
            <View key={l.id} testID={`format-option-${l.id}`} style={{ borderRadius: radius.card, borderWidth: look === l.id ? 2 : 1, borderColor: look === l.id ? c.fox : c.line, backgroundColor: c.surface, padding: 16, gap: 10 }}>
              <View>
                <Text style={{ fontFamily: l.id === "classic" ? font.display : font.bold, fontSize: 19, color: c.ink }}>{l.name}</Text>
                <T kind="small" style={{ color: c.mutedText }}>{l.why}</T>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button testID={`button-preview-${l.id}`} kind="ghost" label="Preview" busy={busy === "see-" + l.id} onPress={() => void preview(l.id)} />
                <Button testID={`button-use-${l.id}`} kind="ink" label={look === l.id ? "Using this" : "Use it"} disabled={look === l.id} busy={busy === "use-" + l.id} onPress={() => void pick(l.id)} />
              </View>
            </View>
          ))}
          {!!look && <Button testID="button-own-format" kind="ghost" label="Keep my own file instead" flex busy={busy === "use-own"} onPress={() => void pick(null)} />}
          {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
        </ScrollView>
      </Modal>
    </View>
  );
}
