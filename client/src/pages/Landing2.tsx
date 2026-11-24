import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { FIELD_GROUPS, fieldFor } from "@shared/fields";
import { go } from "../lib/router";
import { useOwnerView, useStore } from "../lib/store";
import { BetaBadge, Remy } from "../components/common";
import { ThemeToggle } from "../components/ThemeToggle";
import { useTeam } from "./Info";
import { FieldBrowser, LinkedInMark, applyHref } from "./Welcome";

export const INSTAGRAM = "https://www.instagram.com/coachremyai/";
export const LINKEDIN = "https://www.linkedin.com/company/remyai-org/";

function InstagramMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The simpler front page (owners only until Dilan releases it): one message, the real app, the real team, our socials. */
export function Top({ inside, what = "#what" }: { inside: boolean; what?: string }) {
  return (
    <header className="lp2-top">
      <a className="logo" href="/" aria-label="Remy home">Remy <BetaBadge /></a>
      <nav className="lp2-nav" aria-label="Main">
        <a className="hide-sm" href={what}>What Remy does</a>
        <a className="hide-sm" href="/about">About</a>
        <ThemeToggle className="lp2-theme" />
        <a className="lp2-btn lp2-btn-sm" href={inside ? "/" : "/signin"} data-testid="button-lp-signin">{inside ? "Open my Remy" : "Sign in"}</a>
      </nav>
    </header>
  );
}

/** "Where does my major lead?" with real BLS numbers, public (moved off the homepage to keep it short). Owners only for now. */
export function Careers() {
  const { me, ws } = useStore();
  if (!useOwnerView()) return <Landing2Fallback />;
  return (
    <div className={PAGE}>
      <div className="lp2-w">
        <Top inside={!!(me && ws?.started)} what="/welcome#what" />
        <main className="lp2-careers">
          <h1>Where does your major lead?</h1>
          <p className="lp2-sub">Pick a major and see the jobs people go into, with real pay and growth from the U.S. Bureau of Labor Statistics.</p>
          <FieldBrowser />
        </main>
      </div>
    </div>
  );
}

// The light/dark "Try it now" look Dilan picked (Nov 22); its colours live in the .lk-try block of index.css.
const PAGE = "lp2 lk lk-try";
const YEARS = ["freshman", "sophomore", "junior", "senior"];
type Occ = { title: string; change: number; wage: number | null };
type Ex = { field: string; intern: [string, string]; grad: [string, string]; hidden: [string, string]; step: [string, string]; first?: [string, string] };
/** Extra fields, written once: [major, field word, internship, new-grad role, city, posting hidden, why hidden, next step, why]. */
function more(rows: [string, string, string, string, string, string, string, string, string][]): Record<string, Ex> {
  return Object.fromEntries(rows.map(([m, field, intern, grad, city, hid, why, step, stepWhy]) =>
    [m, { field, intern: [intern, `${city} · closes Feb 1`], grad: [grad, `${city} · closes Mar 15`], hidden: [hid, why], step: [step, stepWhy] }]));
}
const ALL_MAJORS = FIELD_GROUPS.flatMap(([, o]) => o);
// Example cards for "Try it now": every one follows the picked major (and the opening follows the year), so nothing says "marketing" to a nursing student.
const EXAMPLES: Record<string, Ex> = {
  Marketing: { field: "marketing", intern: ["Marketing Intern, Summer 2027", "Dallas, TX · closes Jan 31"], grad: ["Marketing Coordinator, new grad", "Dallas, TX · closes Feb 28"], hidden: ["Senior Marketing Associate", "needs 3 years of experience"], step: ["Add how many followers the club's Instagram gained.", "That bullet has no number yet. A real figure makes it stand out."] },
  Finance: { field: "finance", intern: ["Finance Intern, Summer 2027", "Fort Worth, TX · closes Feb 14"], grad: ["Financial Analyst I, new grad", "Fort Worth, TX · closes Mar 15"], hidden: ["Senior Financial Analyst", "needs 4 years of experience"], step: ["Add the size of the budget you managed.", "That bullet has no dollar figure yet. A real number makes it stand out."] },
  Nursing: { field: "nursing", intern: ["Nursing Student Summer Program, 2027", "Fort Worth, TX · closes Feb 1"], grad: ["New Grad RN Residency", "Fort Worth, TX · closes Mar 1"], hidden: ["ICU Registered Nurse", "needs an RN license and 2 years of experience"], step: ["Add your clinical hours and units.", "Hospitals look for them first, and your resume doesn't list them yet."], first: ["Add your CPR or BLS card.", "Hospitals look for it first, and your resume doesn't list it yet."] },
  Engineering: { field: "engineering", intern: ["Engineering Intern, Summer 2027", "Austin, TX · closes Jan 15"], grad: ["Associate Engineer, new grad", "Austin, TX · closes Feb 15"], hidden: ["Senior Mechanical Engineer", "needs 5 years of experience"], step: ["Add what your class design project achieved.", "That bullet says what you built, not how well it worked. A real result makes it stand out."] },
  "Psychology & social work": { field: "psychology and social work", intern: ["Research Assistant Intern, Summer 2027", "Dallas, TX · closes Mar 1"], grad: ["Case Manager, new grad", "Dallas, TX · closes Apr 1"], hidden: ["Licensed Clinical Social Worker", "needs a master's degree and a license"], step: ["Add the hours you volunteered on the crisis line.", "That bullet has no number yet. A real figure makes it stand out."] },
  ...more([
    ["Investment banking", "investment banking", "Investment Banking Summer Analyst, 2027", "Investment Banking Analyst, new grad", "Dallas, TX", "Investment Banking Associate", "needs an MBA or 3 years as an analyst", "Add the deal you modeled in the investment club.", "That bullet says you joined, not what you built. Name the model and the company."],
    ["Accounting", "accounting", "Audit Intern, Summer 2027", "Audit Associate, new grad", "Fort Worth, TX", "Audit Senior", "needs a CPA license and 3 years of experience", "Add your accounting GPA and CPA plan.", "Firms check both first, and your resume doesn't show them yet."],
    ["Consulting", "consulting", "Consulting Summer Intern, 2027", "Business Analyst, new grad", "Dallas, TX", "Engagement Manager", "needs 5 years of consulting experience", "Add the case competition you entered.", "Firms look for case work, and it isn't on your resume yet."],
    ["Sales", "sales", "Sales Intern, Summer 2027", "Sales Development Representative, new grad", "Dallas, TX", "Regional Sales Manager", "needs 6 years in sales", "Add how much you raised for your club's fundraiser.", "Sales teams want a number, and that bullet doesn't have one yet."],
    ["Business & management", "business", "Business Operations Intern, Summer 2027", "Rotational Leadership Program, new grad", "Fort Worth, TX", "Operations Manager", "needs 5 years of management experience", "Add the team you led and what it got done.", "That bullet says your title, not what changed. A real result makes it stand out."],
    ["Entrepreneurship", "entrepreneurship", "Startup Operations Intern, Summer 2027", "Founder's Associate, new grad", "Austin, TX", "Head of Growth", "needs 6 years at a startup", "Add what your side business sold.", "A real number of customers or sales makes it stand out."],
    ["Human resources", "human resources", "HR Intern, Summer 2027", "HR Associate, new grad", "Dallas, TX", "HR Business Partner", "needs 5 years of HR experience and a SHRM certification", "Add the new members you recruited for your club.", "That bullet has no number yet. A real figure makes it stand out."],
    ["Supply chain & operations", "supply chain", "Supply Chain Intern, Summer 2027", "Supply Chain Analyst, new grad", "Fort Worth, TX", "Logistics Manager", "needs 5 years of experience", "Add how much time or money your class project saved.", "Operations teams look for a result, and that bullet doesn't show one."],
    ["Real estate", "real estate", "Real Estate Analyst Intern, Summer 2027", "Real Estate Analyst, new grad", "Dallas, TX", "Acquisitions Director", "needs 8 years in real estate", "Add the property you valued in your real estate class.", "Firms want to see a deal you worked, and it isn't on your resume yet."],
    ["Software & computer science", "computer science", "Software Engineering Intern, Summer 2027", "Software Engineer I, new grad", "Austin, TX", "Senior Software Engineer", "needs 5 years of experience", "Link the app you built for class.", "Recruiters click through to your code, and there's no link yet."],
    ["Data & analytics", "data and analytics", "Data Analyst Intern, Summer 2027", "Data Analyst, new grad", "Dallas, TX", "Senior Data Scientist", "needs a master's degree and 4 years of experience", "Add the tools you used in your statistics project.", "Postings ask for SQL and Python by name, and your bullet doesn't say them."],
    ["Information systems & IT", "information systems", "IT Intern, Summer 2027", "IT Analyst, new grad", "Fort Worth, TX", "IT Manager", "needs 7 years of experience", "Add the help-desk tickets you handled at your campus job.", "That bullet has no number yet. A real figure makes it stand out."],
    ["Cybersecurity", "cybersecurity", "Cybersecurity Intern, Summer 2027", "Security Analyst, new grad", "San Antonio, TX", "Senior Penetration Tester", "needs an OSCP certification and 4 years of experience", "Add the capture-the-flag contest you placed in.", "Security teams look for hands-on proof, and it isn't on your resume yet."],
    ["Architecture & construction", "construction", "Construction Management Intern, Summer 2027", "Assistant Project Manager, new grad", "Dallas, TX", "Senior Project Manager", "needs 8 years of experience", "Add the size of the project you worked on last summer.", "A dollar figure or square footage makes it stand out."],
    ["Aviation", "aviation", "Aviation Operations Intern, Summer 2027", "Airline Operations Analyst, new grad", "Fort Worth, TX", "Airline Captain", "needs 1,500 flight hours and an ATP certificate", "Add your flight hours and ratings.", "Airlines check them first, and your resume doesn't list them yet."],
    ["Healthcare & medicine", "healthcare", "Clinical Research Intern, Summer 2027", "Clinical Research Coordinator, new grad", "Dallas, TX", "Physician Assistant", "needs a PA license", "Add your shadowing and volunteer hours.", "Programs and clinics look for hours first, and your resume doesn't list them yet."],
    ["Science & research", "science", "Summer Research Intern, 2027", "Research Technician, new grad", "Houston, TX", "Research Scientist", "needs a PhD", "Add the lab techniques you've used.", "Labs search for techniques by name, and your bullet doesn't say them."],
    ["Environment & sustainability", "sustainability", "Sustainability Intern, Summer 2027", "Environmental Analyst, new grad", "Austin, TX", "Environmental Program Manager", "needs 6 years of experience", "Add the campus sustainability project you worked on.", "A result, like waste cut or trees planted, makes it stand out."],
    ["Education & teaching", "education", "Summer Teaching Fellow, 2027", "Elementary Teacher, new grad", "Fort Worth, TX", "Assistant Principal", "needs a master's degree and 5 years of teaching", "Add the students you tutored and how they did.", "Schools look for results with students, and that bullet doesn't show one."],
    ["Law & government", "law and government", "Legislative Intern, Spring 2027", "Legal Assistant, new grad", "Austin, TX", "Associate Attorney", "needs a law degree and a bar license", "Add the policy paper you wrote.", "Offices want writing samples, and your resume doesn't name it yet."],
    ["Public safety", "public safety", "Emergency Management Intern, Summer 2027", "Emergency Management Coordinator, new grad", "Fort Worth, TX", "Police Lieutenant", "needs 8 years of service", "Add your CPR, first aid or EMT card.", "Agencies check certifications first, and yours aren't listed yet."],
    ["Nonprofit & ministry", "nonprofit work", "Nonprofit Program Intern, Summer 2027", "Program Coordinator, new grad", "Fort Worth, TX", "Executive Director", "needs 10 years of nonprofit leadership", "Add the volunteers you organized.", "That bullet has no number yet. A real figure makes it stand out."],
    ["Art & design", "art and design", "Graphic Design Intern, Summer 2027", "Junior Designer, new grad", "Dallas, TX", "Art Director", "needs 7 years of experience", "Link your portfolio.", "Design teams look at your work first, and there's no link yet."],
    ["Film, theater & music", "film, theater and music", "Production Intern, Summer 2027", "Production Assistant, new grad", "Austin, TX", "Producer", "needs 6 years of production credits", "Add the productions you worked on, with your role.", "Crews hire by credits, and your resume doesn't list them yet."],
    ["Journalism & communications", "communications", "Communications Intern, Summer 2027", "Communications Coordinator, new grad", "Dallas, TX", "Communications Director", "needs 8 years of experience", "Link two articles you've published.", "Editors read clips first, and there are no links yet."],
    ["Hospitality & events", "hospitality", "Hotel Operations Intern, Summer 2027", "Hotel Management Trainee, new grad", "Dallas, TX", "General Manager", "needs 8 years in hotel management", "Add the size of the event you helped run.", "A number of guests makes it stand out."],
    ["Sports & recreation", "sports", "Athletics Operations Intern, Summer 2027", "Ticket Sales Associate, new grad", "Arlington, TX", "Director of Team Operations", "needs 7 years in sports", "Add the games you worked and what you ran.", "Teams look for game-day experience, and that bullet doesn't show it yet."],
  ]),
};
// The middle card's "try it": a resume line with no number, Remy's question, and the line rewritten with only what the
// visitor typed (no invented claims). [line before, question, sample answer, line after with {x}].
const TRY: Record<string, [string, string, string, string]> = {
  Marketing: ["Ran the club's Instagram account", "How many followers did it gain?", "1,200", "Grew the club's Instagram by {x} followers with a weekly posting plan"],
  Finance: ["Managed the club budget", "How big was the budget?", "$8,000", "Managed a {x} club budget, tracked in a monthly Excel report"],
  Nursing: ["Completed clinical rotations", "How many clinical hours?", "180", "Completed {x} clinical hours across med-surg and pediatric units"],
  Engineering: ["Built a robot arm for design class", "How accurate did it get?", "2 mm", "Built a robot arm for design class that placed parts within {x}"],
  "Psychology & social work": ["Volunteered on a crisis line", "How many hours?", "120", "Answered calls on a crisis line for {x} volunteer hours"],
  "Investment banking": ["Modeled a deal in the investment club", "Which company?", "Southwest Airlines", "Built a DCF model valuing {x} for the investment club's pitch"],
  Accounting: ["Did bookkeeping for a family business", "How many transactions a month?", "300", "Recorded about {x} transactions a month for a family business"],
  Consulting: ["Competed in a case competition", "How did you place?", "2nd of 24 teams", "Placed {x} in a strategy case competition"],
  Sales: ["Ran the club fundraiser", "How much did you raise?", "$3,500", "Raised {x} running the club's spring fundraiser"],
  "Business & management": ["Led a student organization", "How many members?", "40", "Led a student organization of {x} members"],
  Entrepreneurship: ["Started a T-shirt business", "How many did you sell?", "250", "Started a T-shirt business and sold {x} shirts"],
  "Human resources": ["Recruited new club members", "How many joined?", "35", "Recruited {x} new members for the club"],
  "Supply chain & operations": ["Improved a process for a class project", "How much time did it save?", "20%", "Cut processing time by {x} in a class operations project"],
  "Real estate": ["Valued a property in real estate class", "What was it worth?", "$2.1M", "Valued a {x} apartment property for a real estate class"],
  "Software & computer science": ["Built a web app for class", "How many people used it?", "150", "Built a web app for class used by {x} students"],
  "Data & analytics": ["Analyzed survey data for a class", "How many responses?", "1,000", "Analyzed {x} survey responses in Python for a class project"],
  "Information systems & IT": ["Worked the campus help desk", "Tickets a week?", "60", "Resolved about {x} help-desk tickets a week"],
  Cybersecurity: ["Competed in capture-the-flag contests", "Best finish?", "top 10%", "Finished in the {x} of a capture-the-flag contest"],
  "Architecture & construction": ["Interned on a building project", "Project size?", "$12M", "Supported a {x} building project as a summer intern"],
  Aviation: ["Training for my private pilot license", "Flight hours so far?", "45", "Logged {x} flight hours toward a private pilot license"],
  "Healthcare & medicine": ["Shadowed physicians", "How many hours?", "60", "Shadowed physicians for {x} hours in family medicine"],
  "Science & research": ["Worked in a biology lab", "Which techniques?", "PCR and gel electrophoresis", "Ran {x} in a biology research lab"],
  "Environment & sustainability": ["Helped with campus recycling", "What changed?", "15% less waste", "Helped the campus recycling program reach {x}"],
  "Education & teaching": ["Tutored middle schoolers", "How many students?", "12", "Tutored {x} middle schoolers in math each week"],
  "Law & government": ["Wrote a policy paper", "On what topic?", "housing costs in Fort Worth", "Wrote a policy paper on {x}"],
  "Public safety": ["Volunteered with the fire department", "How many hours?", "80", "Volunteered {x} hours with the local fire department"],
  "Nonprofit & ministry": ["Organized volunteers for a food drive", "How many volunteers?", "30", "Organized {x} volunteers for a campus food drive"],
  "Art & design": ["Designed posters for campus events", "How many events?", "15", "Designed posters for {x} campus events"],
  "Film, theater & music": ["Worked on student productions", "How many?", "6", "Worked crew on {x} student productions"],
  "Journalism & communications": ["Wrote for the student paper", "How many articles?", "18", "Wrote {x} articles for the student newspaper"],
  "Hospitality & events": ["Helped run a campus event", "How many guests?", "400", "Helped run a campus event for {x} guests"],
  "Sports & recreation": ["Worked game days for athletics", "How many games?", "20", "Worked {x} game days for the athletics department"],
};
/** The example opening for a year: seniors see a full-time new-grad role, everyone else a summer internship. */
export const example = (major: string, year: string) => {
  // A typed major ("Biology") uses its field's example, in the student's own words.
  const known = EXAMPLES[major] ? major : fieldFor(major);
  const ex = known ? { ...EXAMPLES[known], ...(known !== major ? { field: major.toLowerCase() } : {}) } : EXAMPLES.Marketing;
  const [title, where] = year === "senior" ? ex.grad : ex.intern;
  return { ...ex, lookup: known || "Marketing", tryIt: TRY[known || "Marketing"] || TRY.Marketing, step: year === "freshman" && ex.first || ex.step, title, where, short: title.split(",")[0], due: where.split("· ")[1].replace("closes", "due"), years: year === "freshman" ? "freshmen" : year + "s" };
};

/** The year and major menus in "I'm a ___ studying ___": the dashed word opens a card list in the page's own look
 *  (Dilan Nov 23: the browser's menu looked out of place). The major menu filters as you type and takes any major
 *  Remy can place in a field ("Biology" → science). */
function Pick({ label, value, options, onPick, testid, search, groups }: { label: string; value: string; options: string[]; onPick: (v: string) => void; testid: string; search?: boolean; groups?: [string, string[]][] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const shown = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  // A typed major only when no listed one matches ("Biology"), so "Investment" still picks Investment banking.
  const typed = q.trim().length > 2 && !shown.length && fieldFor(q) ? q.trim() : "";
  const choose = (v: string) => { onPick(v); setOpen(false); setQ(""); box.current?.querySelector<HTMLButtonElement>(".lk-pick-btn")?.focus(); };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); box.current?.querySelector<HTMLButtonElement>(".lk-pick-btn")?.focus(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(box.current?.querySelectorAll<HTMLElement>("[role=option], .lk-pick-q") || [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };
  return (
    <span className="lk-pick" ref={box} onKeyDown={keys}>
      <button type="button" className="lk-pick-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${value}`} onClick={() => setOpen(!open)} data-testid={testid}>{value}<ChevronDown size={16} aria-hidden /></button>
      {open && (
        <span className="lk-pick-pop" role="dialog" aria-label={`Pick your ${label.toLowerCase()}`}>
          {search && <input className="lk-pick-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (typed || shown[0])) { e.preventDefault(); choose(typed || shown[0]); } }} placeholder="Type your major" aria-label="Type your major" data-testid={`${testid}-search`} />}
          <span className="lk-pick-list" role="listbox" aria-label={label}>
            {typed && <button type="button" role="option" aria-selected={false} onClick={() => choose(typed)} data-testid={`${testid}-typed`}>{typed}</button>}
            {shown.map((o) => [groups && !q.trim() && groups.find(([, g]) => g[0] === o) && <span key={"h" + o} className="lk-pick-h" role="presentation">{groups.find(([, g]) => g[0] === o)![0]}</span>, <button key={o} type="button" role="option" aria-selected={o === value} autoFocus={!search && o === value} onClick={() => choose(o)} data-testid={`${testid}-opt-${o.split(/\W/)[0].toLowerCase()}`}>{o}{o === value && <Check size={14} aria-hidden />}</button>])}
            {!shown.length && !typed && <span className="lk-pick-none">No match yet. Try a field like &ldquo;biology&rdquo; or &ldquo;business&rdquo;.</span>}
          </span>
        </span>
      )}
    </span>
  );
}

/** "Investment banking" leads with financial and investment analysts, not accountants: titles sharing a word stem with
 *  the major go first, then the BLS order (most openings). */
const closest = (jobs: Occ[], major: string) => {
  const stems = major.toLowerCase().split(/\W+/).filter((w) => w.length > 3).map((w) => w.slice(0, 5));
  const hit = (o: Occ) => stems.some((st) => o.title.toLowerCase().includes(st));
  return [...jobs.filter(hit), ...jobs.filter((o) => !hit(o))];
};

/** The middle card's try-it: the visitor types the number their line is missing and watches Remy rewrite it. Only
 *  their own words go in, so it shows how Remy works without inventing anything. */
function TryLine({ t }: { t: [string, string, string, string] }) {
  const [before, ask, sample, after] = t;
  const [v, setV] = useState("");
  const x = v.trim();
  return (
    <div className="lk-try-line">
      <p className="lk-was"><span>Your line now</span><s>{before}</s></p>
      <label className="lk-try-ask"><span>{ask}</span>
        <input value={v} onChange={(e) => setV(e.target.value.slice(0, 40))} placeholder={`e.g. ${sample}`} data-testid="input-lp-try" /></label>
      <p className={"lk-now" + (x ? " on" : "")} aria-live="polite"><span>{x ? "Remy\u2019s rewrite" : "Type it and watch"}</span><span>{after.split("{x}").map((part, i) => <span key={i}>{i > 0 && <b>{x || "\u2026"}</b>}{part}</span>)}</span></p>
    </div>
  );
}

export default function Landing2() {
  const { config, me, ws } = useStore();
  const inside = !!(me && ws?.started);
  const team = useTeam();
  const beta = !!config?.beta?.on && !inside;
  const start = inside ? "/" : beta ? applyHref(config?.beta?.formUrl) : "/signin";
  const startLabel = inside ? "Open my Remy" : beta ? "Apply to be a beta tester" : "Create your account";
  const ext: Record<string, string> = beta ? { target: "_blank", rel: "noreferrer" } : {};
  const out = { target: "_blank", rel: "noreferrer" };
  const page = useRef<HTMLDivElement>(null);
  const [major, setMajor] = useState("Marketing");
  const [year, setYear] = useState(YEARS[1]);
  const [jobs, setJobs] = useState<Occ[] | null>(null);
  const ex = example(major, year);
  useEffect(() => {
    let live = true;
    setJobs(null);
    fetch("/api/public/careers?field=" + encodeURIComponent(ex.lookup)).then((r) => r.json()).then((d) => live && setJobs(closest(d?.[0]?.jobs || [], major).slice(0, 3))).catch(() => live && setJobs([]));
    return () => { live = false; };
  }, [ex.lookup]);
  // Sections ease in as they scroll into view (CSS keeps them visible when motion is reduced or JS is off).
  useEffect(() => {
    const els = page.current?.querySelectorAll(".rv") || [];
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((list) => { for (const x of list) if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return (
    <div className={PAGE} ref={page}>
      <div className="lp2-w">
        <Top inside={inside} />

        <main>
          <section className="lk-hero lk-try-hero">
            <div className="lk-top">
            <div>
            <h1>Find the jobs you can actually get.</h1>
            <p className="lp2-lede">Tell Remy your year and major. It reads 180+ employers&rsquo; own career sites and shows what fits you.</p>
            </div>
            <figure className="lk-remy" aria-hidden>
              <span className="lk-bubble">Hi, I&rsquo;m Remy. Tell me your year and major and I&rsquo;ll show you what fits.</span>
              <span className="lk-medal"><Remy size={250} mood="wave" /></span>
            </figure>
            </div>
            <div className="lk-ask">
              <p>I&rsquo;m a{" "}
                <Pick label="Year" value={year} options={YEARS} onPick={setYear} testid="select-lp-year" />{" "}
                <span className="lk-ask-m">studying <Pick label="Major" value={major} options={ALL_MAJORS} groups={FIELD_GROUPS} onPick={setMajor} testid="select-lp-major" search /></span>
              </p>
              <a className="lp2-btn lp2-btn-lg" href={start} {...ext} data-testid="button-lp-start">{inside ? "Open my Remy" : "Show me my matches"}</a>
            </div>
            <div className="lk-results">
              <div className="lk-card"><p className="lk-small">Openings that fit a {year}</p>
                <div className="lk-job"><div><b>{ex.title}</b><span>{ex.where}</span></div><span className="lk-ok">You qualify</span></div>
                <p className="lk-why">It&rsquo;s open to {ex.years} in {ex.field}. That&rsquo;s you.</p>
                <div className="lk-job lk-hide"><div><b>{ex.hidden[0]}</b><span>Hidden: {ex.hidden[1]}</span></div></div>
                {/* A second hidden one fills the card level with the other two and shows the year rule at work. */}
                <div className="lk-job lk-hide"><div><b>{year === "senior" ? ex.intern[0] : ex.grad[0]}</b><span>Hidden: {year === "senior" ? "for students returning next fall" : "starts after you graduate"}</span></div></div>
              </div>
              <div className="lk-card lk-say"><p className="lk-small">Remy&rsquo;s next step for you</p>
                <p className="lk-step">{ex.step[0]}</p>
                <TryLine key={ex.lookup} t={ex.tryIt} />
              </div>
              <div className="lk-card" aria-live="polite"><p className="lk-small">Where {major.toLowerCase()} leads</p>
                {!jobs ? <p className="lk-occ"><span>Loading&hellip;</span></p> : jobs.map((o) => <p key={o.title} className="lk-occ"><b>{o.title}</b><span>{[o.wage ? `$${o.wage.toLocaleString("en-US")} median` : "", o.change ? `${o.change > 0 ? "+" : ""}${o.change}% by 2035` : ""].filter(Boolean).join(" · ")}</span></p>)}
              </div>
            </div>
            <p className="lk-note">The opening and next step are examples; the rewrite uses only what you type. Career numbers are live from the U.S. Bureau of Labor Statistics.</p>
          </section>
        </main>
      </div>

      <section className="lp2-sec" id="what" aria-labelledby="what-h">
        <div className="lp2-w">
          <h2 id="what-h">What Remy does</h2>
          <div className="lp2-three rv">
            <div>
              <span className="lk-num">01</span><h3>Openings you can actually get</h3><p>Remy reads 180+ employers&rsquo; own career sites and checks each posting against your year, field, location, start date and visa needs. Postings you can&rsquo;t apply to are hidden, and every opening says why it fits you.</p>
              <div className="lp-shot" aria-hidden>
                <div className="lp-job"><div><b>{ex.title}</b><span>{ex.where}</span></div><span className="chip chip-live">You qualify</span></div>
                <p className="lp-why">It&rsquo;s open to {ex.years} in {ex.field}. You&rsquo;re a {year} in {ex.field}.</p>
                <div className="lp-job lp-hidden"><div><b>{ex.hidden[0]}</b><span>Hidden: {ex.hidden[1]}</span></div></div>
              </div>
            </div>
            <div>
              <span className="lk-num">02</span><h3>A resume that fits each job and stays true</h3><p>Line-by-line suggestions for each opening. Anything your resume can&rsquo;t back up gets flagged, and you approve every word before it&rsquo;s used.</p>
              <div className="lp-shot" aria-hidden>
                <p className="lp-old">{ex.tryIt[0]}</p>
                <p className="lp-new">{ex.tryIt[3].replace("{x}", ex.tryIt[2])}</p>
                <div className="lp-flag"><ShieldCheck size={15} /><span><b>Flagged:</b> &ldquo;{ex.tryIt[2]}&rdquo; isn&rsquo;t on your resume yet, so Remy asks you first.</span></div>
              </div>
            </div>
            <div>
              <span className="lk-num">03</span><h3>A plan for this week</h3><p>Deadlines and next steps become dated to-dos, in your Google Calendar if you like. Ask Remy anything; it knows your resume and your deadlines.</p>
              <div className="lp-shot" aria-hidden>
                <div className="lp-todo"><span className="lp-box" /><span><b>Apply: {ex.short}</b><span className="xs muted"> &middot; {ex.due}</span></span></div>
                <div className="lp-todo"><span className="lp-box" /><span><b>Ask your advisor for a reference</b></span></div>
                <div className="lp-todo done"><span className="lp-box"><Check size={12} /></span><span>Add your LinkedIn</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="how-h">
        <div className="lp2-w">
          <h2 id="how-h">Three steps, about five minutes</h2>
          <ol className="lk-steps rv">
            <li><b>Add your resume.</b> Upload it, add your LinkedIn, or answer a few questions and Remy builds your first one.</li>
            <li><b>Say what you want, or that you don&rsquo;t know yet.</b> Pick fields, places and dates, or let Remy show you where your major leads.</li>
            <li><b>Get openings and a plan.</b> Remy checks for new openings about once a day and turns what it finds into to-dos and deadlines.</li>
          </ol>
          <div className="lk-nevers" aria-label="What Remy will never do">
            <ShieldCheck size={18} /><b>Remy never</b>
            <span>makes up experience</span><span>applies or messages anyone for you</span><span>asks for passwords or sells your data</span>
          </div>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="team-h">
        <div className="lp2-w">
          <div className="lp2-row">
            <div><h2 id="team-h">The people behind Remy</h2><p>A small team in Fort Worth, Texas. We read every message students send.</p></div>
            <a className="lp2-more" href="/about">About the team <span aria-hidden>&rarr;</span></a>
          </div>
          <ul className="lp2-team rv">
            {team.map((m) => (
              <li key={m.name}>
                {m.photo ? <img src={m.photo} alt="" width={200} height={200} loading="lazy" /> : <span className="lp2-ini" aria-hidden>{m.name.split(" ").map((w) => w[0]).join("")}</span>}
                <b>{m.name}</b><span>{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="follow-h">
        <div className="lp2-w">
          <div className="lp2-follow-head">
            <div><h2 id="follow-h">Follow along</h2><p className="lp2-sub">Job-search tips, what we shipped this week, and the occasional fox.</p></div>
          </div>
          <div className="lp2-social">
            <a href={INSTAGRAM} {...out} data-testid="link-instagram"><InstagramMark size={26} /><span><b>Instagram</b><span>@coachremyai</span></span><span className="lp2-go" aria-hidden>&rarr;</span></a>
            <a href={LINKEDIN} {...out} data-testid="link-linkedin"><LinkedInMark /><span><b>LinkedIn</b><span>RemyAI company page</span></span><span className="lp2-go" aria-hidden>&rarr;</span></a>
          </div>
        </div>
      </section>

      <section className="lp2-sec lp2-end">
        <div className="lp2-w">
          <span className="lk-medal lk-medal-sm"><Remy size={84} mood="wave" /></span>
          <h2>Ready when you are.</h2>
          <p>Free during beta. About five minutes to set up.</p>
          <a className="lp2-btn lp2-btn-lg" href={start} {...ext}>{startLabel}</a>
        </div>
      </section>

      <div className="lp2-w">
        <footer className="lp2-foot">
          <span>&copy; 2026 RemyAI LLC &middot; Fort Worth, Texas</span>
          <nav aria-label="Footer">
            <a href="/about">About</a><a href="mailto:hello@remyai.org">hello@remyai.org</a>
            <a href={INSTAGRAM} {...out}>Instagram</a><a href={LINKEDIN} {...out}>LinkedIn</a>
            <a href="/policies">Privacy</a><a href="/policies#beta-terms">Beta terms</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** Not an owner: /careers isn't released yet, so send them home. */
function Landing2Fallback() {
  useEffect(() => { go("/"); }, []);
  return null;
}
