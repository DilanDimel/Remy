import type { CapacitorConfig } from "@capacitor/cli";

// Remy's iPhone and Android apps. The app is a native shell around the live site,
// so every deploy of `main` reaches the apps at once with no app-store update.
// Sign-in cookies stay first-party because the pages come from remyai.org itself.
// The native-only behaviour (sign-in hand-off, downloads, outside links) is in
// client/src/lib/native.ts. See docs/mobile-app.md.
const config: CapacitorConfig = {
  appId: "org.remyai.app",
  appName: "Remy",
  // Shown only when the site can't be reached (no connection).
  webDir: "mobile/www",
  server: {
    url: process.env.REMY_APP_URL || "https://remyai.org",
    errorPath: "offline.html",
    cleartext: false,
  },
  appendUserAgent: "RemyApp",
  backgroundColor: "#fff4ec",
  ios: {
    // Keeps pages clear of the notch and home indicator.
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Hides on its own: the live site may not have the native code yet, and a page
    // that fails to load must never leave the app stuck on the launch screen.
    SplashScreen: { launchAutoHide: true, launchShowDuration: 800, launchFadeOutDuration: 200, backgroundColor: "#fff4ec", showSpinner: false },
    SystemBars: { insetsHandling: "native", style: "LIGHT" },
  },
};

export default config;
