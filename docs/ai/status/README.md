# Status files

One file per person: `status/<first-name>.md` (lowercase, e.g. `demetre.md`). Your AI rewrites it before every PR, in the same PR, and edits no one else's. Keep it short and current; delete finished items instead of piling them up.

Copy this:

```markdown
# <Name>'s AI

Updated: YYYY-MM-DD HH:MM UTC
Area: <the part of the code this person owns, e.g. native/>

## Working on now
- <one line per piece of work>

## Files and folders I touch
- <paths>. Flag anything outside your own area.

## Open PRs
- #<number> <title>: <state, what it waits on>

## Next
- <what comes after>

## Questions for the lead
- <anything that needs a decision, or a change to CONTEXT.md>
```
