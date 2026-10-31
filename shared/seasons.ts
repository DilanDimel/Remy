// When each field usually recruits interns, from Cornell Career Services' recruiting timeline by career pathway
// (opened 2026-10-31). Ranges, not promises: the page itself says timelines "may shift without notice".
export const SEASON_SOURCE = "https://career.cornell.edu/resources/recruiting-timeline-by-career-pathways/";

type Season = { field: RegExp; label: string; from: number; to: number; note: string };
// Months 1–12; a window that wraps the new year has from > to.
const SEASONS: Season[] = [
  { field: /financ|bank|invest|accounting|actuar|econom/i, label: "Finance", from: 1, to: 6, note: "Big firms often recruit sophomores for junior-summer internships, so start a year early." },
  { field: /consult/i, label: "Consulting", from: 6, to: 11, note: "Applications often open in late June or early July; start case prep 3 to 6 months before." },
  { field: /software|computer|data|tech|information|cyber/i, label: "Tech", from: 9, to: 4, note: "Large companies recruit in the fall; many others hire interns in the spring." },
  { field: /engineer|manufactur/i, label: "Engineering", from: 10, to: 2, note: "Most engineering internships are filled between October and February." },
  { field: /market|advertis|public relations|\bpr\b|communicat|media/i, label: "Marketing and communications", from: 11, to: 3, note: "PR and advertising internships mostly recruit November to March." },
  { field: /nurs|health|medic|pharm|biolog|kinesi/i, label: "Healthcare", from: 11, to: 3, note: "Most organizations look for interns in the spring." },
  { field: /government|policy|politic|public admin|law|international/i, label: "Government and policy", from: 9, to: 2, note: "Federal internships usually recruit September to February; background checks add wait time." },
  { field: /nonprofit|non-profit|social work|education|teach/i, label: "Nonprofit and social impact", from: 11, to: 4, note: "Many roles are posted as needed, so check often." },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const inWindow = (m: number, s: Season) => (s.from <= s.to ? m >= s.from && m <= s.to : m >= s.from || m <= s.to);

/** The student's field's internship season and where today falls in it; null when no field matches. */
export function seasonFor(field: string, today: Date = new Date()) {
  const s = SEASONS.find((x) => x.field.test(field));
  if (!s) return null;
  const m = today.getMonth() + 1;
  const open = inWindow(m, s);
  const monthsUntil = open ? 0 : (s.from - m + 12) % 12;
  return { label: s.label, open, monthsUntil, window: `${MONTHS.at(s.from - 1)} to ${MONTHS.at(s.to - 1)}`, opens: MONTHS.at(s.from - 1)!, note: s.note };
}
