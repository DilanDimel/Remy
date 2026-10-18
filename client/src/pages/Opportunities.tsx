import { useEffect, useState } from "react";
import { ArrowUpRight, Bookmark, BookmarkCheck, CalendarPlus, ChevronDown, ChevronUp, EyeOff, Link2, MapPin, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import type { Job, JobCheck, JobFit, Workspace } from "@shared/types";
import { api, daysUntil, fmtDate, rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { kindLabel, reloadJobs, useJobs } from "../lib/jobs";
import { Empty, Remy, Spinner, StatusChip } from "../components/common";

type Kind = "all" | "jobs" | "campus" | "event";
const matchKind = (j: Job, k: Kind) => k === "all" || (k === "event" ? j.kind === "event" : k === "campus" ? j.kind === "campus" : ["job", "internship", "program"].includes(j.kind));

export default function Opportunities({ query }: { query: URLSearchParams }) {
  const { ws, setWs, run, toast } = useStore();
  const w = ws!;
  const { jobs, fits } = useJobs();
  const kind = (query.get("kind") as Kind) || "all";
  const focus = query.get("id");
  const [savedOnly, setSavedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [showImport, setShowImport] = useState(query.get("import") === "1");
  const [showHidden, setShowHidden] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const regions = w.profile.regions.trim();
  const [myRegions, setMyRegions] = useState(!!regions && !/anywhere/i.test(regions));
  const setKind = (k: Kind) => go(`/opportunities?kind=${k}`);
  const [finding, setFinding] = useState(false);
  const discover = async () => {
    setFinding(true);
    const r = await run(() => api<{ added: number; reached: string[]; workspace: Workspace }>("POST", "/api/jobs/discover", {}));
    if (r) {
      setWs(r.workspace);
      await reloadJobs();
      toast(r.added ? `Found ${r.added} new opening${r.added > 1 ? "s" : ""} from ${r.reached.length} employer job boards` : `Checked ${r.reached.length} employer job boards — nothing new that fits you right now`);
    }
    setFinding(false);
  };
  const base = (jobs || [])
    .filter((j) => matchKind(j, kind))
    .filter((j) => (showHidden ? true : !w.hiddenJobIds.includes(j.id)))
    .filter((j) => !savedOnly || w.savedJobIds.includes(j.id))
    .filter((j) => !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q.toLowerCase()));
  // Postings that definitely rule the student out are hidden; elsewhere-only ones too, if asked.
  const ineligible = base.filter((j) => fits[j.id]?.excluded);
  const elsewhere = base.filter((j) => !fits[j.id]?.excluded && fits[j.id]?.regionMatch === false);
  const list = base
    .filter((j) => showIneligible || !fits[j.id]?.excluded)
    .filter((j) => !myRegions || fits[j.id]?.regionMatch !== false)
    .sort((a, b) => (fits[b.id]?.score ?? 0) - (fits[a.id]?.score ?? 0) || (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Opportunities</span>
          <h1>Openings worth your time.</h1>
          <p>Ranked for you: openings you're eligible for and that match your background come first.</p>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={discover} disabled={finding} data-testid="button-discover">{finding ? <Spinner /> : <Search size={16} />} {finding ? "Remy is checking job boards…" : "Find more openings"}</button>
          <button className="btn btn-secondary" onClick={() => setShowImport((s) => !s)} data-testid="button-toggle-import"><Link2 size={16} /> Import a posting</button>
        </div>
      </div>
      {finding && <div className="notice small fade-up"><Remy size={28} mood="think" /><div>Remy is reading live job boards from employers that fit {w.profile.targetRoles || "your interests"}{w.profile.regions ? ` in ${w.profile.regions}` : ""}. This takes a few seconds.</div></div>}
      {showImport && <ImportPanel onDone={() => setShowImport(false)} />}
      <div className="row-between">
        <div className="seg" role="group" aria-label="Category">
          {([["all", "All"], ["jobs", "Jobs & internships"], ["campus", "Campus jobs"], ["event", "Events"]] as [Kind, string][]).map(([k, l]) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`filter-${k}`}>{l}</button>
          ))}
        </div>
        <div className="row">
          <input className="input" style={{ width: 200 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search openings" data-testid="input-search-jobs" />
          <label className="row small"><input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} /> Saved only</label>
          {regions && <label className="row small" title={`Your regions: ${regions}`}><input type="checkbox" checked={myRegions} onChange={(e) => setMyRegions(e.target.checked)} data-testid="checkbox-my-regions" /> Only where I want to work</label>}
          {w.hiddenJobIds.length > 0 && <label className="row small"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show hidden</label>}
        </div>
      </div>
      <div className="notice small">
        <StatusChip label="Live" />
        <div>
          <strong>Verified public openings</strong> come from official firm pages (or the firm's posting on a university career board), checked Oct 17, 2026. Open <em>Details</em> to re-check a posting before applying. Postings you import are labeled <strong>Needs verification</strong>.
        </div>
      </div>
      {(ineligible.length > 0 || (myRegions && elsewhere.length > 0)) && (
        <div className="notice small" data-testid="notice-filtered">
          <div>
            {ineligible.length > 0 && <>{showIneligible ? "Showing" : "Hiding"} <strong>{ineligible.length}</strong> opening{ineligible.length > 1 ? "s" : ""} the posting says you're not eligible for (for example, a class-year rule). <button className="btn btn-ghost btn-sm" onClick={() => setShowIneligible((v) => !v)} data-testid="button-toggle-ineligible">{showIneligible ? "Hide them" : "Show anyway"}</button></>}
            {myRegions && elsewhere.length > 0 && <div>{elsewhere.length} more {elsewhere.length > 1 ? "are" : "is"} outside {regions}. <button className="btn btn-ghost btn-sm" onClick={() => setMyRegions(false)}>Show all locations</button></div>}
            {!w.profile.classYear && !w.profile.graduation && <div>Tell Remy your class year in <a href="#/accounts" style={{ fontWeight: 700 }}>Accounts</a> so eligibility can be checked.</div>}
          </div>
        </div>
      )}
      {!jobs ? <div className="stack">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div> : list.length ? (
        <div className="stack">{list.map((j) => <JobCard key={j.id} j={j} fit={fits[j.id]} defaultOpen={focus === j.id} />)}</div>
      ) : (
        <div className="card">
          <Empty
            title={kind === "campus" ? "No campus jobs added yet" : "Nothing matches"}
            body={kind === "campus" ? "Campus jobs at TCU are posted on Handshake, which requires your login. Copy a posting's text and import it here — Remy will pull out the requirements." : "Try another filter, or import a posting."}
            action={<button className="btn btn-secondary" onClick={() => setShowImport(true)}>Import a posting</button>}
          />
        </div>
      )}
    </>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const { setWs, run, config, toast } = useStore();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"url" | "text">("url");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api<{ job: Job; workspace: Workspace; droppedQuotes: number }>("POST", "/api/jobs/import", mode === "url" ? { url } : { text, url: url || undefined });
      setWs(r.workspace);
      await reloadJobs();
      toast(`Imported ${r.job.company} — ${r.job.title}${r.droppedQuotes ? ` (${r.droppedQuotes} unverifiable quote(s) dropped)` : ""}`);
      setUrl(""); setText("");
      onDone();
      go(`/opportunities?kind=all&id=${r.job.id}`);
    } catch (e: any) {
      toast(e.message, true);
      if (e.code === "needs-text" || e.code === "login-wall" || e.status === 422) setMode("text");
    }
    setBusy(false);
  };
  return (
    <div className="card card-pad stack">
      <div className="row-between"><h3>Import any public posting</h3><div className="seg"><button aria-pressed={mode === "url"} onClick={() => setMode("url")}>From a link</button><button aria-pressed={mode === "text"} onClick={() => setMode("text")} data-testid="button-import-mode-text">Paste text</button></div></div>
      <p className="xs muted">Remy reads one public page you choose and quotes requirements exactly. It doesn't read pages behind logins (LinkedIn, Handshake) — paste their text instead.</p>
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://careers.example.com/job/…" aria-label="Posting link" data-testid="input-import-url" />
      {mode === "text" && <textarea className="textarea" style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full posting text" aria-label="Posting text" data-testid="input-import-text" />}
      <div className="row"><button className="btn btn-primary" onClick={submit} disabled={busy || !config?.ai.available || (mode === "url" ? !url : text.length < 150)} data-testid="button-import-submit">{busy ? <Spinner /> : <Sparkles size={16} />} {busy ? "Reading posting…" : "Import"}</button>
        {!config?.ai.available && <span className="xs" style={{ color: "var(--amber)" }}>Importing needs AI, which isn't configured on this server.</span>}</div>
    </div>
  );
}

function eligChip(f?: JobFit) {
  if (!f) return null;
  const map = { likely: ["chip-live", "Likely eligible"], check: ["chip-setup", "Check eligibility"], unlikely: ["chip-bad", "Likely not eligible"], unknown: ["chip-plain", "Eligibility unknown"] } as const;
  const [c, l] = map[f.eligibility];
  return <span className={"chip " + c} title={f.eligibilityNote}>{l}</span>;
}

function JobCard({ j, fit, defaultOpen }: { j: Job; fit?: JobFit; defaultOpen: boolean }) {
  const { ws, save, setWs, run, config } = useStore();
  const w = ws!;
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState("");
  useEffect(() => { if (defaultOpen) document.getElementById("job-" + j.id)?.scrollIntoView({ block: "center" }); }, [defaultOpen]);
  const saved = w.savedJobIds.includes(j.id);
  const hidden = w.hiddenJobIds.includes(j.id);
  const d = daysUntil(j.deadline);
  const last: JobCheck | undefined = j.checks[0];
  const onCal = w.calendar.some((c) => c.linkedId === j.id);
  const recheck = async () => {
    setBusy("check");
    const r = await run(() => api<{ check: JobCheck; workspace: Workspace }>("POST", `/api/jobs/${j.id}/check`));
    if (r) { setWs(r.workspace); await reloadJobs(); }
    setBusy("");
  };
  const explain = async () => {
    setBusy("fit");
    const r = await run(() => api("POST", `/api/jobs/${j.id}/fit`));
    if (r) await reloadJobs();
    setBusy("");
  };
  const addCal = () => run(() => save("calendar", [...w.calendar, { id: rid("cal"), title: `${j.company}: ${j.kind === "event" ? "event" : "deadline"}`, date: j.deadline, time: "", kind: j.kind === "event" ? "Event" : "Deadline", source: j.label === "Live" ? "From verified posting" : "From imported posting", linkedId: j.id, notes: j.deadlineText }]), "Added to your Remy calendar");
  return (
    <article id={"job-" + j.id} className="card card-pad stack-sm" style={defaultOpen ? { borderColor: "var(--plum)" } : undefined} data-testid="card-job">
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
          <div className="row"><span className="xs muted">{j.company} · {kindLabel[j.kind]}</span><StatusChip label={j.label} />{eligChip(fit)}</div>
          <h3>{j.title}</h3>
          <div className="row small muted"><span className="row" style={{ gap: 4 }}><MapPin size={14} />{j.location || "Location not stated"}</span>{j.dates && <span>· {j.dates}</span>}</div>
        </div>
        {j.deadline && <span className={"chip " + (d !== null && d < 0 ? "chip-bad" : d !== null && d <= 7 ? "chip-setup" : "chip-plain")}>{d !== null && d < 0 ? "Deadline passed" : `Due ${fmtDate(j.deadline)}${d !== null ? ` · ${d}d` : ""}`}</span>}
      </div>
      {j.requirements.length > 0 && (
        <div className="row" style={{ gap: 6 }} data-testid="job-keywords">
          <span className="xs muted" style={{ fontWeight: 700 }}>Looking for:</span>
          {j.requirements.slice(0, 5).map((r) => <span key={r.id} className={"chip " + (fit?.matched.includes(r.keyword) ? "chip-live" : "chip-plain")} title={r.quote}>{fit?.matched.includes(r.keyword) ? "✓ " : ""}{r.keyword}</span>)}
        </div>
      )}
      {fit && <p className="small"><strong>Why it fits you: </strong>{fit.why}</p>}
      {fit && fit.eligibility !== "likely" && fit.eligibility !== "unknown" && <p className="xs muted"><strong>Eligibility: </strong>{fit.eligibilityNote}</p>}
      {fit && fit.gaps.length > 0 && <p className="small muted"><strong>Gaps: </strong>{fit.gaps.slice(0, 3).join("; ")}</p>}
      {open && (
        <div className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 4 }}>
          <p className="small">{j.summary}</p>
          <div className="grid-2">
            <div className="stack-sm"><span className="eyebrow">Eligibility (quoted)</span>{j.eligibility.length ? j.eligibility.map((e, i) => <span key={i} className="quote">{e}</span>) : <span className="small muted">Not stated</span>}
              {fit && <span className="xs muted">{fit.eligibilityNote}</span>}</div>
            <div className="stack-sm"><span className="eyebrow">Requirements (quoted)</span>{j.requirements.map((r) => <span key={r.id} className="quote"><strong>{r.keyword}:</strong> {r.quote}</span>)}</div>
          </div>
          <dl className="kv">
            <dt>Format</dt><dd>{j.format || "—"}</dd>
            <dt>Deadline</dt><dd>{j.deadlineText || "Not stated"}</dd>
            <dt>Source</dt><dd><a href={j.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--plum)" }}>{j.sourceName}</a></dd>
            <dt>Freshness</dt><dd>Checked {fmtDate(j.checkedAt)}{last ? ` · re-checked ${fmtDate(last.at)}: ${last.note}` : ""}</dd>
          </dl>
          <div><button className="btn btn-secondary btn-sm" onClick={recheck} disabled={!!busy} data-testid="button-recheck">{busy === "check" ? <Spinner /> : <RefreshCw size={14} />} Re-check that the posting is still open</button></div>
        </div>
      )}
      <div className="row" style={{ marginTop: 4 }}>
        {j.kind !== "event" && <button className="btn btn-primary btn-sm" onClick={() => go(`/resume?tab=tailor&job=${j.id}`)} data-testid="button-tailor-job">Tailor resume</button>}
        <a className="btn btn-secondary btn-sm" href={j.applyUrl || j.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-apply">{j.kind === "event" ? "Register" : "Apply"} <ArrowUpRight size={13} /></a>
        <button className="btn btn-ghost btn-sm" onClick={() => save("savedJobIds", saved ? w.savedJobIds.filter((x) => x !== j.id) : [...w.savedJobIds, j.id])} data-testid="button-save-job">{saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {saved ? "Saved" : "Save"}</button>
        {j.deadline && <button className="btn btn-ghost btn-sm" onClick={addCal} disabled={onCal} data-testid="button-add-calendar"><CalendarPlus size={14} /> {onCal ? "On calendar" : "Add to calendar"}</button>}
        <button className="btn btn-ghost btn-sm" onClick={explain} disabled={!!busy || !config?.ai.available || !w.resume}>{busy === "fit" ? <Spinner /> : <Sparkles size={14} />} Explain fit</button>
        <button className="btn btn-ghost btn-sm" onClick={() => save("hiddenJobIds", hidden ? w.hiddenJobIds.filter((x) => x !== j.id) : [...w.hiddenJobIds, j.id])}><EyeOff size={14} /> {hidden ? "Unhide" : "Hide"}</button>
        {j.origin !== "verified-catalog" && <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={async () => { const r = await run(() => api<Workspace>("DELETE", `/api/jobs/${j.id}`)); if (r) { setWs(r); reloadJobs(); } }}><Trash2 size={14} /> Remove</button>}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setOpen((o) => !o)} data-testid="button-job-details">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Details</button>
      </div>
      {last && <span className={"xs " + (last.result === "reachable" ? "pass" : "fail")} data-testid="text-last-check">Last re-check {new Date(last.at).toLocaleString()}: {last.result === "reachable" ? "reachable" : last.result === "closed-signal" ? "page suggests it's closed" : "couldn't reach"}{last.httpStatus ? ` (HTTP ${last.httpStatus})` : ""}</span>}
    </article>
  );
}
