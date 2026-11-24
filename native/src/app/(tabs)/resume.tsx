import { useState } from "react";
import { Button, Group, Icon, Row, Screen, Sect, T } from "@/components/ui";
import { go } from "@/lib/nav";
import { useRefreshAll, useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** Resume & CV. For now its sections open the website's Resume page, signed in, as a sheet; the native read view with
 *  Remy's line-by-line fixes (original vs. proposed, Accept · Edit · Skip) is the next step (handoff P1.6). */
export default function Resume() {
  const { ws } = useSession();
  const refresh = useRefreshAll();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  if (!ws) return null;
  const sections = ws.resume?.doc?.sections || [];
  const lines = sections.reduce((n, s) => n + s.entries.reduce((m, e) => m + e.bullets.length, 0), 0);
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };
  const open = (q = "") => go(`/resume${q}`, "Resume", { page: true });
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ marginTop: 28 }}>Resume</T>
      <T kind="muted">{sections.length ? `${sections.length} sections · ${lines} lines. Remy only suggests changes from what you wrote, and you approve each one.` : "Add your resume and Remy reads it, checks it, and helps you tailor it for each opening."}</T>
      {sections.length ? <>
        <Sect title="Your resume" />
        <Group>
          {sections.map((s, i) => <Row key={s.id} first={i === 0} title={s.heading || "Section"} sub={`${s.entries.length} ${s.entries.length === 1 ? "entry" : "entries"}`} left={<Icon name="doc" color={c.mutedText} />} onPress={() => open("?tab=base")} testID="row-resume-section" />)}
        </Group>
        <Button testID="button-open-resume" label="Open my resume" icon="arrow" onPress={() => open("?tab=base")} style={{ marginTop: 16 }} flex />
      </> : <Button testID="button-add-resume" label="Add my resume" icon="arrow" onPress={() => open()} style={{ marginTop: 18 }} flex />}
    </Screen>
  );
}
