import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { API_BASE } from "@/lib/api";
import { isSiteDownload, shareSiteDownload } from "@/lib/files";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const SITE = API_BASE || "https://remyai.org";

/** Somewhere other than Remy: web pages open in the in-app browser, mail/phone/text links in their own app. */
function openOutside(url: string) {
  if (/^https?:/i.test(url)) WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
  else Linking.openURL(url).catch(() => Alert.alert("Couldn't open that link", "No app on this phone can open it."));
}

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

  // Remy's own pages load here; anything else leaves the sheet instead of being silently blocked.
  const onNavigate = (r: ShouldStartLoadRequest) => {
    if (r.url.startsWith(SITE) || r.url.startsWith("about:") || r.url.startsWith("blob:") || r.url.startsWith("data:")) return true;
    if (r.isTopFrame === false && /^https?:/i.test(r.url)) return true; // embeds inside a Remy page
    openOutside(r.url);
    return false;
  };
  // Downloads: the site sends the file over (a phone web view can't save it), and the share sheet opens.
  const onMessage = (e: WebViewMessageEvent) => {
    let m: unknown;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (isSiteDownload(m)) shareSiteDownload(m).catch((err) => Alert.alert("Couldn't save the file", String(err?.message || err)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Stack.Screen options={{ title, headerBackTitle: "Back" }} />
      {Platform.OS === "web"
        ? <iframe src={SITE + safe} style={{ border: 0, width: "100%", height: "100%" }} title={title} />
        : <WebView source={{ uri: SITE + safe }} sharedCookiesEnabled thirdPartyCookiesEnabled applicationNameForUserAgent="RemyApp" onLoadEnd={() => setBusy(false)}
            originWhitelist={["*"]} onShouldStartLoadWithRequest={onNavigate} onOpenWindow={(e) => openOutside(e.nativeEvent.targetUrl)} onMessage={onMessage}
            style={{ backgroundColor: c.paper }} />}
      {busy && Platform.OS !== "web" && <ActivityIndicator color={c.fox} style={{ position: "absolute", top: 24, alignSelf: "center" }} />}
    </View>
  );
}
