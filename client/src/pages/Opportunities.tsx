import { useEffect, useRef, useState, Fragment } from "react";
import { dreamWithoutOpenings } from "@shared/org";
import { decodeEntities, postingField, postingLines } from "@shared/postingText";
import { authKind } from "@shared/workAuth";
import { ArrowDown, ArrowUp, ArrowUpRight, Bookmark, BookmarkCheck, CalendarPlus, Check, X, ChevronDown, ChevronUp, Link2, MapPin, Mic, RefreshCw, Search, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { openingRanker, reasonLine } from "@shared/order";
import type { Job, JobCheck, JobFit, JobInterestReason, JobRanking, Workspace } from "@shared/types";
import { api, daysUntil, fmtDate, rid, useDraft, useOwnerView, useStore } from "../lib/store";
import { ApplyLink } from "../components/ApplyLink";
import { go } from "../lib/router";
import { kindLabel, reloadJobs, sameOrg, shortPlace, useJobs } from "../lib/jobs";
import { shortTitle } from "@shared/org";
import { screeningFor } from "@shared/screening";
import { postingSkills, skillsIn } from "@shared/requirements";
import { isRoleOpening } from "@shared/roleMatch";
import { Empty, Modal, Remy, Spinner, StatusChip, WorkingSteps } from "../components/common";
import { useIsMobile } from "../hooks/use-mobile";
import { OrgLogo } from "../components/OrgLogo";

type Kind = "all" | "jobs" | "campus" | "event";
const matchKind = (j: Job, k: Kind) => k === "all" || (k === "event" ? j.kind === "event" : k === "campus" ? j.kind === "campus" : ["job", "internship", "program"].includes(j.kind));

export default function Opportunities({ query }: { query: URLSearchParams }) {
  const { ws, setWs, run, toast } = useStore();
  const w = ws!;
  const owner = useOwnerView(); // tabs redesign (Nov 22), owners first
  const { jobs, fits, interest, interestEnabled, needsProfile, refreshing, fieldEmployers } = useJobs();
  // Remy's employer list is mostly business, tech and engineering; for other fields it says so instead of blaming filters.
  // An undecided student has no field, so "few employers hire in your field" would be untrue for them.
  const noField = !w.profile.targetRoles.trim() && (!w.profile.major.trim() || /undecided|undeclared|not sure|exploring/i.test(w.profile.major));
  const fewInField = !noField && fieldEmployers !== undefined && fieldEmployers < 20;
  const field = w.profile.targetRoles || w.profile.major || "your field";
  const kind = (query.get("kind") as Kind) || "all";
  const focus = query.get("id");
  // From My Path: only openings of that kind of job (same rule as the count there, shared/roleMatch.ts).
  const role = query.get("role") || "";
  // From Home's "New openings" / "Saved openings that closed": those cards come first.
  const show = query.get("show"), since = query.get("since") || "";
  const pinned = (j: Job) => show === "new" ? (j.foundAt || "") > since
    : show === "closed" ? (w.savedJobIds.includes(j.id) || w.applications.some((a) => a.jobId === j.id)) && !!j.checks?.[0] && j.checks[0].at > since && (j.checks[0].result === "closed-signal" || j.checks[0].httpStatus === 404 || j.checks[0].httpStatus === 410)
    : false;
  // Filters stay as the student left them (this browser only).
  const kept = (() => { try { return JSON.parse(localStorage.getItem("remy.opps") || "{}"); } catch { return {}; } })();
  const [savedOnly, setSavedOnly] = useState<boolean>(!!kept.savedOnly);
  const [q, setQ] = useState("");
  const [showImport, setShowImport] = useState(query.get("import") === "1");
  const [showHidden, setShowHidden] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const regions = w.profile.regions.trim();
  // Not remembered: "Show all locations" lasts this visit, so the student's places always apply when they come back.
  const [myRegions, setMyRegions] = useState<boolean>(!!regions && !regions.split(/[,;/]+/).some((r) => /^\s*anywhere\b/i.test(r) && !/^\s*anywhere in (?!the\b|us\b|usa\b|u\.s|united|america)[a-z]+\s*$/i.test(r)));
  useEffect(() => { try { localStorage.setItem("remy.opps", JSON.stringify({ savedOnly })); } catch {} }, [savedOnly]);
  // "See kept" after a Keep (Demetre, Nov 24) lands here with ?kept=1.
  const keptLink = query.get("kept");
  useEffect(() => { if (keptLink) setSavedOnly(keptLink === "1"); }, [keptLink]);
  // The best 10 first, then 10 more at a time (99 cards were 40 phone screens long); a new search or filter starts over.
  const [shown, setShown] = useState(10);
  useEffect(() => { setShown(10); }, [kind, q, savedOnly, myRegions, showHidden, showIneligible, role]);
  const setKind = (k: Kind) => go(`/opportunities?kind=${k}${role ? `&role=${encodeURIComponent(role)}` : ""}`);
  const [finding, setFinding] = useState(false);
  // Dream employers with nothing in the list: say so instead of staying silent. Only once the list has loaded
  // and no search is running, so it never claims "nothing" about openings that are still on their way.
  const dreams = (w.profile.dreamEmployers || "").split(/[,;]+/).map((x) => x.trim()).filter((x) => x.length > 1).slice(0, 5);
  const noDream = jobs && !refreshing && !finding && w.lastSearch?.at ? dreamWithoutOpenings(w.profile.dreamEmployers, jobs.map((j) => j.company)) : [];
  const discover = async () => {
    setFinding(true);
    const r = await run(() => api<{ added: number; reached: string[]; workspace: Workspace }>("POST", "/api/jobs/discover", {}));
    if (r) {
      setWs(r.workspace);
      await reloadJobs();
      toast(r.added ? `Found ${r.added} new opening${r.added > 1 ? "s" : ""} from ${r.reached.length} employer job boards` : fewInField ? `Checked ${r.reached.length} employer job boards. Remy reads few employers in ${field} yet, so import postings you find elsewhere and Remy will tailor your resume to them.` : `Checked ${r.reached.length} employer job boards: nothing new that fits you right now. Remy checks again by itself.`);
    }
    setFinding(false);
  };
  // The ordering itself lives in shared/order.ts (tested in server/order.test.ts).
  const { group, compare } = openingRanker(w, jobs || [], fits, interest, interestEnabled);
  const base = (jobs || [])
    .filter((j) => matchKind(j, kind))
    .filter((j) => (showHidden ? true : !w.hiddenJobIds.includes(j.id)))
    // From My Path the list is exactly what was counted there, so a remembered "Saved only" doesn't apply.
    .filter((j) => !savedOnly || !!role || w.savedJobIds.includes(j.id))
    .filter((j) => !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q.toLowerCase()))
    .filter((j) => !role || isRoleOpening(role, j));
  // Postings that definitely rule the student out are hidden; elsewhere-only ones too, if asked.
  // Owners (Nov 23 PM review): "All 21", 7 cards, "Hiding 10", "14 more outside DFW" didn't add up. With "Only where I
  // want to work" on, the tab counts and the hidden line count only your places, so cards + hidden = the tab count.
  const inArea = (j: { id: string }) => !myRegions || fits[j.id]?.regionMatch !== false || !!fits[j.id]?.relocate;
  const ineligible = base.filter((j) => fits[j.id]?.excluded && (!owner || inArea(j)));
  // Outside the student's places with no reason from their relocation answer: behind the "N more" link.
  const elsewhere = base.filter((j) => !fits[j.id]?.excluded && fits[j.id]?.regionMatch === false && !fits[j.id]?.relocate);
  const list = base
    .filter((j) => showIneligible || !fits[j.id]?.excluded)
    .filter((j) => !myRegions || fits[j.id]?.regionMatch !== false || !!fits[j.id]?.relocate)
    // The student's own places first, then "Worth relocating for" (their relocation answer), then other places (only
    // when they show all locations); pinned and ranked within each group, so a group never splits (skeptic review).
    .sort(compare(pinned));
  const visible = (jobs || []).filter((j) => !w.hiddenJobIds.includes(j.id) && !fits[j.id]?.excluded);
  // The tab counts follow "Show anyway" / "Show ones I'm not interested in", like the list under them (Nov 23).
  const counted = (jobs || []).filter((j) => (showHidden || !w.hiddenJobIds.includes(j.id)) && (showIneligible || !fits[j.id]?.excluded) && inArea(j));
  const rest = list; // Dilan Nov 22: no "Remy's pick" card on owner Opportunities, it was doing too much
  return (
    <>
      {needsProfile && <div className="notice" data-testid="needs-profile">{needsProfile}</div>}
      {role && <div className="notice row-between" data-testid="role-filter"><span>Showing {list.length} <b>{role}</b> opening{list.length === 1 ? "" : "s"}, from My Path.</span><button className="btn btn-ghost btn-sm" onClick={() => go("/opportunities")}>Show all openings</button></div>}
      {refreshing && <div className="notice" data-testid="openings-refreshing"><Spinner /> Remy is checking employers' career sites for new openings that fit you. They'll appear here in a moment.</div>}
      {owner && <JobsSeg at={savedOnly ? "saved" : "for"} onSaved={setSavedOnly} />}
      <div className="page-head">
        <div>
          <span className="eyebrow">Opportunities</span>
          <h1><span className="title-slogan">Openings worth your time.</span><span className="title-plain">Opportunities</span></h1>
          {owner ? <OppLine visible={list} any={visible.length > 0} fits={fits} /> : <p className="hide-phone">Ranked for you: openings you're eligible for and that match your background come first.</p>}
          {(() => {
            // A quiet status line instead of a button to press: when Remy last looked, and what's new this week.
            const at = w.lastSearch?.at || w.openingsCheckedAt;
            if (!at || refreshing) return null;
            const h = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 3600_000));
            const d = Math.round(h / 24);
            const ago = h < 1 ? "less than an hour ago" : h < 24 ? `${h}h ago` : `${d} day${d === 1 ? "" : "s"} ago`;
            const week = new Date(Date.now() - 7 * 864e5).toISOString();
            const fresh = (jobs || []).filter((j) => (j.foundAt || "") > week && !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false && !w.hiddenJobIds.includes(j.id)).length;
            return <p className="xs muted" data-testid="openings-status">Updated {ago}{fresh && !owner ? ` · ${fresh} new this week` : ""}<span className="opp-status-extra"> · Remy checks again by itself</span></p>;
          })()}
        </div>
        <div className="row opp-actions">
          <button className="btn btn-secondary" onClick={discover} disabled={finding} data-testid="button-discover">{finding ? <Spinner /> : <Search size={16} />} {finding ? <><span className="hide-phone">Remy is checking job boards…</span><span className="opp-phone-only">Checking…</span></> : "Find more openings"}</button>
          <button className="btn btn-secondary" onClick={() => setShowImport((s) => !s)} data-testid="button-toggle-import"><Link2 size={16} /> <span className="hide-phone">Import a posting</span><span className="opp-phone-only">Import</span></button>
        </div>
      </div>
      {finding && <div className="notice small fade-up"><Remy size={28} mood="think" /><div className="stack-sm"><span>Remy is reading live job boards from employers that fit {w.profile.targetRoles || "your interests"}{w.profile.regions ? ` in ${w.profile.regions}` : ""}.</span><WorkingSteps steps={["Picking employers that fit you", "Reading their career sites", "Keeping internships and entry-level roles", "Ranking by how well they fit"]} every={3500} /></div></div>}
      {showImport && <ImportPanel onDone={() => setShowImport(false)} />}
      <div className="row-between opp-filters">
        <div className="seg" role="group" aria-label="Category">
          {([["all", "All", "All"], ["jobs", "Jobs & internships", "Jobs"], ["campus", "Campus jobs", "Campus"], ["event", "Events", "Events"]] as [Kind, string, string][]).map(([k, l, short]) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} aria-label={l} data-testid={`filter-${k}`}><span className="opp-kind-long">{l}</span><span className="opp-kind-short" aria-hidden>{short}</span>{owner && <em className="op-n">{counted.filter((j) => matchKind(j, k)).length}</em>}</button>
          ))}
        </div>
        <div className="row">
          <input className="input opp-search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search openings" data-testid="input-search-jobs" />
          <label className={"row small" + (owner ? " hide-phone" : "")}><input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} data-testid="checkbox-saved-only" /> {owner ? `Kept only${w.savedJobIds.length ? ` (${w.savedJobIds.length})` : ""}` : "Saved only"}</label>
          {regions && <label className="row small" title={`Your regions: ${regions}`}><input type="checkbox" checked={myRegions} onChange={(e) => setMyRegions(e.target.checked)} data-testid="checkbox-my-regions" /> Only where I want to work</label>}
          {w.hiddenJobIds.length > 0 && <label className="row small"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show ones I'm not interested in</label>}
        </div>
      </div>
      {/* Dream employers at a glance (ranking council, Nov 19): how many openings each has right now; tap to see them. */}
      {dreams.length > 0 && w.lastSearch?.at && (
        <div className="row small" style={{ gap: 8, flexWrap: "wrap" }} data-testid="dream-row">
          <b>Your dream employers</b>
          {dreams.map((d) => { const n = (jobs || []).filter((j) => sameOrg(d, j.company) && !w.hiddenJobIds.includes(j.id)).length; return (
            <button key={d} className={"chip " + (n ? "chip-live" : "chip-plain")} disabled={!n} onClick={() => setQ(d)} title={n ? `Show ${d}'s openings` : "Remy checks their career site each time it searches"} data-testid="dream-chip">{d}<span className="dream-long"> · {n ? `${n} open` : "none open now"}</span><span className="dream-short" aria-hidden> · {n}</span></button>
          ); })}
          {noDream.length > 0 && <span className="xs muted">Found one yourself? <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>Import it</button></span>}
        </div>
      )}
      {(ineligible.length > 0 || (myRegions && elsewhere.length > 0)) && (
        <div className="notice small" data-testid="notice-filtered">
          <div>
            {ineligible.length > 0 && <>{showIneligible ? "Showing" : "Hiding"} <strong>{ineligible.length}</strong> opening{ineligible.length > 1 ? "s" : ""} you can't apply to or that {ineligible.length > 1 ? "don't" : "doesn't"} fit your choices. <button className="btn btn-ghost btn-sm" onClick={() => setShowIneligible((v) => !v)} data-testid="button-toggle-ineligible">{showIneligible ? "Hide them" : "Show anyway"}</button></>}
            {myRegions && elsewhere.length > 0 && <div>{elsewhere.length} more {elsewhere.length > 1 ? "are" : "is"} outside {regions}. <button className="btn btn-ghost btn-sm" onClick={() => setMyRegions(false)}>Show all locations</button></div>}
            {!w.profile.classYear && !w.profile.graduation && <div>Add your class year in <a href="/accounts" style={{ fontWeight: 700 }}>Accounts</a> and Remy will check every opening's eligibility for you.</div>}
          </div>
        </div>
      )}
      {(() => { const listBlock = (!jobs ? <div className="stack">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div> : list.length ? (
        (() => {
          // A link to one opening (?id=) shows the list down to it.
          const count = role ? rest.length : Math.max(shown, rest.findIndex((j) => j.id === focus) + 1); // from My Path: all of them
          return (
            <div className="stack">
              {rest.slice(0, count).map((j, i, shownList) => (
                <Fragment key={j.id}>
                  {/* Openings outside the student's places come after theirs, under a line saying why (their relocation answer). */}
                  {group(j) > 0 && (i === 0 || group(shownList[i - 1]) !== group(j)) && (
                    <div className="row small muted" style={{ gap: 8, margin: "6px 2px 0" }} data-testid={group(j) === 1 ? "worth-relocating" : "other-places"}><b style={{ color: "var(--text)" }}>{group(j) === 1 ? "Worth relocating for" : "Other places"}</b><span>outside {regions}</span></div>
                  )}
                  <JobCard j={j} fit={fits[j.id]} moved={interest[j.id]} canRate={interestEnabled} defaultOpen={focus === j.id} showPassed={showHidden} />
                </Fragment>
              ))}
              {rest.length > count && (
                <button className="btn btn-secondary" style={{ alignSelf: "center" }} onClick={() => {
                  setShown(count + 10);
                  // Keyboard users land on the first new card, not past it.
                  setTimeout(() => { const el = document.querySelectorAll<HTMLElement>(".job-card")[count]; if (el) { el.setAttribute("tabindex", "-1"); el.focus(); } }, 50);
                }} data-testid="button-show-more-jobs">
                  Show {Math.min(10, rest.length - count)} more <span className="muted">({rest.length - count} left)</span>
                </button>
              )}
            </div>
          );
        })()
      ) : (
        <div className="card">
          <Empty
            title={kind === "campus" ? "No campus jobs added yet" : jobs.length ? "Nothing matches" : "No openings yet"}
            body={kind === "campus" ? "Campus jobs are posted on your school's career site (often Handshake), which requires your login. Copy a posting's text and import it here — Remy will pull out the requirements."
              : fewInField ? `Remy checks over 90,000 employers' career sites and found few ${field} openings that fit you right now. That's a gap in Remy, not in you. Import postings you find on Handshake, your career center or an employer's own site, and Remy will check your eligibility and tailor your resume to each one.`
              : jobs.length && (q || savedOnly || kind !== "all") ? `Nothing here matches ${q ? `"${q}"` : savedOnly ? "your saved openings" : "this filter"}. Clear the search or pick All to see everything Remy found.`
              : jobs.length ? nothingFits(w.profile) : "Remy searches employers' own career sites for openings that fit you. Run a search, or import a posting you found."}
            action={kind !== "campus" && !jobs.length && !fewInField ? <button className="btn btn-primary" onClick={discover} disabled={finding}>{finding ? <Spinner /> : <Search size={16} />} {finding ? "Remy is checking job boards…" : "Find openings"}</button> : <button className="btn btn-secondary" onClick={() => setShowImport(true)}>Import a posting</button>}
          />
        </div>
      ));
        // Owners: the list beside a rail with their search counts and what closes soon; the season band closes the page.
        return owner ? <><div className="op-cols"><div className="stack">{listBlock}</div><OppRail jobs={jobs || []} /></div></> : listBlock; // season band lives on Home only (it showed on both, Nov 23 review)
      })()}
    </>
  );
}

/** Phones (Dilan, Nov 25): Jobs holds For you, Saved and Applied (the Progress page), like the phone app's Jobs tab. */
export function JobsSeg({ at, onSaved }: { at: "for" | "saved" | "applied"; onSaved?: (saved: boolean) => void }) {
  const w = useStore().ws!;
  const pick = (k: "for" | "saved" | "applied") => k === "applied" ? go("/progress") : onSaved ? onSaved(k === "saved") : go(`/opportunities?kept=${k === "saved" ? 1 : 0}`);
  return (
    <div className="seg jobs-seg" role="group" aria-label="Openings">
      {([["for", "For you", 0], ["saved", "Saved", w.savedJobIds.length], ["applied", "Applied", w.tracker.length]] as const).map(([k, l, n]) => (
        <button key={k} aria-pressed={at === k} onClick={() => pick(k)} data-testid={`jobs-seg-${k}`}>{l}{n ? <em className="op-n">{n}</em> : null}</button>
      ))}
    </div>
  );
}

/** Owners: Remy's line under the title, from real counts (never a made-up number). */
// Counts what the filters show (Nov 23 review: "32 new, you qualify for 10" sat above 2 cards).
function OppLine({ visible, any, fits }: { visible: Job[]; any: boolean; fits: Record<string, JobFit> }) {
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const fresh = visible.filter((j) => (j.foundAt || "") > week).length;
  const qualify = visible.filter((j) => fits[j.id]?.checked && fits[j.id]?.eligibility !== "unlikely" && !fits[j.id]?.closed).length;
  const soon = visible.map((j) => ({ j, d: daysUntil(j.deadline) })).filter((x) => x.d !== null && x.d >= 0 && x.d <= 14).sort((a, b) => a.d! - b.d!)[0];
  if (!visible.length) return <p className="op-say">{any ? "No openings match these filters." : "Remy is looking for openings that fit you."}</p>;
  return (
    <p className="op-say" data-testid="opp-line">
      <b>{fresh ? `${fresh} new this week.` : `${visible.length} opening${visible.length === 1 ? "" : "s"} ranked for you.`}</b>
      {qualify ? ` You qualify for ${qualify}.` : ""}
      {soon ? ` ${soon.j.company} closes ${soon.d === 0 ? "today" : soon.d === 1 ? "tomorrow" : `in ${soon.d} days`}.` : ""}
    </p>
  );
}

// Owners: a posting listing four cities reads "West Palm Beach, FL + 3 more" (hover shows them all).

/** Owners: where their search stands and the deadlines coming up, beside the list. */
function OppRail({ jobs }: { jobs: Job[] }) {
  const { ws } = useStore();
  const w = ws!;
  const sent = w.tracker.filter((t) => !["Saved", "Withdrawn"].includes(t.status));
  const tiles: [string, number][] = [["Saved", w.savedJobIds.length], ["Tailored", w.applications.length], ["Applied", sent.length], ["Interview", sent.filter((t) => t.status === "Interview" || t.status === "Offer").length]];
  const soon = jobs.filter((j) => !w.hiddenJobIds.includes(j.id)).map((j) => ({ j, d: daysUntil(j.deadline) }))
    .filter((x) => x.d !== null && x.d >= 0 && x.d <= 30)
    .sort((a, b) => Number(w.savedJobIds.includes(b.j.id)) - Number(w.savedJobIds.includes(a.j.id)) || a.d! - b.d!).slice(0, 3);
  return (
    <aside className="op-rail" data-testid="opp-rail">
      <div className="op-card">
        <div className="op-ch"><h3>Your search</h3><button className="op-link" onClick={() => go("/progress")} data-testid="button-rail-progress">Progress →</button></div>
        <div className="op-stats" data-testid="opp-search-line">{tiles.map(([l, n]) => <span key={l}><b>{n}</b>{l}</span>)}</div>
      </div>
      <div className="op-card">
        <div className="op-ch"><h3>Closing soon</h3><button className="op-link" onClick={() => go("/calendar")} data-testid="button-rail-calendar">Calendar →</button></div>
        {soon.length ? <ul className="op-dl">{soon.map(({ j }) => (
          <li key={j.id}><span className="op-date"><small>{new Date(j.deadline.slice(0, 10) + "T12:00").toLocaleDateString("en-US", { month: "short" })}</small><b>{new Date(j.deadline.slice(0, 10) + "T12:00").getDate()}</b></span>
            <button onClick={() => go(`/opportunities?kind=all&id=${j.id}`)}><strong>{shortTitle(j.title, j.company)}</strong><span>{j.company}{w.savedJobIds.includes(j.id) ? " · saved" : ""}</span></button></li>
        ))}</ul> : <p className="small muted">No deadlines in the next 30 days. Remy adds them here as openings post dates.</p>}
      </div>
    </aside>
  );
}

/** Why a student might see nothing, from what they told Remy, and what to try next. */
function nothingFits(p: Workspace["profile"]) {
  const tips = [
    /first|fresh|soph/i.test(p.classYear) && !/program|insight/i.test(p.opportunityTypes) && "Internships that take first-years and sophomores are rare; add \"Programs & insight days\" to what you're looking for.",
    authKind(p.workAuth) === "sponsor" && "Fewer postings work when you need sponsorship. Your school's international student office can tell you which roles you can take.",
    p.regions && !/remote|anywhere/i.test(p.regions) && "Widening where you'll look (Remote or Anywhere in the US) usually finds more.",
  ].filter(Boolean);
  return [...(tips.length ? tips : ["Try another filter."]), "You can also import a posting you found yourself, or change these choices in Account → Profile."].join(" ");
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const { setWs, run, config, toast } = useStore();
  const [url, setUrl] = useState("");
  const [text, setText] = useDraft("import-posting");
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
      <div className="row-between"><h3>Import any public posting</h3><div className="seg opp-import-seg"><button aria-pressed={mode === "url"} onClick={() => setMode("url")}>From a link</button><button aria-pressed={mode === "text"} onClick={() => setMode("text")} data-testid="button-import-mode-text">Paste text</button></div></div>
      <p className="xs muted">Remy reads one public page you choose and quotes requirements exactly. It doesn't read pages behind logins (LinkedIn, Handshake) — paste their text instead.</p>
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://careers.example.com/job/…" aria-label="Posting link" data-testid="input-import-url" />
      {mode === "text" && <textarea className="textarea" style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full posting text" aria-label="Posting text" data-testid="input-import-text" />}
      <div className="row"><button className="btn btn-primary" onClick={submit} disabled={busy || !config?.ai.available || (mode === "url" ? !url : text.length < 150)} data-testid="button-import-submit">{busy ? <Spinner /> : <Sparkles size={16} />} {busy ? "Reading posting…" : "Import"}</button>
        {!config?.ai.available && <span className="xs" style={{ color: "var(--warn)" }}>Importing needs AI, which isn't configured on this server.</span>}</div>
    </div>
  );
}

function eligChip(f?: JobFit) {
  if (!f) return null;
  if (f.closed) return <span className="chip chip-bad" title={f.closed}>Closed</span>;
  // Remy decides eligibility itself; students only see the outcome. Unknown shows nothing (the page asks once for what's missing).
  if (f.eligibility === "unknown") return null;
  if (f.eligibility === "unlikely") return <span className="chip chip-bad" title={f.eligibilityNote}>Not eligible</span>;
  // "You qualify" only when the posting states a rule Remy checked and you meet it; "no limits stated" isn't proof.
  if (f.hidden) return <span className="chip chip-plain" title={f.hidden}>Hidden</span>;
  return f.checked ? <span className="chip chip-live" title={f.eligibilityNote}>You qualify</span> : null;
}

/** The posting as readable lines, "Label: value" lines as a small table, long text behind "Show more". */
export function PostingText({ text }: { text: string }) {
  const [all, setAll] = useState(false);
  const lines = postingLines(text);
  const shown = all ? lines : lines.slice(0, 6);
  if (!lines.length) return null;
  return (
    <div className="posting-text small" data-testid="posting-text">
      {shown.map((l, i) => { const f = postingField(l); return f ? <p key={i} className="posting-field"><b>{f[0]}</b><span>{f[1]}</span></p> : <p key={i}>{l}</p>; })}
      {lines.length > 6 && <button type="button" className="op-link link-btn" onClick={() => setAll(!all)} aria-expanded={all} data-testid="button-posting-more">{all ? "Show less" : "Show the full posting"}</button>}
    </div>
  );
}

function JobCard({ j, fit, moved, canRate, defaultOpen, showPassed }: { j: Job; fit?: JobFit; moved?: JobRanking; canRate: boolean; defaultOpen: boolean; showPassed: boolean }) {
  const keepPass = useOwnerView(); // redesign stage 3, owners first
  const { ws, save, setWs, run, config } = useStore();
  const w = ws!;
  const [open, setOpen] = useState(defaultOpen);
  // Phones (Dilan, Nov 25): a short row in the list; tapping it opens the whole card as a sheet from the bottom.
  const phone = useIsMobile() && keepPass;
  const [sheet, setSheet] = useState(defaultOpen);
  // Pass (Demetre, Nov 24): the card swipes aside and fades, then the gap closes, instead of vanishing when the server answers.
  const card = useRef<HTMLElement>(null);
  const [gone, setGone] = useState(false);
  const leaving = useRef(false);
  // Resolves once the card is out of sight; the Pass is saved after that, so the card can't vanish before it moves.
  const swipeAway = async () => {
    const el = card.current;
    if (showPassed || leaving.current) return; // the list keeps passed cards, so it stays put and shows "Passed · undo"
    leaving.current = true;
    if (el && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await el.animate([{ transform: "none", opacity: 1 }, { transform: "translateX(56px) rotate(1.5deg)", opacity: 0 }], { duration: 260, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }).finished;
      await el.animate([{ height: `${el.offsetHeight}px` }, { height: "0px", paddingTop: "0px", paddingBottom: "0px", borderWidth: "0px" }], { duration: 200, easing: "ease-out", fill: "forwards" }).finished;
    }
    setGone(true);
    leaving.current = false;
  };
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
  if (gone) return null;
  const due = j.deadline && d !== null && d >= 0 && d <= 14 ? `closes ${fmtDate(j.deadline)}` : "";
  if (phone && !sheet) return (
    <button className="job-row" onClick={() => setSheet(true)} id={"job-" + j.id} data-testid="job-row">
      <OrgLogo company={j.company} url={j.applyUrl} />
      <span className="job-row-main"><b>{shortTitle(j.title, j.company)}</b><span>{[j.company, kindLabel[j.kind], due || shortPlace(j.location)].filter(Boolean).join(" · ")}</span></span>
      {eligChip(fit)}
    </button>
  );
  const addCal = () => run(() => save("calendar", [...w.calendar, { id: rid("cal"), title: `${j.company}: ${j.kind === "event" ? "event" : "deadline"}`, date: j.deadline, time: "", kind: j.kind === "event" ? "Event" : "Deadline", source: j.label === "Live" ? "From verified posting" : "From imported posting", linkedId: j.id, notes: j.deadlineText }]), "Added to your Remy calendar");
  const full = (
    <article ref={card} id={"job-" + j.id} className={"card card-pad stack-sm job-card" + (open ? " open" : "")} style={defaultOpen ? { borderColor: "var(--plum)" } : undefined} data-testid="card-job">
      <div className="row-between job-top" style={{ alignItems: "flex-start" }}>
        {keepPass && <OrgLogo company={j.company} url={j.applyUrl} />}
        <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
          <div className="row"><span className="xs muted">{j.company} · {kindLabel[j.kind]}</span><StatusChip label={j.label} />{eligChip(fit)}</div>
          <h3 title={shortTitle(j.title, j.company) !== j.title ? j.title : undefined}>{shortTitle(j.title, j.company)}</h3>
          <div className="row small muted"><span className="row" style={{ gap: 4 }} title={j.location}><MapPin size={14} style={{ flex: "none" }} />{keepPass ? shortPlace(j.location) : j.location || "Location not stated"}</span>{j.dates && <span>· {j.dates}</span>}</div>
        </div>
        {j.deadline && <span className={"chip " + (d !== null && d < 0 ? "chip-bad" : d !== null && d <= 7 ? "chip-setup" : "chip-plain")}>{d !== null && d < 0 ? "Deadline passed" : `Due ${fmtDate(j.deadline)}${d === 0 ? " · today" : d !== null ? ` · ${d}d` : ""}`}</span>}
      </div>
      {fit && <p className="small job-why"><strong>Why it fits you: </strong>{fit.why}</p>}
      {(() => { const r = reasonLine(ws!, j, fit, keepPass); return r.length ? <p className="xs muted" data-testid="job-reasons">{r.join(" · ")}</p> : null; })()}
      {fit?.regionMatch === false && <p className="xs muted" data-testid="job-outside">Outside the places you chose{fit.relocate ? `, shown because ${fit.relocate}` : ""}.</p>}
      {(() => { const known = w.contacts.filter((c) => sameOrg(c.org, j.company)); return known.length > 0 && <button className="xs job-contact" style={{ textAlign: "left", color: "var(--fox)", fontWeight: 700 }} onClick={() => go("/community")} data-testid="job-known-contact">You know {known.map((c) => c.name).join(", ")} here: ask about the team before you apply →</button>; })()}
      {/* These wait under Details on every screen, so a closed card is short (audit section 6). */}
      <div className="job-more stack-sm">
      {postingSkills(j.requirements).length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} data-testid="job-keywords">
          <span className="xs muted" style={{ fontWeight: 700 }}>Looking for:</span>
          {postingSkills(j.requirements).slice(0, 5).map((k) => <span key={k} className={"chip " + (fit?.matched.includes(k) ? "chip-live" : "chip-plain")} title={j.requirements.find((r) => r.keyword === k || skillsIn(r.quote).includes(k))?.quote}>{fit?.matched.includes(k) ? "✓ " : ""}{k}</span>)}
        </div>
      )}
      {fit && fit.eligibility !== "unknown" && <p className="xs muted"><strong>{fit.eligibility === "unlikely" ? "Why not: " : fit.checked && !fit.hidden ? "Why you qualify: " : "Eligibility: "}</strong>{fit.eligibilityNote}</p>}
      {fit?.hidden && <p className="xs muted"><strong>Why it's hidden: </strong>{fit.hidden}</p>}
      {moved && moved.adjustment !== 0 && <p className="xs muted row" style={{ gap: 4 }} data-testid="text-interest-moved">{moved.adjustment > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{moved.reasons[0]}</p>}
      {fit && fit.gaps.length > 0 && <p className="small muted"><strong>Gaps: </strong>{fit.gaps.slice(0, 3).join("; ")}</p>}
      </div>
      {open && (
        <div className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 4 }}>
          {shortTitle(j.title, j.company) !== j.title && <p className="xs muted" data-testid="job-full-title"><strong>Full title: </strong>{j.title}</p>}
          <PostingText text={j.postingText || j.summary} />
          <div className="grid-2">
            <div className="stack-sm"><span className="eyebrow">Eligibility (quoted)</span>{j.eligibility.length ? j.eligibility.map((e, i) => <span key={i} className="quote">{decodeEntities(e)}</span>) : <span className="small muted">Not stated</span>}
              {fit && <span className="xs muted">{fit.eligibilityNote}</span>}</div>
            <div className="stack-sm"><span className="eyebrow">Requirements (quoted)</span>{j.requirements.map((r) => <span key={r.id} className="quote"><strong>{r.keyword}:</strong> {decodeEntities(r.quote)}</span>)}</div>
          </div>
          {(() => { const sc = screeningFor(j); return sc && (
            <details className="notice stack-sm" data-testid="screening">
              <summary className="small" style={{ cursor: "pointer" }}><b>How {j.company} reviews applications</b> <span className="muted">· {sc.system}</span></summary>
              <div className="small stack-sm" style={{ marginTop: 6 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{sc.steps.map((s) => <li key={s}>{s}</li>)}</ul>
                <b>What to do</b>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{sc.tips.map((s) => <li key={s}>{s}</li>)}</ul>
                <span className="xs muted">This is how {sc.system} works in general. Remy can't see {j.company}'s own settings or who reads your application.</span>
              </div>
            </details>
          ); })()}
          <dl className="kv">
            <dt>Format</dt><dd>{j.format || "—"}</dd>
            <dt>Deadline</dt><dd>{j.deadlineText || "Not stated"}</dd>
            <dt>Source</dt><dd><a href={j.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--plum)" }}>{j.sourceName}</a></dd>
            <dt>Freshness</dt><dd>Checked {fmtDate(j.checkedAt)}{last ? ` · re-checked ${fmtDate(last.at)}: ${last.note}` : ""}</dd>
          </dl>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={recheck} disabled={!!busy} data-testid="button-recheck">{busy === "check" ? <Spinner /> : <RefreshCw size={14} />} Re-check it's still open</button>
            {keepPass && !saved && j.kind !== "event" && <button className="btn btn-ghost btn-sm" onClick={() => go(`/interview?job=${j.id}`)} data-testid="button-mock-interview-details"><Mic size={14} /> Mock interview</button>}
            <button className="btn btn-ghost btn-sm" onClick={explain} disabled={!!busy || !config?.ai.available || !w.resume}>{busy === "fit" ? <Spinner /> : <Sparkles size={14} />} Explain fit</button>
            {canRate && j.kind !== "event" ? (keepPass ? null : <Interest j={j} hidden={hidden} />) : <button className="btn btn-ghost btn-sm" onClick={() => save("hiddenJobIds", hidden ? w.hiddenJobIds.filter((x) => x !== j.id) : [...w.hiddenJobIds, j.id])}>{hidden ? "Show it again" : "Not interested"}</button>}
            {/* Only postings the student added can be removed; a live one would come back on the next search. */}
            {j.origin === "imported" && !/job board/i.test(j.sourceName || "") && <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={async () => { const r = await run(() => api<Workspace>("DELETE", `/api/jobs/${j.id}`)); if (r) { setWs(r); reloadJobs(); } }}><Trash2 size={14} /> Remove</button>}
          </div>
        </div>
      )}
      <div className="row job-acts" style={{ marginTop: 4 }}>
        {j.kind !== "event" && <button className="btn btn-primary btn-sm" onClick={() => go(`/resume?tab=tailor&job=${j.id}&go=1`)} data-testid="button-tailor-job">Tailor resume</button>}
        <ApplyLink j={j} />
        {keepPass && canRate && j.kind !== "event" ? <KeepPass j={j} saved={saved} hidden={hidden} onPass={swipeAway} onUndo={() => { leaving.current = false; setGone(false); }} /> : (
        <button className="btn btn-ghost btn-sm" onClick={() => save("savedJobIds", saved ? w.savedJobIds.filter((x) => x !== j.id) : [...w.savedJobIds, j.id])} data-testid="button-save-job">{saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {saved ? "Saved" : "Save"}</button>)}
        {keepPass && saved && j.kind !== "event" && <button className="btn btn-ghost btn-sm" onClick={() => go(`/interview?job=${j.id}`)} data-testid="button-mock-interview"><Mic size={14} /> Mock interview</button>}
        {j.deadline && <button className="btn btn-ghost btn-sm" onClick={addCal} disabled={onCal} data-testid="button-add-calendar"><CalendarPlus size={14} /> {onCal ? "On calendar" : "Add to calendar"}</button>}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setOpen((o) => !o)} data-testid="button-job-details">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Details</button>
      </div>
      {last && open && <span className={"xs " + (last.result === "reachable" ? "pass" : "fail")} data-testid="text-last-check">Last re-check {new Date(last.at).toLocaleString()}: {last.result === "reachable" ? "reachable" : last.result === "closed-signal" ? "page suggests it's closed" : "couldn't reach"}{last.httpStatus ? ` (HTTP ${last.httpStatus})` : ""}</span>}
    </article>
  );
  return phone ? <Modal title={shortTitle(j.title, j.company)} onClose={() => setSheet(false)}><div className="job-sheet">{full}</div></Modal> : full;
}

// "More like this" / "Not for me" (Julio's interest system, Nov 6 2026): the student's own taps re-order their openings,
// and an optional reason carries the like or pass over to similar openings. "Not for me" asks why first (or "Just hide it"),
// then saves and hides the card in one step, so nothing is half-done if the student walks away.
/** Redesign stage 3 (owners first): a plain Keep / Pass on every opening ("like dating apps"). Keep saves it and tells
 *  Remy you want more like it; Pass hides it and tells Remy the opposite. Same signal swipe mode will use later. */
function KeepPass({ j, saved, hidden, onPass, onUndo }: { j: Job; saved: boolean; hidden: boolean; onPass: () => Promise<void>; onUndo: () => void }) {
  const { ws, setWs, run, toast } = useStore();
  // The tap shows at once; the server catches up (it re-ranks openings, which took ~4 s, Dilan Nov 23). A failed save puts it back.
  const [shown, setShown] = useState<null | { kept: boolean; hidden: boolean }>(null);
  const [pop, setPop] = useState(false);
  const kept = shown ? shown.kept : saved && (ws!.jobFeedback?.[j.id]?.rating ?? 0) >= 4;
  if (shown) hidden = shown.hidden;
  const now = (next: { kept: boolean; hidden: boolean }, p: Promise<unknown>) => { setShown(next); p.finally(() => setShown(null)); };
  const put = (body: object) => run(() => api<Workspace>("PUT", `/api/jobs/${j.id}/interest`, body)).then((r) => { if (r) setWs(r); return r; });
  const unpass = () => run(() => api<Workspace>("DELETE", `/api/jobs/${j.id}/interest?unhide=1`)).then((r) => r && setWs(r));
  const undo = () => now({ kept: false, hidden: false }, unpass());
  // Keep (Demetre, Nov 24): the button pops, and a toast says where it went with a link to the kept list.
  const keep = () => {
    setPop(true);
    toast(`Kept ${j.company}. Remy will find more like it.`, false, { label: "See kept", run: () => go("/opportunities?kept=1") });
    now({ kept: true, hidden: false }, put({ rating: 5, keep: true }));
  };
  const unkeep = () => now({ kept: false, hidden: false }, run(() => api<Workspace>("DELETE", `/api/jobs/${j.id}/interest`)).then((r) => r && run(() => api<Workspace>("PUT", "/api/ws/savedJobIds", { value: r.savedJobIds.filter((x) => x !== j.id) })).then((r2) => r2 && setWs(r2))));
  const pass = () => {
    toast(`Passed on ${j.company}.`, false, { label: "Undo", run: () => { onUndo(); unpass(); } });
    onPass().then(() => now({ kept: false, hidden: true }, put({ rating: 1, hide: true }).then((r) => { if (!r) onUndo(); })));
  };
  if (hidden) return <button className="btn btn-ghost btn-sm" onClick={undo} data-testid="button-unpass">Passed · undo</button>;
  return (
    <>
      <button className={`btn btn-sm ${kept ? "btn-secondary" : "btn-ghost"}${pop ? " kp-pop" : ""}`} aria-pressed={kept} onAnimationEnd={() => setPop(false)} onClick={kept ? unkeep : keep} data-testid="button-keep">
        <Check size={14} /> {kept ? "Kept" : "Keep"}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={pass} data-testid="button-pass"><X size={14} /> Pass</button>
    </>
  );
}

function Interest({ j, hidden }: { j: Job; hidden: boolean }) {
  const { ws, setWs, save, run } = useStore();
  const w = ws!;
  const mine = w.jobFeedback?.[j.id];
  const liked = !!mine && mine.rating >= 4;
  const [asking, setAsking] = useState<"" | "up" | "down">("");
  // Openings found on job boards only say "Remote" or nothing, so "remote or not" only works when it says remote.
  const reasons: [JobInterestReason, string][] = [["role", "the role"], ["company", "the employer"], ["location", "the location"], ...(/remote/i.test(j.format) && !/hybrid|on-?site|in[- ]person/i.test(j.format) ? [["format", "remote work"] as [JobInterestReason, string]] : [])];
  const put = (rating: 1 | 5, reason?: JobInterestReason) => run(() => api<Workspace>("PUT", `/api/jobs/${j.id}/interest`, { rating, ...(reason ? { reason } : {}), ...(rating === 1 ? { hide: true } : {}) }));
  const like = async (reason?: JobInterestReason) => { const r = await put(5, reason); if (r) { setWs(r); setAsking(reason ? "" : "up"); } };
  const pass = async (reason?: JobInterestReason) => {
    const r = await put(1, reason); // the server rates and hides it in one step
    if (r) { setWs(r); setAsking(""); }
  };
  const clear = async (unhide = false) => { const r = await run(() => api<Workspace>("DELETE", `/api/jobs/${j.id}/interest${unhide ? "?unhide=1" : ""}`)); if (r) { setWs(r); setAsking(""); } return r; };
  // Rated cards un-hide in the same request; cards hidden the old way (no rating) just leave the hidden list.
  const showAgain = () => (mine ? clear(true) : save("hiddenJobIds", w.hiddenJobIds.filter((x) => x !== j.id)));
  if (hidden) return <button className="btn btn-ghost btn-sm" onClick={showAgain} data-testid="button-show-again">Show it again</button>;
  return (
    <>
      <button className="btn btn-ghost btn-sm" aria-pressed={liked} onClick={() => (liked ? clear() : like())} data-testid="button-more-like-this"><ThumbsUp size={14} /> {liked ? "Liked" : "More like this"}</button>
      <button className="btn btn-ghost btn-sm" aria-expanded={asking === "down"} onClick={() => setAsking(asking === "down" ? "" : "down")} data-testid="button-not-for-me"><ThumbsDown size={14} /> Not for me</button>
      {asking && (
        <div className="row xs" style={{ gap: 6, flexBasis: "100%" }} role="group" aria-label="Why (optional)">
          <span className="muted">{asking === "up" ? "What did you like? (optional, Remy applies it to similar openings)" : "What puts you off? Remy hides this one and applies your answer to similar openings."}</span>
          {reasons.map(([k, label]) => <button key={k} className="pref-chip" aria-pressed={asking === "up" && mine?.reason === k} onClick={() => (asking === "up" ? like(k) : pass(k))} data-testid={`chip-reason-${k}`}>{label}</button>)}
          <button className="btn btn-ghost btn-sm" onClick={() => (asking === "down" ? pass() : setAsking(""))} data-testid="button-reason-skip">{asking === "down" ? "Just hide it" : "Skip"}</button>
        </div>
      )}
    </>
  );
}
