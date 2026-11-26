import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Linkedin, Plus } from "lucide-react";
import { LINKEDIN_RECHECK_DAYS, linkedinBasics, linkedinGaps, linkedinTips, parseLinkedin } from "@shared/linkedin";
import { splitList } from "@shared/words";
import { Sparkles } from "lucide-react";
import { api } from "../lib/store";
import { Spinner } from "./common";
import { daysUntil, rid, useStore } from "../lib/store";
import { CopyButton } from "./common";
import { ProfileImport } from "./Uploaders";

/** LinkedIn coach: what's on the resume but not on LinkedIn, with each field ready to paste.
 *  LinkedIn doesn't let apps edit profiles, so the student pastes; Remy never signs in for them. */
export function LinkedInCoach() {
  const { ws, save, run } = useStore();
  const w = ws!;
  const [open, setOpen] = useState<number | null>(null);
  const li = w.linkedin;
  const doc = w.resume?.doc;
  const age = li ? -(daysUntil(li.at) ?? 0) : 0;
  const upload = <ProfileImport kind="LinkedIn profile (PDF)" hint="On LinkedIn (on a computer): your profile → Resources → Save to PDF. Then upload Profile.pdf here." />;
  if (!doc) return null;
  if (!li) return (
    <section className="card card-pad stack-sm" data-testid="linkedin-coach">
      <h3 className="row"><Linkedin size={18} /> LinkedIn coach</h3>
      <p className="small muted">Upload your LinkedIn PDF and Remy lists what's on your resume but missing from LinkedIn, with the words ready to paste.</p>
      {upload}
    </section>
  );
  const gaps = linkedinGaps(doc, li.text);
  // Photo isn't in the PDF, so it goes in the "can't see" note instead of the checklist.
  // The tips below cover About and Skills, so only Experience stays in the short checklist.
  const basics = linkedinBasics(li.text).filter((b) => b.ok !== null && !/about|skills/i.test(b.label));
  const parsed = parseLinkedin(li.text, [w.profile.name, w.profile.preferredName || "", doc.contact.name]);
  // For the headline: a CURRENT role the resume reader didn't guess (dates say Present or this/last year), leadership
  // first. No current role → no role in the suggestion (an old high-school title isn't who they are now).
  const yr = new Date().getFullYear();
  const current = (d: string) => /present|current|now/i.test(d) || new RegExp(`\\b(${yr}|${yr + 1}|${yr + 2})\\b`).test(d);
  const roles = doc.sections.filter((x) => !/educ|skill|certif|honou?r|award|course/i.test(x.heading)).flatMap((x) => x.entries)
    .filter((e) => e.role && e.org && !e.unverified?.includes("role") && !e.unverified?.includes("org") && current(e.dates));
  const lead0 = roles.find((e) => /president|treasurer|founder|director|captain|chair|lead|officer|vice|secretary|intern/i.test(e.role)) || roles[0];
  const lead = lead0 && { role: lead0.role.split(/\s+[–—|]\s+|\s*\(/)[0].trim(), org: lead0.org.split(/\s+[–—|]\s+|\s*\(/)[0].trim() };
  const tips = linkedinTips(parsed, {
    major: w.profile.major, school: w.profile.school, role: lead ? `${lead.role} @ ${lead.org}` : "",
    resumeSkills: doc.skills.flatMap((k) => splitList(k.items)).map((x) => x.replace(/\(.*?\)/g, "").trim()).filter((x) => x.length > 1),
  });
  const addTodo = (title: string, why: string) => w.tasks.some((t) => t.title === title && !t.done)
    ? run(async () => { throw new Error("That's already on your to-do list."); })
    : run(() => save("tasks", [{ id: rid("t"), title, why, due: "", category: "Prepare" as const, done: false, source: "LinkedIn coach" }, ...w.tasks]), "Added to your to-dos");
  return (
    <section className="card card-pad stack-sm" data-testid="linkedin-coach">
      <div className="row-between"><h3 className="row"><Linkedin size={18} /> LinkedIn coach</h3><span className="xs muted">Checked {age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`}</span></div>
      {age >= LINKEDIN_RECHECK_DAYS && <div className="notice small" data-testid="linkedin-stale">It's been over a month. Save a fresh PDF from LinkedIn and upload it to re-check.</div>}
      <div className="stack-sm" style={{ gap: 4 }}>
        {basics.map((b) => (
          <div key={b.label} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 8 }}>
            <span style={{ flex: "none", width: 16, marginTop: 2, color: b.ok ? "var(--success, #22a05a)" : b.ok === false ? "var(--warn)" : "var(--muted-text)" }}>{b.ok ? <Check size={14} /> : b.ok === false ? "!" : "?"}</span>
            <span><b>{b.label}</b>{!b.ok && <span className="muted"> · {b.tip}</span>}</span>
          </div>
        ))}
      </div>
      <div className="stack-sm" style={{ gap: 10 }} data-testid="linkedin-tips">
        {tips.map((t) => (
          <div key={t.key} className="stack-sm" style={{ gap: 4 }} data-testid={`linkedin-tip-${t.key}`}>
            <span className="small row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <span style={{ flex: "none", width: 16, marginTop: 2, color: t.ok ? "var(--success, #22a05a)" : "var(--warn)" }}>{t.ok ? <Check size={14} /> : "!"}</span>
              <span><b>{t.title}</b> <span className="muted">{t.detail}</span></span>
            </span>
            {t.suggestion && <div className="row" style={{ gap: 8, flexWrap: "nowrap", marginLeft: 24 }}><span className="xs" style={{ flex: 1 }}>Try: “{t.suggestion}”</span><CopyButton text={t.suggestion} /></div>}
            {t.key === "about" && !parsed.about && <AboutDraft />}
          </div>
        ))}
      </div>
      <b className="small" data-testid="linkedin-gap-count">{gaps.length ? `On your resume but not on LinkedIn (${gaps.length})` : "Everything on your resume is on LinkedIn."}</b>
      {gaps.map((g, i) => (
        <div key={g.section + g.title} className="card card-pad stack-sm" style={{ boxShadow: "none", padding: 10 }} data-testid="linkedin-gap">
          <button className="row-between small" style={{ textAlign: "left", gap: 8, flexWrap: "nowrap" }} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span><span className="chip chip-plain">{g.section}</span> {g.title}</span>{open === i ? <ChevronUp size={16} style={{ flex: "none" }} /> : <ChevronDown size={16} style={{ flex: "none" }} />}
          </button>
          {open === i && <>
            <span className="xs muted">On LinkedIn: your profile → Add profile section → {g.section}. Paste each field:</span>
            {g.fields.map((f) => (
              <div key={f.label} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 8 }}>
                <span className="xs" style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><b>{f.label}:</b> {f.value}</span>
                <CopyButton text={f.value} />
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => addTodo(`Add to LinkedIn: ${g.section}: ${g.title}`, g.fields.map((f) => `${f.label}: ${f.value}`).join("\n"))}><Plus size={14} /> Do it later (to-do)</button>
          </>}
        </div>
      ))}
      <details className="xs muted"><summary>What Remy can't see in the PDF</summary>Your photo, banner and “Open to work” setting don't come through in LinkedIn's PDF. Quick check yourself: a clear, friendly headshot; a simple banner (your school works); and Open to work set to recruiters only if you're looking.</details>
      <details className="xs muted"><summary>Upload a newer LinkedIn PDF</summary>{upload}</details>
      <p className="xs muted">Remy only compares the two. When they disagree, you decide which is right.</p>
    </section>
  );
}

/** "Draft my About": Remy writes 3-4 sentences from the student's own record; they edit and paste it. Not saved. */
function AboutDraft() {
  const { run } = useStore();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const draft = async () => { setBusy(true); const r = await run(() => api<{ about: string }>("POST", "/api/ai/linkedin-about")); setBusy(false); if (r) setText(r.about); };
  return (
    <div className="stack-sm" style={{ marginLeft: 24, gap: 6 }}>
      {!text && <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={draft} data-testid="button-draft-about">{busy ? <Spinner /> : <Sparkles size={14} />} Draft my About</button>}
      {text && <>
        <textarea className="textarea" style={{ minHeight: 110 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your About section" data-testid="input-about" />
        <div className="row" style={{ gap: 8 }}><CopyButton text={text} /><span className="xs muted">Made only from your resume and profile. Change any words so it sounds like you, then paste it into LinkedIn → About.</span></div>
      </>}
    </div>
  );
}

/** Redesign stage 3 (owners first): the LinkedIn tab is gone; this card beside the resume flags what doesn't match,
 *  and opens the full coach only when the student wants it. */
export function LinkedInFlags() {
  const { ws } = useStore();
  const [open, setOpen] = useState(false);
  const doc = ws!.resume?.doc, li = ws!.linkedin;
  if (!doc) return null;
  const n = li ? linkedinGaps(doc, li.text).length : null;
  return (
    <div className="stack-sm" data-testid="linkedin-flags">
      <h3 className="row"><Linkedin size={16} /> LinkedIn</h3>
      {!open && <p className="small" data-testid="linkedin-flag-text">{n === null ? "Upload your LinkedIn PDF and Remy flags anything on your resume that's missing from LinkedIn."
        : n ? `${n} thing${n === 1 ? "" : "s"} on your resume ${n === 1 ? "isn't" : "aren't"} on your LinkedIn yet.` : "Your LinkedIn matches your resume."}</p>}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} aria-expanded={open} onClick={() => setOpen(!open)} data-testid="button-linkedin-flags">
        {open ? "Hide" : n === null ? "Add your LinkedIn PDF" : n ? "See what to add" : "See LinkedIn tips"}
      </button>
      {open && <div className="r1-linkedin"><LinkedInCoach /></div>}
    </div>
  );
}
