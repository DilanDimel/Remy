import { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { Button, Remy, Screen, T, success } from "@/components/ui";
import { useGateRedirect } from "@/lib/gate";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import type { Me, Workspace } from "@shared/types";

/** Sign in with the 6-digit email code (the same one the website sends). It works inside any app, unlike Google's page. */
export default function SignIn() {
  const { signedIn } = useSession();
  const { c } = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const away = useGateRedirect("sign-in");
  if (away) return away;

  const input = { height: 54, borderRadius: BUTTON_RADIUS, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, fontFamily: font.body, fontSize: 17, color: c.ink } as const;
  const start = async () => {
    setBusy(true); setErr("");
    try { await api("POST", "/api/auth/email/start", { email }); setSent(true); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true); setErr("");
    try { const r = await api<{ me: Me; workspace: Workspace }>("POST", "/api/auth/email/verify", { email, code }); success(); signedIn(r.me, r.workspace); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 14, paddingBottom: 40 }}>
        <View style={{ alignSelf: "flex-start", marginBottom: 6 }}><Remy size={92} /></View>
        <T kind="display">{sent ? "Check your email" : "Welcome to Remy"}</T>
        <T kind="muted">{sent ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.` : "Your career coach, now as an app. Sign in with the email you use on remyai.org."}</T>
        {!sent ? (
          <TextInput testID="input-email" style={input} placeholder="you@school.edu" placeholderTextColor={c.faint} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} onSubmitEditing={start} returnKeyType="send" />
        ) : (
          <TextInput testID="input-code" style={[input, { letterSpacing: 8, fontFamily: font.bold, fontSize: 22 }]} placeholder="123456" placeholderTextColor={c.faint} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} value={code} onChangeText={setCode} onSubmitEditing={verify} />
        )}
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
        <Button testID={sent ? "button-verify" : "button-send-code"} label={sent ? "Sign in" : "Email me a code"} onPress={sent ? verify : start} busy={busy} flex />
        {sent && <Button testID="button-other-email" kind="ghost" label="Use another email" onPress={() => { setSent(false); setCode(""); setErr(""); }} flex />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
