import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Group, Icon, Remy, Row, T, success, tap } from "@/components/ui";
import { useGateRedirect } from "@/lib/gate";
import { api, API_BASE } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { newVerifier, parseReturn } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { brand } from "@/lib/tokens";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import type { Me, Workspace } from "@shared/types";

const WAIT = 30;
type Sso = "google" | "linkedin_oidc";
// Expo Go (testing) can't receive remy:// links, so its sign-in collects the result from the server instead.
const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const SSO: { id: Sso; label: string }[] = [{ id: "google", label: "Google" }, { id: "linkedin_oidc", label: "LinkedIn" }];

const GoogleMark = () => (
  <Svg width={20} height={20} viewBox="0 0 48 48">
    <Path fill={brand.googleRed} d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
    <Path fill={brand.googleBlue} d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
    <Path fill={brand.googleYellow} d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
    <Path fill={brand.googleGreen} d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </Svg>
);
const LinkedInMark = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path fill={brand.linkedin} d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </Svg>
);


/** First screen for anyone signed out: the welcome, then one email screen for new and returning people (the server
 *  makes the account on the first code), then the 6-digit code. Same words as the phone website's sign-up. */
export default function SignIn() {
  const { signedIn } = useSession();
  const { config } = useConfig();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"welcome" | "email" | "code">("welcome");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ssoBusy, setSsoBusy] = useState<Sso | "">("");
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
  // Google and LinkedIn go through Supabase in the system browser sheet (Google refuses sign-in inside an app's web
  // view), then come back on the app's own link with a one-time code (PKCE) that only this app can swap for the token our server checks, the same as the website's buttons.
  const sso = async (p: Sso) => {
    const sb = config?.supabase;
    if (!sb) return;
    setSsoBusy(p); setErr("");
    try {
      // Supabase returns to a remyai.org page that opens remy://auth: Android's Chrome won't follow a redirect
      // straight into the app at the end of a long sign-in (after a phone prompt), but it will from a tap there.
      // Expo Go can't receive remy://, so there the page leaves the code with our server under a random key and
      // the app collects it (the code is useless without this app's verifier).
      const back = Linking.createURL("auth");
      const verifier = newVerifier();
      const key = expoGo ? newVerifier().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "";
      const via = `${API_BASE || "https://remyai.org"}/api/auth/app-return${key ? `?state=${key}` : ""}`;
      const session = WebBrowser.openAuthSessionAsync(`${sb.url}/auth/v1/authorize?provider=${p}&redirect_to=${encodeURIComponent(via)}&code_challenge=${verifier}&code_challenge_method=plain`, back);
      let backUrl = "";
      if (key) {
        let closed = false;
        session.finally(() => { closed = true; }).catch(() => {});
        // Checks every second while the page is open, and a few more times once they're back in the app.
        for (let i = 0, after = 0; i < 300 && after < 5 && !backUrl; i++) {
          await new Promise((ok) => setTimeout(ok, 1000));
          const h = await api<{ result: string | null }>("GET", `/api/auth/app-handoff?state=${key}` as `/api/${string}`).catch(() => ({ result: null }));
          if (h.result) backUrl = `remy://auth?${h.result}`;
          else if (closed) after++;
        }
        if (backUrl) Promise.resolve().then(() => WebBrowser.dismissBrowser()).catch(() => {});
      } else {
        const r = await session;
        if (r.type === "success") backUrl = r.url;
      }
      if (backUrl) {
        const { code, error } = parseReturn(backUrl);
        if (!code) throw new Error(error ? `Sign-in didn't finish: ${error}` : "Sign-in didn't finish. Please try again.");
        // The code is only good with the verifier this app kept, so it's swapped for the token here, not in the link.
        const t = await fetch(`${sb.url}/auth/v1/token?grant_type=pkce`, { method: "POST", headers: { apikey: sb.anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ auth_code: code, code_verifier: verifier }) });
        const tok = await t.json().catch(() => ({}));
        if (!t.ok || !tok.access_token) throw new Error(tok.error_description || tok.msg || "Sign-in didn't finish. Please try again.");
        const s = await api<{ me: Me; workspace: Workspace }>("POST", "/api/auth/supabase", { accessToken: tok.access_token });
        success(); signedIn(s.me, s.workspace);
      }
    } catch (e: any) { setErr(e.message); }
    setSsoBusy("");
  };
  const ssoOn = SSO.filter((s) => config?.supabase?.providers[s.id]);
  const ssoButtons = !!ssoOn.length && <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: c.line }} /><T kind="small">or</T><View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
    </View>
    {ssoOn.map((s) => (
      <Pressable key={s.id} testID={`button-sso-${s.id === "google" ? "google" : "linkedin"}`} accessibilityRole="button" accessibilityLabel={`Continue with ${s.label}`} disabled={!!ssoBusy || busy}
        onPress={() => { tap(); sso(s.id); }}
        style={({ pressed }) => ({ height: 50, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: pressed ? 0.8 : 1 })}>
        {ssoBusy === s.id ? <ActivityIndicator color={c.ink} /> : s.id === "google" ? <GoogleMark /> : <LinkedInMark />}
        <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.ink }}>Continue with {s.label}</Text>
      </Pressable>
    ))}
  </>;
  const typeCode = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 6); setCode(d); if (d.length === 6 && !busy) verify(d); };
  // Privacy and Terms open inside the app (a sheet over this screen), never in an outside browser.
  const link = (label: string, path: string) => <Text onPress={() => router.push({ pathname: "/web", params: { path, title: label } })} style={{ textDecorationLine: "underline" }}>{label}</Text>;
  const backBtn = (to: "welcome" | "email") => (
    <Pressable testID="button-back" accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => { tap(); setErr(""); setStep(to); }} style={{ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginLeft: -4 }}>
      <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chev" size={22} color={c.fox} strokeWidth={2.4} /></View>
      <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.fox }}>Back</Text>
    </Pressable>
  );
  // The back link stays at the top; everything else sits in the middle of the screen (not stuck to the top with an
  // empty half below), capped at 440 wide so it doesn't stretch on big phones and tablets.
  const shell = (body: React.ReactNode, foot?: React.ReactNode, top?: React.ReactNode) => (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
        {top}
        <View style={{ flex: 1, gap: 12, justifyContent: "center", width: "100%", maxWidth: 440, alignSelf: "center" }}>{body}</View>
        {foot && <View style={{ gap: 10, paddingTop: 12, width: "100%", maxWidth: 440, alignSelf: "center" }}>{foot}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (step === "welcome") return shell(<>
    <View style={{ alignItems: "center", marginTop: 8 }}><Remy size={130} alive /></View>
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
    <T kind="small" style={{ textAlign: "center" }}>Free during beta · {link("Privacy & Terms", "/policies")} · {link("About", "/about")}</T>
  </>);

  if (step === "email") return shell(<>
    <View style={{ alignSelf: "center" }}><Remy size={80} alive /></View>
    <T kind="display" style={{ textAlign: "center" }}>Get started with Remy</T>
    <T kind="muted" style={{ textAlign: "center" }}>Free during beta. New or back, enter your email and Remy sends a 6-digit code.</T>
    <TextInput testID="input-email" autoFocus style={{ height: 54, borderRadius: BUTTON_RADIUS, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, fontFamily: font.body, fontSize: 17, color: c.ink, marginTop: 8 }}
      placeholder="you@school.edu" placeholderTextColor={c.faint} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
      value={email} onChangeText={setEmail} onSubmitEditing={() => /.+@.+\..+/.test(email.trim()) && send()} returnKeyType="send" />
    <Button testID="button-send-code" kind="fox" label="Send code" onPress={send} busy={busy} disabled={!/.+@.+\..+/.test(email.trim()) || !!ssoBusy} flex />
    {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
    {ssoButtons}
    <T kind="small" style={{ textAlign: "center" }}>Already have an account? Use the same email or the same Google or LinkedIn account and you'll pick up where you left off, on the website too.</T>
  </>, <T kind="small" style={{ textAlign: "center" }}>By continuing you agree to Remy's {link("Terms", "/terms")} and {link("Privacy Policy", "/privacy")}.</T>, backBtn("welcome"));

  // The code: six boxes over one hidden field, so the phone's "from Messages/Mail" suggestion fills all six at once.
  return shell(<>
    <T kind="display" style={{ textAlign: "center" }}>Check your email</T>
    <T kind="muted" style={{ textAlign: "center" }}>We sent a 6-digit code to <Text style={{ fontFamily: font.bold, color: c.ink }}>{email.trim()}</Text>. It expires in 10 minutes. Not there? Check spam or Promotions.</T>
    <Pressable onPress={() => codeRef.current?.focus()} style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 8 }} accessible={false}>
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
    <Button testID="button-verify" label="Sign in" onPress={() => verify(code)} busy={busy} disabled={code.length !== 6} flex style={{ marginTop: 6 }} />
  </>, undefined, backBtn("email"));
}
