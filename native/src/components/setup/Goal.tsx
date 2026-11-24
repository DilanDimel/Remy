import { useState } from "react";
import { View } from "react-native";
import { PATHS, type SetupFocus } from "@shared/types";
import { firstName } from "@shared/names";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/session";
import { Chips, Input, Nav, Q, Say, useSave } from "./common";

// The website's first setup screen (client/src/pages/Onboarding.tsx FocusPick): tap one or write your own.
// "Not sure yet" is a real answer: Remy starts from exploring.
const GOALS: [string, SetupFocus][] = [["Land an internship", "openings"], ["Find a full-time job", "openings"], ["Make my resume stronger", "resume"], ["Get ready for an interview", "interview"], ["Switch to a new field", "direction"], ["Not sure yet", "direction"]];

/** Where the student is and what they're working toward, so everything Remy suggests starts from their goal. */
export function Goal() {
  const { ws } = useSession();
  const w = ws!;
  const save = useSave();
  const first = firstName(w);
  const [path, setPath] = useState(w.profile.path || "");
  const [goal, setGoal] = useState(w.profile.goal || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chip = GOALS.find(([g]) => g === goal);
  const ready = !!path && goal.trim().length > 1;
  const next = async () => {
    setBusy(true); setError("");
    try {
      const after = await save("profile", { ...w.profile, path, goal: goal.trim().slice(0, 300) });
      // One save for focus and "still exploring", so neither overwrites the other.
      await save("onboarding", { ...after.onboarding, focus: chip ? chip[1] : "openings", ...(goal === "Not sure yet" ? { exploring: true } : {}) });
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  return (
    <View style={{ gap: 22 }} testID="focus-pick">
      <Say title={`Hi${first ? ` ${first}` : ""}! What are you working toward?`}>Everything Remy suggests starts from this, so be as specific as you like. "Not sure yet" is a fine answer.</Say>
      <Q title="Where are you right now?">
        <Chips options={PATHS.map(([, l]) => l)} value={PATHS.filter(([k]) => k === path).map(([, l]) => l)} multi={false} testID="path"
          onChange={([l]) => setPath(PATHS.find(([, x]) => x === l)?.[0] || "")} />
      </Q>
      <Q title="What are you working toward?">
        <Chips options={GOALS.map(([g]) => g)} value={chip ? [goal] : []} multi={false} testID="goal" onChange={([g]) => setGoal(g || "")} />
        <Input testID="input-goal" value={chip ? "" : goal} onChangeText={setGoal} maxLength={300} placeholder="Or in your own words" />
      </Q>
      <Nav note={error || (!path ? "Pick where you are right now." : !goal.trim() ? "Tap a goal or write your own." : "Next: your resume.")}
        next={<Button testID="button-goal-next" label="Continue" icon="arrow" onPress={next} busy={busy} disabled={!ready} flex />} />
    </View>
  );
}
