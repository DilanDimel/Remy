import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Group, Icon, Remy, Row, T, success, tap } from "@/components/ui";
import { useGateRedirect } from "@/lib/gate";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import type { Me, Workspace } from "@shared/types";

const POLICIES = "https://remyai.org/policies";
const WAIT = 30;

/** First screen for anyone signed out: the welcome, then one email screen for new and returning people (the server
 *  makes the account on the first code), then the 6-digit code. Same words as the phone website's sign-up. */
export default function SignIn() {
  const { signedIn } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"welcome" | "email" | "code">("welcome");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const codeRef = useRef<any>(null);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const away = useGateRedirect("sign-in");
  if (away) return away;

  const send = async () => {
    setBusy(true); setErr("");
    try { await api("POST", "/api/auth/email/start", { email: email.trim() }); setCode(""); setStep("code"); setWait(WAIT); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const verify = async (value: string) => {
    setBusy(true); setErr("");
    try { const r = await api<{ me: Me; workspace: Workspace }>("POST", "/api/auth/email/verify", { email: email.trim(), code: value }); success(); signedIn(r.me, r.workspace); }
    catch (e: any) { setErr(e.message); setCode(""); codeRef.current?.focus(); }
    setBusy(false);
  };
  const typeCode = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 6); setCode(d); if (d.length === 6 && !busy) verify(d); };
  const link = (label: string) => <Text onPress={() => WebBrowser.openBrowserAsync(POLICIES)} style={{ textDecorationLine: "underline" }}>{label}</Text>;
  const backBtn = (to: "welcome" | "email") => (
    <Pressable testID="button-back" accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => { tap(); setErr(""); setStep(to); }} style={{ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginLeft: -4 }}>
      <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chev" size={22} color={c.fox} strokeWidth={2.4} /></View>
      <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.fox }}>Back</Text>
    </Pressable>
  );
  const shell = (body: React.ReactNode, foot?: React.ReactNode) => (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
        <View style={{ flex: 1, gap: 12 }}>{body}</View>
        {foot && <View style={{ gap: 10, paddingTop: 12 }}>{foot}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (step === "welcome") return shell(<>
    <View style={{ alignItems: "center", marginTop: 8 }}><Remy size={130} /></View>
    <T kind="display" style={{ textAlign: "center" }}>Find the jobs you can actually get.</T>
    <T kind="muted" style={{ textAlign: "center" }}>I'm Remy, your career coach for college. I work on your resume, find openings that fit you and plan your next step with you.</T>
    <Group style={{ marginTop: 8 }}>
      <Row first title="Fix your resume, line by line" sub="Only from what's true. You approve every change." subLines={2} left={<Icon name="doc" size={20} color={c.fox} />} />
      <Row title="Openings that fit you" sub="Internships, jobs and events, checked daily" left={<Icon name="jobs" size={20} color={c.fox} />} />
      <Row title="A plan for this semester" sub="Small steps, one at a time" left={<Icon name="compass" size={20} color={c.fox} />} />
    </Group>
  </>, <>
    <Button testID="button-get-started" kind="fox" label="Get started" icon="arrow" onPress={() => setStep("email")} flex />
    <Button testID="button-have-account" kind="ghost" label="I already have an account" onPress={() => setStep("email")} flex />
    <T kind="small" style={{ textAlign: "center" }}>Free during beta · {link("Privacy")} · {link("Terms")}</T>
  </>);

  if (step === "email") return shell(<>
    {backBtn("welcome")}
    <View style={{ alignSelf: "flex-start" }}><Remy size={80} /></View>
    <T kind="display">Get started with Remy</T>
    <T kind="muted">Free during beta. New or back, enter your email and Remy sends a 6-digit code.</T>
    <TextInput testID="input-email" autoFocus style={{ height: 54, borderRadius: BUTTON_RADIUS, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, fontFamily: font.body, fontSize: 17, color: c.ink, marginTop: 8 }}
      placeholder="you@school.edu" placeholderTextColor={c.faint} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
      value={email} onChangeText={setEmail} onSubmitEditing={() => /.+@.+\..+/.test(email.trim()) && send()} returnKeyType="send" />
    <T kind="small">Already have an account? Use the same email and you'll pick up where you left off, on the website too.</T>
    {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
  </>, <>
    <Button testID="button-send-code" kind="fox" label="Send code" onPress={send} busy={busy} disabled={!/.+@.+\..+/.test(email.trim())} flex />
    <T kind="small" style={{ textAlign: "center" }}>By continuing you agree to Remy's {link("Terms")} and {link("Privacy Policy")}.</T>
  </>);

  // The code: six boxes over one hidden field, so the phone's "from Messages/Mail" suggestion fills all six at once.
  return shell(<>
    {backBtn("email")}
    <T kind="display">Check your email</T>
    <T kind="muted">We sent a 6-digit code to <Text style={{ fontFamily: font.bold, color: c.ink }}>{email.trim()}</Text>. It expires in 10 minutes. Not there? Check spam or Promotions.</T>
    <Pressable onPress={() => codeRef.current?.focus()} style={{ flexDirection: "row", gap: 8, marginTop: 8 }} accessible={false}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const at = i === code.length && !busy;
        return (
          <View key={i} style={{ flex: 1, maxWidth: 56, aspectRatio: 0.85, borderRadius: 12, borderWidth: at ? 2 : 1.5, borderColor: err ? c.error : at ? c.fox : c.line, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.display, fontSize: 24, color: c.ink }}>{code[i] || ""}</Text>
          </View>
        );
      })}
      <TextInput ref={codeRef} testID="input-code" autoFocus value={code} onChangeText={typeCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6}
        accessibilityLabel="6-digit code" caretHidden style={{ position: "absolute", inset: 0, opacity: 0.02, color: "transparent" }} />
    </Pressable>
    {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
      <Pressable testID="button-resend-code" disabled={wait > 0 || busy} hitSlop={8} onPress={() => { tap(); send(); }}>
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: wait > 0 ? c.mutedText : c.foxDeep }}>{wait > 0 ? `Send a new code (0:${String(wait).padStart(2, "0")})` : "Send a new code"}</Text>
      </Pressable>
      <Pressable testID="button-other-email" hitSlop={8} onPress={() => { tap(); setStep("email"); setCode(""); setErr(""); }}>
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.foxDeep }}>Use a different email</Text>
      </Pressable>
    </View>
  </>, <Button testID="button-verify" label="Sign in" onPress={() => verify(code)} busy={busy} disabled={code.length !== 6} flex />);
}
