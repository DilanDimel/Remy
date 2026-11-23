import { awayBrief } from "@shared/activity";
import { firstName } from "@shared/names";
import { useJobs } from "../lib/jobs";
import { useStore } from "../lib/store";
import { go } from "../lib/router";

// Owners ("Remy feels alive" #2): back after a day or more, Remy tells you in his own voice what happened meanwhile.
// The last visit is read once per page load, before Home moves it forward.
let since: string | null = null;
const AWAY_MS = 20 * 3600_000;

export function RemyAway() {
  const { ws } = useStore();
  const { jobs, fits } = useJobs();
  if (since === null) since = ws!.settings.lastSeenAt || "";
  if (!since || Date.now() - Date.parse(since) < AWAY_MS) return null;
  const rows = awayBrief({ ...ws!, jobs: jobs || ws!.jobs }, since, fits);
  if (!rows.length) return null;
  const name = firstName(ws!);
  return (
    <div className="bubble bubble-ai" data-testid="remy-away">
      <b>Welcome back{name ? `, ${name}` : ""}! While you were away:</b>
      {rows.map((r) => <div key={r.text + r.at}>{"• "}{r.link ? <a href={r.link} onClick={(e) => { e.preventDefault(); go(r.link!); }} style={{ textDecoration: "underline" }}>{r.text}</a> : r.text}</div>)}
    </div>
  );
}
