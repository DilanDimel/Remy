# Where Remy's data files come from

- `catalog-boards.tsv`: the companies whose public job boards Remy's employer catalog reads (system, board id, company name).
  From the [StoreSignal ATS job boards directory](https://github.com/storesignalhq/ats-job-boards) (verified Nov 16, 2026),
  licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Trimmed to three columns; Remy re-checks every board
  when it reads it. Company names and trademarks belong to their owners.
- Not in the repo: the employer catalog also reads the boards listed in [Stapply's open company lists](https://storage.stapply.ai/jobs/v1/manifest.json)
  (from the MIT-licensed `ats-scrapers` project; the list data is CC0 per stapply.ai), fetched weekly into Remy's own storage:
  Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters, Workday, Oracle, BambooHR, Breezy, JazzHR, Paylocity, UKG (UltiPro), ADP Workforce Now, iCIMS, Phenom and SuccessFactors career sites (from the sitemaps their robots.txt offers), AppliTrack (school districts) and
  Rippling boards. Remy reads each board itself, from the employer's own public career page.
- `employers.json`: Remy's hand-picked employers, with the fields they hire for.
- `onet-tasks.json`: from O*NET (U.S. Department of Labor), CC BY 4.0.
- `onet-titles.json`: occupation titles, Job Zones and about 50,000 sample and reported job titles from
  [O*NET 30.2](https://www.onetcenter.org/database.html) (U.S. Department of Labor, Employment and Training Administration),
  licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), plus the
  [NCES CIP 2020 to SOC 2018 crosswalk](https://nces.ed.gov/ipeds/cipcode/resources.aspx?y=56) (public domain), used to
  match job titles and majors to occupations (`server/jobs/soc.ts`). O*NET® is a trademark of USDOL/ETA.
- `us-metros.json`: every U.S. metropolitan area (380) with its principal cities and the other incorporated places in its
  counties, from the Census Bureau's [2023 CBSA delineation files](https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/delineation-files.html)
  and [2020 place-by-county list](https://www2.census.gov/geo/docs/reference/codes2020/) (public domain). Each row is
  `[metro title, principal "city|ST" names, other "place|ST" names]`; used to read "Columbus, OH" as the whole Columbus area (`server/jobs/metros.ts`).
