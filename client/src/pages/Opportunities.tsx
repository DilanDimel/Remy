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
  const { jobs, fits, needsProfile, refreshing } = useJobs();
  const kind = (query.get("kind") as Kind) || "all";
  const focus = query.get("id");
  // Filters stay as the student left them (this browser only).
  const kept = (() => { try { return JSON.parse(localStorage.getItem("remy.opps") || "{}"); } catch { return {}; } })();
  const [savedOnly, setSavedOnly] = useState<boolean>(!!kept.savedOnly);
  const [q, setQ] = useState("");
  const [showImport, setShowImport] = useState(query.get("import") === "1");
  const [showHidden, setShowHidden] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const regions = w.profile.regions.trim();
  const [myRegions, setMyRegions] = useState<boolean>(kept.myRegions ?? (!!regions && !/anywhere/i.test(regions)));
  useEffect(() => { try { localStorage.setItem("remy.opps", JSON.stringify({ savedOnly, myRegions })); } catch {} }, [savedOnly, myRegions]);
  const setKind = (k: Kind) => go(`/opportunities?kind=${k}`);
  const [finding, setFinding] = useState(false);
  const discover = async () => {
    setFinding(true);
    const r = await run(() => api<{ added: number; reached: string[]; workspace: Workspace }>("POST", "/api/jobs/discover", {}));
    if (r) {
      setWs(r.workspace);
      await reloadJobs();
      toast(r.added ? `Found ${r.added} new opening${r.added > 1 ? "s" : ""} from ${r.reached.length} employer job boards` : `Checked ${r.reached.length} employer job boards — nothing new that fits you right now${r.workspace.profile.regions?.trim() ? `. Few openings in ${r.workspace.profile.regions} at the moment: adding more places in Account → Profile will show more` : ""}`);
    }
    setFinding(false);
  };
  // Feedback loop: employers the student saved or applied to rise; ones they keep marking "Not interested" sink.
  const companyOf = (id: string) => (jobs || []).find((j) => j.id === id)?.company;
  const liked = new Set([...w.savedJobIds, ...w.applications.map((a) => a.jobId)].map(companyOf));
  const hiddenBy = new Map<string | undefined, number>();
  for (const id of w.hiddenJobIds) hiddenBy.set(companyOf(id), (hiddenBy.get(companyOf(id)) || 0) + 1);
  // The specific words of their goal ("mechanical") in a title outrank a same-field but different job ("electrical").
  const GENERIC = /^(intern|interns|internship|internships|student|students|engineer|engineering|analyst|associate|assistant|summer|entry|level|role|roles|jobs?|work|program|career|careers|position|and|the|for|with)$/i;
  const specific = [...new Set(`${w.profile.targetRoles} ${w.profile.major}`.toLowerCase().split(/[^a-z&]+/).filter((x) => x.length > 3 && !GENERIC.test(x)))];
  // No places chosen: openings in the student's own city or state come first.
  const home = regions ? [] : (w.profile.location || "").split(",").map((x) => x.trim()).filter((x) => x.length >= 2);
  const near = (j: Job) => home.some((h) => new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, "")}\\b`, "i").test(j.location));
  const rank = (j: Job) => (fits[j.id]?.score ?? 0) + (near(j) ? 6 : 0) + (liked.has(j.company) ? 8 : 0) - Math.min(3, hiddenBy.get(j.company) || 0) * 5
    + 10 * specific.filter((x) => new RegExp(`\\b${x}`, "i").test(j.title)).length;
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
    .sort((a, b) => rank(b) - rank(a) || (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  return (
    <>
      {needsProfile && <div className="notice" data-testid="needs-profile">{needsProfile}</div>}
      {refreshing && <div className="notice" data-testid="openings-refreshing"><Spinner /> Remy is checking employers' career sites for new openings that fit you. They'll appear here in a moment.</div>}
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
          {w.hiddenJobIds.length > 0 && <label className="row small"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show ones I'm not interested in</label>}
        </div>
      </div>
      {(ineligible.length > 0 || (myRegions && elsewhere.length > 0)) && (
        <div className="notice small" data-testid="notice-filtered">
          <div>
            {ineligible.length > 0 && <>{showIneligible ? "Showing" : "Hiding"} <strong>{ineligible.length}</strong> opening{ineligible.length > 1 ? "s" : ""} that {ineligible.length > 1 ? "don't" : "doesn't"} fit what you chose, {ineligible.length > 1 ? "are" : "is"} closed, or you're not eligible for (for example, another field, a passed deadline or a class-year rule). <button className="btn btn-ghost btn-sm" onClick={() => setShowIneligible((v) => !v)} data-testid="button-toggle-ineligible">{showIneligible ? "Hide them" : "Show anyway"}</button></>}
            {myRegions && elsewhere.length > 0 && <div>{elsewhere.length} more {elsewhere.length > 1 ? "are" : "is"} outside {regions}. <button className="btn btn-ghost btn-sm" onClick={() => setMyRegions(false)}>Show all locations</button></div>}
            {!w.profile.classYear && !w.profile.graduation && <div>Add your class year in <a href="/accounts" style={{ fontWeight: 700 }}>Accounts</a> and Remy will check every opening's eligibility for you.</div>}
          </div>
        </div>
      )}
      {!jobs ? <div className="stack">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div> : list.length ? (
        <div className="stack">{list.map((j) => <JobCard key={j.id} j={j} fit={fits[j.id]} defaultOpen={focus === j.id} />)}</div>
      ) : (
        <div className="card">
          <Empty
            title={kind === "campus" ? "No campus jobs added yet" : jobs.length ? "Nothing matches" : "No openings yet"}
            body={kind === "campus" ? "Campus jobs are posted on your school's career site (often Handshake), which requires your login. Copy a posting's text and import it here — Remy will pull out the requirements." : jobs.length ? nothingFits(w.profile) : "Remy searches employers' own career sites for openings that fit you. Run a search, or import a posting you found."}
            action={kind !== "campus" && !jobs.length ? <button className="btn btn-primary" onClick={discover} disabled={finding}>{finding ? <Spinner /> : <Search size={16} />} {finding ? "Remy is checking job boards…" : "Find openings"}</button> : <button className="btn btn-secondary" onClick={() => setShowImport(true)}>Import a posting</button>}
          />
        </div>
      )}
    </>
  );
}

/** Why a student might see nothing, from what they told Remy, and what to try next. */
function nothingFits(p: Workspace["profile"]) {
  const tips = [
    /first|fresh|soph/i.test(p.classYear) && !/program|insight/i.test(p.opportunityTypes) && "Internships that take first-years and sophomores are rare; add \"Programs & insight days\" to what you're looking for.",
    /sponsor|visa/i.test(p.workAuth) && "Fewer postings work when you need sponsorship. Your school's international student office can tell you which roles you can take.",
    p.regions && !/remote|anywhere/i.test(p.regions) && "Widening where you'll look (Remote or Anywhere in the US) usually finds more.",
  ].filter(Boolean);
  return [...(tips.length ? tips : ["Try another filter."]), "You can also import a posting you found yourself, or change these choices in Accounts → Profile."].join(" ");
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
  if (f.closed) return <span className="chip chip-bad" title={f.closed}>Closed</span>;
  // Remy decides eligibility itself; students only see the outcome. Unknown shows nothing (the page asks once for what's missing).
  if (f.eligibility === "unknown") return null;
  if (f.eligibility === "unlikely") return <span className="chip chip-bad" title={f.eligibilityNote}>Not eligible</span>;
  return <span className="chip chip-live" title={f.eligibilityNote}>You qualify</span>;
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
        {j.deadline && <span className={"chip " + (d !== null && d < 0 ? "chip-bad" : d !== null && d <= 7 ? "chip-setup" : "chip-plain")}>{d !== null && d < 0 ? "Deadline passed" : `Due ${fmtDate(j.deadline)}${d === 0 ? " · today" : d !== null ? ` · ${d}d` : ""}`}</span>}
      </div>
      {j.requirements.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} data-testid="job-keywords">
          <span className="xs muted" style={{ fontWeight: 700 }}>Looking for:</span>
          {j.requirements.slice(0, 5).map((r) => <span key={r.id} className={"chip " + (fit?.matched.includes(r.keyword) ? "chip-live" : "chip-plain")} title={r.quote}>{fit?.matched.includes(r.keyword) ? "✓ " : ""}{r.keyword}</span>)}
        </div>
      )}
      {fit && <p className="small"><strong>Why it fits you: </strong>{fit.why}</p>}
      {fit && fit.eligibility !== "unknown" && <p className="xs muted"><strong>{fit.eligibility === "unlikely" ? "Why not: " : "Why you qualify: "}</strong>{fit.eligibilityNote}</p>}
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
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={recheck} disabled={!!busy} data-testid="button-recheck">{busy === "check" ? <Spinner /> : <RefreshCw size={14} />} Re-check it's still open</button>
            <button className="btn btn-ghost btn-sm" onClick={explain} disabled={!!busy || !config?.ai.available || !w.resume}>{busy === "fit" ? <Spinner /> : <Sparkles size={14} />} Explain fit</button>
            <button className="btn btn-ghost btn-sm" onClick={() => save("hiddenJobIds", hidden ? w.hiddenJobIds.filter((x) => x !== j.id) : [...w.hiddenJobIds, j.id])}><EyeOff size={14} /> {hidden ? "Show it again" : "Not interested"}</button>
            {/* Only postings the student added can be removed; a live one would come back on the next search. */}
            {j.origin === "imported" && !/job board/i.test(j.sourceName || "") && <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={async () => { const r = await run(() => api<Workspace>("DELETE", `/api/jobs/${j.id}`)); if (r) { setWs(r); reloadJobs(); } }}><Trash2 size={14} /> Remove</button>}
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 4 }}>
        {j.kind !== "event" && <button className="btn btn-primary btn-sm" onClick={() => go(`/resume?tab=tailor&job=${j.id}&go=1`)} data-testid="button-tailor-job">Tailor resume</button>}
        <a className="btn btn-secondary btn-sm" href={j.applyUrl || j.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-apply">{j.kind === "event" ? "Register" : "Apply"} <ArrowUpRight size={13} /></a>
        <button className="btn btn-ghost btn-sm" onClick={() => save("savedJobIds", saved ? w.savedJobIds.filter((x) => x !== j.id) : [...w.savedJobIds, j.id])} data-testid="button-save-job">{saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {saved ? "Saved" : "Save"}</button>
        {j.deadline && <button className="btn btn-ghost btn-sm" onClick={addCal} disabled={onCal} data-testid="button-add-calendar"><CalendarPlus size={14} /> {onCal ? "On calendar" : "Add to calendar"}</button>}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setOpen((o) => !o)} data-testid="button-job-details">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Details</button>
      </div>
      {last && <span className={"xs " + (last.result === "reachable" ? "pass" : "fail")} data-testid="text-last-check">Last re-check {new Date(last.at).toLocaleString()}: {last.result === "reachable" ? "reachable" : last.result === "closed-signal" ? "page suggests it's closed" : "couldn't reach"}{last.httpStatus ? ` (HTTP ${last.httpStatus})` : ""}</span>}
    </article>
  );
}
