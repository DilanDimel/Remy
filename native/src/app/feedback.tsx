import { router } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Remy, T, success } from "@/components/ui";
import { api, apiForm } from "@/lib/api";
import { canPickImages, pickScreenshot, type Picked } from "@/lib/pick";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";

/** More → Send feedback: a note to the team (`POST /api/feedback`, the website's feedback box), marked as from the app,
 *  with an optional screenshot from Photos (expo-image-picker, in builds from Nov 24 on; older builds say so). */
export default function Feedback() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [shot, setShot] = useState<Picked | null>(null);
  const page = `App (${Platform.OS})`;
  const send = async () => {
    setBusy(true); setError("");
    try {
      if (shot) await apiForm("/api/feedback", shot, { message: text.trim(), page });
      else await api("POST", "/api/feedback", { message: text.trim(), page });
      success(); setSent(true);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  const addShot = async () => {
    setError("");
    try {
      const s = await pickScreenshot();
      if (s && (s.size || 0) > 2_000_000) return setError("That screenshot is too large. Try a smaller one.");
      if (s) setShot(s);
    } catch (e: any) { setError(e.message); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Remy size={56} />
          <T kind="muted" style={{ flex: 1 }}>{sent ? "Thank you! The team reads every note." : "Something confusing, broken or missing? Tell the team in a sentence or two."}</T>
        </View>
        {sent ? <Button testID="button-feedback-done" label="Done" onPress={() => router.back()} flex /> : <>
          <TextInput testID="input-feedback" value={text} onChangeText={setText} multiline maxLength={1000} autoFocus placeholder="What happened, and where?" placeholderTextColor={c.faint}
            style={{ minHeight: 140, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 12, fontFamily: font.body, fontSize: 16, color: c.ink, textAlignVertical: "top" }} />
          {shot ? (
            <View testID="feedback-screenshot" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image source={{ uri: shot.uri }} style={{ width: 56, height: 100, borderRadius: 8, borderWidth: 1, borderColor: c.line }} resizeMode="cover" />
              <T kind="small" style={{ flex: 1 }}>Screenshot added.</T>
              <Pressable testID="button-remove-screenshot" hitSlop={8} onPress={() => setShot(null)}><Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>Remove</Text></Pressable>
            </View>
          ) : canPickImages() ? <Button testID="button-add-screenshot" kind="ghost" label="Add a screenshot" onPress={addShot} flex /> : null}
          {!!error && <T kind="small" style={{ color: c.error }}>{error}</T>}
          <Button testID="button-send-feedback" label="Send" onPress={send} busy={busy} disabled={text.trim().length < 3} flex />
          <T kind="small">Your note goes to the team with your account, so they can follow up.{canPickImages() ? " Only the team sees your screenshot." : " Screenshots can be added from the website's feedback box."}</T>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
