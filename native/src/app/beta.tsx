import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { Button, Remy, Screen, T } from "@/components/ui";
import { useConfig } from "@/lib/config";
import { useGateRedirect } from "@/lib/gate";
import { useRefreshAll, useSession } from "@/lib/session";

/** Signed in, but not on the beta tester list yet (the server answers 403 "beta"): the website's words and form link. */
export default function Beta() {
  const { error, signOut } = useSession();
  const { config } = useConfig();
  const refresh = useRefreshAll();
  const away = useGateRedirect("beta");
  if (away) return away;
  return (
    <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 14 }}>
      <View style={{ alignSelf: "flex-start" }}><Remy size={92} /></View>
      <T kind="display">You're not on the list yet</T>
      <T kind="muted">{error || "Remy is invite-only during the beta. Apply to be a beta tester, then sign in with the email you applied with."}</T>
      {!!config?.beta?.formUrl && <Button testID="button-beta-apply" label="Apply to be a beta tester" icon="arrow" onPress={() => WebBrowser.openBrowserAsync(config.beta!.formUrl)} flex />}
      <Button testID="button-beta-retry" kind="ghost" label="I've been accepted, check again" onPress={refresh} flex />
      <Button testID="button-sign-out" kind="ghost" label="Sign out" onPress={signOut} flex />
    </Screen>
  );
}
