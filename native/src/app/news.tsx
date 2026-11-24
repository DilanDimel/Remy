import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { newsLink, showsNews } from "@shared/news";
import { Card, Chip, Icon, T } from "@/components/ui";
import { NEWS, latestNewsId } from "@/lib/news";
import { go } from "@/lib/nav";
import { useOwnerView, useOwnersOnly, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

const TONE = { New: "live", Improved: "soon", Fixed: "plain", Changed: "plain" } as const;
const dayName = (d: string) => {
  const diff = Math.round((new Date().setHours(12, 0, 0, 0) - new Date(d + "T12:00").getTime()) / 864e5);
  const date = new Date(d + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return diff === 0 ? `Today · ${date}` : diff === 1 ? `Yesterday · ${date}` : date;
};

/** More → What's new: the same notes as the website's (shared/news/), newest first, a day at a time. Opening it marks
 *  them seen on the account (`settings.newsSeen`), so the website's count clears too. A note that names a page opens it. */
export default function News() {
  const { ws, saveSettings } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const redesign = useOwnerView();
  const owner = useOwnersOnly();
  // What was seen before this visit, so the notes new since then keep a dot while the list is open.
  const seenAtOpen = useRef<string | undefined>(undefined);
  if (seenAtOpen.current === undefined && ws) seenAtOpen.current = ws.settings.newsSeen ?? "";
  const items = NEWS.filter((n) => showsNews(n, owner, redesign));
  const days = [...new Set(items.map((n) => n.date))];
  useEffect(() => {
    const latest = latestNewsId();
    if (ws && latest && (!ws.settings.newsSeen || ws.settings.newsSeen < latest)) saveSettings({ newsSeen: latest }).catch(() => {});
  }, [!!ws]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (to: string) => { router.back(); setTimeout(() => go(to), 250); };
  return (
    <ScrollView testID="whats-new-list" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}>
      {!items.length && <T kind="muted">Nothing new yet.</T>}
      {days.map((d) => (
        <View key={d} style={{ gap: 8 }}>
          <T kind="label" style={{ color: c.mutedText, marginTop: 10, marginHorizontal: 4 }}>{dayName(d)}</T>
          {items.filter((n) => n.date === d).map((n) => {
            const to = newsLink(n);
            const fresh = !!seenAtOpen.current && n.id > seenAtOpen.current;
            return (
              <Card key={n.id} testID="news-item" onPress={to ? () => open(to) : undefined} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Chip text={n.kind} tone={TONE[n.kind]} />
                  {fresh && <View accessibilityLabel="New" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.fox }} />}
                  <View style={{ flex: 1 }} />
                  {!!to && <Icon name="chev" size={18} color={c.faint} />}
                </View>
                <T style={{ fontFamily: font.bold }}>{n.title}</T>
                <T kind="small" style={{ color: c.ink, lineHeight: 20 }}>{n.body}</T>
              </Card>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
