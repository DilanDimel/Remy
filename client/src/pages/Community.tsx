import { useEffect, useState } from "react";
import { Copy, GraduationCap, Mail, MapPin, Plus, Send, Sparkles, Trash2, UserPlus } from "lucide-react";
import type { Contact, OutreachDraft, Workspace } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { Empty, Modal, Spinner, StatusChip } from "../components/common";
import { atAlumniSchool, SchoolVerify } from "../components/SchoolVerify";
import { startOutreach, useTailorSession } from "../lib/tailorChat";

type AlumMatch = { id: string; year: number | null; name: string; employer: string; industry: string; role: string; title: string; location: string; majors: string[]; score: number; why: string[] };

export default function Community() {
  const { ws, me, setWs, save, run, config } = useStore();
  const w = ws!;
  const [adding, setAdding] = useState(false);
  const [c, setC] = useState({ name: "", title: "", org: "", email: "", why: "" });
  const [review, setReview] = useState<OutreachDraft | null>(null);
  const [alumni, setAlumni] = useState<{ source: string; total: number; matches: AlumMatch[]; signInRequired?: boolean; schoolEmailRequired?: boolean; domains?: string[] } | null>(null);
  const [busyAlum, setBusyAlum] = useState("");
  const profileKey = [w.profile.major, w.profile.targetRoles, w.profile.regions, w.profile.interests, w.savedJobIds.length].join("|");
  useEffect(() => {
    let live = true;
    api<{ source: string; total: number; matches: AlumMatch[]; signInRequired?: boolean; schoolEmailRequired?: boolean; domains?: string[] }>("GET", "/api/community/alumni").then((d) => { if (live) setAlumni(d); }, () => {});
    return () => { live = false; };
  }, [profileKey, me?.id, me?.schoolEmail]);
  // When Remy finishes writing an email, open it for review.
  // Remy's "done" can arrive a render before the workspace with the new draft, so
  // look again when the drafts change, and open each draft only once.
  const convo = useTailorSession();
  const [opened, setOpened] = useState("");
  useEffect(() => {
    if (convo?.kind !== "outreach" || convo.stage !== "done" || !convo.draftId || convo.draftId === opened) return;
    const d = w.outreach.find((x) => x.id === convo.draftId);
    if (d) { setReview(d); setOpened(d.id); }
  }, [convo?.stage, convo?.draftId, w.outreach.length]);
  const toContact = async (a: AlumMatch) => {
    setBusyAlum(a.id);
    const r = await run(() => api<{ contact: Contact; workspace: Workspace }>("POST", `/api/community/alumni/${a.id}/contact`));
    if (r) setWs(r.workspace);
    setBusyAlum("");
    return r?.contact;
  };
  const draftTo = (c: Contact) => startOutreach(c);
  const loadSamples = async () => { const r = await run(() => api<Workspace>("POST", "/api/community/sample"), "Sample contacts added"); if (r) setWs(r); };
  const addContact = async () => {
    await run(() => save("contacts", [...w.contacts, { id: rid("c"), ...c, tags: [], label: "Student provided" }]), "Contact saved");
    setAdding(false);
    setC({ name: "", title: "", org: "", email: "", why: "" });
  };
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Community</span>
          <h1>A few right people.</h1>
          <p>{alumni?.schoolEmailRequired ? "People you've met who can help with your career" : "TCU alumni who match your major, interests and where you want to work"}. Remy asks you a few questions, then writes the email — you approve every word and send it yourself.</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setAdding(true)} data-testid="button-add-contact"><Plus size={16} /> Add a contact</button>
          {!w.contacts.some((x) => x.label === "Demo data") && <button className="btn btn-ghost" onClick={loadSamples} data-testid="button-sample-contacts">Load sample contacts</button>}
        </div>
      </div>
      {/* Alumni are only for TCU accounts, so other signed-in accounts don't see this section at all. */}
      {alumni?.schoolEmailRequired && atAlumniSchool(w) && <SchoolVerify />}
      {!alumni?.schoolEmailRequired && <section className="stack" data-testid="section-alumni">
        <div className="row-between">
          <h2>TCU alumni matched to you</h2>
          {alumni && <span className="xs muted">From the {alumni.source || "TCU alumni list"} · {alumni.total} alumni</span>}
        </div>
        {alumni?.signInRequired ? (
          <div className="card card-pad stack-sm" data-testid="alumni-sign-in">
            <strong>TCU students: sign in to see alumni in your field</strong>
            <p className="small muted">Sign out from the menu under your name, then choose Continue with Work/School Email and use your @tcu.edu address.</p>
          </div>
        ) : !alumni ? <div className="grid-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 150 }} />)}</div> : alumni.matches.length ? (
          <div className="grid-3">
            {alumni.matches.map((a) => {
              const saved = w.contacts.some((c) => c.id === "alum-" + a.id);
              return (
                <div key={a.id} className="card card-pad stack-sm" data-testid="card-alum">
                  <div className="row-between" style={{ alignItems: "flex-start" }}><strong>{a.name}</strong>{a.year && <span className="chip chip-plain"><GraduationCap size={12} /> {a.year}</span>}</div>
                  <span className="small">{a.title || a.role}{a.employer ? ` · ${a.employer}` : ""}</span>
                  <span className="xs muted row" style={{ gap: 4 }}><MapPin size={12} />{a.location || "Location not listed"}{a.majors.length ? ` · ${a.majors.join("/")}` : ""}</span>
                  <div className="row" style={{ gap: 6 }}>{a.why.slice(0, 3).map((x) => <span key={x} className="chip chip-live">{x}</span>)}</div>
                  <div className="row" style={{ marginTop: "auto" }}>
                    <button className="btn btn-primary btn-sm" disabled={busyAlum === a.id} onClick={async () => { const c = await toContact(a); if (c) draftTo(c); }} data-testid="button-draft-alum">{busyAlum === a.id ? <Spinner /> : <Sparkles size={14} />} Draft email</button>
                    {!saved && <button className="btn btn-ghost btn-sm" disabled={busyAlum === a.id} onClick={() => toContact(a)} data-testid="button-save-alum"><UserPlus size={14} /> Save</button>}
                    {saved && <span className="xs muted">Saved</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="card"><Empty title="No strong matches yet" body="Add your major, the fields you're interested in and where you want to work (Account → Profile), and Remy will match you with TCU alumni." /></div>}
      </section>}
      <h2>Your contacts</h2>
      {w.contacts.length ? (
        <div className="grid-3">
          {w.contacts.map((p) => (
            <div key={p.id} className="card card-pad stack-sm" data-testid="card-contact">
              <div className="row-between"><strong>{p.name}</strong><StatusChip label={p.label} /></div>
              <span className="small muted">{p.title}{p.org ? ` · ${p.org}` : ""}</span>
              <p className="small">{p.why}</p>
              <div className="row" style={{ marginTop: "auto" }}>
                <button className="btn btn-primary btn-sm" onClick={() => draftTo(p)} data-testid="button-draft-outreach"><Sparkles size={14} /> Draft email</button>
                <button className="icon-btn" onClick={() => save("contacts", w.contacts.filter((x) => x.id !== p.id))} aria-label="Remove contact"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="card"><Empty title="No contacts yet" body="Save an alum above, or add someone you've met at a career fair, in class or on LinkedIn." /></div>}

      {w.outreach.length > 0 && (
        <section className="card card-pad stack">
          <h3>Drafts</h3>
          {w.outreach.map((d) => {
            const p = w.contacts.find((x) => x.id === d.contactId);
            return (
              <div key={d.id} className="item">
                <Mail size={18} style={{ color: "var(--plum)", marginTop: 3 }} />
                <div className="item-main"><strong className="small">{d.subject}</strong><div className="why">To {p?.name} · {d.to} · {fmtDate(d.createdAt)}</div></div>
                <span className={"chip " + (d.status === "draft" ? "chip-plain" : "chip-live")}>{d.status === "draft" ? "Draft" : d.status === "approved" ? "Approved" : "Opened in your email"}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setReview(d)} data-testid="button-review-draft">Review</button>
              </div>
            );
          })}
        </section>
      )}

      {adding && (
        <Modal title="Add a contact" onClose={() => setAdding(false)}>
          <div className="grid-2">
            {(["name", "title", "org", "email"] as const).map((k) => <label key={k} className="field"><span style={{ textTransform: "capitalize" }}>{k === "org" ? "Organization" : k}</span><input className="input" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} data-testid={`input-contact-new-${k}`} /></label>)}
          </div>
          <label className="field"><span>Why this person?</span><textarea className="textarea" value={c.why} onChange={(e) => setC({ ...c, why: e.target.value })} placeholder="e.g. Met at the Neeley career fair; works in M&A" /></label>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={!c.name || !c.email} onClick={addContact} data-testid="button-save-contact">Save contact</button></div>
        </Modal>
      )}
      {review && <ReviewModal draft={review} onClose={() => setReview(null)} />}
    </>
  );
}

function ReviewModal({ draft, onClose }: { draft: OutreachDraft; onClose: () => void }) {
  const { ws, save, run, toast } = useStore();
  const w = ws!;
  const [d, setD] = useState(draft);
  const p = w.contacts.find((x) => x.id === d.contactId);
  const persist = (patch: Partial<OutreachDraft>) => {
    const next = { ...d, ...patch };
    setD(next);
    return save("outreach", w.outreach.map((x) => (x.id === d.id ? next : x)));
  };
  const mailto = `mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(d.to)}&su=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  return (
    <Modal title="Review before anything is sent" onClose={onClose} wide>
      <div className="notice small"><Send size={16} style={{ color: "var(--plum)", marginTop: 2 }} /><div>Remy doesn't send email. After you approve, it opens the message in <strong>your</strong> email so you send it yourself.</div></div>
      <dl className="kv"><dt>To</dt><dd data-testid="text-recipient">{p?.name} &lt;{d.to}&gt; {p?.label === "Demo data" && <StatusChip label="Demo data">Sample address — won't reach anyone</StatusChip>}</dd><dt>From</dt><dd>{w.profile.applicationEmail || "Your email account"}</dd></dl>
      <label className="field"><span>Subject</span><input className="input" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value, status: "draft" })} data-testid="input-outreach-subject" /></label>
      <label className="field"><span>Full message</span><textarea className="textarea" style={{ minHeight: 220 }} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value, status: "draft" })} data-testid="input-outreach-body" /></label>
      {d.linkedin && (
        <div className="field"><span>LinkedIn note (under 200 characters)</span>
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><p className="small" style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }} data-testid="text-linkedin-note">{d.linkedin}</p>
            <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(d.linkedin || ""); toast("LinkedIn note copied"); }}><Copy size={14} /> Copy</button></div>
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(`To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`); toast("Copied"); }}><Copy size={14} /> Copy</button>
        <div className="row">
          {d.status === "draft" ? (
            <button className="btn btn-primary" onClick={() => run(() => persist({ status: "approved", approvedAt: new Date().toISOString() }), "Approved")} data-testid="button-approve-outreach">Approve message</button>
          ) : (
            <>
              <a className="btn btn-secondary" href={gmail} target="_blank" rel="noreferrer" onClick={() => persist({ status: "handed-off" })} data-testid="link-open-gmail">Open in Gmail</a>
              <a className="btn btn-primary" href={mailto} onClick={() => persist({ status: "handed-off" })} data-testid="link-open-mail">Open in my email app</a>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
