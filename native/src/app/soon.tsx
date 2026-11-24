import { router, Stack, useLocalSearchParams } from "expo-router";
import { FEATURES } from "@shared/features";
import { ComingSoon, Screen } from "@/components/ui";
import { openJobs } from "@/lib/nav";

/** A locked feature (Interview and Community for students): the website's "Coming in a future update" card. */
export default function Soon() {
  const { key = "" } = useLocalSearchParams<{ key?: string }>();
  const f = FEATURES.find((x) => x.key === key);
  return (
    <Screen style={{ flexGrow: 1, justifyContent: "center" }}>
      <Stack.Screen options={{ title: f?.label || "" }} />
      <ComingSoon featureKey={key} label={f?.label || "Coming soon"} teaser={f?.teaser || ""} onFind={() => { router.back(); openJobs("new"); }} />
    </Screen>
  );
}
