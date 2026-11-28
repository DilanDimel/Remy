import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Application, BulletChange, Job, Workspace } from "@shared/types";
import { wordDiff } from "@shared/resumeDiff";
import { shortTitle } from "@shared/org";
import { Button, FitBadge, Logo, T, success, tap } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { shareFromServer } from "@/lib/files";
import { useJobs } from "@/lib/jobs";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

type Res = { application: Application; workspace: Workspace };
const textOf = (c: BulletChange) => (c.status === "edited" && c.edited ? c.edited : c.revised);

/** Tailor the resume for one opening, natively (handoff 02 §2.4): Remy drafts changes from the student's own resume
 *  (`POST /api/applications/:id/generate`), each one is reviewed on its own screen (original above proposed, the words
 *  that changed highlighted, the posting's words that asked for it below) with Accept / Edit / Reject, then the student
 *  approves and downloads. Every change was already checked for invented claims on the server; flagged ones say so. */
export default function Tailor() {
  const { job: jobId, app: appId } = useLocalSearchParams<{ job?: string; app?: string }>();
  const { ws, setWs } = useSession();
  const { jobs, fits } = useJobs();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [conflict, setConflict] = useState("");
  const [letterAsk, setLetterAsk] = useState("");
  const [at, setAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const a = ws?.applications.find((x) => (appId ? x.id === appId : x.jobId === jobId));
  const job: Job | undefined = jobs.find((j) => j.id === (a?.jobId || jobId));

  const run = async (what: string, f: () => Promise<void>) => {
    setBusy(what); setErr("");
    try { await f(); } catch (e: any) { setErr(e.message); }
    setBusy("");
  };
  if (!ws) return null;
  const wrap = (body: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: job ? `Tailor for ${job.company}` : "Tailor your resume" }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">{body}</ScrollView>
    </View>
  );
  const box = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, gap: 8 } as const;
  const label = (t: string, color = c.mutedText) => <Text style={{ fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.7, color }}>{t.toUpperCase()}</Text>;
  const errLine = !!err && <T kind="small" style={{ color: c.error }}>{err}</T>;

  // No opening named: pick one (tailoring in progress first, then the best fits not started).
  if (!jobId && !appId) {
    const inProgress = ws.applications.map((x) => ({ x, j: jobs.find((j) => j.id === x.jobId) })).filter((p): p is { x: Application; j: Job } => !!p.j);
    const fresh = jobs.filter((j) => j.kind !== "event" && !ws.applications.some((x) => x.jobId === j.id) && !!fits[j.id] && !fits[j.id]!.excluded && fits[j.id]!.regionMatch !== false && !ws.hiddenJobIds.includes(j.id))
      .sort((x, y) => (fits[y.id]?.score ?? 0) - (fits[x.id]?.score ?? 0)).slice(0, 8);
    const row = (j: Job, sub: string, onPress: () => void, testID: string) => (
      <Pressable key={j.id + testID} testID={testID} onPress={() => { tap(); onPress(); }} style={[box, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
        <Logo company={j.company} url={j.applyUrl} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Three lines and the place: four "Summer 2027 Internship – Auto …" rows from one company read the same at two. */}
          <Text numberOfLines={3} style={{ fontFamily: font.bold, fontSize: 15.5, color: c.ink }}>{shortTitle(j.title, j.company)}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.body, fontSize: 13, color: c.mutedText }}>{j.company}{j.location ? ` · ${j.location}` : ""} · {sub}</Text>
        </View>
        <FitBadge fit={fits[j.id]} />
      </Pressable>
    );
    return wrap(<>
      <T kind="muted">Pick an opening. Remy proposes changes from what's already on your resume, and you accept, edit or reject each one.</T>
      {inProgress.length > 0 && <>{label("In progress")}{inProgress.map(({ x, j }) => row(j, x.versions.length ? `Approved v${x.versions.length}` : x.generatedAt ? `${x.overnight ? "Remy's draft · " : ""}${x.changes.filter((ch) => ch.status === "pending").length} to review` : "Not drafted yet", () => router.setParams({ app: x.id }), "row-tailor-started"))}</>}
      {fresh.length > 0 && <>{label("Best fits")}{fresh.map((j) => row(j, "Start", () => router.setParams({ job: j.id }), "row-tailor-new"))}</>}
      {!inProgress.length && !fresh.length && <T kind="muted">No openings yet. Keep a few on Jobs and come back.</T>}
    </>);
  }

  // Jobs still loading, or the opening left the feed.
  if (!job) return wrap(jobs.length ? <T kind="muted">This opening isn't in your list any more.</T> : <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}><ActivityIndicator color={c.fox} /><T kind="small">Loading your openings…</T></View>);

  const head = (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <Logo company={job.company} url={job.applyUrl} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 13, color: c.mutedText }}>Tailoring for {job.company}</Text>
        <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 17, color: c.ink }}>{shortTitle(job.title, job.company)}</Text>
      </View>
    </View>
  );
  const generate = (confirmEligible = false) => run("generate", async () => {
    setConflict("");
    // Nothing is started (or kept) until the student asks Remy to draft: opening this screen only looks.
    const id = a?.id || (await api<Res>("POST", "/api/applications", { jobId: job.id })).application.id;
    try { const r = await api<Res>("POST", `/api/applications/${id}/generate`, confirmEligible ? { confirmEligible: true } : {}); setWs(r.workspace); success(); }
    catch (e) { if (e instanceof ApiError && e.code === "eligibility-conflict") setConflict(e.message); else throw e; }
  });

  // 1. Nothing drafted yet
  if (!a || !a.generatedAt) return wrap(<>
    {head}
    <View style={box}>
      <T kind="h2">Remy drafts the changes</T>
      <T kind="small">He reads the posting, finds the lines on your resume that back what it asks for, and rewords them using only what you already wrote. Nothing is used until you approve it.</T>
      {busy === "generate" ? <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 6 }}><ActivityIndicator color={c.fox} /><T kind="small" style={{ flex: 1 }}>Remy is reading the posting and your resume. This takes up to a minute…</T></View>
        : <Button testID="button-generate" label="Draft my changes" icon="arrow" flex onPress={() => generate()} style={{ marginTop: 6 }} />}
    </View>
    {!!conflict && (
      <View style={[box, { borderColor: c.fox }]}>
        <T kind="small">{conflict}</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button testID="button-tailor-anyway" label="I'm eligible, tailor anyway" onPress={() => generate(true)} />
          <Button testID="button-tailor-back" kind="ghost" label="Go back" onPress={() => router.back()} />
        </View>
      </View>
    )}
    {errLine}
  </>);

  const pending = a.changes.filter((ch) => ch.status === "pending");
  const current = a.changes.find((ch) => ch.id === at && ch.status === "pending") || pending[0];
  const decide = (ch: BulletChange, body: object, ok: () => void) => run("change", async () => {
    const r = await api<Res>("PUT", `/api/applications/${a.id}/change/${ch.id}`, body);
    setWs(r.workspace); ok(); setEditing(false); setAt(null);
  });

  // 2. One change per screen
  if (current) {
    const n = a.changes.indexOf(current) + 1;
    const words = wordDiff(current.original, current.revised);
    return wrap(<>
      {head}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: "hidden" }}><View style={{ width: `${((a.changes.length - pending.length) / a.changes.length) * 100}%`, height: 6, backgroundColor: c.fox }} /></View>
        <Text style={{ fontFamily: font.semi, fontSize: 13, color: c.mutedText }} testID="text-change-progress">{n} of {a.changes.length}</Text>
      </View>
      <View style={box} testID="card-change">
        {label(current.entryLabel || "Your resume")}
        {label("Original")}
        <T style={{ color: c.mutedText }}>{current.original}</T>
        {label("Remy's version", c.fox)}
        {editing
          ? <TextInput testID="input-change-edit" value={draft} onChangeText={setDraft} multiline autoFocus style={{ minHeight: 90, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, padding: 10, fontFamily: font.body, fontSize: 15.5, color: c.ink, textAlignVertical: "top" }} />
          : <Text style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 23, color: c.ink }}>{words.map((x, i) => <Text key={i} style={x.added ? { backgroundColor: c.foxSoft, fontFamily: font.semi } : undefined}>{i ? " " : ""}{x.w}</Text>)}</Text>}
        {current.flags.length > 0 && current.flags.map((f) => <T key={f.type + f.term} kind="small" style={{ color: c.error }}>{f.message}</T>)}
      </View>
      {!!current.requirementQuote && (
        <View style={[box, { backgroundColor: c.surface2, borderColor: c.surface2 }]}>
          {label(`${job.company} asks for`)}
          <T kind="small">“{current.requirementQuote}”</T>
          {!!current.evidence && <T kind="small" style={{ color: c.mutedText }}><Text style={{ fontFamily: font.bold }}>Backed by: </Text>{current.evidence}</T>}
        </View>
      )}
      {errLine}
      {editing ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button testID="button-change-save-edit" label="Use my version" busy={busy === "change"} onPress={() => decide(current, { edited: draft.trim() }, success)} />
          <Button testID="button-change-cancel-edit" kind="ghost" label="Cancel" onPress={() => setEditing(false)} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button testID="button-change-accept" label="Accept" flex style={{ flex: 1 }} busy={busy === "change"} onPress={() => decide(current, { status: "accepted" }, success)} />
          <Button testID="button-change-edit" kind="ghost" label="Edit" flex style={{ flex: 1 }} onPress={() => { setDraft(current.revised); setEditing(true); }} />
          <Button testID="button-change-reject" kind="ghost" label="Reject" flex style={{ flex: 1 }} onPress={() => decide(current, { status: "rejected" }, tap)} />
        </View>
      )}
      {pending.length > 1 && <Pressable testID="button-change-later" onPress={() => { tap(); setAt(pending[(pending.indexOf(current) + 1) % pending.length]!.id); }} style={{ alignSelf: "center", padding: 8 }}><Text style={{ fontFamily: font.semi, fontSize: 14, color: c.mutedText }}>Decide this one later</Text></Pressable>}
    </>);
  }

  // 3. All reviewed: approve, then download
  const used = a.changes.filter((ch) => ch.status === "accepted" || ch.status === "edited");
  const v = a.versions[a.versions.length - 1];
  const approved = !!v && a.letterApproved && !a.staleReason;
  const approve = (confirmLetter = false) => run("approve", async () => {
    setLetterAsk("");
    try { const r = await api<Res>("POST", `/api/applications/${a.id}/approve`, confirmLetter ? { confirmLetter: true } : undefined); setWs(r.workspace); success(); }
    catch (e) { if (e instanceof ApiError && e.status === 409 && /cover letter/i.test(e.message)) setLetterAsk(e.message); else throw e; }
  });
  const base = `${(ws.resume?.doc.contact.name || "Resume").replace(/\s+/g, "_")}_${job.company.replace(/\W+/g, "_")}`;
  const dl = (doc: "resume" | "letter", fmt: "pdf" | "docx") => run(doc + fmt, () => shareFromServer(`/api/applications/${a.id}/export?doc=${doc}&format=${fmt}&v=${v!.v}`, `${base}_${doc === "resume" ? "Resume" : "Cover_Letter"}.${fmt}`, fmt === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  return wrap(<>
    {head}
    <View style={box} testID="card-tailor-summary">
      <T kind="h2">{approved ? `Approved · version ${v!.v}` : "All changes reviewed"}</T>
      <T kind="small">{used.length} change{used.length === 1 ? "" : "s"} used, {a.changes.length - used.length} rejected.{a.skippedChanges ? ` Remy left out ${a.skippedChanges} more that said more than your resume does.` : ""}</T>
      {!!a.staleReason && <T kind="small" style={{ color: c.foxDeep }}>{a.staleReason}</T>}
      {used.map((ch) => <T key={ch.id} kind="small" style={{ color: c.mutedText }}>• {textOf(ch)}</T>)}
      {!approved && <Button testID="button-approve" label="Approve my tailored resume" icon="check" flex busy={busy === "approve"} onPress={() => approve()} style={{ marginTop: 6 }} />}
    </View>
    {!!letterAsk && (
      <View style={[box, { borderColor: c.fox }]} testID="letter-check">
        <T kind="small">{letterAsk}</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button testID="button-edit-letter" kind="ghost" label="Edit the letter" onPress={() => go(`/resume?tab=tailor&app=${a.id}`, "Cover letter", { page: true })} />
          <Button testID="button-confirm-letter" label="It's all true, approve" busy={busy === "approve"} onPress={() => approve(true)} />
        </View>
      </View>
    )}
    {approved && (
      <View style={box} testID="card-tailor-downloads">
        {label("Download")}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button testID="button-tailored-pdf" label="Resume PDF" busy={busy === "resumepdf"} onPress={() => dl("resume", "pdf")} />
          <Button testID="button-tailored-docx" kind="ghost" label="Word" busy={busy === "resumedocx"} onPress={() => dl("resume", "docx")} />
          {!!a.letter.trim() && <Button testID="button-letter-pdf" kind="ghost" label="Cover letter" busy={busy === "letterpdf"} onPress={() => dl("letter", "pdf")} />}
        </View>
      </View>
    )}
    {errLine}
    <Button testID="button-tailor-website" kind="ghost" label="Cover letter and checks on the website" flex onPress={() => go(`/resume?tab=tailor&app=${a.id}`, "Tailor", { page: true })} />
  </>);
}
