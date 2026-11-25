# Where Remy's data files come from

- `catalog-boards.tsv`: the companies whose public job boards Remy's employer catalog reads (system, board id, company name).
  From the [StoreSignal ATS job boards directory](https://github.com/storesignalhq/ats-job-boards) (verified Nov 16, 2026),
  licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Trimmed to three columns; Remy re-checks every board
  when it reads it. Company names and trademarks belong to their owners.
- `employers.json`: Remy's hand-picked employers, with the fields they hire for.
- `onet-tasks.json`: from O*NET (U.S. Department of Labor), CC BY 4.0.
