import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Remy, T, success } from "@/components/ui";
import { api } from "@/lib/api";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";

/** More → Send feedback: a note to the team (`POST /api/feedback`, the website's feedback box), marked as from the app.
 *  A screenshot can be attached on the website for now: picking images needs a new store build (expo-image-picker). */
export default function Feedback() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const send = async () => {
    setBusy(true); setError("");
    try { await api("POST", "/api/feedback", { message: text.trim(), page: `App (${Platform.OS})` }); success(); setSent(true); } catch (e: any) { setError(e.message); }
    setBusy(false);
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
          {!!error && <T kind="small" style={{ color: c.error }}>{error}</T>}
          <Button testID="button-send-feedback" label="Send" onPress={send} busy={busy} disabled={text.trim().length < 3} flex />
          <T kind="small">Your note goes to the team with your account, so they can follow up. Screenshots can be added from the website's feedback box.</T>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
