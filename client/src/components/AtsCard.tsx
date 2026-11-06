import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { AtsScore } from "@shared/types";
import { api } from "../lib/store";
import { Spinner } from "./common";

function Fix({ f }: { f: AtsScore["fixes"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ats-fix">
      <div className="stack-sm" style={{ gap: 4, minWidth: 0 }}>
        <span className="xs muted">{f.category}</span>
        <div className="small">{f.text}</div>
        {!!f.examples?.length && (
          <>
            <button className="btn btn-ghost btn-sm link-btn" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show which"}</button>
            {open && <ul className="ats-examples">{f.examples.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          </>
        )}
      </div>
    </div>
  );
}

/** Remy's suggestions for the resume (no score: a number out of 100 would claim to know how employers' systems
 *  rank it, and Remy doesn't). With `appId`, also the skills that posting names: shown on the resume or not. */
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
  if (!data) return <div className="card card-pad row"><Spinner /> <span className="small muted">Checking your resume…</span></div>;
  const main = data.tailored || data.base;
  const fixes = main.fixes.filter((f) => f.category !== "Keyword match"); // the posting's skills are listed below
  const posting = main.against.replace(/^in the /, "the ");
  return (
    <div className="card card-pad stack" data-testid="card-ats-score">
      <div className="stack-sm">
        <h3>{data.tailored ? `Skills ${posting} names` : "Suggestions for your resume"}</h3>
        <p className="xs muted">{data.tailored
          ? "Which skills this posting asks for appear on this version of your resume. Add one only if it's true."
          : "Ways to make your resume easier to read for recruiters and the systems employers use. Remy's suggestions, not an employer's score."}</p>
      </div>
      {(main.keywords.matched.length > 0 || main.keywords.missing.length > 0) && (
        <div className="grid-2">
          <div className="stack-sm"><span className="eyebrow">On your resume</span><div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{main.keywords.matched.length ? main.keywords.matched.map((k) => <span key={k} className="chip chip-live">✓ {k}</span>) : <span className="xs muted">None yet</span>}</div></div>
          <div className="stack-sm"><span className="eyebrow">Worth adding, if true</span><div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{main.keywords.missing.length ? main.keywords.missing.map((k) => <span key={k} className="chip chip-plain">+ {k}</span>) : <span className="xs muted">You show them all</span>}</div></div>
        </div>
      )}
      {data.tailored && !main.keywords.matched.length && !main.keywords.missing.length && <p className="small muted">Remy couldn't read specific skills in this posting. Open it to check what it asks for.</p>}
      {fixes.length > 0 ? (
        <div className="stack-sm">
          {data.tailored && <span className="eyebrow">Suggestions</span>}
          {fixes.slice(0, 5).map((f, i) => <Fix key={i} f={f} />)}
        </div>
      ) : !data.tailored && <p className="small row" style={{ gap: 6 }}><CheckCircle2 size={16} color="var(--sage)" />No suggestions: your resume covers the basics.</p>}
    </div>
  );
}
