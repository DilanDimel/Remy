import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { MemoryFact, Profile, Workspace } from "@shared/types";
import { alreadyIn, fitsField, inField, setupReply, tappedResumeClaim } from "@shared/setupReply";
import { Button, Pill, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { Input, Nav, Say, useSave } from "./common";

const UNSURE = "I'm not sure yet";

/** Three quick questions from Remy (`POST /api/ai/questions`), as a short chat. Each answer feeds the profile field
 *  its question names (when it's a short answer that names things) and Remy's memory, the same as the website. */
export function Questions({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, setWs } = useSession();
  const { config } = useConfig();
  const { c } = useTheme();
  const save = useSave();
  const w = ws!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  // The answer being saved shows right away, so Next feels instant.
  const [pending, setPending] = useState<{ q: string; a: string; toConfirm?: boolean; saved?: boolean } | null>(null);
  const qs = w.onboarding.questions;
  const targets = w.onboarding.targets || [];
  const answered = pending ? [...w.onboarding.answers, { q: pending.q, a: pending.a, toConfirm: pending.toConfirm }] : w.onboarding.answers;
  const idx = answered.length;
  useEffect(() => {
    if (qs.length || !config?.ai.available) return;
    setBusy(true);
    api<Workspace>("POST", "/api/ai/questions").then(setWs).catch((e) => setError(e.message)).finally(() => setBusy(false));
  }, []);
  const current = qs[idx];
  const entries = (w.resume?.doc.sections || []).flatMap((s) => s.entries);
  const resumeNames = { orgs: entries.map((e) => e.org).filter(Boolean), roles: entries.map((e) => e.role).filter(Boolean) };
  const submit = async (text: string) => {
    if (pending || !current) return;
    const a = text.trim();
    const i = idx;
    const target = targets[i] as keyof Profile | undefined;
    // Decided now and kept on the answer, so a later resume edit can't turn Remy's words into the student's.
    const toConfirm = tappedResumeClaim(current, a, w.onboarding.options?.[i] || [], target, resumeNames);
    setPending({ q: current, a, toConfirm });
    setAnswer(""); setError("");
    const answers = [...w.onboarding.answers, { q: current, a, ...(toConfirm ? { toConfirm } : {}) }];
    try {
      let now = w;
      if (a && !toConfirm && target && target in now.profile && fitsField(target, a)) {
        const before = String(now.profile[target] || "").trim();
        if (!alreadyIn(before, a)) now = await save("profile", { ...now.profile, [target]: before ? `${before}, ${a}` : a });
      }
      if (a) {
        const at = new Date().toISOString();
        const fact: MemoryFact = { id: "f" + Date.now(), text: `${current} — ${a}`, category: "goal", source: toConfirm ? "Tapped one of Remy's suggested answers in setup: keep it only if it's true" : "Onboarding answer", status: toConfirm ? "suggested" : "approved", createdAt: at, updatedAt: at };
        now = await save("memory", [...now.memory, fact]);
      }
      setPending({ q: current, a, saved: true });
      const last = answers.length >= qs.length;
      if (last) await new Promise((r) => setTimeout(r, 900)); // let Remy's last reply land before the next step
      // The answers and the move to the next step go in one save, so the last answer can't be overwritten.
      await save("onboarding", { ...now.onboarding, answers, ...(last ? { step: 5 } : {}) });
    } catch (e: any) { setError(e.message); }
    setPending(null);
  };
  const options = [...(w.onboarding.options?.[idx] || []), UNSURE];
  const bubble = (text: string, me = false, key?: string) => (
    <View key={key} style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: "88%", backgroundColor: me ? c.ink : c.surface, borderWidth: me ? 0 : 1, borderColor: c.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 21, color: me ? c.onInk : c.ink }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ flexGrow: 1, gap: 18 }}>
      <Say size={56}>
        <T kind="label">{qs.length ? `Question ${Math.min(idx + 1, qs.length)} of ${qs.length}` : "A few questions"}</T>
        <T kind="muted">Three quick questions so I can pick better openings for you.</T>
      </Say>
      <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
        {answered.map((x, i) => (
          <View key={i} style={{ gap: 8 }}>
            {bubble(x.q)}
            {bubble(x.a || "Skipped", true)}
            {bubble(pending && !pending.saved && i === answered.length - 1 ? "Saving…" : setupReply(x.a, targets[i], inField(w.profile, targets[i], x.a), !!x.toConfirm))}
          </View>
        ))}
        {busy && <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ActivityIndicator color={c.fox} /><T kind="small">Thinking of a few useful questions…</T></View>}
        {current && !busy && <View testID="text-question">{bubble(current)}</View>}
        {!current && !busy && !qs.length && bubble("Questions need AI, which isn't available right now. You can continue without them.")}
      </View>
      {current && !busy ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {options.map((o) => <Pill key={o} testID="button-answer-option" label={o} onPress={pending ? undefined : () => submit(o)} />)}
          </View>
          <Input testID="input-answer" value={answer} onChangeText={setAnswer} multiline placeholder="Or type your own answer" style={{ minHeight: 70 }} />
          {!!error && <T kind="small" style={{ color: c.error }}>{error}</T>}
          <Button testID="button-answer" label="Next" icon="arrow" onPress={() => submit(answer)} disabled={!answer.trim() || !!pending} flex />
          <Button testID="button-skip-question" kind="ghost" label="Skip" onPress={() => submit("")} disabled={!!pending} flex />
        </View>
      ) : !busy && (
        // Waits for the last answer's save (it always ends), so a fast Continue can't skip it (website does the same).
        <Nav note={error || undefined} onBack={onBack} next={<Button testID="button-ob-next-questions" label={pending ? "Saving your answer…" : "Continue"} icon="arrow" onPress={onNext} disabled={!!pending} flex />} />
      )}
    </View>
  );
}
