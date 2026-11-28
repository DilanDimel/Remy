import { seasonFor } from "./seasons";

// My Path's Timeline (Dilan, Nov 27: "the timeline is useless and not personalized"): the student's own semesters and
// summers up to graduation, with real dates, their field's recruiting window and what to do at each stop.
export type TimelineStop = { when: string; what: string; now?: boolean };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SUMMER = ["", "A first internship, research, a campus job with numbers, or a project you can show.",
  "A sophomore program (many big firms run one) or a first internship.",
  "The big internship. It often turns into a job offer.", "Your last summer before your first job."];

/** year: 1 first-year … 4 senior, 5 after college. graduation: "May 2029", "2029" or "". */
export function personalTimeline(o: { year: number; graduation?: string; field: string; next?: string; cert?: string; job?: string; exploring?: boolean; now?: Date }): TimelineStop[] {
  const now = o.now || new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
  const term = m <= 5 ? `Spring ${y}` : m <= 7 ? `Summer ${y}` : `Fall ${y}`;
  const lc = (t: string) => (/^[A-Z][a-z]/.test(t) && !/^(Excel|Microsoft|Google|Python|SQL|Bloomberg|Power|Tableau)\b/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
  const todo = [o.exploring ? "Try one small task in each field you're weighing." : "", o.next ? `Next: ${lc(o.next)}.` : "", o.cert ? `A certificate worth doing now: ${o.cert}.` : ""].filter(Boolean).join(" ");
  const out: TimelineStop[] = [{ when: `Now · ${term}`, what: todo || "Keep going: you've covered this stage.", now: true }];
  if (o.year >= 5) return [...out, { when: "This year", what: o.job ? `Grow in your first job as a ${o.job}.` : "Grow in your first job." }];
  const gm = /\b(20\d\d)\b/.exec(o.graduation || "");
  const academicEnd = m >= 8 ? y + 1 : y; // the spring this school year ends in
  const gradYear = gm ? Number(gm[1]) : academicEnd + (4 - Math.min(4, Math.max(1, o.year)));
  const gradMonth = MONTHS.find((x) => new RegExp(x.slice(0, 3), "i").test(o.graduation || "")) || "May";
  // The field's next recruiting window, with its real month and year.
  const s = seasonFor(o.field, now);
  if (s) {
    const start = s.open ? now : new Date(y, m - 1 + s.monthsUntil, 1);
    const end = s.window.split(" to ")[1];
    out.push({ when: s.open ? `Open now · until ${end}` : `${s.opens} ${start.getFullYear()}`, what: `${s.label} internship applications ${s.open ? "are open" : "open"}. ${s.note}` });
  }
  const firstSummer = m <= 5 ? y : y + 1; // in June and July the summer is already under way
  for (let S = firstSummer, k = 0; S < gradYear && k < 3; S++, k++) {
    const after = Math.min(4, o.year + (S - firstSummer));
    out.push({ when: `Summer ${S}`, what: SUMMER[after] });
  }
  out.push({ when: `Graduation · ${gradMonth} ${gradYear}`, what: o.job ? `First job: ${o.job}.` : o.exploring ? "Your first job, in whichever direction you pick." : "Your first job." });
  return out;
}
