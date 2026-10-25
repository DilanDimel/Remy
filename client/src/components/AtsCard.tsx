import { useEffect, useState } from "react";
import type { AtsScore } from "@shared/types";
import { api } from "../lib/store";
import { Spinner } from "./common";

const tone = (pct: number) => (pct >= 80 ? "var(--sage)" : pct >= 60 ? "var(--amber)" : "var(--error)");

const grade = (n: number) => (n >= 85 ? "Strong" : n >= 70 ? "Good" : n >= 55 ? "Fair" : "Needs work");

function Ring({ score, label }: { score: number; label: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <div className="ats-ring" aria-label={`${label}: ${score} out of 100`}>
      <div className="ats-ring-dial">
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={tone(score)} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 48 48)" />
        </svg>
        <div className="ats-ring-num"><strong>{score}</strong><span>{grade(score)}</span></div>
      </div>
      <small>{label}</small>
    </div>
  );
}

function Fix({ f }: { f: AtsScore["fixes"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ats-fix">
      <span className="ats-gain">+{f.gain}</span>
      <div className="stack-sm" style={{ gap: 4, minWidth: 0 }}>
        <span className="xs muted">{f.category}</span>
        <div className="small">{f.text}</div>
        {!!f.examples?.length && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: 0, minHeight: 0 }} onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show which"}</button>
            {open && <ul className="ats-examples">{f.examples.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          </>
        )}
      </div>
    </div>
  );
}

/** ATS readiness out of 100, with a breakdown and the fixes worth the most points.
 * With `appId`, scores that tailored version against its posting next to the base. */
export function AtsCard({ appId, refreshKey }: { appId?: string; refreshKey?: string }) {
  const [data, setData] = useState<{ base: AtsScore; tailored?: AtsScore } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    const query = appId ? `?app=${encodeURIComponent(appId)}` : "";
    api<{ base: AtsScore; tailored?: AtsScore }>("GET", "/api/resume/ats" + query).then((d) => live && setData(d), (e) => live && setErr(e.message));
    return () => { live = false; };
  }, [appId, refreshKey]);
  if (err) return null;
  if (!data) return <div className="card card-pad row"><Spinner /> <span className="small muted">Scoring your resume…</span></div>;
  const main = data.tailored || data.base;
  return (
    <div className="card card-pad stack" data-testid="card-ats-score">
      <div className="row" style={{ alignItems: "center", gap: 18 }}>
        {data.tailored && <Ring score={data.base.score} label="Base resume" />}
        <Ring score={main.score} label={data.tailored ? "Tailored" : "Readiness"} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
          <h3>ATS readiness{data.tailored ? ` · ${data.tailored.score - data.base.score >= 0 ? "+" : ""}${data.tailored.score - data.base.score} from tailoring` : ""}</h3>
          <p className="xs muted">{data.tailored
            ? `How well an applicant tracking system can read your resume and match it to ${main.against.replace(/^in the /, "the ")}.`
            : "How easily applicant tracking systems can read your resume: contact info, sections, bullets and format. Keywords are checked against each posting when you tailor."} This is Remy's check, not an employer's score; the same resume always gets the same number.</p>
        </div>
      </div>
      <div className="ats-cats">
        {main.categories.map((c) => (
          <div key={c.name} className="ats-cat" title={c.items.map((i) => (i.ok ? "✓ " : "✗ ") + i.text).join("\n")}>
            <div className="row-between small"><span>{c.name}</span><strong>{c.score}/{c.max}</strong></div>
            <div className="ats-bar"><i style={{ width: `${(100 * c.score) / c.max}%`, background: tone((100 * c.score) / c.max) }} /></div>
          </div>
        ))}
      </div>
      {main.fixes.length > 0 && (
        <div className="stack-sm">
          <span className="eyebrow">What to improve first</span>
          {main.fixes.slice(0, 5).map((f, i) => <Fix key={i} f={f} />)}
        </div>
      )}
      {(main.keywords.matched.length > 0 || main.keywords.missing.length > 0) && (
        <div className="grid-2">
          <div className="stack-sm"><span className="eyebrow">Skills you show</span><div className="row" style={{ gap: 6 }}>{main.keywords.matched.length ? main.keywords.matched.map((k) => <span key={k} className="chip chip-live">✓ {k}</span>) : <span className="xs muted">None yet</span>}</div></div>
          <div className="stack-sm"><span className="eyebrow">Worth adding, if true</span><div className="row" style={{ gap: 6 }}>{main.keywords.missing.length ? main.keywords.missing.map((k) => <span key={k} className="chip chip-plain">+ {k}</span>) : <span className="xs muted">You cover them all</span>}</div></div>
        </div>
      )}
    </div>
  );
}
