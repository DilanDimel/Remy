import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, Text, View } from "react-native";
import { Redirect, router, usePathname } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Loading, RemyRing, tap } from "@/components/ui";
import { Moments } from "@/components/Moments";
import { BigUpgrade } from "@/components/BigUpgrade";
import { gateRoute, useGate } from "@/lib/gate";
import { aboveTabs, font, useTheme } from "@/lib/theme";
import { shadow } from "@/lib/tokens";
import { useOffline } from "@/lib/net";
import { useOwnerView, useSession } from "@/lib/session";
import { useDeviceLanguage, useT } from "@/lib/lang";

/** Remy isn't a tab: like the website, he is a floating fox button above the tab bar that opens his chat from any page.
 *  Not on My Path (he's in his office there) and not while the keyboard is up. */
function RemyButton({ hidden }: { hidden: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { ws } = useSession();
  const t = useT();
  if (hidden) return null;
  const bottom = aboveTabs(insets.bottom);
  // Nov 27: the fox alone didn't read as a button, so it says "Ask Remy"; a dot when he wrote first and waits for you.
  const last = ws?.chat[ws.chat.length - 1];
  const waiting = last?.role === "assistant" && !!last.replies?.length;
  return (
    <Pressable testID="button-remy" accessibilityRole="button" accessibilityLabel={waiting ? "Remy wrote to you" : "Ask Remy"} onPress={() => { tap(); router.push("/remy"); }} hitSlop={6}
      style={({ pressed }) => [{ position: "absolute", right: 16, bottom, height: 52, borderRadius: 26, paddingLeft: 3, paddingRight: 16, gap: 8, flexDirection: "row", backgroundColor: c.surface, borderWidth: 2, borderColor: c.fox, alignItems: "center", overflow: "visible", transform: [{ scale: pressed ? 0.94 : 1 }] }, shadow.floating]}>
      <RemyRing size={44} bg={c.surface} />
      <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{t("Ask Remy")}</Text>
      {waiting && <View testID="remy-waiting-dot" style={{ position: "absolute", top: -2, left: 34, width: 12, height: 12, borderRadius: 6, backgroundColor: c.fox, borderWidth: 2, borderColor: c.surface }} />}
    </Pressable>
  );
}

/** A slim strip under the status bar while the last call couldn't reach Remy. It goes by itself once a call gets through.
 *  Owners first: it's new. */
function OfflineBanner() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const off = useOffline();
  const owner = useOwnerView();
  if (!off || !owner) return null;
  return (
    <View testID="banner-offline" accessibilityRole="alert" pointerEvents="none" style={{ position: "absolute", top: insets.top + 4, left: 16, right: 16, backgroundColor: c.ink, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}>
      <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.onInk, textAlign: "center" }}>You're offline. Remy will try again when you pull down or tap something.</Text>
    </View>
  );
}

export default function Tabs() {
  const gate = useGate();
  const { c } = useTheme();
  const path = usePathname();
  const t = useT();
  useDeviceLanguage();
  // Android: the window shrinks for the keyboard, so the tab bar would sit on top of the keys; hide it meanwhile.
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKb(true));
    const b = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  if (gate === "loading") return <Loading />;
  // The website's order: sign-in, the beta list, the beta terms, setup, then the app (src/lib/rules.ts).
  if (gate !== "tabs") return <Redirect href={gateRoute(gate) as any} />;
  // The website's phone bar, with Remy as the floating fox instead of a tab (handoff 02 §2.0).
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* The bar follows the app theme, not only the phone setting (it stayed light in dark mode on Android). */}
      <NativeTabs tintColor={c.fox} backgroundColor={c.surface} iconColor={{ default: c.mutedText, selected: c.fox }} minimizeBehavior="onScrollDown" labelStyle={{ default: { fontFamily: font.semi, color: c.mutedText }, selected: { fontFamily: font.semi, color: c.fox } }} labelVisibilityMode="labeled" indicatorColor={c.foxSoft} hidden={kb && Platform.OS === "android"}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
          <NativeTabs.Trigger.Label>{t("Home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="path">
          <NativeTabs.Trigger.Icon sf={{ default: "safari", selected: "safari.fill" }} md="explore" />
          <NativeTabs.Trigger.Label>{t("My Path")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="resume">
          <NativeTabs.Trigger.Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} md="description" />
          <NativeTabs.Trigger.Label>{t("Resume")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="jobs">
          <NativeTabs.Trigger.Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} md="work" />
          <NativeTabs.Trigger.Label>{t("Jobs")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="more">
          <NativeTabs.Trigger.Icon sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }} md="menu" />
          <NativeTabs.Trigger.Label>{t("More")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      <RemyButton hidden={kb || path === "/path"} />
      <OfflineBanner />
      {/* A new pin, a first interview or offer, or a new level: said once, the moment it happens (owners). */}
      <Moments />
      <BigUpgrade />
    </View>
  );
}
