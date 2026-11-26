import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PATHS, type Profile, type Workspace } from "@shared/types";
import { nameConcern } from "@shared/junk";
import { yearOptions } from "@shared/setupDefaults";
import { AUTH_OPTS } from "@shared/workAuth";
import { Button, Icon, Loading, Sect, T, success, tap } from "@/components/ui";
import { Chips, Input } from "@/components/setup/common";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

type K = keyof Profile;
// The website's profile fields and groups (client/src/pages/Accounts.tsx OwnerProfile, Onboarding.tsx PROFILE_FIELDS).
const LABEL: Partial<Record<K, [string, string?]>> = {
  name: ["Full name"], preferredName: ["What should Remy call you?"], school: ["School"], major: ["Major(s)"], minors: ["Minor(s)"], gpa: ["GPA", "e.g. 3.6 (optional)"],
  classYear: ["Class year"], path: ["Where are you right now?"], goal: ["What you're working toward", "e.g. a summer 2027 finance internship in Dallas"],
  targetRoles: ["Roles you're curious about", "e.g. investment banking, fintech"], opportunityTypes: ["Kinds of opportunities", "e.g. Internships, Events"],
  dreamEmployers: ["Dream employers", "e.g. PwC, EY (searched first)"], avoid: ["Anything to leave out?", "e.g. audit, sales (hidden from your openings)"],
  regions: ["Where should Remy look?", "e.g. Fort Worth, Dallas, Remote"], location: ["Location"], graduation: ["Expected graduation", "e.g. May 2029"],
  timeline: ["When do you want to start?", "e.g. Summer 2027 (empty = open to anything)"], workAuth: ["Work authorization"], relocation: ["Open to relocating?"],
  applicationEmail: ["Email for applications", "e.g. you@tcu.edu"], constraints: ["Anything that limits what you can take?", "e.g. Needs to be paid"], worries: ["What worries you most?", "e.g. Interviews"],
  goals: ["Goals", "What would a great next year look like?"],
};
const GROUPS: [string, K[]][] = [
  ["About you", ["name", "preferredName", "school", "major", "minors", "gpa", "classYear"]],
  ["What you want", ["path", "goal", "targetRoles", "opportunityTypes", "dreamEmployers", "avoid", "goals"]],
  ["Where and when", ["regions", "location", "graduation", "timeline", "relocation", "workAuth", "applicationEmail", "constraints", "worries"]],
];
const OTHER_PATH: Partial<Record<K, string>> = { major: "Program, trade or field", classYear: "Year (if in school)", graduation: "Expected finish date" };
const RELOC = ["Yes", "For the right role", "No"];
const pathName = (v: string) => PATHS.find(([x]) => x === v)?.[1] || v;

/** Edit your profile, native (it opened the website's Account page): rows grouped like the website, tap one to change
 *  it (choices as chips, the rest as a box), one Save. Saves with PUT /api/ws/profile, like the website's ProfileForm. */
export default function ProfileScreen() {
  const { ws } = useSession();
  return ws ? <Editor /> : <Loading />;
}

function Editor() {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState<Profile>(ws!.profile);
  const [open, setOpen] = useState<K | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = JSON.stringify(p) !== JSON.stringify(ws!.profile);
  const save = async () => {
    tap(); setBusy(true); setErr("");
    try { setWs(await api<Workspace>("PUT", "/api/ws/profile", { value: p })); success(); router.back(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const hidden = (k: K) => (k === "classYear" && !p.classYear && !yearOptions(p.path).length) || (k === "minors" && !p.minors && p.path === "high-school");
  const choices = (k: K): string[] | null =>
    k === "path" ? PATHS.map(([, l]) => l)
    : k === "classYear" ? [...yearOptions(p.path), ...(p.classYear && !yearOptions(p.path).includes(p.classYear) ? [p.classYear] : [])]
    : k === "workAuth" ? [...AUTH_OPTS, ...(p.workAuth && !AUTH_OPTS.includes(p.workAuth) ? [p.workAuth] : [])]
    : k === "relocation" ? RELOC : null;
  const shown = (k: K) => (k === "path" ? pathName(p.path || "") : String(p[k] ?? "")).trim();
  const set = (k: K, v: string) => setP({ ...p, [k]: k === "path" ? PATHS.find(([, l]) => l === v)?.[0] || v : v });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView testID="profile-screen" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <T kind="muted">Changes update which openings fit you. Approved resumes are never rewritten.</T>
        {GROUPS.map(([title, keys]) => (
          <View key={title}>
            <Sect title={title} />
            <View style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, overflow: "hidden" }}>
              {keys.filter((k) => !hidden(k)).map((k, i) => {
                const [label0, ph] = LABEL[k]!;
                const label = (p.path && p.path !== "four-year" && OTHER_PATH[k]) || label0;
                const opts = choices(k);
                const warn = (k === "name" || k === "preferredName") && open !== k ? nameConcern(String(p[k] || ""), k === "preferredName") : "";
                return (
                  <View key={k} style={{ paddingVertical: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: c.line }}>
                    <Pressable testID={`row-profile-${k}`} accessibilityRole="button" accessibilityLabel={`${label}: ${shown(k) || "Not added"}. Tap to change.`} onPress={() => { tap(); setOpen(open === k ? "" : k); }} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1 }}><T kind="small" style={{ fontFamily: font.semi }}>{label}</T>{open !== k && <T numberOfLines={2} style={shown(k) ? undefined : { color: c.faint }}>{shown(k) || "Add"}</T>}</View>
                      <Icon name="chev" size={16} color={c.faint} />
                    </Pressable>
                    {open === k && (opts
                      ? <Chips testID={`chips-profile-${k}`} options={opts} value={shown(k) ? [shown(k)] : []} multi={false} onChange={(v) => { set(k, v[0] || ""); setOpen(""); }} />
                      : <Input testID={`input-profile-${k}`} value={String(p[k] ?? "")} placeholder={ph} maxLength={600} autoFocus multiline={k === "goals"} style={k === "goals" ? { minHeight: 80 } : undefined}
                          onChangeText={(v) => set(k, v)} onSubmitEditing={() => setOpen("")} returnKeyType="done"
                          autoCapitalize={k === "applicationEmail" ? "none" : "sentences"} keyboardType={k === "applicationEmail" ? "email-address" : k === "gpa" ? "decimal-pad" : "default"} />)}
                    {!!warn && <T kind="small" style={{ color: c.foxDeep }}>{warn}</T>}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line, backgroundColor: c.surface, gap: 6 }}>
        {!!err && <T kind="small" style={{ color: c.error }}>{err}</T>}
        <Button testID="button-save-profile" label={dirty ? "Save profile" : "No changes yet"} disabled={!dirty} busy={busy} onPress={save} flex />
      </View>
    </View>
  );
}
