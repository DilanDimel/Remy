import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { Button, Remy, Screen, T } from "@/components/ui";
import { useGateRedirect } from "@/lib/gate";
import { useSession } from "@/lib/session";

/** Until Dilan releases the `app` switch (Admin → Beta → Feature releases), students see this (src/lib/rules.ts appOpenFor) and keep using the website. */
export default function NotYet() {
  const { signOut } = useSession();
  const away = useGateRedirect("not-yet");
  if (away) return away;
  return (
    <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 14 }}>
      <View style={{ alignSelf: "flex-start" }}><Remy size={92} /></View>
      <T kind="display">The new app is almost here</T>
      <T kind="muted">We're still testing it. Everything you need is on remyai.org for now, and your work is waiting there.</T>
      <Button testID="button-open-site" label="Open remyai.org" icon="arrow" onPress={() => WebBrowser.openBrowserAsync("https://remyai.org")} flex />
      <Button testID="button-sign-out" kind="ghost" label="Sign out" onPress={signOut} flex />
    </Screen>
  );
}
