import { useEffect } from "react";
import type { Workspace } from "@shared/types";
import { reloadJobs } from "./jobs";
import { go } from "./router";
import { openRemy, startResumeFix } from "./tailorChat";
import { api, useStore } from "./store";
import { tourAgain } from "../components/Tour";

// Owners: what Remy said he'd do from chat (side panel or the My Path office) happens on screen as soon as his reply
// arrives: "take me to…" opens the page, "fix my resume" starts asking one line at a time, a Keep/Pass or a changed
// search preference refreshes the openings. Each reply is acted on once, and only while it is new.
const done = new Set<string>();
const since = Date.now() - 10_000; // replies from before this page load were acted on already
const JOB_KINDS = new Set(["interest", "unhide", "prefs", "save", "unsave", "role"]);

export function useRemyDoes(on: boolean) {
  const { ws, setWs, run, save } = useStore();
  const last = ws?.chat[ws.chat.length - 1];
  useEffect(() => {
    if (!on || !ws || !last || last.role !== "assistant" || done.has(last.id)) return;
    done.add(last.id);
    if (!last.did?.length || Date.parse(last.at) < since) return;
    if (last.did.some((d) => JOB_KINDS.has(d.kind) && !d.undone)) reloadJobs().catch(() => {});
    // Remy "touches" where each change landed: that page's link in the menu glows for a moment.
    for (const d of last.did) if (d.link && !d.noUndo && !d.undone) touch("/" + (d.link.split(/[?#]/)[0].split("/")[1] || ""));
    const act = last.did.find((d) => d.noUndo && !d.undone);
    if (!act) return;
    if (act.kind === "start" && act.ref === "tour") { void tourAgain(save); return; }
    if (act.link) go(act.link);
    if (act.kind === "start" && act.ref === "resumeFix") startResumeFix(ws as Workspace, { setWs, run });
  }, [on, last?.id]);
}

function touch(path: string) {
  for (const el of document.querySelectorAll<HTMLElement>(`a.nav-item[href="${path}"], .mobile-nav a[href="${path}"]`)) {
    el.classList.remove("remy-touched");
    void el.offsetWidth; // restart the animation
    el.classList.add("remy-touched");
    setTimeout(() => el.classList.remove("remy-touched"), 2600);
  }
}

// Owners (#3, #6): once per page load Remy may start the conversation himself (a question he promised, or the weekly
// check-in); his panel opens so it reads as him reaching out.
let reached = false;
export function useRemyReachOut(on: boolean) {
  const { ws, setWs } = useStore();
  const ready = !!ws?.onboarding.done;
  useEffect(() => {
    if (!on || !ready || reached) return;
    const t = setTimeout(() => {
      if (reached) return;
      reached = true;
      api<{ said: string; ws?: Workspace }>("POST", "/api/remy/reachout").then((r) => { if (r.said && r.ws) { setWs(r.ws); openRemy(); } }).catch(() => {});
    }, 2500); // after the page has settled
    return () => clearTimeout(t);
  }, [on, ready]);
}
