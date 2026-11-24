# Review checklist: where can this fail?

For Julio's reviews (and any AI reviewing a PR). Leave a comment for each real problem, most serious first. Skip style nits.

1. **Students:** can a student see something new that isn't released? Look for UI without `useOwnerView()` or a server route without `isOwner`.
2. **Wrong input:** empty, very long, odd characters, missing fields, a second click, two tabs at once. Is input validated at the server?
3. **Failure paths:** the AI times out or returns junk, the database is down, the network drops. Does the student lose work or see a raw error?
4. **Invented claims:** can any AI text about a student skip `server/ai/claims.ts` or the accept/edit/reject step?
5. **Cost:** a new AI call in a loop or on every page load, no limit, no cache. Rough cost per student per day?
6. **Database egress:** does it read a whole workspace per request or poll? (Supabase Free; see `DECISIONS.md`.)
7. **Security:** another user's data reachable by changing an id, secrets in code, HTML from users rendered raw.
8. **Phones:** does it still work at 344 px?
9. **Tests:** is the new logic covered by a `*.test.ts`, and would that test fail if the code broke?
