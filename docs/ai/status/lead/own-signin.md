Remy's own Google and LinkedIn sign-in, so Supabase can be deleted (lead, Nov 26). Dilan said go.

What's in the first PR:
- `server/platform/oauth.ts`: OpenID Connect code flow with the client secret on the server. Google uses the "Remy calendar" client (GCAL_CLIENT_ID/SECRET, or GOOGLE_SIGNIN_CLIENT_ID/SECRET if set). LinkedIn uses LINKEDIN_CLIENT_ID/SECRET. Only a verified email signs in. State is one-time, 10 minutes, in memory (one DO instance).
- Routes in `server/routes.ts`: GET `/api/auth/oauth/:provider/start` and `/callback`, POST `/api/auth/oauth/redeem`. The account is found by email (`userByEmail`), so the 19 Supabase-made accounts and email-code accounts open as before. New ones get `g:<sub>` (kind google) or `li:<sub>` (kind supabase). The web flow binds state to a `__Host-remy_oauth` cookie. The app gets a one-time code through `/api/auth/app-return`'s page (remy://auth, or the Expo Go handoff), which only works with its PKCE verifier.
- Redirect URIs: `https://remyai.org/api/auth/oauth/google/callback` (added in Google Cloud by Dilan, Nov 26) and `https://remyai.org/api/auth/oauth/linkedin/callback` (still to add in LinkedIn's portal).
- Switch: `OWN_SIGNIN=google` (later `google,linkedin`) in DO env makes the website and app buttons use it (`config.ownSignin`). Unset, nothing changes for anyone; the start URL still works for testing.
- native/ (noted per the rule): `native/src/app/sign-in.tsx` opens Remy's start URL and redeems the code when `config.ownSignin` says so; Supabase path kept as is. Needs an OTA update to reach the app.

Next: test live by opening /api/auth/oauth/google/start, set OWN_SIGNIN=google, LinkedIn keys, then remove Supabase (the LinkedIn "connect" in Account still uses Supabase and needs moving too).
