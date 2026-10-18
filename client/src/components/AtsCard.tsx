import { useEffect, useState } from "react";
import type { AtsScore } from "@shared/types";
import { api } from "../lib/store";
import { Spinner } from "./common";

const tone = (pct: number) => (pct >= 80 ? "var(--sage)" : pct >= 60 ? "var(--amber)" : "var(--error)");

function Ring({ score, label }: { score: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="ats-ring" aria-label={`${label}: ${score} out of 100`}>
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={tone(score)} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 44 44)" />
      </svg>
      <div><strong>{score}</strong><span>/100</span></div>
      <small>{label}</small>
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
        <Ring score={main.score} label={data.tailored ? "Tailored" : "ATS readiness"} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
          <h3>ATS screening score{data.tailored ? ` · ${data.tailored.score - data.base.score >= 0 ? "+" : ""}${data.tailored.score - data.base.score} from tailoring` : ""}</h3>
          <p className="xs muted">How well an applicant tracking system can read your resume and match it to {main.against.replace(/^in the |^from /, "")}. Calculated from your resume itself, so the same resume always gets the same score.</p>
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
          {main.fixes.slice(0, 5).map((f, i) => (
            <div key={i} className="ats-fix"><span className="ats-gain">+{f.gain}</span><div><span className="xs muted">{f.category}</span><div className="small">{f.text}</div></div></div>
          ))}
        </div>
      )}
      {(main.keywords.matched.length > 0 || main.keywords.missing.length > 0) && (
        <div className="row" style={{ gap: 6 }}>
          {main.keywords.matched.map((k) => <span key={k} className="chip chip-live">✓ {k}</span>)}
          {main.keywords.missing.map((k) => <span key={k} className="chip chip-bad">✕ {k}</span>)}
        </div>
      )}
    </div>
  );
}
