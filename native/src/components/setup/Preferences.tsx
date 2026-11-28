import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Workspace } from "@shared/types";
import { FIELD_GROUPS, FIELD_MAJORS, splitFieldList } from "@shared/fields";
import { AUTH_OPTS, authChip } from "@shared/workAuth";
import { defaultTypes, fieldFromMajor, guessYearFor, yearOptions } from "@shared/setupDefaults";
import { Button, Icon, Pill, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { Chips, Input, Nav, Q, Say, useSave } from "./common";
import { LIMIT_OPTS } from "@shared/limits";
import { regionHint, regionOptions } from "@shared/regions";

// The same choices as the website's Preferences step (client/src/pages/Onboarding.tsx).
const TYPE_OPTS = ["Internships", "Full-time jobs", "Part-time / campus jobs", "Programs & insight days", "Events & networking", "Competitions"];
const RELOC_OPTS = ["Yes", "For the right role", "No"];
const TRIED_OPTS = ["Nothing yet", "Applied to a few", "Went to a career fair", "Talked to the career center", "Reached out to people"];
const WORRY_OPTS = ["No experience yet", "Not sure what I want", "Feeling behind", "Interviews", "My resume", "Talking to people"];
/** The next few terms a student could start something, e.g. Spring 2027, Summer 2027, Fall 2027, Summer 2028. */
function timelineOptions(today = new Date()) {
  const y = today.getFullYear(), late = today.getMonth() >= 6;
  const s1 = late ? y + 1 : y;
  return [late ? `Spring ${y + 1}` : `Fall ${y}`, `Summer ${s1}`, `Fall ${s1}`, `Summer ${s1 + 1}`, "Full-time after graduation"];
}
const splitList = (v: string) => v.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "-");
const UNSURE_NOTE = "No problem. Pick any that sound interesting, or none. Remy will search by your major and show you where it leads on My Path.";

/** What the student is looking for, then where and the practical bits: two short pages, saved to the profile. */
export function Preferences({ onBack, scrollTop }: { onBack: () => void; scrollTop: () => void }) {
  const { ws, setWs } = useSession();
  const { c } = useTheme();
  const save = useSave();
  const { reload } = useJobs();
  const p = ws!.profile;
  // Start from what the resume already says (graduation year, home city) instead of blanks, as on the website.
  // Only a year that is one of this path's choices counts, so a stale "Junior" never answers it for a high-schooler.
  const [year, setYear] = useState([p.classYear, guessYearFor(p.path || "", p.graduation)].filter((y) => yearOptions(p.path).includes(y)).slice(0, 1));
  const [grad, setGrad] = useState(p.graduation);
  const [timeline, setTimeline] = useState(splitList(p.timeline || ""));
  // The student's own city and state first ("Columbus" · "Anywhere in Ohio"), not only Texas places, preselected for everyone.
  const regionOpts = regionOptions(p.location || "");
  const [regions, setRegions] = useState(p.regions ? splitList(p.regions) : regionOpts.filter((r) => r === (p.location || "").split(",")[0]!.trim()));
  const [otherRegion, setOtherRegion] = useState("");
  const [types, setTypes] = useState(p.opportunityTypes ? splitList(p.opportunityTypes) : defaultTypes(p.goal, p.path));
  const [fields, setFields] = useState(p.targetRoles ? splitFieldList(p.targetRoles) : fieldFromMajor(p.major));
  // Grades for high school, two years for community college, no year question for work, trade or service paths.
  const yearOpts = yearOptions(p.path);
  const [otherField, setOtherField] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const about = `${p.major || ""} ${p.goal || ""}`;
    const picked = splitFieldList(p.targetRoles);
    return FIELD_GROUPS.filter(([, opts]) => opts.some((o) => picked.includes(o) || FIELD_MAJORS[o]?.test(about))).map(([g]) => g);
  });
  const [unsure, setUnsure] = useState(!!ws!.onboarding.exploring);
  const [page, setPage] = useState(0);
  const [auth, setAuth] = useState(authChip(p.workAuth));
  const [reloc, setReloc] = useState(p.relocation ? [p.relocation] : []);
  const [dream, setDream] = useState(p.dreamEmployers || "");
  const [avoid, setAvoid] = useState(p.avoid || "");
  const [limits, setLimits] = useState(splitList(p.constraints || ""));
  const [tried, setTried] = useState(splitList(p.tried || ""));
  const [worries, setWorries] = useState(splitList(p.worries || ""));
  const [worryText, setWorryText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allFields = [...fields, ...splitList(otherField)];
  // Exploring without a resume (the website's rule, Dilan Nov 28): major, year and a place are required for rough matches.
  const noResume = !ws!.resume;
  const [major, setMajor] = useState(p.major || "");
  const allRegions = [...regions, ...splitList(otherRegion)];
  const allWorries = [...worries, worryText.trim()].filter(Boolean);
  const missing = (page === 0
    ? [noResume && !major.trim() && "your major", yearOpts.length && !year.length && "your year", !allFields.length && !unsure && "at least one field (or \"I'm not sure yet\")", !types.length && "what kinds of opportunities"]
    : [noResume && !allRegions.length && "at least one place"]).filter(Boolean);
  const pageOne = () => ({ ...p, ...(noResume ? { major: major.trim() } : {}), classYear: year[0] || "", graduation: grad.trim(), timeline: timeline.join(", "), opportunityTypes: types.join(", "), targetRoles: allFields.join(", ") });
  const run = async (f: () => Promise<void>) => { setBusy(true); setError(""); try { await f(); } catch (e: any) { setError(e.message); } setBusy(false); };
  // Page 1's picks are saved before page 2, so coming back later doesn't lose them.
  const nextPage = () => run(async () => {
    const w = await save("profile", pageOne());
    if (unsure !== !!w.onboarding.exploring) await save("onboarding", { ...w.onboarding, exploring: unsure });
    setPage(1); scrollTop();
  });
  const submit = () => run(async () => {
    let w = await save("profile", {
      ...pageOne(), regions: allRegions.join(", "), workAuth: auth[0] || (authChip(p.workAuth).length ? "" : p.workAuth), relocation: reloc[0] || "", dreamEmployers: dream.trim(), avoid: avoid.trim(),
      constraints: limits.join(", "), tried: tried.join(", "), worries: allWorries.join(", ").slice(0, 400),
    });
    if (unsure && !allFields.length && !w.tasks.some((t) => t.link === "/path?tab=career" && !t.done))
      w = await save("tasks", [{ id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: "Explore the jobs your major leads to", why: "You said you're not sure yet. My Path lists the jobs people with your major go into, what each one is really like, and lets you add the ones you like to your search.", due: "", category: "Explore", done: false, source: "Setup", link: "/path?tab=career" }, ...w.tasks]);
    // Start the search now so results are ready by the last step.
    api<{ workspace: Workspace }>("POST", "/api/jobs/discover", {}).then((d) => { setWs(d.workspace); return reload(); }).catch(() => {});
    // "Not sure yet" and the move to the next step in one save (two saves would let the older copy win).
    await save("onboarding", { ...w.onboarding, exploring: unsure, step: 4 });
  });
  const unsureChip = <Pill testID="pref-unsure" label="I'm not sure yet" on={unsure} onPress={() => setUnsure(!unsure)} />;
  return (
    <View style={{ flexGrow: 1, gap: 22 }}>
      <Say>
        <T kind="label">{`Page ${page + 1} of 2`}</T>
        <T kind="muted">{page === 0 ? "What are you looking for? This decides which openings I show you, and anything that rules you out stays hidden." : "Almost there. Where should I look, and is there anything that would rule an opening out?"}</T>
      </Say>
      {page === 0 ? <>
        <Q n={1} title={yearOpts.length ? "What year are you in?" : "When did you finish school?"} optional={!yearOpts.length}>
          {noResume && <Input testID="input-pref-major" label="Your major" value={major} onChangeText={setMajor} maxLength={120} placeholder="e.g. Finance, Nursing, Undecided" />}
          {yearOpts.length > 0 && <Chips options={yearOpts} value={year} onChange={setYear} multi={false} testID="pref-year" />}
          <Input testID="input-pref-grad" label={yearOpts.length ? "Expected graduation" : "Graduation"} value={grad} onChangeText={setGrad} placeholder="e.g. May 2029" />
        </Q>
        <Q n={2} title="Which fields or roles interest you?">
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: c.line, overflow: "hidden" }}>
            {FIELD_GROUPS.map(([group, opts], i) => {
              const open = openGroups.includes(group);
              const picked = opts.filter((o) => fields.includes(o));
              return (
                <View key={group} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line, backgroundColor: c.surface }}>
                  <Pressable testID={`pref-group-${slug(group)}`} accessibilityRole="button" accessibilityState={{ expanded: open }}
                    onPress={() => setOpenGroups((o) => (open ? o.filter((x) => x !== group) : [...o, group]))}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
                    <View style={{ flex: 1 }}>
                      <T style={{ fontFamily: font.bold }}>{group}</T>
                      <T kind="small" numberOfLines={1}>{picked.length ? `${picked.length} picked: ${picked.join(", ")}` : `${opts.length} fields`}</T>
                    </View>
                    <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}><Icon name="chev" size={18} color={c.mutedText} /></View>
                  </Pressable>
                  {open && <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}><Chips options={opts} value={fields} onChange={setFields} testID="pref-field" /></View>}
                </View>
              );
            })}
          </View>
          <Input testID="input-pref-field" value={otherField} onChangeText={setOtherField} placeholder="Something more specific?" />
          <View style={{ flexDirection: "row" }}>{unsureChip}</View>
          {unsure && <T kind="small">{UNSURE_NOTE}</T>}
        </Q>
        <Q n={3} title="What kinds of opportunities do you want?"><Chips options={TYPE_OPTS} value={types} onChange={setTypes} testID="pref-type" /></Q>
        <Q n={4} title="When do you want to start?">
          <Chips options={timelineOptions()} value={timeline} onChange={setTimeline} testID="pref-when" />
          <T kind="small">Pick all that work. Leave empty if you're open to anything.</T>
        </Q>
      </> : <>
        <Q n={5} title="Where should I look for you?">
          <Chips options={[...regionOpts, ...regions.filter((r) => !regionOpts.includes(r))]} value={regions} onChange={setRegions} testID="pref-region" />
          {!!regionHint(regions) && <T kind="small">{regionHint(regions)}</T>}
          <Input testID="input-pref-region" value={otherRegion} onChangeText={setOtherRegion} placeholder="Somewhere else? e.g. Chicago" />
          <T kind="small">Open to relocating?</T>
          <Chips options={RELOC_OPTS} value={reloc} onChange={setReloc} multi={false} testID="pref-reloc" />
        </Q>
        <Q n={6} title="Work authorization" optional>
          <Chips options={AUTH_OPTS} value={auth} onChange={setAuth} multi={false} testID="pref-auth" />
          <T kind="small">Only to skip postings you can't take: "won't sponsor" ones if you'll need sponsorship, U.S. citizens only ones if you aren't one. You can still open them. Leave it blank and nothing is hidden.</T>
        </Q>
        <Q n={7} title="Dream employers" optional>
          <Input testID="input-pref-dream" value={dream} onChangeText={setDream} placeholder="e.g. Goldman Sachs" />
          <T kind="small">Remy checks their career sites first.</T>
        </Q>
        <Q n={8} title="Anything to leave out?" optional><Input testID="input-pref-avoid" value={avoid} onChangeText={setAvoid} placeholder="e.g. tobacco, cold calling" /></Q>
        <Q n={9} title="Anything that limits what you can take?" optional><Chips options={LIMIT_OPTS} value={limits} onChange={setLimits} testID="pref-limit" /></Q>
        <Q n={10} title="What have you tried so far?" optional><Chips options={TRIED_OPTS} value={tried} onChange={setTried} testID="pref-tried" /></Q>
        <Q n={11} title="What worries you most about this?" optional>
          <Chips options={WORRY_OPTS} value={worries} onChange={setWorries} testID="pref-worry" />
          <Input testID="input-pref-worry" value={worryText} onChangeText={setWorryText} maxLength={200} placeholder="Or in your own words" />
          <T kind="small">Your plan's first step will start there.</T>
        </Q>
        {/* Remy repeats it back in one line before saving, so the student can catch anything wrong. */}
        <T kind="small" style={{ color: c.ink }}>
          <T kind="small" style={{ fontFamily: font.bold, color: c.ink }}>So: </T>
          {[year[0], allFields.slice(0, 3).join(", ") || (unsure ? "still exploring" : ""), types.join(", "), timeline.join(", "), allRegions.join(", "), limits.join(", "), allWorries.length ? `worried about ${allWorries.join(", ").toLowerCase()}` : ""].filter(Boolean).join(" · ")}.
          <T kind="small"> Change anything above if it's off.</T>
        </T>
      </>}
      <Nav note={error || (missing.length ? `To continue, choose ${missing.join(", ")}.` : undefined)} onBack={() => (page ? (setPage(0), scrollTop()) : onBack())}
        next={page === 0
          ? <Button testID="button-ob-prefs-page" label="Next" icon="arrow" onPress={nextPage} busy={busy} disabled={missing.length > 0} flex />
          : <Button testID="button-ob-next-prefs" label="Save and continue" icon="arrow" onPress={submit} busy={busy} disabled={missing.length > 0} flex />} />
    </View>
  );
}
