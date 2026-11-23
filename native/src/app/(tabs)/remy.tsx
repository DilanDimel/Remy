import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, Animated, Easing, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChatDid, ChatMsg, Workspace } from "@shared/types";
import { Fox, Icon, RichText, T, success, tap } from "@/components/ui";
import { api, streamChat } from "@/lib/api";
import { go } from "@/lib/nav";
import { tidyPartial } from "@/lib/partial";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";

const QUICK = ["What should I do this week?", "Which opening fits me best?", "Help me practice an interview"];

/** "Remy is writing": three dots that rise and fade in turn, so a slow first word never looks stuck. */
function TypingDots({ color, bg, line }: { color: string; bg: string; line: string }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = dots.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay((2 - i) * 160 + 200),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View testID="typing-dots" accessibilityLabel="Remy is writing" style={{ alignSelf: "flex-start", flexDirection: "row", gap: 5, backgroundColor: bg, borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 8, borderWidth: 1, borderColor: line }}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />
      ))}
    </View>
  );
}

/** Remy's chat. The fox lives here only (owner view rule). Everything Remy does from a reply shows with Undo. */
export default function RemyChat() {
  const { ws, setWs } = useSession();
  const { c, look } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  // Opened from Today ("Help me with this: …"): the question waits in the box, ready to send or edit.
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  useEffect(() => { if (ask) setText(ask); }, [ask]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ChatMsg | null>(null);
  // Remy's reply while it is being written (streamed): `live` is what has arrived, `shown` catches up a few
  // characters at a time, so a reply that arrives in one burst still reads as being written. The saved message
  // replaces it once `shown` has caught up.
  const [live, setLive] = useState("");
  const [shown, setShown] = useState("");
  const done = useRef<{ w?: Workspace; err?: string; m?: string } | null>(null);
  const [doneTick, setDoneTick] = useState(0);
  const finish = () => {
    const d = done.current; done.current = null;
    if (d?.w) setWs(d.w);
    if (d?.err) { setErr(d.err); setText(d.m || ""); }
    setLive(""); setShown(""); setPending(null); setBusy(false);
  };
  useEffect(() => {
    if (shown.length >= live.length) { if (done.current) finish(); return; }
    const t = setTimeout(() => setShown(live.slice(0, shown.length + Math.max(3, Math.ceil((live.length - shown.length) / 12)))), 24);
    return () => clearTimeout(t);
  }, [live, shown, doneTick]);
  const [err, setErr] = useState("");
  // Inside the native tabs the bottom inset already includes the tab bar, so the box sits just above it; with the
  // keyboard up it sits just above the keyboard instead (the keyboard covers the tab bar).
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKb(true));
    const b = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  if (!ws) return null;
  const soul = look === "soul";
  const msgs = [...ws.chat, ...(pending ? [pending] : []), ...(pending && shown ? [{ id: "live", role: "assistant", text: tidyPartial(shown), at: pending.at } as ChatMsg] : [])].slice(-60).reverse();

  const send = async (message: string) => {
    const m = message.trim();
    if (!m || busy) return;
    tap(); Keyboard.dismiss(); setText(""); setErr(""); setBusy(true);
    setPending({ id: "pending", role: "user", text: m, at: new Date().toISOString() });
    try { done.current = { w: await streamChat<Workspace>({ message: m, page: "home", where: "native app: Remy tab" }, setLive) }; }
    catch (e: any) { done.current = { err: e.message, m }; }
    setDoneTick((n) => n + 1); // the effect above finishes once the shown text has caught up (at once if nothing streamed)
  };
  // Remy can't clear the chat from a reply (it used to say "I've cleared our chat" and didn't): this button does.
  const clearChat = () => Alert.alert("Clear the whole chat?", "Things Remy already did for you stay done.", [
    { text: "Keep", style: "cancel" },
    { text: "Clear chat", style: "destructive", onPress: async () => { try { setWs(await api<Workspace>("DELETE", "/api/chat")); success(); } catch (e: any) { setErr(e.message); } } },
  ]);
  const undo = async (mid: string, d: ChatDid) => {
    try { setWs(await api<Workspace>("POST", `/api/chat/${mid}/undo/${d.id}`)); success(); } catch (e: any) { setErr(e.message); }
  };

  const bubble = (m: ChatMsg) => {
    const me = m.role === "user";
    return (
      <View style={{ marginBottom: 8 }}>
        <View style={{ maxWidth: "84%", alignSelf: me ? "flex-end" : "flex-start", backgroundColor: me ? c.ink : c.surface, borderRadius: 20, borderBottomRightRadius: me ? 6 : 20, borderBottomLeftRadius: me ? 20 : 6, paddingHorizontal: 15, paddingVertical: 11, borderWidth: me ? 0 : 1, borderColor: c.line }}>
          <RichText text={m.text} style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 22, color: me ? c.onInk : c.ink }} />
        </View>
        {m.resumeProposal && (
          <Pressable testID="button-review-resume-change" onPress={() => go("/resume?tab=base", "Resume")} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: c.line, marginTop: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: BUTTON_RADIUS, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Icon name="doc" size={20} color={c.foxDeep} /></View>
            <View style={{ flex: 1 }}><Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>Resume change to review</Text><T kind="small" numberOfLines={1}>{m.resumeProposal.summary || "See original vs new"}</T></View>
            <Icon name="chev" size={18} color={c.faint} />
          </Pressable>
        )}
        {(m.did || []).map((d) => (
          <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingTop: 6 }}>
            <Icon name={d.undone ? "undo" : "check"} size={16} color={d.undone ? c.faint : c.sage} />
            <Text style={{ flex: 1, fontFamily: font.body, fontSize: 13.5, color: c.muted, textDecorationLine: d.undone ? "line-through" : "none" }} numberOfLines={2}>{d.label}</Text>
            {!d.undone && <Pressable testID="button-undo" hitSlop={8} onPress={() => undo(m.id, d)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Icon name="undo" size={14} /><Text style={{ fontFamily: font.bold, fontSize: 13.5, color: c.ink }}>Undo</Text></Pressable>}
          </View>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 18, paddingBottom: 10, flexDirection: soul ? "row" : "column", alignItems: "center", gap: soul ? 10 : 2, borderBottomWidth: soul ? 0 : 1, borderColor: c.line }}>
        <View style={{ width: soul ? 46 : 40, height: soul ? 46 : 40, borderRadius: 23, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Fox size={soul ? 30 : 26} /></View>
        {soul ? (
          <View style={{ flex: 1 }}><Text style={{ fontFamily: font.display, fontSize: 18, color: c.ink }}>Remy</Text><T kind="small">Your career coach</T></View>
        ) : <Text style={{ fontFamily: font.semi, fontSize: 13, color: c.ink }}>Remy</Text>}
        {ws.chat.length > 0 && !busy && (
          <Pressable testID="button-clear-chat" accessibilityRole="button" accessibilityLabel="Clear chat" hitSlop={10} onPress={() => { tap(); clearChat(); }}
            style={soul ? { paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, justifyContent: "center" } : { position: "absolute", left: 18, top: insets.top + 16 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.muted }}>Clear</Text>
          </Pressable>
        )}
      </View>
      <FlatList inverted data={msgs} keyExtractor={(m) => m.id} renderItem={({ item }) => bubble(item)} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onTouchStart={() => Keyboard.dismiss()} style={{ flex: 1 }}
        ListHeaderComponent={busy && !shown ? <TypingDots color={c.muted} bg={c.surface} line={c.line} /> : undefined}
        ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }], paddingTop: 40, alignItems: "center", gap: 8 }}><T kind="h2">Ask Remy anything</T><T kind="muted" style={{ textAlign: "center" }}>About jobs, your resume, interviews or what to do next. Remy only uses what you've told it.</T></View>} />
      {!!err && <T kind="small" style={{ color: c.error, paddingHorizontal: 18, paddingBottom: 6 }}>{err}</T>}
      {soul && !text && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8, alignItems: "center" }}>
          {QUICK.map((q) => <Pressable key={q} testID="button-quick-reply" onPress={() => send(q)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, justifyContent: "center" }}><Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.ink }}>{q}</Text></Pressable>)}
        </ScrollView>
      )}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginHorizontal: 12, marginTop: 4, marginBottom: kb ? 8 : insets.bottom + 10, paddingLeft: 18, paddingRight: 5, paddingVertical: 5, minHeight: 50, borderRadius: 25, borderCurve: "continuous", backgroundColor: c.surface, borderWidth: 1, borderColor: text.trim() ? c.fox + "55" : c.line, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
        <TextInput testID="input-chat" value={text} onChangeText={setText} placeholder={soul ? "Ask Remy anything" : "Message Remy"} placeholderTextColor={c.faint} multiline maxLength={2000}
          returnKeyType="send" submitBehavior="blurAndSubmit" onSubmitEditing={() => send(text)} enablesReturnKeyAutomatically selectionColor={c.fox}
          style={{ flex: 1, alignSelf: "center", fontFamily: font.body, fontSize: 16, lineHeight: 21, color: c.ink, maxHeight: 120, paddingTop: 9, paddingBottom: 9 }} />
        <Pressable testID="button-send" accessibilityLabel="Send" disabled={!text.trim() || busy} onPress={() => send(text)} hitSlop={6}
          style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: text.trim() ? c.fox : c.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <Icon name="up" size={19} color={text.trim() ? c.onFox : c.faint} strokeWidth={2.6} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
