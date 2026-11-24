// Feature releases (shared/features.ts): a locked feature shows students its real page, blurred and out of reach,
// behind a "coming in a future update" card. It always shows today's Remy (the Scholar fox), even in the student view. Owners in owner view always get the working page.
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { accessOf, FEATURES, releasesOf } from "@shared/features";
import { go } from "../lib/router";
import { useOwnerView, useStore } from "../lib/store";

/** "open", "locked" or "hidden" for this person right now. */
export function useAccess() {
  const { config } = useStore();
  const ownerView = useOwnerView();
  const r = releasesOf(config?.features);
  return (key: string) => accessOf(r, key, ownerView);
}

export function ComingSoon({ feature, children }: { feature: string; children: ReactNode }) {
  const f = FEATURES.find((x) => x.key === feature)!;
  return (
    <div className="soon" data-testid={`coming-soon-${f.key}`}>
      <div className="soon-behind" aria-hidden="true" {...{ inert: "" }}>{children}</div>
      <div className="soon-card" role="region" aria-label={`${f.label} is coming soon`}>
        <span className="soon-face"><img src="/remy-scholar.svg" alt="" width={64} height={64} /><span className="soon-lock"><Lock size={14} /></span></span>
        <span className="soon-kicker">Coming in a future update</span>
        <h2>{f.label}</h2>
        <p>{f.teaser}</p>
        <button className="btn btn-primary btn-sm" onClick={() => go("/opportunities")} data-testid={`button-soon-${f.key}`}>Find openings meanwhile</button>
      </div>
    </div>
  );
}
