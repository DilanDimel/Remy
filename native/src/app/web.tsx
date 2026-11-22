import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import { API_BASE } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const SITE = API_BASE || "https://remyai.org";

/** A website page inside the app, already signed in (the web view shares the app's sign-in cookie).
 *  shortcut: for screens not rebuilt natively yet (resume, interview, settings); replace each with a native screen over time. */
export default function Web() {
  const { path = "/", title = "Remy" } = useLocalSearchParams<{ path?: string; title?: string }>();
  const { refresh } = useSession();
  const { c } = useTheme();
  const [busy, setBusy] = useState(true);
  // Whatever changed on the page (a confirmed resume, a new to-do) shows up when the sheet closes.
  useEffect(() => () => { refresh(); }, [refresh]);
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Stack.Screen options={{ title, headerBackTitle: "Back" }} />
      {Platform.OS === "web"
        ? <iframe src={SITE + safe} style={{ border: 0, width: "100%", height: "100%" }} title={title} />
        : <WebView source={{ uri: SITE + safe }} sharedCookiesEnabled thirdPartyCookiesEnabled applicationNameForUserAgent="RemyApp" onLoadEnd={() => setBusy(false)}
            onShouldStartLoadWithRequest={(r) => r.url.startsWith(SITE)} style={{ backgroundColor: c.paper }} />}
      {busy && Platform.OS !== "web" && <ActivityIndicator color={c.fox} style={{ position: "absolute", top: 24, alignSelf: "center" }} />}
    </View>
  );
}
