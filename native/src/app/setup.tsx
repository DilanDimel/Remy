import { View } from "react-native";
import { Button, Remy, Screen, T } from "@/components/ui";
import { useGateRedirect } from "@/lib/gate";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";

/** Not set up yet (`onboarding.done` is false): the website's setup runs in the signed-in sheet for now, and the app
 *  opens once it's done (the sheet refreshes the account when it closes). Native setup screens are handoff P1.7. */
export default function Setup() {
  const { ws, signOut } = useSession();
  const away = useGateRedirect("setup");
  if (away) return away;
  return (
    <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 14 }}>
      <View style={{ alignSelf: "flex-start" }}><Remy size={92} /></View>
      <T kind="display">Let's set up your Remy</T>
      <T kind="muted">Add your resume, check what Remy read from it, and he builds your first plan. It takes about five minutes.</T>
      <Button testID="button-start-setup" label={ws?.onboarding.step ? "Finish setting up" : "Start"} icon="arrow" onPress={() => go("/", "Set up Remy", { page: true })} flex />
      <Button testID="button-sign-out" kind="ghost" label="Sign out" onPress={signOut} flex />
    </Screen>
  );
}
