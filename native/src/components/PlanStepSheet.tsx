import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Workspace } from "@shared/types";
import { Button, Icon, T, success, tap } from "@/components/ui";
import { api } from "@/lib/api";
import { askRemy } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

/** One step of the student's plan (ws.plan): a career step, a skill or certification, or a semester. It used to open the
 *  website's My Path in a sheet; now it opens here, with what the plan already says about it and two next moves: put it
 *  on the to-do list, or ask Remy about it. Nothing is added to what the plan says. */
export type PlanStop = { key: string; title: string; sub: string; why?: string; verify?: string; items?: string[]; note?: string; ask: string };

export function PlanStepSheet({ stop, onClose }: { stop: PlanStop; onClose: () => void }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const onList = !!ws?.tasks.some((t) => t.title === stop.title);
  const url = stop.verify && /^https?:\/\//.test(stop.verify) ? stop.verify : "";
  const addTask = async () => {
    if (!ws || onList) return;
    setBusy(true); setErr("");
    const task = { id: "t" + Math.random().toString(36).slice(2, 10), title: stop.title, why: stop.why || "", due: "", category: "Prepare" as const, done: false, source: "Added from My Path" };
    try { setWs(await api<Workspace>("PUT", "/api/ws/tasks", { value: [task, ...ws.tasks] })); success(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const box = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 } as const;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} testID="sheet-plan-step">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 16, paddingHorizontal: 16 }}>
        <View style={{ flex: 1, gap: 2 }}><T kind="label" style={{ color: c.foxDeep }}>{stop.sub}</T><T kind="h2">{stop.title}</T></View>
        <Pressable testID="button-sheet-close" accessibilityLabel="Close" hitSlop={10} onPress={onClose}><Icon name="x" size={22} color={c.mutedText} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: insets.bottom + 24 }}>
        {!!stop.why && <View style={box}><T kind="label">Why it's in your plan</T><T>{stop.why}</T></View>}
        {!!stop.items?.length && <View style={box}><T kind="label">The plan for this term</T>{stop.items.map((it) => <View key={it} style={{ flexDirection: "row", gap: 8 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fox, marginTop: 8 }} /><T style={{ flex: 1 }}>{it}</T></View>)}{!!stop.note && <T kind="small">{stop.note}</T>}</View>}
        {!!stop.verify && (
          <View style={box}>
            <T kind="label">Where to check it</T>
            {url ? <Pressable testID="link-plan-verify" onPress={() => Linking.openURL(url)}><Text style={{ fontFamily: font.bold, fontSize: 15, color: c.fox }}>{url.replace(/^https?:\/\/(www\.)?/, "")}</Text></Pressable> : <T>{stop.verify}</T>}
          </View>
        )}
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
        {!stop.items && <Button testID="button-plan-add-todo" label={onList ? "On your to-do list" : "Add to my to-dos"} icon={onList ? "check" : "plus"} disabled={onList} busy={busy} flex onPress={addTask} />}
        <Button testID="button-plan-ask" kind={stop.items ? "ink" : "ghost"} label="Ask Remy about it" icon="arrow" flex onPress={() => { tap(); onClose(); askRemy(stop.ask); }} />
      </ScrollView>
    </View>
  );
}
