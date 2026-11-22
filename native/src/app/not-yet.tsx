import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { Button, Fox, Screen, T } from "@/components/ui";
import { isOwnerView, useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** The new app is owners-only while the team tests it; students keep using the website. */
export default function NotYet() {
  const { me, ws, status, signOut } = useSession();
  const { c } = useTheme();
  if (status !== "ready") return <Redirect href="/sign-in" />;
  if (isOwnerView(me, ws)) return <Redirect href="/" />;
  return (
    <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 14 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Fox size={46} /></View>
      <T kind="display">The new app is almost here</T>
      <T kind="muted">{me?.owner ? "You're in student view. Switch back to owner view on remyai.org to test the new app." : "We're still testing it. Everything you need is on remyai.org for now, and your work is waiting there."}</T>
      <Button testID="button-open-site" label="Open remyai.org" icon="arrow" onPress={() => WebBrowser.openBrowserAsync("https://remyai.org")} flex />
      <Button testID="button-sign-out" kind="ghost" label="Sign out" onPress={signOut} flex />
    </Screen>
  );
}
