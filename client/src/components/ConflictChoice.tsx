import type { MemoryFact, Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";

/** An imported fact that disagrees with the resume: the student picks which is right, and the other becomes a to-do. */
export function ConflictChoice({ fact }: { fact: MemoryFact }) {
  const { run, setWs } = useStore();
  const source = fact.source.replace(/\s*\(.*$/, "").replace(/ import$/, "");
  const pick = (right: "resume" | "source") =>
    run(() => api<Workspace>("POST", `/api/memory/${fact.id}/resolve`, { right }), "Added to your to-dos").then((w) => w && setWs(w));
  return (
    <div className="stack-sm" style={{ gap: 6 }}>
      <div className="xs" style={{ color: "var(--amber)" }}>Doesn't match: {fact.conflict}. Which is right?</div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => pick("resume")} data-testid="button-conflict-resume">My resume is right</button>
        <button className="btn btn-secondary btn-sm" onClick={() => pick("source")} data-testid="button-conflict-source">{source} is right</button>
      </div>
    </div>
  );
}
