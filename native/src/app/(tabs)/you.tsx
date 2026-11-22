import Constants from "expo-constants";
import { Pressable, Text, View } from "react-native";
import { Group, Icon, Row, Screen, Sect, T, tap, type IconName } from "@/components/ui";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { font, useTheme, type Look } from "@/lib/theme";

const LINKS: { title: string; sub: string; path: string; icon: IconName }[] = [
  { title: "Resume", sub: "Your base resume and tailored versions", path: "/resume", icon: "doc" },
  { title: "Interview practice", sub: "Stories and practice questions", path: "/interview", icon: "chat" },
  { title: "Progress", sub: "To-dos, applications and hours", path: "/progress", icon: "trend" },
  { title: "People", sub: "Contacts and alumni", path: "/community", icon: "you" },
  { title: "Settings", sub: "Emails, texts and your account", path: "/settings", icon: "flag" },
];

export default function You() {
  const { me, ws, signOut } = useSession();
  const { c, look, setLook } = useTheme();
  const choice = (l: Look, title: string, sub: string) => (
    <Pressable testID={`button-look-${l}`} accessibilityRole="radio" accessibilityState={{ selected: look === l }} onPress={() => { tap(); setLook(l); }}
      style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: look === l ? c.foxSoft : c.surface, borderWidth: 2, borderColor: look === l ? c.fox : c.line }}>
      <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.ink }}>{title}</Text>
      <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted, marginTop: 2 }}>{sub}</Text>
    </Pressable>
  );
  return (
    <Screen>
      <T kind="display" style={{ fontSize: 34, marginTop: 28 }}>{ws?.profile.name || "You"}</T>
      <T kind="muted">{[ws?.profile.major, ws?.profile.school].filter(Boolean).join(" · ") || me?.email}</T>
      {/* Owners are trying both looks on their phones (Nov 22); this switch goes once the team picks one. */}
      <Sect title="Look (owners test)" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        {choice("calm", "A · Calm", "Apple-style lists")}
        {choice("soul", "B · Soul", "Remy's personality")}
      </View>
      <Sect title="More" />
      <Group>{LINKS.map((l, i) => <Row key={l.path} first={i === 0} title={l.title} sub={l.sub} left={<Icon name={l.icon} color={c.muted} />} onPress={() => go(l.path, l.title)} testID={`row-${l.title.toLowerCase().split(" ")[0]}`} />)}</Group>
      <Group style={{ marginTop: 24 }}><Row first title="Sign out" onPress={signOut} right={<View />} testID="button-sign-out" /></Group>
      <T kind="small" style={{ textAlign: "center", marginTop: 18 }}>Remy app {Constants.expoConfig?.version} · owners preview</T>
    </Screen>
  );
}
