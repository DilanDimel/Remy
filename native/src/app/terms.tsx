import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import type { Workspace } from "@shared/types";
import { BETA_TERMS_LEAD, termsFor } from "@shared/beta";
import { Button, Icon, Remy, T, tap } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { useGateRedirect } from "@/lib/gate";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

/** Every person agrees to the current beta terms once (and again when they change) before anything else: the
 *  website's BetaAgreement (client/src/App.tsx), with the same words from shared/beta.ts. */
export default function Terms() {
  const { setWs } = useSession();
  const { config, reload } = useConfig();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [ok, setOk] = useState(false);
  const [open, setOpen] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const away = useGateRedirect("terms");
  if (away) return away;
  const { version, terms, heads } = termsFor(config?.beta?.open);
  const agree = async () => {
    setBusy(true); setErr("");
    try { setWs(await api<Workspace>("POST", "/api/beta/agree", { version })); }
    catch (e: any) {
      // 409: the terms changed since the app loaded them; show the new ones.
      if (e instanceof ApiError && e.status === 409) { await reload(); setOk(false); }
      setErr(e.message);
    }
    setBusy(false);
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Remy size={56} icon />
          <View style={{ flex: 1 }}><T kind="title">Before you start</T><T kind="small">{BETA_TERMS_LEAD}</T></View>
        </View>
        {/* Each point's short head first; tap it for the full words (the same text as the website). */}
        <View style={{ marginTop: 18, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, overflow: "hidden" }} testID="beta-agreement">
          {terms.map((t, i) => (
            <Pressable key={t} testID="term-row" accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => { tap(); setOpen(open === i ? -1 : i); }}
              style={{ paddingVertical: 13, paddingHorizontal: 16, gap: 6, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: c.line }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ flex: 1, fontFamily: font.body, fontSize: 15.5, color: c.ink }}><Text style={{ fontFamily: font.bold }}>{i + 1}. </Text>{heads[i] || `Point ${i + 1}`}</Text>
                <View style={{ transform: [{ rotate: open === i ? "90deg" : "0deg" }] }}><Icon name="chev" size={16} color={c.faint} /></View>
              </View>
              {open === i && <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: c.mutedText }}>{t}</Text>}
            </Pressable>
          ))}
        </View>
        <Pressable testID="link-policies" onPress={() => WebBrowser.openBrowserAsync("https://remyai.org/policies")} style={{ marginTop: 16 }}>
          <T kind="small" style={{ textDecorationLine: "underline" }}>Read the full privacy policy and terms</T>
        </Pressable>
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 14, gap: 12 }}>
        <Pressable testID="checkbox-beta-agree" accessibilityRole="checkbox" accessibilityState={{ checked: ok }} onPress={() => { tap(); setOk(!ok); }} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: ok ? c.fox : c.line, backgroundColor: ok ? c.fox : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{ok && <Icon name="check" size={14} color={c.onFox} strokeWidth={3} />}</View>
          <Text style={{ flex: 1, fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.ink }}>I'm 16 or older (with a parent or guardian's OK if I'm under 18), I understand Remy is in beta, and I agree to these terms.</Text>
        </Pressable>
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
        <Button testID="button-beta-agree" label="Agree and continue" onPress={() => { if (ok) agree(); }} busy={busy} style={{ opacity: ok ? 1 : 0.45 }} flex />
      </View>
    </View>
  );
}
