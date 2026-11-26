import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Workspace } from "@shared/types";
import { Button, Card, Icon, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { useJobs } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { Nav, Preview, Say, beforePrefs } from "./common";
import { CareerTime } from "@/components/CareerTime";

const shortDate = (d: string) => { const t = new Date(d.length === 10 ? d + "T12:00:00" : d); return isNaN(+t) ? d : t.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

/** The last step: Remy writes the first plan (`POST /api/ai/plan`) and shows the openings that fit so far. */
export function PlanStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => Promise<void> }) {
  const { ws, setWs } = useSession();
  const { config } = useConfig();
  const { c } = useTheme();
  const { jobs, fits, loading } = useJobs();
  const w = ws!;
  const matches = jobs.filter((j) => !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false && beforePrefs(w, j));
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const make = async () => {
    setBusy(true); setError("");
    try { setWs(await api<Workspace>("POST", "/api/ai/plan")); } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  useEffect(() => { if (!w.plan && config?.ai.available) make(); }, []);
  const finish = async () => { setFinishing(true); try { await onFinish(); } catch (e: any) { setError(e.message); setFinishing(false); } };
  return (
    <View style={{ flexGrow: 1, gap: 18 }}>
      <Say title={busy ? "Putting your plan together…" : w.plan ? "Here's where I'd start" : "Your workspace is ready"}>Suggestions, not requirements. You can change anything.</Say>
      {busy && (
        <Card style={{ gap: 10 }}>
          {["Reading your resume and answers", "Choosing where to start", "Writing your first to-dos"].map((s) => (
            <View key={s} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ActivityIndicator color={c.fox} size="small" /><T kind="small" style={{ color: c.ink }}>{s}</T></View>
          ))}
        </Card>
      )}
      <Card testID="plan-matches" style={{ gap: 6 }}>
        {loading ? <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ActivityIndicator color={c.fox} /><T kind="small" style={{ flex: 1 }}>Remy is checking employers' career sites for openings that fit you…</T></View>
          : matches.length ? <>
            <T style={{ fontFamily: font.bold }}>{`Remy found ${matches.length} opening${matches.length === 1 ? "" : "s"} that fit you`}</T>
            {matches.slice(0, 3).map((j) => <Preview key={j.id} j={j} />)}
            <T kind="small">They're waiting on the Jobs tab.</T>
          </> : w.lastSearch && w.lastSearch.reached < w.lastSearch.scanned / 2 ? <>
            <T style={{ fontFamily: font.bold }}>Most employer career sites didn't answer just now</T>
            <T kind="small">{`Remy reached ${w.lastSearch.reached} of ${w.lastSearch.scanned} (they may be down for maintenance). It will try again in about 30 minutes, and your openings will be waiting on the Jobs tab.`}</T>
          </> : <>
            <T style={{ fontFamily: font.bold }}>No openings fit all your choices right now</T>
            <T kind="small">Remy checks again about once a day. Adding more places or fields shows more.</T>
          </>}
      </Card>
      {w.plan && !busy && (
        <View style={{ gap: 10 }}>
          <Card style={{ flexDirection: "row", gap: 12, backgroundColor: c.foxSoft, borderColor: c.foxSoft }}>
            <Icon name="flag" color={c.foxDeep} />
            <View style={{ flex: 1, gap: 2 }}><T style={{ fontFamily: font.bold }}>{w.plan.nextAction.title}</T><T kind="small" style={{ color: c.ink }}>{w.plan.nextAction.why}</T></View>
          </Card>
          {w.tasks.filter((t) => !t.done).slice(0, 4).map((t) => (
            <View key={t.id} style={{ flexDirection: "row", gap: 10, paddingHorizontal: 4 }}>
              <View style={{ flex: 1, gap: 2 }}><T style={{ fontFamily: font.semi, fontSize: 15 }}>{t.title}</T>{!!t.why && <T kind="small">{t.why}</T>}</View>
              {!!t.due && <T kind="small">{shortDate(t.due)}</T>}
            </View>
          ))}
        </View>
      )}
      <Card style={{ gap: 6 }}><T style={{ fontFamily: font.bold }}>When will you work on your career each week?</T><CareerTime intro /></Card>
      <Nav note={error || undefined} onBack={busy ? undefined : onBack}
        next={<>
          <Button testID="button-enter-workspace" label="Go to my Home" icon="arrow" onPress={finish} busy={finishing} disabled={busy} flex />
          {w.plan && config?.ai.available && !busy && <Button testID="button-regenerate-plan" kind="ghost" label="Write a different plan" onPress={make} flex />}
        </>} />
    </View>
  );
}
