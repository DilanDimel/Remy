import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Animated, Easing, FlatList, Keyboard, LayoutAnimation, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChatAction, ChatDid, ChatMsg, Workspace } from "@shared/types";
import { resumeDiff } from "@shared/resumeDiff";
import { Icon, Remy, RichText, T, success, tap } from "@/components/ui";
import { api, streamChat } from "@/lib/api";
import { go } from "@/lib/nav";
import { tidyPartial } from "@/lib/partial";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";

const PROFILE_NAME: Record<string, string> = { major: "Major", minors: "Minors", school: "School", graduation: "Graduation", location: "Location" };
const NOTIFY_NAME: Record<string, string> = { "notify.deadlines": "deadline reminders", "notify.statusChanges": "status-change alerts", "notify.weeklyPlan": "weekly plan emails" };
const rolesOf = (ws: Workspace) => ws.profile.targetRoles.split(/,\s*/).filter(Boolean);
/** The button's words, the website's (client/src/App.tsx). Kinds Remy does himself are never offered as buttons. */
function actionLabel(a: ChatAction, ws: Workspace): string {
  if (a.kind === "task") return `Add to-do: ${a.title}`;
  if (a.kind === "role") return `Look for ${a.title} openings`;
  if (a.kind === "open") return a.label;
  if (a.kind === "profile") return `Change ${PROFILE_NAME[a.field]?.toLowerCase() || a.field} to ${a.value}`;
  if (a.kind === "setting") return a.key === "theme" ? (a.value === "system" ? "Match my device's theme" : `Turn on ${String(a.value)} mode`) : `Turn ${NOTIFY_NAME[a.key] || a.key} ${a.value ? "on" : "off"}`;
  return "";
}
function isDone(a: ChatAction, ws: Workspace) {
  if (a.kind === "task") return ws.tasks.some((t) => t.title === a.title);
  if (a.kind === "role") return rolesOf(ws).some((r) => r.toLowerCase() === a.title.toLowerCase());
  if (a.kind === "profile") return ws.profile[a.field] === a.value;
  if (a.kind === "setting") return a.key === "theme" ? ws.settings.theme === a.value : ws.settings.notify[a.key.split(".")[1] as keyof Workspace["settings"]["notify"]] === a.value;
  return false;
}

/** A resume change Remy drafted from the chat: what changes, before and after, saved only on "Use this" (the website's
 *  chat-proposal). Edit opens the resume; Not now hides it. The server checked it for invented claims before sending. */
function Proposal({ m }: { m: ChatMsg }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const p = m.resumeProposal;
  const r = ws?.resume;
  if (!p || !r || hidden) return null;
  if (JSON.stringify(p.doc) === JSON.stringify(r.doc)) return <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 8 }} testID="chat-resume-saved"><Icon name="check" size={14} color={c.sage} strokeWidth={2.6} /><T kind="small" style={{ color: c.sage }}>Saved to your resume</T></View>;
  // Drafted on an older version: saving it would undo the changes made since.
  if (p.base !== (r.editedAt || r.uploadedAt)) return <T kind="small" style={{ paddingTop: 8 }}>Your resume changed since this draft. Ask again and Remy will draft it on your latest version.</T>;
  const diff = resumeDiff(r.doc, p.doc);
  if (!diff.length) return null;
  const use = async () => {
    setBusy(true); setErr("");
    try { setWs(await api<Workspace>("PUT", "/api/resume/doc", { doc: p.doc, base: p.base })); success(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <View testID="chat-resume-proposal" style={{ marginTop: 8, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 12, gap: 10, maxWidth: "96%" }}>
      {diff.slice(0, 6).map((d, i) => (
        <View key={i} style={{ gap: 4 }}>
          <T kind="small">{d.where}</T>
          {!!d.before && <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.mutedText, textDecorationLine: "line-through" }}>{d.before}</Text>}
          {!!d.after && <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.ink, backgroundColor: c.sageBg, borderRadius: 4, paddingHorizontal: 4 }}>{d.after}</Text>}
        </View>
      ))}
      {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable testID="button-chat-use-change" disabled={busy} onPress={use} style={{ borderRadius: BUTTON_RADIUS, backgroundColor: c.ink, paddingHorizontal: 14, paddingVertical: 9, opacity: busy ? 0.6 : 1 }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.onInk }}>Use this</Text></Pressable>
        <Pressable testID="button-chat-edit-change" onPress={() => go("/resume?tab=base", "Resume")} style={{ borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>Edit</Text></Pressable>
        <Pressable testID="button-chat-skip-change" onPress={() => { tap(); setHidden(true); }} style={{ paddingHorizontal: 10, paddingVertical: 9 }}><Text style={{ fontFamily: font.semi, fontSize: 14, color: c.mutedText }}>Not now</Text></Pressable>
      </View>
    </View>
  );
}

const QUICK = ["What should I do today?", "Which opening fits me best?", "Help me with my resume"];

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

/** Remy's chat, opened over any tab from the floating fox (like the website's Remy panel). Everything Remy does from a
 *  reply shows with Undo. */
export default function RemyChat() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  // Opened from Today ("Help me with this: …"): the question waits in the box, ready to send or edit.
  // From My Path's office box (`send`), it was typed already, so it is asked at once (send() below, once ws is here).
  const { ask, send: sendNow, at } = useLocalSearchParams<{ ask?: string; send?: string; at?: string }>();
  const asked = useRef("");
  useEffect(() => { if (ask && !sendNow) setText(ask); }, [ask, sendNow]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ChatMsg | null>(null);
  // Remy's reply while it is being written (streamed): `live` is what has arrived, `shown` catches up a few
  // characters at a time, so a reply that arrives in one burst still reads as being written. The saved message
  // replaces it once `shown` has caught up.
  const [live, setLive] = useState("");
  const [shown, setShown] = useState("");
  const done = useRef<{ w?: Workspace; err?: string; m?: string } | null>(null);
  const [doneTick, setDoneTick] = useState(0);
  // Keeps the newest message in view: Android closes the keyboard on send and resizes the window, which left the
  // list scrolled up to older messages while Remy's reply came in off screen.
  const list = useRef<FlatList<ChatMsg>>(null);
  const sending = useRef(false);
  const toBottom = () => requestAnimationFrame(() => list.current?.scrollToOffset({ offset: 0, animated: true }));
  const finish = () => {
    const d = done.current; done.current = null; sending.current = false;
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
  // The box sits above the home indicator; with the keyboard up, just above the keyboard instead.
  // On iPhone the chat is a card that ends at the bottom of the screen, but KeyboardAvoidingView measures it as if it
  // started at the top, so it lifted the box short by the card's top gap and the keyboard covered it (Nov 24, on
  // Deme's iPhone). The keyboard's own height, as bottom padding, puts the box right on top of it.
  const [kb, setKb] = useState(false);
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const ease = (e: { duration?: number }) => { if (Platform.OS === "ios") LayoutAnimation.configureNext({ duration: e.duration || 250, update: { type: LayoutAnimation.Types.keyboard } }); };
    const a = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => { ease(e); setKb(true); setKbH(e.endCoordinates.height); });
    const b = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", (e) => { ease(e); setKb(false); setKbH(0); if (sending.current) toBottom(); });
    return () => { a.remove(); b.remove(); };
  }, []);
  // Each new message (yours, Remy's first words, the saved reply) brings the list back to the bottom while sending.
  const count = (ws?.chat.length || 0) + (pending ? 1 : 0) + (shown ? 1 : 0);
  useEffect(() => { if (sending.current || busy) toBottom(); }, [count, busy]);
  useEffect(() => {
    if (!ws || !ask || !sendNow || asked.current === `${at}|${ask}`) return;
    asked.current = `${at}|${ask}`;
    send(ask);
  }, [ws ? 1 : 0, ask, sendNow, at]);
  if (!ws) return null;
  const msgs = [...ws.chat, ...(pending ? [pending] : []), ...(pending && shown ? [{ id: "live", role: "assistant", text: tidyPartial(shown), at: pending.at } as ChatMsg] : [])].slice(-60).reverse();

  const send = async (message: string) => {
    const m = message.trim();
    if (!m || busy) return;
    tap(); sending.current = true; Keyboard.dismiss(); setText(""); setErr(""); setBusy(true); toBottom();
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
  const remember = async (t: string) => {
    tap();
    try { setWs(await api<Workspace>("POST", "/api/memory/remember", { text: t })); success(); } catch (e: any) { setErr(e.message); }
  };
  // The website's act() (client/src/App.tsx): a link opens its page; a to-do, setting, profile change or new role is
  // saved, then shows as done. Everything else Remy does himself, with Undo.
  const act = async (a: ChatAction) => {
    if (a.kind === "open") return go(a.link, a.label);
    const save = (section: string, value: unknown) => api<Workspace>("PUT", `/api/ws/${section}` as `/api/${string}`, { value });
    try {
      let w: Workspace | undefined;
      if (a.kind === "task") w = await save("tasks", [{ id: "t" + Math.random().toString(36).slice(2, 10), title: a.title, why: a.why, due: a.due || "", category: "Prepare", done: false, source: "Remy chat" }, ...ws.tasks]);
      else if (a.kind === "setting" && a.key === "theme") w = await save("settings", { ...ws.settings, theme: a.value, themeChosen: true });
      else if (a.kind === "setting") w = await save("settings", { ...ws.settings, notify: { ...ws.settings.notify, [a.key.split(".")[1]]: a.value } });
      else if (a.kind === "profile") w = await save("profile", { ...ws.profile, [a.field]: a.value });
      else if (a.kind === "role") w = await save("profile", { ...ws.profile, targetRoles: [...rolesOf(ws), a.title].join(", ") });
      if (w) { setWs(w); success(); }
    } catch (e: any) { setErr(e.message); }
  };
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
        <Proposal m={m} />
        {(m.did || []).map((d) => (
          <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingTop: 6 }}>
            <Icon name={d.undone ? "undo" : "check"} size={16} color={d.undone ? c.faint : c.sage} />
            <Text style={{ flex: 1, fontFamily: font.body, fontSize: 13.5, color: c.mutedText, textDecorationLine: d.undone ? "line-through" : "none" }} numberOfLines={2}>{d.label}</Text>
            {!d.undone && <Pressable testID="button-undo" hitSlop={8} onPress={() => undo(m.id, d)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Icon name="undo" size={14} /><Text style={{ fontFamily: font.bold, fontSize: 13.5, color: c.ink }}>Undo</Text></Pressable>}
          </View>
        ))}
        {/* Buttons Remy offered under his reply: nothing happens until the student taps one. Done ones say so. */}
        {!!m.actions?.length && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 8, maxWidth: "92%" }}>
            {m.actions.map((a, i) => {
              const label = actionLabel(a, ws);
              if (!label) return null;
              return isDone(a, ws)
                ? <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: c.sageBg, paddingHorizontal: 10, height: 30 }}><Icon name="check" size={13} color={c.sage} strokeWidth={2.6} /><Text style={{ fontFamily: font.semi, fontSize: 13, color: c.sage }}>{a.kind === "task" ? "On your to-dos" : a.kind === "role" ? "In your search" : "Done"}</Text></View>
                : <Pressable key={i} testID="button-chat-action" onPress={() => { tap(); act(a); }} style={({ pressed }) => ({ borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surface2 : c.surface, paddingHorizontal: 12, paddingVertical: 8 })}><Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.ink }}>{label}</Text></Pressable>;
            })}
          </View>
        )}
        {/* "Remember this?": a fact Remy noticed, saved to his memory only when the student says so. */}
        {(m.memorySuggestions || []).filter((t) => !ws.memory.some((x) => x.text === t)).map((t) => (
          <View key={t} style={{ marginTop: 8, maxWidth: "92%", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12, gap: 6 }} testID="card-remember">
            <T kind="small">Remember this?</T>
            <T>{t}</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable testID="button-remember" onPress={() => remember(t)} style={{ borderRadius: BUTTON_RADIUS, backgroundColor: c.ink, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ fontFamily: font.bold, fontSize: 13.5, color: c.onInk }}>Remember</Text></Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingBottom: Platform.OS === "ios" ? kbH : 0 }}>
      {/* A sheet on iOS (no status bar to clear, room for the grabber); full screen on Android. */}
      <View style={{ paddingTop: Platform.OS === "ios" ? 14 : insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderColor: c.line }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" }}><Remy size={38} icon /></View>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: font.display, fontSize: 18, color: c.ink }}>Remy</Text><T kind="small">Your career coach</T></View>
        {ws.chat.length > 0 && !busy && (
          <Pressable testID="button-clear-chat" accessibilityRole="button" accessibilityLabel="Clear chat" hitSlop={10} onPress={() => { tap(); clearChat(); }}
            style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.mutedText }}>Clear</Text>
          </Pressable>
        )}
        <Pressable testID="button-close-remy" accessibilityRole="button" accessibilityLabel="Close Remy's chat" hitSlop={10} onPress={() => { tap(); router.canGoBack() ? router.back() : router.replace("/"); }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
          <Icon name="x" size={16} color={c.mutedText} strokeWidth={2.4} />
        </Pressable>
      </View>
      {/* The inverted list already flips its empty view back (scale -1 on Android, scaleY -1 on iOS). A transform here replaces that, which mirrored this text on Android. */}
      <FlatList ref={list} inverted data={msgs} keyExtractor={(m) => m.id} renderItem={({ item }) => bubble(item)} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onTouchStart={() => Keyboard.dismiss()} style={{ flex: 1 }}
        ListHeaderComponent={busy && !shown ? <TypingDots color={c.mutedText} bg={c.surface} line={c.line} /> : undefined}
        ListEmptyComponent={<View style={{ paddingTop: 40, alignItems: "center", gap: 8 }}><Remy size={92} /><T kind="h2">Ask Remy anything</T><T kind="muted" style={{ textAlign: "center" }}>About jobs, your resume, interviews or what to do next. Remy only uses what you've told it.</T></View>} />
      {!!err && <T kind="small" style={{ color: c.error, paddingHorizontal: 18, paddingBottom: 6 }}>{err}</T>}
      {/* Starters (only for an empty chat, like the website) wrap instead of running off the edge. */}
      {!text && !busy && !ws.chat.length && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
          {QUICK.map((q) => <Pressable key={q} testID="button-quick-reply" onPress={() => send(q)} style={{ minHeight: 36, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, justifyContent: "center" }}><Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.ink }}>{q}</Text></Pressable>)}
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginHorizontal: 12, marginTop: 4, marginBottom: kb ? 8 : insets.bottom + 10, paddingLeft: 18, paddingRight: 5, paddingVertical: 5, minHeight: 50, borderRadius: 25, borderCurve: "continuous", backgroundColor: c.surface, borderWidth: 1, borderColor: text.trim() ? c.fox + "55" : c.line, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
        <TextInput testID="input-chat" value={text} onChangeText={setText} placeholder="Ask Remy anything" placeholderTextColor={c.faint} multiline maxLength={2000}
          returnKeyType="send" submitBehavior="blurAndSubmit" onSubmitEditing={() => send(text)} enablesReturnKeyAutomatically selectionColor={c.fox}
          style={{ flex: 1, alignSelf: "center", fontFamily: font.body, fontSize: 16, lineHeight: 21, color: c.ink, maxHeight: 120, paddingTop: 9, paddingBottom: 9 }} />
        <Pressable testID="button-send" accessibilityLabel="Send" disabled={!text.trim() || busy} onPress={() => send(text)} hitSlop={6}
          style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: text.trim() ? c.fox : c.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <Icon name="up" size={19} color={text.trim() ? c.onFox : c.faint} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}
