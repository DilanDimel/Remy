import { useEffect, useState } from "react";
import { GraduationCap, Mail, PenLine, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import type { Contact, OutreachDraft } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { CopyButton, Empty, Modal, Spinner, StatusChip } from "../components/common";
import { startOutreach, useTailorSession } from "../lib/tailorChat";
import { sameOrg, useJobs } from "../lib/jobs";
import { go } from "../lib/router";


export default function Community() {
  const { ws, save, run, toast } = useStore();
  const w = ws!;
  const [adding, setAdding] = useState(false);
  const { jobs } = useJobs();
  const openAt = (org: string) => (jobs || []).filter((j) => org && sameOrg(j.company, org) && !w.hiddenJobIds.includes(j.id));
  // Employers the student saved but knows nobody at: the people worth meeting next.
  const unknownOrgs = [...new Set((jobs || []).filter((j) => w.savedJobIds.includes(j.id)).map((j) => j.company))].filter((c) => !w.contacts.some((p) => sameOrg(p.org, c))).slice(0, 4);
  const [c, setC] = useState({ name: "", title: "", org: "", email: "", why: "" });
  const [review, setReview] = useState<OutreachDraft | null>(null);
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
  const draftTo = (c: Contact) => startOutreach(c);
  // Coach mode first: the student writes their own email and Remy comments on it.
  const writeTo = async (c: Contact) => {
    const d: OutreachDraft = { id: rid("o"), contactId: c.id, to: c.email, subject: "", body: "", status: "draft", createdAt: new Date().toISOString() };
    if (await run(() => save("outreach", [...w.outreach, d]))) setReview(d);
  };
  const addContact = async () => {
    // An email is optional, but one that can't be an address would end up in the draft's "To:" line.
    if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) { toast("That email doesn't look right. Fix it or leave it empty.", true); return; }
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
          <p>People you've met who can help with your career. Remy asks you a few questions, then writes the email — you approve every word and send it yourself.</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setAdding(true)} data-testid="button-add-contact"><Plus size={16} /> Add a contact</button>
        </div>
      </div>
      <div className="notice small" data-testid="alumni-coming-soon"><GraduationCap size={16} style={{ color: "var(--plum)", marginTop: 2 }} /><div><StatusChip label="Needs setup">Coming soon</StatusChip> <strong>Alumni connections.</strong> Remy will match you with alumni in your field once a school gives us permission to use its alumni list. Until then, add people you've met yourself.</div></div>
      {unknownOrgs.length > 0 && <div className="notice small" data-testid="people-to-meet"><Sparkles size={16} style={{ color: "var(--fox)", marginTop: 2 }} /><div><strong>Worth meeting next:</strong> you saved openings at {unknownOrgs.join(", ")} but don't know anyone there yet. A recruiter you met at a fair, an alum or a TA who interned there is worth adding, and Remy can draft the first message.</div></div>}
      <h2>Your contacts</h2>
      {w.contacts.length ? (
        <div className="grid-3">
          {w.contacts.map((p) => (
            <div key={p.id} className="card card-pad stack-sm" data-testid="card-contact">
              <div className="row-between"><strong>{p.name}</strong><StatusChip label={p.label} /></div>
              <span className="small muted">{p.title}{p.org ? ` · ${p.org}` : ""}</span>
              <p className="small">{p.why}</p>
              {openAt(p.org).length > 0 && <button className="xs" style={{ textAlign: "left", color: "var(--fox)", fontWeight: 700, padding: 0 }} onClick={() => go(`/opportunities?kind=all&id=${openAt(p.org)[0].id}`)} data-testid="contact-openings">{openAt(p.org).length} opening{openAt(p.org).length > 1 ? "s" : ""} at {p.org} →</button>}
              <div className="row" style={{ marginTop: "auto" }}>
                <button className="btn btn-primary btn-sm" onClick={() => writeTo(p)} data-testid="button-write-outreach"><PenLine size={14} /> Write an email</button>
                <button className="btn btn-ghost btn-sm" onClick={() => draftTo(p)} data-testid="button-draft-outreach"><Sparkles size={14} /> Draft it for me</button>
                <button className="icon-btn" onClick={() => save("contacts", w.contacts.filter((x) => x.id !== p.id))} aria-label="Remove contact"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="card"><Empty title="No contacts yet" body="Add someone you've met at a career fair, in class or on LinkedIn." /></div>}

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
  const { ws, save, run } = useStore();
  const w = ws!;
  const [d, setD] = useState(draft);
  const [tips, setTips] = useState<string[] | null>(null);
  const [coaching, setCoaching] = useState(false);
  const coach = async () => { setCoaching(true); const r = await run(() => api<{ tips: string[] }>("POST", "/api/ai/outreach-feedback", { contactId: d.contactId, subject: d.subject, body: d.body })); setCoaching(false); if (r) setTips(r.tips); };
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
      <dl className="kv"><dt>To</dt><dd data-testid="text-recipient">{p?.name} &lt;{d.to}&gt;</dd><dt>From</dt><dd>{w.profile.applicationEmail || "Your email account"}</dd></dl>
      <label className="field"><span>Subject</span><input className="input" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value, status: "draft" })} data-testid="input-outreach-subject" /></label>
      <label className="field"><span>Full message</span><textarea className="textarea" style={{ minHeight: 220 }} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value, status: "draft" })} data-testid="input-outreach-body" /></label>
      <div className="stack-sm">
        <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} disabled={coaching || d.body.trim().split(/\s+/).length < 15} onClick={coach} data-testid="button-outreach-feedback">{coaching ? <Spinner /> : <Sparkles size={14} />} Get Remy's feedback</button>
        {!d.body.trim() && <span className="xs muted">Write it in your own words: who you are, one real reason you're reaching out to {p?.name.split(" ")[0] || "them"}, and a small ask like a 15-minute chat. Remy comments; it won't rewrite it.</span>}
        {tips && <ul className="small" style={{ paddingLeft: 18 }} data-testid="outreach-tips">{tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      </div>
      {d.linkedin && (
        <div className="field"><span>LinkedIn note (under 200 characters)</span>
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><p className="small" style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }} data-testid="text-linkedin-note">{d.linkedin}</p>
            <CopyButton text={d.linkedin || ""} /></div>
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <CopyButton text={`To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`} />
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
