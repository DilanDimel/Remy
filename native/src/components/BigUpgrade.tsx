import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Button, Remy, T } from "@/components/ui";
import { useOwnersOnly, useOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

/** The update's name, as on the website (client/src/components/Beta2Welcome.tsx). */
export const UPDATE_NAME = "The Big Upgrade";

const NEW: [string, string][] = [
  ["A fresh look", "Every page is cleaner, and Remy has a new look to match."],
  ["Remy does it for you", "Ask him to save an opening, add a to-do or fix a resume line. You approve every change."],
  ["Rewards for every step", "My Path is now Remy's office, and the new Rewards page shows every pin, level and outfit you can earn."],
  ["Openings that fit", "Each opening is checked against your major, year and resume, with the reason why."],
];

/** The website's one-time welcome (Beta2Welcome), for the app: the first time a student opens Remy after owners release
 *  the redesign, Remy says what changed, once. It shares `settings.beta2Seen` with the website, so it shows once in all
 *  places. Owners never see it. The website's "Show me around" tour doesn't exist in the app, so there's one button. */
export function BigUpgrade() {
  const { ws, saveSettings } = useSession();
  const released = useOwnerView(), owner = useOwnersOnly();
  const { c } = useTheme();
  const [done, setDone] = useState(false);
  const want = released && !owner && !!ws?.onboarding.done && !ws.settings.beta2Seen && !done;
  // Wait a moment so it never lands on top of the screen that is still opening.
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!want) return; const t = setTimeout(() => setReady(true), 1200); return () => clearTimeout(t); }, [want]);
  if (!want || !ready) return null;
  const close = () => { setDone(true); saveSettings({ beta2Seen: true }).catch(() => {}); };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
        <Pressable onPress={() => {}} testID="beta2-welcome" accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: 24, padding: 22, gap: 12 }}>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Remy size={96} />
            <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: c.fox, letterSpacing: 0.4 }}>NEW UPDATE · {UPDATE_NAME.toUpperCase()}</Text>
            <T kind="title" style={{ textAlign: "center" }}>Remy just got his biggest update yet</T>
          </View>
          {NEW.map(([t, d]) => (
            <View key={t} style={{ gap: 2 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{t}</Text>
              <T kind="muted">{d}</T>
            </View>
          ))}
          <Button testID="button-beta2-close" kind="fox" label="Got it" onPress={close} flex />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
