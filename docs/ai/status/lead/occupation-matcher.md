# Occupation matcher (lead thread, Nov 25, 2026)

- `server/jobs/soc.ts`: `matchTitle(title)` gives the likeliest 2018 SOC occupations for a posting title (exact O*NET
  title first, then rare shared words); `majorSocs(major)` gives the occupations a major leads to (NCES CIP-SOC crosswalk);
  `jobZone(soc)` gives O*NET's preparation level. Offline, no AI, data in `server/data/onet-titles.json` (2 MB, server only).
- Measured on 159 hand-labelled posting titles (`server/jobs/soc-labels.tsv`): exact 67%, major group 84%, top 10 92%. Field-only titles ("Engineering Intern") are flagged `broad` and ranked by how often an occupation carries that word.
- Not wired into matching yet: the next PR uses it to rank catalog openings by the student's major. The resume thread
  may import it too.
