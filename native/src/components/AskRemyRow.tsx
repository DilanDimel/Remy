import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Remy, T, tap } from "@/components/ui";
import { askRemy } from "@/lib/nav";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

/** Remy built into a screen (Interview, Dilan Nov 27; the website's RemyAskInline): one tap asks him, and his chat
 *  opens with the answer coming in. */
export function AskRemyRow({ asks }: { asks: string[] }) {
  const { c } = useTheme();
  return (
    <View testID="remy-ask-inline" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14 }}>
      <Remy size={36} icon />
      <View style={{ flex: 1, gap: 8 }}>
        <T kind="small" style={{ color: c.ink, fontFamily: font.semi }}>Ask me anything about it</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {asks.map((q, i) => (
            <Pressable key={q} testID="button-ask-inline-chip" accessibilityRole="button" onPress={() => { tap(); askRemy(q, { send: true }); }}
              style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, justifyContent: "center", borderWidth: 1, borderColor: i ? c.line : c.fox, backgroundColor: i ? (pressed ? c.surface2 : c.surface) : c.fox, opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: i ? c.ink : c.onFox }}>{q}</Text>
            </Pressable>
          ))}
          <Pressable testID="button-ask-inline-more" accessibilityRole="button" onPress={() => { tap(); router.push("/remy"); }} style={{ minHeight: 36, paddingHorizontal: 6, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: c.mutedText, textDecorationLine: "underline" }}>Something else</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
