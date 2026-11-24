import { useState } from "react";
import { Check, Download, Info, Lock, LogOut, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { PATHS, type MemoryFact, type Workspace } from "@shared/types";
import { api, download, fmtDate, rid, useOwnerView, useStore } from "../lib/store";
import { go } from "../lib/router";
import { Modal, StatusChip } from "../components/common";
import { PROFILE_FIELDS, ProfileForm } from "./Onboarding";
import { useGoogleButton } from "./Welcome";
import { ProfileImport } from "../components/Uploaders";
import { GoogleCalendarCard } from "../components/GoogleCalendar";
import { atTcu, schoolVerified, SchoolVerify } from "../components/SchoolVerify";
import { useGoogleCalendar } from "../components/GoogleCalendar";
import { Avatar } from "../components/ProfilePhoto";
import { ConflictChoice } from "../components/ConflictChoice";
import { ThemeChoice } from "../components/ThemeToggle";
import { CareerTime } from "../components/CareerTime";
import { ProfilePhoto } from "../components/ProfilePhoto";
import { knownName } from "@shared/names";

type Tab = "profile" | "sources" | "memory" | "settings" | "data";

export default function Accounts({ query }: { query: URLSearchParams }) {
  const tab = (query.get("tab") as Tab) || "profile";
  const { ws } = useStore();
  const owner = useOwnerView();
  const waiting = ws!.memory.filter((m) => m.status === "suggested").length;
  const say = ownerSay(tab, ws!);
  const tabs = (
      <div className="tabs" role="tablist">
        {([["profile", "Profile"], ["sources", "Connected sources"], ["memory", "AI memory"], ["settings", "Appearance & alerts"], ["data", "Account & data"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/accounts?tab=${k}`)} data-testid={`tab-accounts-${k}`}>{l}{owner && k === "memory" && waiting > 0 && <span className="ac-count" data-testid="count-memory-waiting">{waiting}</span>}</button>
        ))}
      </div>
  );
  if (owner) return (
    <div className="ac">
      <div className="page-head">
        <div>
          <span className="eyebrow">Accounts</span>
          <h1><span className="title-slogan">Your profile, sources and memory.</span><span className="title-plain">Account</span></h1>
          <p className="op-say" data-testid="text-account-say"><b>{say[0]}</b> {say[1]}</p>
        </div>
      </div>
      {tabs}
      {tab === "profile" && <OwnerProfile />}
      {tab === "sources" && <OwnerSources />}
      {tab === "memory" && <OwnerMemory />}
      {tab === "settings" && <OwnerSettings />}
      {tab === "data" && <OwnerData />}
    </div>
  );
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Accounts</span>
          <h1><span className="title-slogan">Your profile, sources and memory.</span><span className="title-plain">Account</span></h1>
          <p className="hide-phone">See exactly what Remy knows, where it came from, and change or delete it.</p>
        </div>
      </div>
      {tabs}
      {tab === "profile" && <div className="card card-pad stack"><ProfilePhoto initials={(ws!.profile.preferredName || knownName(ws!) || "S").split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase()} /><p className="xs muted">Changes here update fit and recommendations. Approved application documents are never rewritten — they're marked for your review instead.</p><ProfileForm /></div>}
      {tab === "sources" && <Sources />}
      {tab === "memory" && <Memory />}
      {tab === "settings" && <Settings />}
      {tab === "data" && <Data />}
    </>
  );
}

const OWNER_SOURCES = ["Resume", "LinkedIn"];

function Sources() {
  const { ws, config, me } = useStore();
  const w = ws!;
  const ownerView = useOwnerView();
  const [open, setOpen] = useState("");
  const signedIn = me?.kind === "google" || me?.kind === "supabase";
  const linkedin = w.imports.find((i) => /linkedin/i.test(i.kind));
  const handshake = w.imports.find((i) => /handshake/i.test(i.kind));
  const stellic = w.imports.find((i) => /stellic|tcu|degree/i.test(i.kind));
  // Each row says what's actually connected right now; "chip" overrides the status wording.
  const rows: { name: string; status: any; chip?: string; label: string; detail: string; importKind?: string }[] = [
    { name: "Resume", status: w.resume ? "Student provided" : "Needs setup", chip: w.resume ? "Added" : "Not added", label: w.resume ? `${w.resume.fileName} · ${fmtDate(w.resume.uploadedAt)}` : "Not uploaded yet", detail: "Your evidence base. Replace it anytime in Resume/CV." },
    { name: "LinkedIn", status: linkedin ? "Student provided" : "Needs setup", chip: linkedin ? "Added" : "Not added", label: linkedin ? `${linkedin.fileName} · ${fmtDate(linkedin.at)}` : "Upload your profile PDF (Resources → Save to PDF on LinkedIn)", detail: "LinkedIn doesn't let apps read profiles directly, so Remy uses the PDF you download.", importKind: "LinkedIn profile (PDF)" },
    { name: "Handshake", status: handshake ? "Student provided" : "Needs setup", chip: handshake ? "Added" : "Not added", label: handshake ? `${handshake.fileName} · ${fmtDate(handshake.at)}` : "Paste your Handshake profile or a posting", detail: "Handshake requires your login; Remy never asks for it.", importKind: "Handshake" },
    // Stellic is TCU's degree-planning tool; everyone else pastes their plan from their own school's tool.
    atTcu(me)
      ? { name: "Stellic / TCU academic", status: stellic ? "Student provided" : "Needs setup", chip: stellic ? "Added" : "Not added", label: stellic ? `${stellic.fileName} · ${fmtDate(stellic.at)}` : "Paste your degree plan from Stellic", detail: "Requirements must come from your advisor and official tools.", importKind: "Stellic / degree plan" }
      : { name: "Degree plan", status: stellic ? "Student provided" : "Needs setup", chip: stellic ? "Added" : "Not added", label: stellic ? `${stellic.fileName} · ${fmtDate(stellic.at)}` : "Paste your plan from your school's degree-planning tool", detail: "Requirements must come from your advisor and official tools.", importKind: "Degree plan" },
    // Proof the student already has: added as suggested facts they approve one by one.
    ...([
      ["Volunteer hours", "GivePulse / volunteer record", "Upload your GivePulse impact transcript (PDF) or paste your service hours", "Verified hours and organizations, for your resume and LinkedIn Volunteering."],
      ["Certificates", "Certificate", "Upload a certificate PDF or paste its text", "Name, issuer and date, so LinkedIn Licenses & certifications and your resume match."],
      ["Unofficial transcript", "Unofficial transcript", "Upload your unofficial transcript (PDF) or paste it", "Courses and honors you choose to keep. Nothing is added until you approve it."],
    ] as const).map(([name, kind, todo, detail]) => {
      const done = w.imports.find((i) => i.kind === kind);
      return { name, status: done ? "Student provided" : "Needs setup", chip: done ? "Added" : "Not added", label: done ? `${done.fileName} · ${fmtDate(done.at)}` : todo, detail, importKind: kind };
    }),
  ].filter((r) => !ownerView || OWNER_SOURCES.includes(r.name));
  // Owners (Nov 22, Dilan): imports students never use or Remy can't really do are gone; the transcript moved to setup.

  return (
    <div className="stack">
      <GoogleCalendarCard />
      <SchoolVerify />
      {rows.map((r) => (
        <div key={r.name} className="stack-sm">
          <div className="source-row" data-testid="row-source">
            <div style={{ flex: 1 }}>
              <div className="row"><strong className="small">{r.name}</strong><StatusChip label={r.status}>{r.chip}</StatusChip></div>
              <div className="small">{r.label}</div>
              <div className="xs muted">{r.detail}</div>
            </div>
            {r.importKind && <button className="btn btn-secondary btn-sm" onClick={() => setOpen(open === r.name ? "" : r.name)}>{open === r.name ? "Close" : "Import"}</button>}
          </div>
          {open === r.name && r.importKind && <ProfileImport kind={r.importKind} hint="Facts found here are added as suggestions for you to approve in AI memory." onDone={() => { setOpen(""); go("/accounts?tab=memory"); }} />}
        </div>
      ))}
      {w.imports.length > 0 && (
        <details className="card card-pad stack-sm">
          <summary className="small" style={{ cursor: "pointer" }}><b>Import history</b> <span className="muted">({w.imports.length})</span></summary>
          {w.imports.map((i) => <div key={i.id} className="small">{fmtDate(i.at)} · <strong>{i.kind}</strong> · {i.fileName}{i.factsAdded ? ` · ${i.factsAdded} fact(s) suggested` : ""}</div>)}
        </details>
      )}
    </div>
  );
}

const CATS: MemoryFact["category"][] = ["background", "goal", "preference", "skill", "experience", "constraint", "other"];

function Memory() {
  const { ws, save, run } = useStore();
  const w = ws!;
  const [edit, setEdit] = useState<MemoryFact | null>(null);
  const put = (list: MemoryFact[], msg?: string) => run(() => save("memory", list), msg);
  const suggested = w.memory.filter((m) => m.status === "suggested");
  const approved = w.memory.filter((m) => m.status === "approved");
  return (
    <div className="stack">
      <div className="notice small"><div>Remy uses <strong>facts</strong> — not your chat history — when drafting and recommending, and its claim checker treats them as true. Answers you typed yourself (in setup, interview stories or while tailoring) are saved here automatically because they're your own words. If one isn't right anymore, edit or delete it.</div></div>
      {suggested.length > 0 && (
        <div className="card card-pad stack-sm">
          <h3>Waiting for your approval · {suggested.length}</h3>
          {suggested.map((m) => (
            <div key={m.id} className="item">
              <div className="item-main stack-sm"><div><span className="small">{m.text}</span><div className="why">{m.source}</div></div>{m.conflict && <ConflictChoice fact={m} />}</div>
              {!m.conflict && <button className="btn btn-primary btn-sm" onClick={() => put(w.memory.map((x) => (x.id === m.id ? { ...x, status: "approved" } : x)), "Approved")} data-testid="button-approve-memory"><Check size={14} /> Approve</button>}
              <button className="icon-btn" onClick={() => put(w.memory.filter((x) => x.id !== m.id), "Removed")} aria-label="Delete"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="card card-pad stack-sm mem-card">
        <div className="row-between"><h3>Approved facts · {approved.length}</h3><button className="btn btn-secondary btn-sm" onClick={() => setEdit({ id: rid("f"), text: "", category: "other", source: "Added by you", status: "approved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} data-testid="button-add-memory">Add a fact</button></div>
        {approved.length ? approved.map((m) => (
          <div key={m.id} className="item" data-testid="row-memory">
            <div className="item-main"><span className="small">{m.text}</span><div className="why"><span className="chip chip-plain">{m.category}</span> {m.source} · {fmtDate(m.updatedAt)}</div></div>
            <button className="icon-btn" onClick={() => setEdit(m)} aria-label="Edit"><Pencil size={15} /></button>
            <button className="icon-btn" onClick={() => put(w.memory.filter((x) => x.id !== m.id), "Forgotten")} aria-label="Delete" data-testid="button-delete-memory"><Trash2 size={15} /></button>
          </div>
        )) : <span className="small muted">Nothing yet. Answers from onboarding, facts you approve from imports, and things you tell Remy to remember appear here.</span>}
      </div>
      {edit && (
        <Modal title={w.memory.some((x) => x.id === edit.id) ? "Edit fact" : "Add a fact"} onClose={() => setEdit(null)}>
          <label className="field"><span>Fact</span><textarea className="textarea" value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} data-testid="input-memory-text" /></label>
          <label className="field"><span>Category</span><select className="select" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as MemoryFact["category"] })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={!edit.text.trim()} onClick={async () => { await put(w.memory.some((x) => x.id === edit.id) ? w.memory.map((x) => (x.id === edit.id ? edit : x)) : [...w.memory, edit], "Saved"); setEdit(null); }} data-testid="button-save-memory">Save</button></div>
        </Modal>
      )}
    </div>
  );
}

function Settings() {
  const { ws, save } = useStore();
  const ownerView = useOwnerView(); // match emails: redesign stage 5, owners first
  const s = ws!.settings;
  const toggle = (k: keyof typeof s.notify) => save("settings", { notify: { ...s.notify, [k]: !s.notify[k] } });
  return (
    <div className="grid-2 acc-settings" style={{ alignItems: "start" }}>
      <div className="card card-pad stack">
        <h3>Theme</h3>
        <ThemeChoice />
        <h3>Weekly career time</h3>
        <CareerTime compact />
        <h3>Assistant</h3>
        <label className="row small"><input type="checkbox" checked={s.assistantOpen} onChange={() => save("settings", { assistantOpen: !s.assistantOpen })} /> Keep Remy open (you can always minimize him from his panel)</label>
      </div>
      <div className="card card-pad stack">
        <h3>Reminders</h3>
        <p className="xs muted">Emails go to your application email (or your sign-in email). Guest accounts don't get emails.</p>
        {([["deadlines", "Deadline reminder emails (3 days before and on the day)"], ["weeklyPlan", "Weekly digest email: new openings and deadlines, on your career-time day"]] as const).map(([k, l]) => (
          <label key={k} className="row small"><input type="checkbox" checked={s.notify[k]} onChange={() => toggle(k)} data-testid={`toggle-${k}`} /> {l}</label>
        ))}
        {ownerView && (
          <label className="field">
            <span>Emails about a new opening that fits you, with a Yes button that starts tailoring</span>
            <select className="select" value={s.nudges || "weekly"} onChange={(e) => save("settings", { nudges: e.target.value as "daily" | "weekly" | "off" })} data-testid="select-nudges">
              <option value="daily">At most once a day</option>
              <option value="weekly">At most once a week</option>
              <option value="off">Off</option>
            </select>
          </label>
        )}
        {ownerView && <UrgentTexts />}
      </div>
    </div>
  );
}

/** Opt-in texts for urgent deadlines (redesign stage 5, owners first). The number is saved when it's valid. */
function UrgentTexts() {
  const { ws, save, toast } = useStore();
  const t = ws!.settings.texts || { on: false, phone: "" };
  const [phone, setPhone] = useState(t.phone);
  const valid = (p: string) => { const d = p.replace(/\D/g, ""); return /^1?[2-9]\d{2}[2-9]\d{6}$/.test(d); };
  const keep = (next: { on: boolean; phone: string }) => {
    if (next.on && !valid(next.phone)) { toast("Add a US phone number first, like (817) 555-0123.", true); return; }
    save("settings", { texts: next });
  };
  return (
    <div className="stack-sm" data-testid="urgent-texts">
      <label className="row small"><input type="checkbox" checked={t.on} onChange={() => keep({ on: !t.on, phone })} data-testid="toggle-texts" /> Text me when an application closes today or tomorrow (at most one text a day)</label>
      <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(817) 555-0123" aria-label="Phone number for urgent texts" value={phone}
        onChange={(e) => setPhone(e.target.value)} onBlur={() => { if (phone !== t.phone && (phone === "" || valid(phone))) keep({ on: t.on && phone !== "", phone }); }} data-testid="input-text-phone" />
      {phone && !valid(phone) && <span className="xs bad">Use a US number with area code.</span>}
    </div>
  );
}

function Data() {
  const { ws, me, config, setSession, setWs, run, toast, refresh } = useStore();
  const owner = useOwnerView();
  const [confirm, setConfirm] = useState(false);
  const google = useGoogleButton(async (credential) => {
    const r = await run(() => api("POST", "/api/auth/google", { credential }), "Signed in with Google");
    if (r) setSession(r.me, r.workspace);
  });
  const signOut = async () => { await run(() => api("POST", "/api/auth/logout")); await refresh(); };
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card card-pad stack">
        <h3>Account</h3>
        <dl className="kv">
          {/* Owners (Nov 23 PM review): "Signed in (email)" then "Email: email" said it twice; dates read "Nov 23, 2026, 2:38 PM" like the rest of Remy. */}
          <dt>Type</dt><dd>{me?.kind === "supabase" ? (owner ? "Signed in with email" : `Signed in (${me.email})`) : me?.kind === "google" ? "Google account" : me?.kind === "visitor" ? "Private preview workspace (this browser)" : "Demo workspace (this browser)"}</dd>
          {me?.email && <><dt>Email</dt><dd>{me.email}</dd></>}
          <dt>Last saved</dt><dd>{owner ? new Date(ws!.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : new Date(ws!.updatedAt).toLocaleString()}</dd>
        </dl>
        {(me?.kind === "guest" || me?.kind === "visitor") && <span className="small muted">You're using a demo account. Sign out, then sign in with Google or email on the home page to keep your work across devices.</span>}
        {(me?.kind === "google" || me?.kind === "supabase" || me?.kind === "guest") && <div><button className="btn btn-secondary btn-sm" onClick={signOut} data-testid="button-sign-out"><LogOut size={14} /> Sign out</button></div>}
      </div>
      <div className="card card-pad stack">
        <h3>Your data</h3>
        <p className="small muted">Your workspace is stored on the Remy server and only returned to your own session. Other visitors can't see it.</p>
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={() => download("/api/export/data", "remy-my-data.json").catch((e) => toast(e.message, true))} data-testid="button-export-data"><Download size={14} /> Download my data</button>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirm(true)} data-testid="button-delete-data"><Trash2 size={14} /> Delete everything</button>
        </div>
        <p className="xs muted"><a href="/policies">Privacy & terms</a> · <a href="/about">About Remy</a></p>
        <details>
        <summary className="small" style={{ cursor: "pointer", marginTop: 8 }}><b>AI activity</b> <span className="muted">(technical log)</span></summary>
        <div className="stack-sm" style={{ maxHeight: 240, overflow: "auto", marginTop: 6 }}>
          {ws!.aiLog.length ? [...ws!.aiLog].reverse().slice(0, 40).map((l) => <div key={l.id} className="xs"><span className={l.ok ? "pass" : "fail"}>●</span> {new Date(l.at).toLocaleString()} · {l.purpose} · {(l.ms / 1000).toFixed(1)}s{l.note ? ` · ${l.note}` : ""}</div>) : <span className="xs muted">No AI calls yet.</span>}
        </div>
        </details>
      </div>
      {confirm && <DeleteModal onClose={() => setConfirm(false)} />}
    </div>
  );
}

// ---------- Owners (Nov 24, Dilan approved the account-settings-v2 mockups): the same look as the redesigned pages ----------

const initialsOf = (w: Workspace) => (w.profile.preferredName || knownName(w) || "S").split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase();
/** Fields the profile meter counts: the ones Remy uses to pick and tailor openings. */
const MEASURED: (keyof Workspace["profile"])[] = ["path", "goal", "name", "preferredName", "applicationEmail", "school", "major", "classYear", "graduation", "location", "targetRoles", "regions", "opportunityTypes", "workAuth"];
/** How Remy's nudge names a missing field. */
const NUDGE: Partial<Record<keyof Workspace["profile"], string>> = { path: "where you are right now", goal: "what you're working toward", name: "your full name", preferredName: "what I should call you", applicationEmail: "your application email", school: "your school", major: "your major", classYear: "your class year", graduation: "when you graduate", location: "where you live", targetRoles: "roles you're curious about", regions: "where I should look", opportunityTypes: "the kinds of openings you want", workAuth: "your work authorization" };
const shortDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const pathLabel = (v: string) => PATHS.find(([k]) => k === v)?.[1] || "";

/** Remy's line under "Account": a bold fact about this tab, then why it matters. */
export function ownerSay(tab: Tab, w: Workspace): [string, string] {
  if (tab === "sources") {
    const n = [!!w.resume, w.imports.some((i) => /linkedin/i.test(i.kind))].filter(Boolean).length;
    return w.resume ? [`${n} of 2 files added.`, "Remy works from what you add here, nothing else."] : ["Your resume isn't here yet.", "It's the one Remy needs most."];
  }
  if (tab === "memory") {
    const n = w.memory.filter((m) => m.status === "approved").length;
    return [`${n} ${n === 1 ? "thing" : "things"} Remy knows about you.`, "He only uses facts you approved, never your chat history."];
  }
  if (tab === "settings") {
    const s = w.settings;
    const on = [s.notify.deadlines && "deadline reminders", s.notify.weeklyPlan && "a weekly digest", (s.nudges || "weekly") !== "off" && "openings that fit"].filter(Boolean) as string[];
    return on.length ? [`Remy emails you about ${on.join(", ").replace(/, ([^,]*)$/, " and $1")}.`, "Change any of it below."] : ["Remy won't email you.", "Turn reminders back on below whenever you like."];
  }
  if (tab === "data") return ["Your data is yours.", "Download it or delete it anytime."];
  return ["Remy picks openings from this page.", "The more he knows, the better your matches."];
}

function OwnerProfile() {
  const { ws } = useStore();
  const w = ws!;
  const p = w.profile;
  const [editing, setEditing] = useState(false);
  const filled = MEASURED.filter((k) => String(p[k] || "").trim()).length;
  const missing = MEASURED.find((k) => !String(p[k] || "").trim());
  const label = (k: keyof typeof p) => PROFILE_FIELDS.find(([f]) => f === k)?.[1] || k;
  const line = [p.major, p.classYear && `${p.classYear}${p.school ? ` at ${p.school}` : ""}`, p.graduation].filter(Boolean).join(" · ");
  const val = (k: keyof typeof p) => (k === "path" ? pathLabel(p.path || "") : String(p[k] || ""));
  const groups: [string, (keyof typeof p)[]][] = [
    ["About you", ["name", "preferredName", "school", "major", "minors", "gpa", "classYear"]],
    ["What you want", ["path", "goal", "targetRoles", "opportunityTypes", "dreamEmployers", "avoid"]],
    ["Where and when", ["regions", "location", "graduation", "timeline", "workAuth", "applicationEmail"]],
  ];
  return (
    <div className="stack">
      <div className="ac-top">
        <div className="card card-pad ac-id">
          <div className="ac-me"><div className="ac-av-photo"><ProfilePhoto initials={initialsOf(w)} /></div><div><b>{p.name || knownName(w) || "Your name"}</b><small>{line || "Add your school and major"}</small></div></div>
          <div className="ac-meter">
            <div><span>Profile filled in</span><span data-testid="text-profile-filled">{filled} of {MEASURED.length}</span></div>
            <div className="ac-bar"><i style={{ width: `${Math.round((filled / MEASURED.length) * 100)}%` }} /></div>
            <span className="xs muted">Changes update your fit. Approved documents are never rewritten; they're marked for your review.</span>
          </div>
        </div>
        {missing && !editing
          ? <div className="ac-nudge"><img src="/remy-scholar.svg" alt="" /><div><span className="ac-kick">Remy's nudge</span><b>Add {NUDGE[missing]}.</b><span>It helps me pick openings that fit you.</span></div><button className="btn btn-primary btn-sm" onClick={() => setEditing(true)} data-testid="button-profile-nudge">Add it</button></div>
          : <div className="card card-pad ac-photo"><p className="small muted" style={{ margin: 0 }}><b>Your profile is complete.</b> Keep it current when your plans change, and Remy's picks follow.</p></div>}
      </div>
      {editing ? (
        <div className="card card-pad stack">
          <div className="row-between"><h3>Edit your profile</h3><button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} data-testid="button-profile-done">Done</button></div>
          <ProfileForm onSaved={() => setEditing(false)} />
        </div>
      ) : (
        <div className="card card-pad ac-three" data-testid="profile-read">
          {groups.map(([title, keys]) => (
            <div key={title}>
              <div className="ac-sec">{title}</div>
              {keys.map((k) => (
                <div key={k} className="ac-f">
                  <div><small>{label(k)}</small>{val(k) ? <b>{val(k)}</b> : <b className="ac-empty">Add</b>}</div>
                  <button className="icon-btn" onClick={() => setEditing(true)} aria-label={`Edit ${label(k)}`} data-testid={`button-edit-${k}`}><Pencil size={14} /></button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerSources() {
  const { ws } = useStore();
  const w = ws!;
  const [open, setOpen] = useState(false);
  const gcal = useGoogleCalendar();
  const linkedin = w.imports.find((i) => /linkedin/i.test(i.kind));
  return (
    <div className="ac-grid ac-grid-src">
      <div className="stack">
        {!w.resume && <div className="ac-nudge"><img src="/remy-scholar.svg" alt="" /><div><span className="ac-kick">Remy's nudge</span><b>Add your resume first.</b><span>Every rewrite and fit score starts from it.</span></div><button className="btn btn-primary btn-sm" onClick={() => go("/resume")} data-testid="button-sources-resume"><Upload size={14} /> Upload resume</button></div>}
        <div className="ac-srcs">
          <div className={"ac-src" + (w.resume ? "" : " off")} data-testid="row-source">
            <div className="top"><span className="ac-mono a">CV</span><div><b>Resume</b><small>{w.resume ? `${w.resume.fileName} · ${fmtDate(w.resume.uploadedAt)}` : "Not uploaded yet"}</small></div><span className={"ac-st " + (w.resume ? "on" : "no")}>{w.resume ? "Added" : "Not added"}</span></div>
            <p>Your evidence base. Replace it anytime in Resume/CV.</p>
            <div className="foot"><span className="xs muted">Word or PDF</span><button className="btn btn-secondary btn-sm" onClick={() => go("/resume")} data-testid="button-source-resume">{w.resume ? "Open" : "Upload"}</button></div>
          </div>
          <div className={"ac-src" + (linkedin ? "" : " off")} data-testid="row-source">
            <div className="top"><span className="ac-mono b">in</span><div><b>LinkedIn</b><small>{linkedin ? `${linkedin.fileName} · ${fmtDate(linkedin.at)}` : "Not added yet"}</small></div><span className={"ac-st " + (linkedin ? "on" : "no")}>{linkedin ? "Added" : "Not added"}</span></div>
            <p>LinkedIn doesn't let apps read profiles, so Remy uses the PDF you download.</p>
            <div className="foot"><span className="xs muted">LinkedIn → Resources → Save to PDF</span><button className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)} data-testid="button-source-linkedin">{open ? "Close" : linkedin ? "Replace" : "Import"}</button></div>
          </div>
          {gcal.available && (
            <div className={"ac-src" + (gcal.connected ? "" : " off")} data-testid="row-source-calendar">
              <div className="top"><span className="ac-mono c">31</span><div><b>Google Calendar</b><small>{gcal.connected ? "A calendar called “Remy”" : "Not connected"}</small></div><span className={"ac-st " + (gcal.connected ? "on" : "no")}>{gcal.connected ? "Connected" : "Off"}</span></div>
              <p>Your Remy deadlines and events show up in your own calendar.</p>
              <div className="foot"><span className="xs muted">Remy only writes to its own calendar</span>
                {gcal.connected
                  ? <button className="btn btn-secondary btn-sm" disabled={gcal.busy} onClick={gcal.disconnect} data-testid="button-source-gcal-off">Disconnect</button>
                  : <button className="btn btn-secondary btn-sm" disabled={gcal.busy || !gcal.signedIn} onClick={() => gcal.connect("calendar")} data-testid="button-source-gcal">Connect</button>}
              </div>
            </div>
          )}
          <div className="ac-src ac-school"><SchoolVerify /></div>
        </div>
        {open && <ProfileImport kind="LinkedIn profile (PDF)" hint="Facts found here are added as suggestions for you to approve in AI memory." onDone={() => { setOpen(false); go("/accounts?tab=memory"); }} />}
      </div>
      <div className="card card-pad">
        <div className="row-between"><h3>Import history</h3><span className="xs muted">{w.imports.length} {w.imports.length === 1 ? "import" : "imports"}</span></div>
        {w.imports.length ? (
          <ul className="ac-tl" data-testid="list-imports">
            {[...w.imports].reverse().slice(0, 6).map((i) => <li key={i.id}><div><b>{i.kind}</b><small>{i.fileName}{i.factsAdded ? ` · ${i.factsAdded} fact${i.factsAdded === 1 ? "" : "s"} suggested` : ""}</small></div><em>{fmtDate(i.at)}</em></li>)}
          </ul>
        ) : <p className="small muted">Nothing imported yet. Your LinkedIn PDF shows up here.</p>}
        <p className="small muted ac-foot">Facts found in an import are only suggestions. Nothing is used until you approve it in AI memory.</p>
      </div>
    </div>
  );
}

const CAT_CLASS: Record<string, string> = { goal: "goal", experience: "exp", preference: "pref", skill: "skill", constraint: "con", background: "bg", other: "bg" };
const FILTERS: [string, string, MemoryFact["category"][]][] = [["all", "All", []], ["goal", "Goals", ["goal"]], ["experience", "Experience", ["experience", "background"]], ["skill", "Skills", ["skill"]], ["other", "Other", ["preference", "constraint", "other"]]];

function OwnerMemory() {
  const { ws, save, run } = useStore();
  const w = ws!;
  const [edit, setEdit] = useState<MemoryFact | null>(null);
  const [filter, setFilter] = useState("all");
  const put = (list: MemoryFact[], msg?: string) => run(() => save("memory", list), msg);
  const suggested = w.memory.filter((m) => m.status === "suggested");
  const approved = w.memory.filter((m) => m.status === "approved");
  const cats = FILTERS.find(([k]) => k === filter)![2];
  const shown = cats.length ? approved.filter((m) => cats.includes(m.category)) : approved;
  const own = approved.filter((m) => /you|setup|answer|interview|tailor/i.test(m.source)).length;
  return (
    <div className="ac-grid ac-grid-mem">
      <div className="stack">
        {suggested.length > 0 && (
          <div className="ac-nudge ac-nudge-list" data-testid="memory-waiting">
            <div className="row" style={{ gap: 10 }}><img src="/remy-scholar.svg" alt="" /><div><span className="ac-kick">Waiting for your OK · {suggested.length}</span><b>Keep what's true, delete the rest.</b></div></div>
            <div className="ac-wait">
              {suggested.map((m) => (
                <div key={m.id}>
                  <div className="stack-sm"><div><b>{m.text}</b><small>{m.source}</small></div>{m.conflict && <ConflictChoice fact={m} />}</div>
                  <div className="row" style={{ gap: 6 }}>
                    {!m.conflict && <button className="btn btn-primary btn-sm" onClick={() => put(w.memory.map((x) => (x.id === m.id ? { ...x, status: "approved" } : x)), "Approved")} data-testid="button-approve-memory"><Check size={14} /> Keep</button>}
                    <button className="icon-btn" onClick={() => put(w.memory.filter((x) => x.id !== m.id), "Removed")} aria-label="Delete" data-testid="button-remove-suggested"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="ac-tiles"><div className="ac-tile c"><b>{approved.length}</b><span>Approved facts</span></div><div className="ac-tile b"><b>{own}</b><span>From your own words</span></div></div>
        <p className="small muted" style={{ margin: 0 }}>Remy uses facts, not your chat history, when drafting and recommending, and his claim checker treats them as true. Answers you type yourself are saved here automatically. If one isn't true anymore, edit or delete it.</p>
      </div>
      <div className="card card-pad">
        <div className="row-between"><h3>What Remy knows</h3><button className="btn btn-secondary btn-sm" onClick={() => setEdit({ id: rid("f"), text: "", category: "other", source: "Added by you", status: "approved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} data-testid="button-add-memory"><Plus size={14} /> Add a fact</button></div>
        <div className="seg ac-filter" role="group" aria-label="Filter facts">
          {FILTERS.map(([k, l, c]) => { const n = c.length ? approved.filter((m) => c.includes(m.category)).length : approved.length; return <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`filter-memory-${k}`}>{l} <em>{n}</em></button>; })}
        </div>
        <div className="ac-facts">
          {shown.length ? shown.map((m) => (
            <div key={m.id} className="ac-fact" data-testid="row-memory">
              <div><b>{m.text}</b><small><span className={"ac-cat " + (CAT_CLASS[m.category] || "bg")}>{m.category}</span>{m.source} · {shortDate(m.updatedAt)}</small></div>
              <div className="row" style={{ gap: 4 }}>
                <button className="icon-btn" onClick={() => setEdit(m)} aria-label="Edit" data-testid="button-edit-memory"><Pencil size={15} /></button>
                <button className="icon-btn" onClick={() => put(w.memory.filter((x) => x.id !== m.id), "Forgotten")} aria-label="Delete" data-testid="button-delete-memory"><Trash2 size={15} /></button>
              </div>
            </div>
          )) : <span className="small muted" style={{ gridColumn: "1 / -1", paddingTop: 10 }}>{approved.length ? "Nothing in this group yet." : "Nothing yet. Answers from setup, facts you approve from imports, and things you tell Remy to remember appear here."}</span>}
        </div>
      </div>
      {edit && <FactModal fact={edit} exists={w.memory.some((x) => x.id === edit.id)} onChange={setEdit} onClose={() => setEdit(null)} onSave={async () => { await put(w.memory.some((x) => x.id === edit.id) ? w.memory.map((x) => (x.id === edit.id ? edit : x)) : [...w.memory, edit], "Saved"); setEdit(null); }} />}
    </div>
  );
}

function FactModal({ fact, exists, onChange, onClose, onSave }: { fact: MemoryFact; exists: boolean; onChange: (f: MemoryFact) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal title={exists ? "Edit fact" : "Add a fact"} onClose={onClose}>
      <label className="field"><span>Fact</span><textarea className="textarea" value={fact.text} onChange={(e) => onChange({ ...fact, text: e.target.value })} data-testid="input-memory-text" /></label>
      <label className="field"><span>Category</span><select className="select" value={fact.category} onChange={(e) => onChange({ ...fact, category: e.target.value as MemoryFact["category"] })} data-testid="select-memory-category">{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
      <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={!fact.text.trim()} onClick={onSave} data-testid="button-save-memory">Save</button></div>
    </Modal>
  );
}

function Switch({ on, onChange, label, testid }: { on: boolean; onChange: () => void; label: string; testid: string }) {
  return <input type="checkbox" role="switch" className="ac-sw" checked={on} onChange={onChange} aria-label={label} data-testid={testid} />;
}

function OwnerSettings() {
  const { ws, save } = useStore();
  const s = ws!.settings;
  const toggle = (k: keyof typeof s.notify) => save("settings", { notify: { ...s.notify, [k]: !s.notify[k] } });
  return (
    <div className="ac-grid ac-grid-even">
      <div className="stack">
        <div className="card card-pad stack-sm">
          <h3>Look and feel</h3>
          <ThemeChoice />
          <div className="ac-set">
            <div><div><b>Keep Remy open</b><small>His panel stays beside every page. You can always minimize him.</small></div><Switch on={s.assistantOpen} onChange={() => save("settings", { assistantOpen: !s.assistantOpen })} label="Keep Remy open" testid="toggle-assistant-open" /></div>
          </div>
        </div>
        <div className="card card-pad stack-sm">
          <div className="row-between"><h3>Weekly career time</h3><span className="xs muted">Remy plans around it</span></div>
          <p className="small muted" style={{ margin: 0 }}>45 minutes a week is plenty. Your weekly digest arrives then too.</p>
          <CareerTime compact />
        </div>
      </div>
      <div className="card card-pad stack-sm">
        <div className="row-between"><h3>How Remy reaches you</h3></div>
        <div className="ac-set">
          <div><div><b>Deadline reminders</b><small>Email 3 days before and on the day</small></div><Switch on={s.notify.deadlines} onChange={() => toggle("deadlines")} label="Deadline reminder emails" testid="toggle-deadlines" /></div>
          <div><div><b>Weekly digest</b><small>New openings and deadlines, on your career-time day</small></div><Switch on={s.notify.weeklyPlan} onChange={() => toggle("weeklyPlan")} label="Weekly digest email" testid="toggle-weeklyPlan" /></div>
          <div><div><b>Openings that fit you</b><small>An email with a Yes button that starts tailoring</small></div>
            <select className="select ac-select" value={s.nudges || "weekly"} onChange={(e) => save("settings", { nudges: e.target.value as "daily" | "weekly" | "off" })} aria-label="Emails about openings that fit you" data-testid="select-nudges">
              <option value="daily">At most daily</option><option value="weekly">At most weekly</option><option value="off">Off</option>
            </select></div>
        </div>
        <UrgentTexts />
        <p className="xs muted" style={{ margin: 0 }}>Emails go to your application email, or your sign-in email if you haven't added one.</p>
      </div>
    </div>
  );
}

function OwnerData() {
  const { ws, me, run, refresh, toast } = useStore();
  const [confirm, setConfirm] = useState(false);
  const w = ws!;
  const signOut = async () => { await run(() => api("POST", "/api/auth/logout")); await refresh(); };
  const when = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="ac-grid ac-grid-even">
      <div className="stack">
        <div className="card card-pad stack-sm">
          <div className="ac-me"><div className="ac-av"><Avatar initials={initialsOf(w)} /></div><div><b>{w.profile.name || me?.name || "Your account"}</b><small>{me?.kind === "google" ? "Signed in with Google" : me?.kind === "supabase" ? "Signed in with email" : "Demo workspace (this browser)"}</small></div>
            {(me?.kind === "google" || me?.kind === "supabase" || me?.kind === "guest") && <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={signOut} data-testid="button-sign-out"><LogOut size={14} /> Sign out</button>}
          </div>
          <dl className="ac-kv">
            {me?.email && <><dt>Email</dt><dd>{me.email}</dd></>}
            <dt>Last saved</dt><dd>{new Date(w.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
          </dl>
        </div>
        <div className="ac-acts">
          <button className="ac-act" onClick={() => download("/api/export/data", "remy-my-data.json").catch((e) => toast(e.message, true))} data-testid="button-export-data"><Download size={18} /><b>Download my data</b><small>Everything, as one file</small></button>
          <a className="ac-act" href="/policies" data-testid="link-policies"><Lock size={18} /><b>Privacy & terms</b><small>What Remy stores and why</small></a>
          <a className="ac-act" href="/about" data-testid="link-about"><Info size={18} /><b>About Remy</b><small>Who builds it</small></a>
        </div>
        <div className="card card-pad ac-danger">
          <div><b>Delete everything</b><small>Your resume, applications, memory and account, for good. This can't be undone.</small></div>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirm(true)} data-testid="button-delete-data"><Trash2 size={14} /> Delete</button>
        </div>
      </div>
      <div className="card card-pad">
        <div className="row-between"><h3>What Remy's AI did</h3><span className="xs muted">latest {Math.min(w.aiLog.length, 8)}</span></div>
        {w.aiLog.length ? (
          <ul className="ac-log" data-testid="list-ai-log">
            {[...w.aiLog].reverse().slice(0, 8).map((l) => <li key={l.id}><i className={l.ok ? "" : "x"} aria-label={l.ok ? "Worked" : "Didn't work"} /><span>{l.purpose}{l.note ? ` · ${l.note}` : ""}</span><em>{when(l.at)} · {(l.ms / 1000).toFixed(1)}s</em></li>)}
          </ul>
        ) : <p className="small muted">No AI calls yet.</p>}
        <p className="small muted ac-foot">Your workspace is only returned to your own session. Every AI rewrite is checked against your approved facts before you see it.</p>
      </div>
      {confirm && <DeleteModal onClose={() => setConfirm(false)} />}
    </div>
  );
}

function DeleteModal({ onClose }: { onClose: () => void }) {
  const { run, toast, setSession } = useStore();
  return (
    <Modal title="Delete everything?" onClose={() => onClose()}>
          <p className="small">This permanently deletes your resume, applications, approved versions, memory, tracker, calendar, verified school email, your sign-in record and your Remy account (name, email, photo), deletes the “Remy” calendar from your Google Calendar if you connected it, then signs you out. Remy keeps nothing that identifies you. Downloaded files on your device aren't affected.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => onClose()}>Cancel</button>
            <button className="btn btn-danger" onClick={async () => { const r = await run(() => api<{ deleted: boolean; loginRemoved: boolean; calendarRemoved: boolean }>("DELETE", "/api/ws")); if (r) { const left = [!r.loginRemoved && "your sign-in record couldn't be removed automatically (email the Remy team and we'll remove it)", !r.calendarRemoved && "Google wouldn't let Remy delete its calendar, so delete “Remy” in Google Calendar yourself"].filter(Boolean); toast(left.length ? `Your Remy data was deleted, but ${left.join(", and ")}.` : "Everything was deleted and you're signed out", !!left.length); onClose(); setSession(null, null); } }} data-testid="button-confirm-delete">Delete permanently</button>
          </div>
        </Modal>
  );
}
