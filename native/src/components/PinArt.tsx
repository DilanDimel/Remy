import { View } from "react-native";
import type { PinState } from "@shared/pins";
import { Icon, type IconName } from "@/components/ui";
import { brand } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";

// Career pins as enamel pins (Rewards, and the moment one is earned).
const ICON: Record<string, IconName> = { resume: "doc", pitch: "chat", linkedin: "you", applied: "jobs", interview: "you", offer: "award",
  tailor: "doc", story: "book", practice: "chat", network: "you", numbers: "list", explorer: "compass", steady: "flame", hours: "heart",
  thickskin: "check", bounce: "undo", comeback: "up", nightowl: "moon", earlybird: "sun", allround: "award", insider: "eye" };
// Each pin's own enamel colour; the rim shows the tier (bronze, silver, gold).
export type Gem = "gemRuby" | "gemGold" | "gemGreen" | "gemTeal" | "gemSky" | "gemBlue" | "gemViolet" | "gemPink";
const HUE: Record<string, Gem> = { resume: "gemSky", pitch: "gemViolet", linkedin: "gemBlue", applied: "gemTeal", interview: "gemPink", offer: "gemGold",
  tailor: "gemRuby", story: "gemViolet", practice: "gemSky", network: "gemBlue", numbers: "gemGreen", explorer: "gemTeal", steady: "gemRuby", hours: "gemPink",
  thickskin: "gemTeal", bounce: "gemGreen", comeback: "gemViolet", nightowl: "gemBlue", earlybird: "gemGold", insider: "gemViolet", allround: "gemPink" };
export const hiddenPin = (p: PinState) => p.kind === "secret" && !p.earned;

/** One enamel pin: the rim shows the tier reached; a pin not earned yet is a dashed outline. */
export function PinArt({ p, size = 44 }: { p: PinState; size?: number }) {
  const { c } = useTheme();
  const rim = p.tiers.length === 1 ? (p.earned ? c.foxDeep : "") : ["", c.metalBronze, c.metalSilver, c.metalGold][p.tier];
  const fill = c[HUE[p.id] || "gemSky"] || c.fox;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: rim ? fill : c.surface, borderWidth: rim ? 4 : 2, borderStyle: rim ? "solid" : "dashed", borderColor: rim || c.line }}>
      <Icon name={hiddenPin(p) ? "lock" : ICON[p.id] || "award"} size={Math.round(size * 0.45)} color={rim ? brand.white : c.faint} strokeWidth={2.2} />
    </View>
  );
}

