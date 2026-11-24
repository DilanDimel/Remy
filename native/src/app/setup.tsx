import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { firstName } from "@shared/names";
import { Button, Card, Chip, T } from "@/components/ui";
import { Dots, Page, Say, useSave } from "@/components/setup/common";
import { Goal } from "@/components/setup/Goal";
import { PlanStep } from "@/components/setup/PlanStep";
import { Preferences } from "@/components/setup/Preferences";
import { Questions } from "@/components/setup/Questions";
import { ResumeStep } from "@/components/setup/ResumeStep";
import { Review } from "@/components/setup/Review";
import { useGateRedirect } from "@/lib/gate";
import { useSession } from "@/lib/session";

/** Setup for someone who hasn't finished it (`onboarding.done` is false), native, with the website's steps and the same
 *  saves (client/src/pages/Onboarding.tsx): goal, resume, review, preferences, three questions, first plan. The step
 *  number lives in the workspace, so setup started on the website carries on here and the other way round. Once it's
 *  done the gate sends the student to Home. */
export default function Setup() {
  const { ws, signOut } = useSession();
  const away = useGateRedirect("setup");
  const save = useSave();
  const scroll = useRef<any>(null);
  const step = ws?.onboarding.step ?? 0;
  const focus = ws?.onboarding.focus;
  // Saved step 0-1 is the goal question (no focus yet) or the resume; 2-5 follow.
  const shown = step <= 1 ? (focus ? 1 : 0) : Math.min(step, 5);
  // Coming back partway through: say so and let the student choose, instead of dropping them mid-step (FAR_ENOUGH_STEP is 3).
  const [welcomeBack, setWelcomeBack] = useState(step >= 3);
  const top = () => scroll.current?.scrollTo({ y: 0, animated: false });
  useEffect(top, [shown, welcomeBack]);
  if (away) return away;
  const w = ws!;
  const setStep = (s: number) => save("onboarding", { ...w.onboarding, step: s });
  const finish = async () => { await save("onboarding", { ...w.onboarding, done: true }); };
  return (
    <Page testID="setup" scrollRef={scroll}>
      <Dots shown={shown} />
      {welcomeBack ? <WelcomeBack onContinue={() => setWelcomeBack(false)} onRestart={async () => { await save("onboarding", { ...w.onboarding, step: 1, answers: [], questions: [], targets: [] }); setWelcomeBack(false); }} />
        : shown === 0 ? <Goal />
        : shown === 1 ? <ResumeStep onBack={() => save("onboarding", { ...w.onboarding, focus: undefined })} onNext={() => setStep(2)} />
        : shown === 2 ? <Review onBack={() => setStep(1)} onNext={() => setStep(3)} />
        : shown === 3 ? <Preferences onBack={() => setStep(2)} scrollTop={top} />
        : shown === 4 ? <Questions onBack={() => setStep(3)} onNext={() => setStep(5)} />
        : <PlanStep onBack={() => setStep(4)} onFinish={finish} />}
      {shown === 0 && !welcomeBack && <Button testID="button-sign-out" kind="ghost" label="Sign out" onPress={signOut} flex />}
    </Page>
  );
}

function WelcomeBack({ onContinue, onRestart }: { onContinue: () => void; onRestart: () => Promise<void> }) {
  const { ws } = useSession();
  const w = ws!;
  const step = w.onboarding.step;
  const first = firstName(w);
  const [busy, setBusy] = useState(false);
  const done: [string, boolean, string][] = [
    ["Your resume", !!w.resume, w.resume ? w.resume.fileName : "Not added yet"],
    ["Profile reviewed", step > 2, step > 2 ? "School, major and graduation confirmed" : "Next up"],
    ["Your preferences", step > 3, step > 3 ? [w.profile.opportunityTypes, w.profile.regions].filter(Boolean).join(" · ") : "Still to do"],
    ["A few questions", step > 4, `${w.onboarding.answers.length} of ${w.onboarding.questions.length || 3} answered`],
  ];
  return (
    <View style={{ gap: 18 }} testID="welcome-back">
      <Say title={`Welcome back${first ? `, ${first}` : ""}!`}>You're partway through setting up Remy. Here's what you've done so far.</Say>
      <View style={{ gap: 8 }}>
        {done.map(([label, ok, detail]) => (
          <Card key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
            <View style={{ flex: 1 }}><T>{label}</T>{!!detail && <T kind="small" numberOfLines={2}>{detail}</T>}</View>
            <Chip text={ok ? "Done" : "To do"} tone={ok ? "live" : "plain"} />
          </Card>
        ))}
      </View>
      <Button testID="button-continue-setup" label="Continue where I left off" icon="arrow" onPress={onContinue} flex />
      <Button testID="button-start-over" kind="ghost" label="Start over" busy={busy} onPress={async () => { setBusy(true); try { await onRestart(); } finally { setBusy(false); } }} flex />
      <T kind="small">Start over keeps your resume and profile; it takes you back to the first step to check everything again.</T>
    </View>
  );
}
