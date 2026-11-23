// Health systems (Tenet and others) post every hospital's openings on one board, so the company is the parent and the
// real employer sits at the front of the title: "Palm Beach Health Network - Nurse Extern Opportunities". Owners see
// the hospital as the employer and the role as the title (Dilan's review, Nov 23).
// The front part must END like a hospital's name, so "Operations Center Analyst - Intern" stays as it is.
const PLACE = /\b(hospital|medical cent(er|re)|health( network| system|care)?|clinic|medical)$/i;

export function hospitalFirst<T extends { title: string; company: string }>(j: T): T {
  const m = j.title.match(/^(.{4,80}?)\s+[-–—]\s+(.{3,})$/);
  if (!m || !PLACE.test(m[1]) || m[1].toLowerCase() === j.company.toLowerCase()) return j;
  const title = m[2].replace(/\s+Opportunities$/i, "").trim();
  return { ...j, company: m[1].trim(), title: title || m[2] };
}
