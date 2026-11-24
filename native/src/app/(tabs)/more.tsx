import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Group, Icon, Row, Screen, Sect, Segmented, T, success, type IconName } from "@/components/ui";
import { go } from "@/lib/nav";
import { useAccess, useOwnersOnly, useRefreshAll, useSession } from "@/lib/session";
import { useTheme, type ThemeChoice } from "@/lib/theme";

// The website's More sheet (client/src/App.tsx), in its order. A row with a feature key follows Admin → Beta → Feature
// releases: open, locked (a lock, and the coming-soon card) or hidden.
const LINKS: { title: string; path: string; icon: IconName; feature?: string; testID: string }[] = [
  { title: "Rewards", path: "/rewards", icon: "flag", feature: "rewards", testID: "row-rewards" },
  { title: "Progress", path: "/progress", icon: "trend", testID: "row-progress" },
  { title: "Calendar", path: "/calendar", icon: "book", testID: "row-calendar" },
  { title: "Interview", path: "/interview", icon: "chat", feature: "interview", testID: "row-interview" },
  { title: "Community", path: "/community", icon: "you", feature: "community", testID: "row-people" },
  { title: "Account", path: "/accounts", icon: "you", testID: "row-account" },
  { title: "About Remy", path: "/about", icon: "compass", testID: "row-about" },
  { title: "Privacy & terms", path: "/policies", icon: "doc", testID: "row-policies" },
];

export default function More() {
  const { me, ws, signOut, saveSettings } = useSession();
  const owners = useOwnersOnly();
  const access = useAccess();
  const refresh = useRefreshAll();
  const { c } = useTheme();
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 3500); return () => clearTimeout(t); }, [note]);
  const save = async (patch: Parameters<typeof saveSettings>[0], said?: string) => {
    setErr("");
    try { await saveSettings(patch); success(); if (said) setNote(said); } catch (e: any) { setErr(e.message); }
  };
  const theme = (ws?.settings.themeChosen || (ws?.settings.theme && ws.settings.theme !== "system") ? ws?.settings.theme : "system") as ThemeChoice;
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ marginTop: 28 }}>{ws?.profile.name || "More"}</T>
      <T kind="muted">{[ws?.profile.major, ws?.profile.school].filter(Boolean).join(" · ") || me?.email}</T>

      {/* Owners only, in both views, so they can always switch back (the website's OwnerTools). Saved on the account,
          so switching here switches the website too, and the other way round. */}
      {me?.owner && <>
        <Sect title="Owner tools" />
        <Segmented testID="button-view" value={owners ? "owner" : "student"} options={[{ key: "owner", label: "Owner" }, { key: "student", label: "Student" }]}
          onChange={(v) => save({ ownerView: v === "owner" }, v === "owner" ? "Owner view is on" : "Student view: you see Remy like a student")} />
        {/* The line keeps its height when it clears, so the rows below don't jump under a finger. */}
        <T kind="small" style={{ marginTop: 8, marginHorizontal: 4, minHeight: 18 }}>{note}</T>
        <Group style={{ marginTop: 12 }}>
          <Row first title="Owners' dashboard" sub="Feature releases, beta and signals" left={<Icon name="list" color={c.mutedText} />} onPress={() => go("/admin", "Owners")} testID="row-admin" />
        </Group>
      </>}

      <Sect title="Theme" />
      <Segmented testID="button-theme" value={theme} options={[{ key: "system", label: "System" }, { key: "light", label: "Light" }, { key: "dark", label: "Dark" }]}
        onChange={(t) => save({ theme: t, themeChosen: true })} />
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}

      <Sect title="More" />
      <Group>
        {LINKS.filter((l) => !l.feature || access(l.feature) !== "hidden").map((l, i) => {
          const locked = !!l.feature && access(l.feature) === "locked";
          return <Row key={l.path} first={i === 0} title={l.title} left={<Icon name={l.icon} color={c.mutedText} />} testID={l.testID}
            right={locked ? <Icon name="lock" size={18} color={c.faint} /> : undefined}
            onPress={() => (locked ? router.push({ pathname: "/soon", params: { key: l.feature! } }) : go(l.path, l.title))} />;
        })}
      </Group>
      <Group style={{ marginTop: 24 }}>
        <Row first title="Sign out" onPress={signOut} right={<View />} testID="button-sign-out" />
        {/* The stores require deleting the account from inside the app: this opens the website's Account & data, where "Delete everything" is. */}
        <Row title="Delete account" sub="Download your data or delete everything" onPress={() => go("/accounts?tab=data", "Account")} testID="row-delete-account" />
      </Group>
      <T kind="small" style={{ textAlign: "center", marginTop: 18 }}>Remy app {Constants.expoConfig?.version} · owners preview{me?.owner && !owners ? " · student view" : ""}</T>
    </Screen>
  );
}
