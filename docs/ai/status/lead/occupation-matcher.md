# Occupation matcher (lead thread, Nov 25, 2026)

- `server/jobs/soc.ts`: `matchTitle(title)` gives the likeliest 2018 SOC occupations for a posting title (exact O*NET
  title first, then rare shared words); `majorSocs(major)` gives the occupations a major leads to (NCES CIP-SOC crosswalk);
  `jobZone(soc)` gives O*NET's preparation level. Offline, no AI, data in `server/data/onet-titles.json` (2 MB, server only).
- Measured on 159 hand-labelled posting titles (`server/jobs/soc-labels.tsv`): exact 62%, major group 80%, top 10 91%.
- Not wired into matching yet: the next PR uses it to rank catalog openings by the student's major. The resume thread
  may import it too.
