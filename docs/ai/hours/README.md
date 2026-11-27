# Estimated hours

The owners' Team & hours board shows two kinds of time: time people clock or log themselves, and **auto, estimated** time worked out from what their work leaves behind. This folder holds the evidence for the estimate.

## The rule

- Evidence: every commit on `main` and on every PR branch (by its author date), each PR when it was opened, and for Dilan the Claude threads he starts in the Remy project (his Claude sessions are his work time).
- A commit by an AI with no GitHub login of its own (Claude) counts for the person whose PR it is on.
- One person's events less than **60 minutes** apart are one stretch of work. A stretch starts **15 minutes** before its first event, ends **15 minutes** after its last, and counts at least **30 minutes**.
- Time someone clocked, logged or wrote as `Hours:` in a PR always wins: the estimate is cut around it, so nothing counts twice.
- Each stretch's note lists the commit and PR titles in it. Non-code work shows as "Planning and company work with Claude".

## How it stays up to date

- `estimated.json` holds the events up to `until`. `npm run hours:estimate -- --extra <file>` adds new commits and PRs from git and GitHub, plus any extra events (a JSON array of `[who, isoTime, what]`), and keeps everything already there.
- Every hour the server (`syncAutoHours` in `server/platform/contrib.ts`) reads this file, adds commits and PRs newer than `until` straight from GitHub, and rebuilds the auto entries. So code work shows up within the hour.
- Each night the lead's PR watch adds the day's Claude-thread events with the daily summary PR.
- Auto entries can't be removed by hand (they would come back); log or clock the real time instead and the estimate makes room.
