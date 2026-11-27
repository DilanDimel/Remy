# Get more students to ask Remy something (Nov 27)

Thread: "Get more students to ask Remy something". Branch `claude/project-thread-dpvt2w`.

- Calmer Remy panel for everyone: one header (face, "Here for you", clear, minimize; owners also get an Activity icon), one opener, two chips and "Something else". The dead `.asst-*` rules are removed from index.css.
- "Ask Remy" label on phones: on the website fab and the owner dock (640 px or narrower), and on the app's floating button, which is now a pill with a dot while Remy's first message waits.
- Interview, for both views: the side panel, fab and dock are closed on /interview. `client/src/components/RemyAskInline.tsx` answers inline. The app has `native/src/components/AskRemyRow.tsx` on interview.tsx and prep.tsx.
- Remy speaks first after setup (owners first, brand new): `firstHello` in server/ai/remyTools.ts, `ChatMsg.replies` and `Workspace.remyHello` in shared/types.ts. The app's Home calls /api/remy/reachout for owners.
- Late-night greeting (10 PM to 4 AM) is "Hey": `shared/greeting.ts`, used on Home, the Admin board, the app Home and admin, and in Remy's opener.
- native/: demetre.md read. Dilan said on Nov 26 that our threads own native/ again. Changed: remy.tsx, (tabs)/_layout.tsx, (tabs)/index.tsx, interview.tsx, prep.tsx, lib/next.ts, app/admin.tsx, plus the new AskRemyRow.
- Julio's area: MockInterview.tsx only gains `<RemyAskInline>` under its Head (start screen and scorecard). The question room is unchanged.
