import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Linking, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { API_BASE } from "@/lib/api";
import { isSiteDownload, shareSiteDownload } from "@/lib/files";
import { Button, T } from "@/components/ui";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

const SITE = API_BASE || "https://remyai.org";

/** The site shows Remy's loading screen (#splash in index.html) until it has a page. This tells the app when it's gone,
 *  so a page that never gets there (the server is slow or down) can be told apart from one that is just loading. */
const WATCH_SPLASH = `(function(){ if (window.__remyWatch) return; window.__remyWatch = setInterval(function(){
  if (!document.getElementById("splash")) { clearInterval(window.__remyWatch); window.ReactNativeWebView.postMessage(JSON.stringify({ remyReady: true })); }
}, 400); })(); true;`;
/** How long a page may stay on the loading screen before the app says so instead of spinning on. */
const GIVE_UP_MS = 25000;

// The sheet's title follows the page the student moves to (Resume → Opportunities), using the website's own nav labels (client/src/App.tsx).
const TITLES: Record<string, string> = { path: "My Path", resume: "Resume", opportunities: "Opportunities", interview: "Interview", community: "Community", calendar: "Calendar", progress: "Progress", settings: "Settings", accounts: "Account" };
function titleFor(url: string): string | undefined {
  try { return TITLES[new URL(url).pathname.split("/")[1] || ""]; } catch { return undefined; }
}

/** Somewhere other than Remy: web pages open in the in-app browser, mail/phone/text links in their own app. */
function openOutside(url: string) {
  if (/^https?:/i.test(url)) WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
  else Linking.openURL(url).catch(() => Alert.alert("Couldn't open that link", "No app on this phone can open it."));
}

/** Android: the keyboard covers the bottom of the page without the page knowing, so a field and the button under it
 *  (Progress → To-dos "Add") end up behind the keys. The app tells the page how many pixels are still visible, and the
 *  page scrolls the field to a third of the way down that space, which shows what sits under it too. */
const keepFieldInView = (visible: number) => `(function(){
  var el = document.activeElement; if (!el || (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable)) return;
  var r = el.getBoundingClientRect(), v = ${Math.max(120, Math.round(visible))};
  if (r.top > v * 0.12 && r.bottom + 90 < v) return;
  // The site scrolls inside a panel (.main), not the window: move whichever box holds the field.
  var box = el.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  (box || document.scrollingElement || document.documentElement).scrollBy({ top: r.top - v * 0.3, behavior: "smooth" });
})(); true;`;

/** A website page inside the app, already signed in (the web view shares the app's sign-in cookie).
 *  shortcut: for screens not rebuilt natively yet (resume, interview, settings); replace each with a native screen over time. */
export default function Web() {
  const { path = "/", title = "Remy" } = useLocalSearchParams<{ path?: string; title?: string }>();
  const { refresh } = useSession();
  const { c, dark } = useTheme();
  // The page follows the app's light or dark look (the account's theme, else the phone's), so a light app never
  // opens a dark page or the other way round. Set before the page's own code runs (client/src/lib/store.tsx).
  const appTheme = `window.__remyAppTheme = ${JSON.stringify(dark ? "dark" : "light")}; document.documentElement.dataset.theme = window.__remyAppTheme; true;`;
  // Android draws its gesture bar over the bottom of the page: leave that much room so the last field isn't under it.
  const insets = useSafeAreaInsets();
  const web = useRef<any>(null); // the WebView, to tell the page how much of it the keyboard leaves visible
  const stop = useRef<() => void>(() => {});
  const box = useRef<any>(null); // the sheet's View, measured to know where the page starts on screen
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const bring = (kbTop: number) => box.current?.measureInWindow((_x: number, y: number) => { const v = kbTop - y; if (v > 0) web.current?.injectJavaScript(keepFieldInView(v)); });
    const a = Keyboard.addListener("keyboardDidShow", (e) => setTimeout(() => bring(e.endCoordinates.screenY), 150));
    return () => a.remove();
  }, []);
  const [busy, setBusy] = useState(true);
  const [stuck, setStuck] = useState(false); // the page hasn't shown anything for GIVE_UP_MS, or couldn't load at all
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (Platform.OS === "web") return;
    setStuck(false);
    const t = setTimeout(() => setStuck(true), GIVE_UP_MS);
    stop.current = () => clearTimeout(t);
    return () => clearTimeout(t);
  }, [tries]);
  const [pageTitle, setPageTitle] = useState<string>();
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
    if ((m as any)?.remyReady) { stop.current(); setStuck(false); return; }
    if (isSiteDownload(m)) shareSiteDownload(m).catch((err) => Alert.alert("Couldn't save the file", String(err?.message || err)));
  };

  return (
    <View ref={box} collapsable={false} style={{ flex: 1, backgroundColor: c.bg, paddingBottom: Platform.OS === "android" ? insets.bottom : 0 }}>
      {/* A sheet always has a way out: swiping down is taken by the page's own scrolling. */}
      {/* Done is a solid orange pill: plain orange text sat on iOS's light-grey header pill and was hard to read. */}
      <Stack.Screen options={{ title: pageTitle || title, headerBackTitle: "Back", headerRight: () => (
        <Pressable testID="button-close-sheet" accessibilityRole="button" accessibilityLabel="Done" hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={{ backgroundColor: c.fox, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.onFox }}>Done</Text>
        </Pressable>
      ) }} />
      {Platform.OS === "web"
        ? <iframe src={SITE + safe} style={{ border: 0, width: "100%", height: "100%" }} title={title} />
        : <WebView source={{ uri: SITE + safe }} sharedCookiesEnabled thirdPartyCookiesEnabled applicationNameForUserAgent="RemyApp" injectedJavaScriptBeforeContentLoaded={appTheme} injectedJavaScript={WATCH_SPLASH} onLoadEnd={() => setBusy(false)}
            onError={() => { setBusy(false); setStuck(true); }} onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) { setBusy(false); setStuck(true); } }}
            onNavigationStateChange={(s) => { const t = titleFor(s.url); if (t) setPageTitle(t); }}
            originWhitelist={["*"]} mediaCapturePermissionGrantType="grantIfSameHostElseDeny" onShouldStartLoadWithRequest={onNavigate} onOpenWindow={(e) => openOutside(e.nativeEvent.targetUrl)} onMessage={onMessage}
            ref={web}
            style={{ backgroundColor: c.bg }} />}
      {stuck && Platform.OS !== "web" && (
        <View testID="web-stuck" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
          <T kind="h2" style={{ textAlign: "center" }}>This page isn't loading</T>
          <T kind="muted" style={{ textAlign: "center" }}>Remy's page is taking longer than it should. Check your connection, then try again.</T>
          <Button testID="button-web-retry" kind="fox" label="Try again" onPress={() => { setBusy(true); web.current?.reload(); setTries((n) => n + 1); }} />
          <Button testID="button-web-close" kind="ghost" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        </View>
      )}
      {busy && Platform.OS !== "web" && <ActivityIndicator color={c.fox} style={{ position: "absolute", top: 24, alignSelf: "center" }} />}
    </View>
  );
}
