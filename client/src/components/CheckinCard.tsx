import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import type { Workspace } from "@shared/types";
import { CHECKIN_KINDS } from "@shared/checkin";
import { api, daysUntil, useDraft, useStore } from "../lib/store";
import { Spinner } from "./common";

type Draft = { kind: string; said: string; fact: string; bullet: string; linkedin: { section: string; fields: { label: string; value: string }[] }; followups: { q: string; options: string[] }[]; proposals?: { id: string; label: string; checked?: boolean }[] };
const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

/** Weekly check-in: tap what you did, say one sentence, approve what Remy keeps. Only the student's own words are used. */
export function CheckinCard({ w }: { w: Workspace }) {
  const { run, setWs } = useStore();
  const [kind, setKind] = useState("");
  const [said, setSaid] = useDraft("checkin");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [keep, setKeep] = useState({ bullet: true, linkedin: true });
  const [accept, setAccept] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  if (w.lastCheckin && (daysUntil(w.lastCheckin) ?? -99) > -6) return null;

  const listen = () => {
    const r = new Speech();
    r.lang = "en-US";
    r.onresult = (e: any) => setSaid((said ? said + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };
  const make = async (text = said) => { setBusy(true); const d = await run(() => api<Draft>("POST", "/api/ai/checkin", { kind, said: text })); setBusy(false); if (d) { setDraft(d); setKeep({ bullet: !!d.bullet, linkedin: !!d.linkedin.fields.length }); setAccept((d.proposals || []).filter((p) => p.checked !== false).map((p) => p.id)); } };
  // A tapped answer becomes part of the student's own words, so the honesty check allows it.
  const answer = (q: string, a: string) => { const text = `${said.trim().replace(/[.]?$/, ".")} ${q} ${a}.`; setSaid(text); make(text); };
  const finish = async (body: object, done: string) => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/checkin", body), done);
    setBusy(false);
    if (r) { setSaid(""); setWs(r); }
  };

  return (
    <section className="card card-pad stack-sm" data-testid="checkin-card">
      <b className="small">What did you do this week?</b>
      {!draft ? <>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {CHECKIN_KINDS.map((k) => <button key={k} type="button" className="pref-chip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? "" : k)}>{k}</button>)}
          <button type="button" className="pref-chip" disabled={busy} onClick={() => finish({ kind: "Nothing new" }, "Checked in. See you next week")}>Nothing new</button>
        </div>
        {kind && <>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input className="input grow" value={said} onChange={(e) => setSaid(e.target.value)} maxLength={600} placeholder="One sentence: where, and what you did" aria-label="What you did" data-testid="checkin-said" />
            {Speech && <button type="button" className="btn btn-ghost btn-sm" onClick={listen} disabled={listening} aria-label="Say it instead"><Mic size={14} />{listening ? " Listening…" : ""}</button>}
          </div>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy || said.trim().length < 8} onClick={() => make()}>{busy ? <Spinner /> : <Sparkles size={14} />} Turn it into a resume line</button>
        </>}
      </> : <>
        <span className="small">Remy will remember: “{draft.fact}”</span>
        {draft.bullet
          ? <label className="row small" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}><input type="checkbox" checked={keep.bullet} onChange={(e) => setKeep({ ...keep, bullet: e.target.checked })} /> <span>Add to my resume to-dos: “{draft.bullet}”</span></label>
          : <span className="xs muted">Remy couldn't write a resume line using only your words. Add more detail next time, like what you did and where.</span>}
        {draft.linkedin.fields.length > 0 && <label className="row small" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}><input type="checkbox" checked={keep.linkedin} onChange={(e) => setKeep({ ...keep, linkedin: e.target.checked })} /> <span>Add to my LinkedIn to-dos ({draft.linkedin.section}): {draft.linkedin.fields.map((f) => `${f.label}: ${f.value}`).join(" · ")}</span></label>}
        {(draft.proposals || []).map((p) => <label key={p.id} className="row small" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }} data-testid={`checkin-proposal-${p.id}`}><input type="checkbox" checked={accept.includes(p.id)} onChange={(e) => setAccept(e.target.checked ? [...accept, p.id] : accept.filter((x) => x !== p.id))} /> <span>{p.label}</span></label>)}
        {draft.followups.map((f) => (
          <div key={f.q} className="stack-sm" style={{ gap: 4 }}>
            <span className="xs muted">Make it stronger (optional): {f.q}</span>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{f.options.map((o) => <button key={o} type="button" className="pref-chip" disabled={busy} onClick={() => answer(f.q, o)}>{o}</button>)}</div>
          </div>
        ))}
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => finish({ ...draft, bullet: keep.bullet ? draft.bullet : "", linkedin: keep.linkedin ? draft.linkedin : { section: "", fields: [] }, accept }, "Saved. Remy will use it from now on")}>Looks right, save</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDraft(null)}>Change what I said</button>
        </div>
      </>}
    </section>
  );
}
