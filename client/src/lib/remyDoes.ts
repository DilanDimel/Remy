import { useEffect } from "react";
import type { Workspace } from "@shared/types";
import { reloadJobs } from "./jobs";
import { go } from "./router";
import { startResumeFix } from "./tailorChat";
import { useStore } from "./store";
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
