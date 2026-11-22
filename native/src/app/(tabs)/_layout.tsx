import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Loading } from "@/components/ui";
import { isOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

export default function Tabs() {
  const { status, me, ws } = useSession();
  const { c } = useTheme();
  if (status === "loading") return <Loading />;
  if (status === "signed-out" || status === "error") return <Redirect href="/sign-in" />;
  // Owners-only until the team releases the new app.
  if (!isOwnerView(me, ws)) return <Redirect href="/not-yet" />;
  return (
    <NativeTabs tintColor={c.fox} minimizeBehavior="onScrollDown" labelStyle={{ fontFamily: font.semi }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="path">
        <NativeTabs.Trigger.Icon sf={{ default: "safari", selected: "safari.fill" }} md="explore" />
        <NativeTabs.Trigger.Label>Path</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="remy">
        <NativeTabs.Trigger.Icon sf={{ default: "bubble.left", selected: "bubble.left.fill" }} md="chat" />
        <NativeTabs.Trigger.Label>Remy</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="jobs">
        <NativeTabs.Trigger.Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} md="work" />
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
