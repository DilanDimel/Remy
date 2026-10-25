import { useState } from "react";
import { Check, Download, LogOut, Pencil, Trash2 } from "lucide-react";
import type { MemoryFact, Workspace } from "@shared/types";
import { api, download, fmtDate, rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { Modal, StatusChip } from "../components/common";
import { ProfileForm } from "./Onboarding";
import { useGoogleButton } from "./Welcome";
import { ProfileImport } from "../components/Uploaders";
import { GoogleCalendarCard } from "../components/GoogleCalendar";
import { atAlumniSchool, SchoolVerify, schoolVerified } from "../components/SchoolVerify";

type Tab = "profile" | "sources" | "memory" | "settings" | "data";

export default function Accounts({ query }: { query: URLSearchParams }) {
  const tab = (query.get("tab") as Tab) || "profile";
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Accounts</span>
          <h1>Your profile, sources and memory.</h1>
          <p>See exactly what Remy knows, where it came from, and change or delete it.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {([["profile", "Profile"], ["sources", "Connected sources"], ["memory", "AI memory"], ["settings", "Appearance & alerts"], ["data", "Account & data"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/accounts?tab=${k}`)} data-testid={`tab-accounts-${k}`}>{l}</button>
        ))}
      </div>
      {tab === "profile" && <div className="card card-pad stack"><p className="xs muted">Changes here update fit and recommendations. Approved application documents are never rewritten — they're marked for your review instead.</p><ProfileForm /></div>}
      {tab === "sources" && <Sources />}
      {tab === "memory" && <Memory />}
      {tab === "settings" && <Settings />}
      {tab === "data" && <Data />}
    </>
  );
}

function Sources() {
  const { ws, config, me } = useStore();
  const w = ws!;
  const [open, setOpen] = useState("");
  const signedIn = me?.kind === "google" || me?.kind === "supabase";
  const linkedin = w.imports.find((i) => /linkedin/i.test(i.kind));
  const handshake = w.imports.find((i) => /handshake/i.test(i.kind));
  const stellic = w.imports.find((i) => /stellic|tcu|degree/i.test(i.kind));
  // Each row says what's actually connected right now; "chip" overrides the status wording.
  const rows: { name: string; status: any; chip?: string; label: string; detail: string; importKind?: string }[] = [
    { name: "Sign-in", status: signedIn ? "Live" : "Needs setup", chip: signedIn ? "Signed in" : "Demo account", label: signedIn ? `Signed in as ${me!.email}` : "You're using a demo account", detail: signedIn ? "Sign-in only (name, email, photo). Remy doesn't read your Gmail or calendar." : "Sign in with Google or email to keep your work across devices." },
    { name: "AI assistant", status: config?.ai.available ? "Live" : "Needs setup", chip: config?.ai.available ? "On" : "Off", label: config?.ai.available ? "On" : "Not set up on this server", detail: "Used for resume reading, tailoring, plans, chat, outreach drafts and email classification." },
    { name: "Resume", status: w.resume ? "Student provided" : "Needs setup", chip: w.resume ? "Added" : "Not added", label: w.resume ? `${w.resume.fileName} · ${fmtDate(w.resume.uploadedAt)}` : "Not uploaded yet", detail: "Your evidence base. Replace it anytime in Resume/CV." },
    { name: "LinkedIn", status: linkedin ? "Student provided" : "Needs setup", chip: linkedin ? "Added" : "Not added", label: linkedin ? `${linkedin.fileName} · ${fmtDate(linkedin.at)}` : "Upload your profile PDF (Resources → Save to PDF on LinkedIn)", detail: "LinkedIn doesn't let apps read profiles directly, so Remy uses the PDF you download.", importKind: "LinkedIn profile (PDF)" },
    { name: "Handshake", status: handshake ? "Student provided" : "Needs setup", chip: handshake ? "Added" : "Coming soon", label: handshake ? `${handshake.fileName} · ${fmtDate(handshake.at)}` : "Direct connection coming soon · you can paste profile or posting text now", detail: "Handshake requires your login; Remy never asks for it.", importKind: "Handshake" },
    { name: "Stellic / TCU academic", status: stellic ? "Student provided" : "Needs setup", chip: stellic ? "Added" : "Coming soon", label: stellic ? `${stellic.fileName} · ${fmtDate(stellic.at)}` : "Direct connection coming soon · you can paste your degree plan now", detail: "Requirements must come from your advisor and official tools.", importKind: "Stellic / degree plan" },
    { name: "Email inbox", status: "Needs setup", chip: "Coming soon", label: "Paste recruiting emails in Progress for now", detail: "Remy doesn't read your inbox. Sample emails are labeled as demos." },
  ];

  return (
    <div className="stack">
      <GoogleCalendarCard />
      {(atAlumniSchool(w) || schoolVerified(me, config?.schoolEmail.domains || [])) && <SchoolVerify />}
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
        <div className="card card-pad stack-sm">
          <h3>Import history</h3>
          {w.imports.map((i) => <div key={i.id} className="small">{fmtDate(i.at)} · <strong>{i.kind}</strong> · {i.fileName}{i.factsAdded ? ` · ${i.factsAdded} fact(s) suggested` : ""}</div>)}
        </div>
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
      <div className="notice small"><div>Remy uses <strong>approved facts</strong> — not your chat history — when drafting and recommending. The unsupported-claim checker also treats approved facts as evidence, so only approve what's true.</div></div>
      {suggested.length > 0 && (
        <div className="card card-pad stack-sm">
          <h3>Waiting for your approval · {suggested.length}</h3>
          {suggested.map((m) => (
            <div key={m.id} className="item">
              <div className="item-main"><span className="small">{m.text}</span><div className="why">{m.source}</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => put(w.memory.map((x) => (x.id === m.id ? { ...x, status: "approved" } : x)), "Approved")} data-testid="button-approve-memory"><Check size={14} /> Approve</button>
              <button className="icon-btn" onClick={() => put(w.memory.filter((x) => x.id !== m.id), "Removed")} aria-label="Delete"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="card card-pad stack-sm">
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
  const s = ws!.settings;
  const toggle = (k: keyof typeof s.notify) => save("settings", { notify: { ...s.notify, [k]: !s.notify[k] } });
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card card-pad stack">
        <h3>Theme</h3>
        <div className="seg">{(["light", "dark"] as const).map((t) => <button key={t} aria-pressed={s.theme === t} onClick={() => save("settings", { theme: t })} data-testid={`button-theme-${t}`}>{t === "light" ? "Light" : "Dark"}</button>)}</div>
        <h3>Assistant</h3>
        <label className="row small"><input type="checkbox" checked={s.assistantOpen} onChange={() => save("settings", { assistantOpen: !s.assistantOpen })} /> Keep Remy open (you can always minimize him from his panel)</label>
      </div>
      <div className="card card-pad stack">
        <h3>Reminders</h3>
        <p className="xs muted">Shown inside Remy. Email reminders are coming soon.</p>
        {([["deadlines", "Upcoming deadlines"], ["statusChanges", "Status suggestions from emails"], ["weeklyPlan", "Weekly plan nudge"]] as const).map(([k, l]) => (
          <label key={k} className="row small"><input type="checkbox" checked={s.notify[k]} onChange={() => toggle(k)} data-testid={`toggle-${k}`} /> {l}</label>
        ))}
      </div>
    </div>
  );
}

function Data() {
  const { ws, me, config, setSession, setWs, run, toast, refresh } = useStore();
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
          <dt>Type</dt><dd>{me?.kind === "supabase" ? `Signed in (${me.email})` : me?.kind === "google" ? "Google account" : me?.kind === "visitor" ? "Private preview workspace (this browser)" : "Demo workspace (this browser)"}</dd>
          {me?.email && <><dt>Email</dt><dd>{me.email}</dd></>}
          <dt>Last saved</dt><dd>{new Date(ws!.updatedAt).toLocaleString()}</dd>
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
        <p className="xs muted"><a href="#/policies">Privacy & terms</a> · <a href="#/about">About Remy</a></p>
        <h3 style={{ marginTop: 8 }}>AI activity</h3>
        <div className="stack-sm" style={{ maxHeight: 240, overflow: "auto" }}>
          {ws!.aiLog.length ? [...ws!.aiLog].reverse().slice(0, 40).map((l) => <div key={l.id} className="xs"><span className={l.ok ? "pass" : "fail"}>●</span> {new Date(l.at).toLocaleString()} · {l.purpose} · {(l.ms / 1000).toFixed(1)}s{l.note ? ` · ${l.note}` : ""}</div>) : <span className="xs muted">No AI calls yet.</span>}
        </div>
      </div>
      {confirm && (
        <Modal title="Delete everything?" onClose={() => setConfirm(false)}>
          <p className="small">This permanently deletes your resume, applications, approved versions, memory, tracker, calendar, verified school email, your sign-in record and your Remy account (name, email, photo), deletes the “Remy” calendar from your Google Calendar if you connected it, then signs you out. Remy keeps nothing that identifies you. Downloaded files on your device aren't affected.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={async () => { const r = await run(() => api<{ deleted: boolean; loginRemoved: boolean; calendarRemoved: boolean }>("DELETE", "/api/ws")); if (r) { const left = [!r.loginRemoved && "your sign-in record couldn't be removed automatically (email the Remy team and we'll remove it)", !r.calendarRemoved && "Google wouldn't let Remy delete its calendar, so delete “Remy” in Google Calendar yourself"].filter(Boolean); toast(left.length ? `Your Remy data was deleted, but ${left.join(", and ")}.` : "Everything was deleted and you're signed out", !!left.length); setConfirm(false); setSession(null, null); } }} data-testid="button-confirm-delete">Delete permanently</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
