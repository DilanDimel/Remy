import { Capacitor } from "@capacitor/core";

// Remy's phone apps (ios/, android/) are a native shell that loads the live site
// (see capacitor.config.ts). The same web code runs in both places; this file holds
// the few things a phone app has to do differently from a browser tab. On the web
// every function here is a no-op or falls back to normal browser behaviour.

export const isNativeApp = Capacitor.isNativePlatform();

/** Where Supabase sends the student back after the system browser sign-in.
 * Must also be listed under Authentication → URL Configuration → Redirect URLs in Supabase. */
export const NATIVE_AUTH_RETURN = "org.remyai.app://auth";

/** Opens a page in the in-app browser sheet (Safari View Controller / Chrome Custom Tab). */
export async function openInBrowser(url: string) {
  if (!isNativeApp) { window.open(url, "_blank", "noopener"); return; }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

/** A phone web view can't save a blob link, so the file goes to the share sheet
 * (Save to Files, Drive, Mail, AirDrop…). Returns false on the web so the caller
 * uses the normal download link. */
export async function saveFileNative(blob: Blob, name: string): Promise<boolean> {
  if (!isNativeApp) return false;
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error || new Error("Couldn't read the file."));
    r.readAsDataURL(blob);
  });
  const safe = name.replace(/[\\/:*?"<>|]+/g, "-") || "download";
  const { uri } = await Filesystem.writeFile({ path: safe, data, directory: Directory.Cache });
  try {
    await Share.share({ title: safe, files: [uri] });
  } catch (e: any) {
    // Closing the share sheet isn't an error.
    if (!/cancel/i.test(String(e?.message || e))) throw e;
  }
  return true;
}

let started = false;
/** Wires up the native shell once at start-up. */
export async function startNative() {
  if (!isNativeApp || started) return;
  started = true;
  document.documentElement.classList.add("native-app", `native-${Capacitor.getPlatform()}`);
  const [{ App }, { Browser }, { SplashScreen }] = await Promise.all([
    import("@capacitor/app"), import("@capacitor/browser"), import("@capacitor/splash-screen"),
  ]);

  // Coming back from the system-browser sign-in: org.remyai.app://auth?code=…
  // Load the same query on the site, where finishSupabaseRedirect() completes it.
  App.addListener("appUrlOpen", ({ url }) => {
    if (!url.startsWith(NATIVE_AUTH_RETURN)) return;
    Browser.close().catch(() => {});
    const q = url.slice(NATIVE_AUTH_RETURN.length).replace(/^\/+/, "");
    location.href = `${location.origin}/${q.startsWith("?") || q.startsWith("#") ? q : ""}`;
  });

  // Android back button walks back through Remy's pages, then leaves the app.
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) history.back();
    else App.exitApp();
  });

  // Links to other sites (job postings, employer pages) open in the browser sheet
  // instead of replacing Remy inside the app.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.hasAttribute("download")) return;
    let u: URL;
    try { u = new URL(a.href, location.href); } catch { return; }
    if (!/^https?:$/.test(u.protocol) || u.origin === location.origin) return;
    e.preventDefault();
    openInBrowser(u.href).catch(() => { location.href = u.href; });
  }, true);

  SplashScreen.hide().catch(() => {});
}
