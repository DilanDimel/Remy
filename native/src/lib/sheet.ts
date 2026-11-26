import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api } from "./api";
import { newVerifier } from "./auth";

const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** A random key for Expo Go's handoff ("" in the real app): Expo Go can't receive remy://, so Remy's return page leaves
 *  the result with our server under this key and the app collects it. */
export const handoffKey = () => (expoGo ? newVerifier().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "");

/** Opens a Google page in the system browser sheet (Google refuses sign-in inside an app's web view) and waits for
 *  Remy's return page to send it back on remy://auth. Returns that link, or "" when the person closed the sheet.
 *  Remy's server ends on a remyai.org page that opens remy://auth: Android's Chrome won't follow a redirect straight
 *  into the app at the end of a long sign-in (after a phone prompt), but it will from a tap there. */
export async function openReturnSheet(start: string, key: string): Promise<string> {
  const session = WebBrowser.openAuthSessionAsync(start, Linking.createURL("auth"));
  if (!key) { const r = await session; return r.type === "success" ? r.url : ""; }
  let backUrl = "";
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
  return backUrl;
}
