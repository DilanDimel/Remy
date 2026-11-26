import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { Profile, Workspace } from "@shared/types";
import { nameConcern } from "@shared/junk";
import { Button, Card, Chip, Icon, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { Input, Nav, useSave } from "./common";
import { AskCard } from "@/components/OfficeGuide";
import { dayKey } from "@shared/daily";
import { remyAsks, type Ask } from "@shared/remyAsks";

/** Mismatches between the resume and the student's other sources (the website's CHECK_KINDS in Onboarding.tsx). */
const CHECK_KINDS: Ask["kind"][] = ["conflict", "name", "profile", "facts"];

/** One mismatch at a time with Remy's own question card, then Continue (tester, Nov 25: the review was too much reading). */
function SetupChecks({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws } = useSession();
  const asks = (ws ? remyAsks(ws, dayKey()) : []).filter((a) => CHECK_KINDS.includes(a.kind));
  const [shown, setShown] = useState<Ask | null>(null);
  const [total] = useState(asks.length);
  const ask = shown || asks[0];
  const left = asks.filter((a) => a.id !== ask?.id).length;
  return (
    <View style={{ flexGrow: 1, gap: 18 }} testID="setup-checks">
      <View style={{ gap: 4 }}>
        {!!ask && <T kind="small">{total - left} of {Math.max(total, total - left)}</T>}
        <T kind="title">{ask ? "A few quick checks" : "That's everything"}</T>
        <T kind="muted">{ask ? "Remy compared your resume with your other sources. Pick what's right and he fixes it." : "Thanks. Everything Remy uses now matches what you picked."}</T>
      </View>
      {!!ask && <AskCard key={ask.id} ask={ask} next={left} onAnswered={() => setShown(ask)} onNext={() => setShown(null)} />}
      <Nav onBack={onBack} next={!ask || (shown && !left) ? <Button testID="button-ob-next-checks" label="Continue" icon="arrow" onPress={onNext} flex /> : undefined} />
    </View>
  );
}

// The website's review step shows ProfileForm without the preference fields (those come on the next step).
const FIELDS: [keyof Profile, string, string?][] = [
  ["name", "Full name"], ["preferredName", "What should Remy call you?"], ["applicationEmail", "Email for applications", "e.g. you@tcu.edu"],
  ["school", "School"], ["major", "Major(s)"], ["minors", "Minor(s)"], ["gpa", "GPA", "e.g. 3.6 (optional)"], ["location", "Location"],
  ["goal", "What you're working toward", "e.g. a summer 2027 finance internship in Dallas"],
];
const OTHER_PATH: Record<string, string> = { major: "Program, trade or field" };
const titleCase = (h: string) => (h === h.toUpperCase() ? h.toLowerCase().replace(/^\w/, (x) => x.toUpperCase()) : h);

/** "Is this right?": what Remy read, to correct before anything is built on it. Remy only uses what's confirmed here. */
export function Review({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const save = useSave();
  const w = ws!;
  const [p, setP] = useState<Profile>(w.profile);
  const [typing, setTyping] = useState("");
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(p) !== JSON.stringify(w.profile);
  const unverified = w.resume?.doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.verified === false) || [];
  const checks = ws ? remyAsks(ws, dayKey()).filter((a) => CHECK_KINDS.includes(a.kind)) : [];
  const [checking, setChecking] = useState(false);
  // Value first: start the search from the resume alone, so real openings show before any more questions.
  const { jobs, fits, reload } = useJobs();
  const [looking, setLooking] = useState(false);
  useEffect(() => {
    if (!w.resume || jobs.length) return;
    setLooking(true);
    api<{ workspace: Workspace }>("POST", "/api/jobs/discover", {}).then((d) => { setWs(d.workspace); return reload(); }).catch(() => {}).finally(() => setLooking(false));
  }, []);
  const first = jobs.filter((j) => !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false).slice(0, 3);
  const next = async () => {
    setBusy(true); setError("");
    try {
      // Edits typed above count as confirmed; a resume whose every line matched the file is confirmed too.
      if (dirty) await save("profile", p);
      if (w.resume && !w.resume.confirmedAt && !unverified.length) setWs(await api<Workspace>("PUT", "/api/resume/doc", { doc: w.resume.doc, confirm: true }));
      if (checks.length) setChecking(true); else onNext();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  if (checking) return <SetupChecks onBack={() => setChecking(false)} onNext={onNext} />;
  return (
    <View style={{ flexGrow: 1, gap: 18 }}>
      {(looking || first.length > 0) && (
        <Card testID="first-matches" style={{ gap: 6 }}>
          {first.length ? <>
            <T style={{ fontFamily: font.bold }}>First openings that fit your resume</T>
            {first.map((j) => <T key={j.id} kind="small" style={{ color: c.ink }}>{j.title} <T kind="small">at {j.company}</T></T>)}
            <T kind="small">Your next answers sharpen these.</T>
          </> : <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ActivityIndicator color={c.fox} /><T kind="small" style={{ flex: 1 }}>Remy is already checking employers' career sites for openings that fit your resume…</T></View>}
        </Card>
      )}
      <View style={{ gap: 4 }}>
        <T kind="title">Here's what I found</T>
        <T kind="muted">Tap anything that's off, or fill in what's empty. Remy only uses what you confirm here.</T>
      </View>
      {/* What Remy read, as rows: tap one to fix it, so the step isn't nine open boxes in a long scroll. */}
      <View style={{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, overflow: "hidden" }} testID="profile-rows">
        {FIELDS.map(([k, label, ph], i) => {
          const warn = (k === "name" || k === "preferredName") && typing !== k ? nameConcern(String(p[k] || ""), k === "preferredName") : "";
          const name = (p.path && p.path !== "four-year" && OTHER_PATH[k]) || label;
          const value = String(p[k] ?? "").trim();
          return (
            <View key={k} style={{ paddingVertical: 12, paddingHorizontal: 16, gap: 4, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: c.line }}>
              {editing === k ? (
                <Input testID={`input-profile-${k}`} label={name} value={String(p[k] ?? "")} placeholder={ph} maxLength={600} autoFocus
                  onChangeText={(v) => setP({ ...p, [k]: v })} onFocus={() => setTyping(k)} onBlur={() => { setTyping(""); setEditing(""); }} onSubmitEditing={() => setEditing("")} returnKeyType="done"
                  autoCapitalize={k === "applicationEmail" ? "none" : "sentences"} keyboardType={k === "applicationEmail" ? "email-address" : k === "gpa" ? "decimal-pad" : "default"} />
              ) : (
                <Pressable testID={`row-profile-${k}`} accessibilityRole="button" accessibilityLabel={`${name}: ${value || "Not added"}. Tap to change.`} onPress={() => setEditing(k)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}><T kind="small" style={{ fontFamily: font.semi }}>{name}</T><T numberOfLines={2} style={value ? undefined : { color: c.faint }}>{value || "Not added"}</T></View>
                  <Icon name="chev" size={16} color={c.faint} />
                </Pressable>
              )}
              {!!warn && <T kind="small" style={{ color: c.foxDeep }}>{warn}</T>}
            </View>
          );
        })}
      </View>
      {w.resume && (
        <View style={{ gap: 8 }}>
          <T kind="h2">From your resume</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {w.resume.doc.sections.map((s) => <Chip key={s.id} text={`${titleCase(s.heading)} · ${s.entries.length}`} />)}
          </View>
          <T kind="small">{w.resume.parsedBy === "builder" ? "Built with Remy from your own answers. Edit any line on the Resume tab."
            : unverified.length ? `${unverified.length} line${unverified.length === 1 ? "" : "s"} couldn't be matched word for word to your file. You can fix them on the Resume tab.`
            : "Every bullet matches your original file word for word."}</T>
          {w.resume.parsedBy === "rules" && <T kind="small" style={{ color: c.foxDeep }} >Remy's AI reader was busy, so a simpler reader sorted your resume. The words are yours, but check on the Resume tab that each job has its own bullets and your degree line reads right.</T>}
        </View>
      )}
      <Nav note={error || undefined} onBack={onBack} next={<Button testID="button-ob-next-review" label="Looks right" icon="arrow" onPress={next} busy={busy} flex />} />
    </View>
  );
}
