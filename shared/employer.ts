// Health systems (Tenet and others) post every hospital's openings on one board, so the company is the parent and the
// real employer sits at the front of the title: "Palm Beach Health Network - Nurse Extern Opportunities". Owners see
// the hospital as the employer and the role as the title (Dilan's review, Nov 23).
const PLACE = /\b(health|hospital|medical|clinic|center|centre|network|regional|healthcare)\b/i;

export function hospitalFirst<T extends { title: string; company: string }>(j: T): T {
  const m = j.title.match(/^(.{4,80}?)\s+[-–—]\s+(.{3,})$/);
  if (!m || !PLACE.test(m[1]) || m[1].toLowerCase() === j.company.toLowerCase()) return j;
  const title = m[2].replace(/\s+Opportunities$/i, "").trim();
  return { ...j, company: m[1].trim(), title: title || m[2] };
}
