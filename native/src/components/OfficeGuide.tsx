import { router } from "expo-router";
import { HearIt } from "@/components/HearIt";
import { DidRows } from "@/components/DidRows";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Workspace } from "@shared/types";
import { dayKey } from "@shared/daily";
import { officeSteps, type OfficeSpot, type OfficeStep } from "@shared/officeSteps";
import { remyAsks, type Ask } from "@shared/remyAsks";
import { Button, success, tap } from "@/components/ui";
import type { OfficeMark } from "@/components/Office";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { go, openJobs, openResumeFix } from "@/lib/nav";
import { useAccess, useOwnerView, useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Remy guides you from his office (the website's PathBoard.tsx, #408; team meeting, Nov 24): above his room he says the
// next thing to do with a button that does it, "Later", and his list of up to three, numbered on the things in his room
// he means (computer = openings, resume frame, filing cabinet = his notes on you). His quick questions about your account
// (shared/remyAsks.ts, #370) are asked right there, and he does the fix himself with Undo (POST /api/remy/ask).

const SPOT_NAME: Record<OfficeSpot, string> = { computer: "My computer", frame: "Resume frame", notes: "My notes" };

/** The guide's state for My Path, or null while it's off (student view before the release, or the `guide` switch). */
export function useOfficeGuide() {
  const { ws, setWs } = useSession();
  const owner = useOwnerView();
  const access = useAccess();
  const on = owner && access("guide") === "open";
  const { jobs, fits } = useJobs();
  // Openings found in the last week that fit and aren't kept or hidden (the website's `fresh`).
  const fresh = useMemo(() => {
    if (!ws) return 0;
    const wk = new Date(Date.now() - 7 * 864e5).toISOString();
    return jobs.filter((j) => (j.foundAt || "") > wk && j.kind !== "event" && !ws.hiddenJobIds.includes(j.id) && !ws.savedJobIds.includes(j.id) && !fits[j.id]?.excluded && !fits[j.id]?.closed && fits[j.id]?.regionMatch !== false).length;
  }, [jobs, fits, ws]);
  // "Later" lasts for today on this phone (the website keeps it per day in the browser).
  const [later, setLater] = useState<{ day: string; ids: string[] }>({ day: dayKey(), ids: [] });
  const today = dayKey();
  const laterIds = later.day === today ? later.ids : [];
  const steps = useMemo(() => (on && ws ? officeSteps(ws, today, new Date().getHours(), fresh, laterIds) : []), [on, ws, today, fresh, laterIds]);
  const [cur, setCur] = useState(0);
  const step: OfficeStep | undefined = steps[Math.min(cur, steps.length - 1)];
  const [doing, setDoing] = useState(false);
  const [err, setErr] = useState("");
  if (!on || !ws) return null;

  const doStep = async (s: OfficeStep) => {
    setErr("");
    if (s.ask) return setCur(steps.indexOf(s));
    if (s.link?.startsWith("/resume")) return router.navigate("/resume" as any);
    if (s.link === "/opportunities") return openJobs("new");
    if (s.link) return go(s.link);
    if (!s.action) return;
    setDoing(true);
    try {
      const w = await api<Workspace>("POST", "/api/remy/act", { action: s.action, offerId: s.offerId });
      setWs(w); success();
      // "Let's fix them" starts the fixing on Resume (as Home's offer card does); anything else shows in his chat with Undo.
      const said = w.chat[w.chat.length - 1];
      if (said?.did?.some((d) => d.kind === "start" && d.ref === "resumeFix" && !d.undone)) return openResumeFix();
      router.push("/remy");
    } catch (e: any) { setErr(e.message); } finally { setDoing(false); }
  };
  const laterStep = (s: OfficeStep) => { tap(); setLater({ day: today, ids: [...laterIds, s.id] }); };
  // Tapping a thing in the room: its step comes up; tapping it again while it's up does it. The cabinet with no step
  // opens his notes (AI memory) on the website.
  const onSpot = (spot: OfficeSpot) => {
    const sp = steps.find((s) => s.spot === spot);
    if (sp) { if (sp === step) void doStep(sp); else setCur(steps.indexOf(sp)); return; }
    if (spot === "notes") go("/accounts?tab=memory", "My notes on you");
  };
  const marks: OfficeMark[] = steps.map((s, i) => ({ spot: s.spot, n: i + 1, on: s === step }));
  return { steps, step, setCur, doStep, laterStep, doing, err, marks, onSpot };
}

type Guide = NonNullable<ReturnType<typeof useOfficeGuide>>;

/** His speech banner above the room: one thing at a time, the button that does it, Later, and his numbered list. */
export function GuideBanner({ g, nextItem }: { g: Guide; nextItem?: [string, string, number] }) {
  const { c } = useTheme();
  const { step, steps } = g;
  return (
    <View testID="office-talk" accessibilityLiveRegion="polite" style={{ backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.fox, borderRadius: radius.card, padding: 14, marginTop: 10, gap: 10 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.8, textTransform: "uppercase", color: c.foxDeep }}>
        Remy{step ? ` · ${steps.length > 1 ? `${steps.indexOf(step) + 1} of ${steps.length}` : "one thing"}` : ""}
      </Text>
      {step?.ask ? <NextAsk />
        : <Text testID="office-step" style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 22, color: c.ink }}>
            {step ? step.say : nextItem ? `You're all set for now. Level ${nextItem[2]} adds a ${nextItem[1].toLowerCase()} to my office.` : "You're all set for now. Ask me anything, or tap something in my office."}
          </Text>}
      {!step?.ask && !!step?.say && <HearIt text={step.say} testID="button-office-hear-it" />}
      {!!g.err && <Text style={{ fontFamily: font.body, fontSize: 13, color: c.error }}>{g.err}</Text>}
      {step && !step.ask && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {!step.ask && <Button testID="button-office-step" label={step.cta} icon="arrow" onPress={() => g.doStep(step)} busy={g.doing} style={{ height: 42, paddingHorizontal: 16 }} />}
        <Button testID="button-office-later" kind="ghost" label="Later" onPress={() => g.laterStep(step)} style={{ height: 42, paddingHorizontal: 16 }} />
      </View>}
      {steps.length > 1 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {steps.map((s, i) => { const onIt = s === step; return (
          <Pressable key={s.id} testID={`button-office-step-${s.spot}`} accessibilityRole="button" accessibilityState={{ selected: onIt }} accessibilityLabel={`Step ${i + 1}: ${SPOT_NAME[s.spot]}`}
            onPress={() => { tap(); g.setCur(i); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: onIt ? c.fox : c.line, backgroundColor: onIt ? c.foxSoft : c.surface }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: onIt ? c.fox : c.surface2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: font.bold, fontSize: 11.5, color: onIt ? c.onFox : c.ink }}>{i + 1}</Text></View>
            <Text style={{ fontFamily: font.semi, fontSize: 13, color: c.ink }}>{SPOT_NAME[s.spot]}</Text>
          </Pressable>); })}
      </View>}
    </View>
  );
}

type Done = { text: string; copy?: string; messageId: string };

/** The next quick question. An answered one stays (what Remy did, Undo) until "Next question" (RemyAsk.tsx NextAsk). */
function NextAsk() {
  const { ws } = useSession();
  const asks = ws ? remyAsks(ws, dayKey()) : [];
  const [cur, setCur] = useState<Ask | null>(null);
  const ask = cur || asks[0];
  if (!ask) return null;
  return <AskCard key={ask.id} ask={ask} next={asks.filter((a) => a.id !== ask.id).length} onAnswered={() => setCur(ask)} onNext={() => setCur(null)} />;
}

/** One question with its answers; after a tap, what Remy did with Undo (the website's AskCard). */
export function AskCard({ ask, next, onAnswered, onNext }: { ask: Ask; next: number; onAnswered: () => void; onNext: () => void }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [no, setNo] = useState<string[]>([]); // facts the student said aren't true
  const [err, setErr] = useState("");
  const answer = async (key: string) => {
    setBusy(key); setErr("");
    try {
      const r = await api<{ ws: Workspace; text: string; copy?: string; messageId: string }>("POST", "/api/remy/ask", { id: ask.id, answer: key, keep: (ask.items || []).map((i) => i.id).filter((id) => !no.includes(id)) });
      if (key !== "later") { setDone({ text: r.text, copy: r.copy, messageId: r.messageId }); onAnswered(); success(); }
      setWs(r.ws);
    } catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  };
  const small = { height: 40, paddingHorizontal: 14 };
  if (done) {
    const m = ws?.chat.find((x) => x.id === done.messageId);
    const d = m?.did?.[0];
    const undo = async () => { if (!m || !d) return; try { setWs(await api<Workspace>("POST", `/api/chat/${m.id}/undo/${d.id}`)); success(); } catch (e: any) { setErr(e.message); } };
    return (
      <View testID="remy-ask-done" style={{ gap: 8 }}>
        <Text style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 22, color: c.ink }}>{done.text}{done.copy ? ` "${done.copy}"` : ""}</Text>
        {m && d && <DidRows did={[d]} onUndo={undo} undoTestID="button-ask-undo" />}
        {!!err && <Text style={{ fontFamily: font.body, fontSize: 13, color: c.error }}>{err}</Text>}
        {next > 0 && <Button testID="button-ask-next" kind="ghost" label={`Next question · ${next} more`} onPress={() => { setDone(null); onNext(); }} style={small} />}
      </View>
    );
  }
  return (
    <View testID="remy-ask" style={{ gap: 10 }}>
      <Text style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 22, color: c.ink }}>{ask.text}</Text>
      {ask.vs && <View style={{ gap: 6 }}>{ask.vs.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", gap: 10, padding: 10, borderRadius: 10, backgroundColor: c.surface2 }}>
          <Text style={{ width: 82, fontFamily: font.semi, fontSize: 13, color: c.mutedText }}>{k}</Text>
          <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, color: c.ink }}>{v}</Text>
        </View>))}</View>}
      {ask.items && <View style={{ gap: 6 }}>{ask.items.map((it) => { const isNo = no.includes(it.id); return (
        <View key={it.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ flex: 1, fontFamily: font.body, fontSize: 14, color: c.ink }}>{it.text}</Text>
          {[["Yes", !isNo, () => setNo(no.filter((x) => x !== it.id)), "button-ask-yes"], ["No", isNo, () => setNo([...no, it.id]), "button-ask-no"]].map(([label, onIt, press, id]) => (
            <Pressable key={label as string} testID={id as string} accessibilityRole="button" accessibilityState={{ selected: onIt as boolean }} accessibilityLabel={`${label}: ${it.text}`} onPress={() => { tap(); (press as () => void)(); }}
              style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", borderWidth: 1, borderColor: onIt ? c.ink : c.line, backgroundColor: onIt ? c.ink : c.surface }}>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: onIt ? c.onInk : c.ink }}>{label as string}</Text>
            </Pressable>))}
        </View>); })}</View>}
      {!!err && <Text style={{ fontFamily: font.body, fontSize: 13, color: c.error }}>{err}</Text>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ask.items ? <Button testID="button-ask-save" label="Save these" onPress={() => answer("facts")} busy={busy === "facts"} disabled={!!busy} style={small} />
          : ask.options.map((o) => <Button key={o.key} testID={`button-ask-${o.key}`} kind="ghost" label={o.label} onPress={() => answer(o.key)} busy={busy === o.key} disabled={!!busy} style={small} />)}
        <Button testID="button-ask-later" kind="ghost" label="Not now" onPress={() => answer("later")} disabled={!!busy} style={small} />
      </View>
    </View>
  );
}
