import { useState } from "react";
import { Copy, Mail, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import type { Contact, OutreachDraft, Workspace } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { Empty, Modal, Spinner, StatusChip } from "../components/common";

export default function Community() {
  const { ws, setWs, save, run, config } = useStore();
  const w = ws!;
  const [adding, setAdding] = useState(false);
  const [c, setC] = useState({ name: "", title: "", org: "", email: "", why: "" });
  const [draftFor, setDraftFor] = useState<Contact | null>(null);
  const [review, setReview] = useState<OutreachDraft | null>(null);
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
          <p>Remy drafts outreach; you see exactly who it goes to and approve every word. Nothing is sent automatically.</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setAdding(true)} data-testid="button-add-contact"><Plus size={16} /> Add a contact</button>
          {!w.contacts.some((x) => x.label === "Demo data") && <button className="btn btn-ghost" onClick={loadSamples} data-testid="button-sample-contacts">Load sample contacts</button>}
        </div>
      </div>
      <div className="notice small"><StatusChip label="Demo data" /><div>Remy has no access to a verified alumni directory, so it doesn't recommend real people. Add people you know (from LinkedIn, a career fair or class) or use clearly labeled sample contacts.</div></div>
      {w.contacts.length ? (
        <div className="grid-3">
          {w.contacts.map((p) => (
            <div key={p.id} className="card card-pad stack-sm" data-testid="card-contact">
              <div className="row-between"><strong>{p.name}</strong><StatusChip label={p.label} /></div>
              <span className="small muted">{p.title}{p.org ? ` · ${p.org}` : ""}</span>
              <p className="small">{p.why}</p>
              <div className="row" style={{ marginTop: "auto" }}>
                <button className="btn btn-primary btn-sm" onClick={() => setDraftFor(p)} disabled={!config?.ai.available} data-testid="button-draft-outreach"><Sparkles size={14} /> Draft outreach</button>
                <button className="icon-btn" onClick={() => save("contacts", w.contacts.filter((x) => x.id !== p.id))} aria-label="Remove contact"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="card"><Empty title="No contacts yet" body="Add someone you'd like to learn from, or load sample contacts to try the workflow." /></div>}

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
      {draftFor && <DraftModal contact={draftFor} onClose={() => setDraftFor(null)} onDrafted={(d) => { setDraftFor(null); setReview(d); }} />}
      {review && <ReviewModal draft={review} onClose={() => setReview(null)} />}
    </>
  );
}

function DraftModal({ contact, onClose, onDrafted }: { contact: Contact; onClose: () => void; onDrafted: (d: OutreachDraft) => void }) {
  const { setWs, run } = useStore();
  const [purpose, setPurpose] = useState("Ask for a 15-minute conversation about their path into the field");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/ai/outreach", { contactId: contact.id, purpose }));
    if (r) { setWs(r); onDrafted(r.outreach[0]); }
    setBusy(false);
  };
  return (
    <Modal title={`Draft a message to ${contact.name}`} onClose={onClose}>
      <label className="field"><span>What do you want to ask for?</span><input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} data-testid="input-outreach-purpose" /></label>
      <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" onClick={go} disabled={busy} data-testid="button-generate-outreach">{busy ? <Spinner /> : <Sparkles size={16} />} Draft it</button></div>
    </Modal>
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
  const placeholders = /\[(PERSONALIZE|ADD|TODO)/i.test(d.body + d.subject);
  const mailto = `mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(d.to)}&su=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  return (
    <Modal title="Review before anything is sent" onClose={onClose} wide>
      <div className="notice small"><Send size={16} style={{ color: "var(--plum)", marginTop: 2 }} /><div>Remy doesn't send email. After you approve, it opens the message in <strong>your</strong> email so you send it yourself.</div></div>
      <dl className="kv"><dt>To</dt><dd data-testid="text-recipient">{p?.name} &lt;{d.to}&gt; {p?.label === "Demo data" && <StatusChip label="Demo data">Sample address — won't reach anyone</StatusChip>}</dd><dt>From</dt><dd>{w.profile.applicationEmail || "Your email account"}</dd></dl>
      <label className="field"><span>Subject</span><input className="input" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value, status: "draft" })} data-testid="input-outreach-subject" /></label>
      <label className="field"><span>Full message</span><textarea className="textarea" style={{ minHeight: 220 }} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value, status: "draft" })} data-testid="input-outreach-body" /></label>
      {placeholders && <div className="notice notice-warn small"><div>Replace the [PERSONALIZE] parts before approving.</div></div>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(`To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`); toast("Copied"); }}><Copy size={14} /> Copy</button>
        <div className="row">
          {d.status === "draft" ? (
            <button className="btn btn-primary" disabled={placeholders} onClick={() => run(() => persist({ status: "approved", approvedAt: new Date().toISOString() }), "Approved")} data-testid="button-approve-outreach">Approve message</button>
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
