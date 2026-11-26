import { Pressable, Text, View } from "react-native";
import type { ChatDid } from "@shared/types";
import { Icon } from "@/components/ui";
import { go } from "@/lib/nav";
import { font, useTheme } from "@/lib/theme";

/** What Remy did from one reply: one card, a row per thing done (orange tick, what changed, a chevron when it opens the
 *  page, Undo). Same rows as the website's RemyDid (Dilan, Nov 26: the loose lines looked dodgy). Chat and office guide. */
export function DidRows({ did, onUndo, undoTestID = "button-undo" }: { did?: ChatDid[]; onUndo: (d: ChatDid) => void; undoTestID?: string }) {
  const { c } = useTheme();
  if (!did?.length) return null;
  return (
    <View testID="chat-did" style={{ alignSelf: "flex-start", width: "92%", marginTop: 8, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface, overflow: "hidden" }}>
      {did.map((d, i) => {
        const label = <Text numberOfLines={3} style={{ flexShrink: 1, fontFamily: d.undone ? font.body : font.bold, fontSize: 14, lineHeight: 19, color: d.undone ? c.mutedText : c.ink, textDecorationLine: d.undone ? "line-through" : "none" }}>{d.label}</Text>;
        return (
          <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingLeft: 12, paddingRight: 6, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: d.undone ? c.surface2 : c.fox }}>
              <Icon name={d.undone ? "undo" : "check"} size={13} strokeWidth={3} color={d.undone ? c.mutedText : c.onFox} />
            </View>
            {d.link && !d.undone
              ? <Pressable testID="button-chat-did-open" onPress={() => go(d.link!)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>{label}<Icon name="chev" size={15} color={c.mutedText} /></Pressable>
              : <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>{label}{d.undone && <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.mutedText }}>Undone</Text>}</View>}
            {!d.undone && !d.noUndo && <Pressable testID={undoTestID} hitSlop={6} onPress={() => onUndo(d)} style={({ pressed }) => ({ paddingHorizontal: 10, height: 36, justifyContent: "center", borderRadius: 10, backgroundColor: pressed ? c.surface2 : "transparent" })}><Text style={{ fontFamily: font.bold, fontSize: 13, color: c.mutedText }}>Undo</Text></Pressable>}
          </View>
        );
      })}
    </View>
  );
}
