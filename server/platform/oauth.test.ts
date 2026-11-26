// Remy's own Google/LinkedIn sign-in. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl, newState, newTicket, ownSignin, redeemTicket, takeState, userFrom } from "./oauth";

test("only a verified email signs in", () => {
  assert.equal(userFrom({ sub: "1", email: "A@x.edu", email_verified: true, name: "A B" }).email, "a@x.edu");
  assert.equal(userFrom({ sub: "2", email: "b@x.edu", email_verified: "true", given_name: "B", family_name: "C" }).name, "B C");
  assert.throws(() => userFrom({ sub: "3", email: "c@x.edu", email_verified: false }));
  assert.throws(() => userFrom({ sub: "4", email: "d@x.edu" }));
  assert.throws(() => userFrom({ email: "e@x.edu", email_verified: true }));
});

test("state works once, for its provider, for 10 minutes", () => {
  const s = newState("google");
  assert.equal(takeState(s, "linkedin"), null);
  assert.equal(takeState(s, "google"), null); // the wrong-provider try used it up
  const t = newState("google", undefined, 0);
  assert.equal(takeState(t, "google", 11 * 60_000), null);
  const u = newState("linkedin", { challenge: "c".repeat(48), handoff: "" });
  assert.equal(takeState(u, "linkedin")?.app?.challenge, "c".repeat(48));
  assert.equal(takeState(u, "linkedin"), null);
});

test("the app's code needs the secret it kept, once", () => {
  const me = { id: "g:1", kind: "google" as const, email: "a@x.edu", name: "", picture: "" };
  const v = "v".repeat(48);
  const code = newTicket(me, v);
  assert.equal(redeemTicket(code, "w".repeat(48)), null);
  assert.equal(redeemTicket(code, v), null); // a wrong try spends it
  const code2 = newTicket(me, v);
  assert.deepEqual(redeemTicket(code2, v), me);
  assert.equal(redeemTicket(code2, v), null);
});

test("buttons switch over only when named in OWN_SIGNIN and the keys are there", () => {
  const keep = { ...process.env };
  try {
    process.env.GCAL_CLIENT_ID = "id"; process.env.GCAL_CLIENT_SECRET = "s";
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.OWN_SIGNIN;
    assert.deepEqual(ownSignin(), { google: false, linkedin_oidc: false });
    process.env.OWN_SIGNIN = "google,linkedin";
    assert.deepEqual(ownSignin(), { google: true, linkedin_oidc: false });
    const url = new URL(authorizeUrl("google", "https://remyai.org/api/auth/oauth/google/callback", "st"));
    assert.equal(url.searchParams.get("redirect_uri"), "https://remyai.org/api/auth/oauth/google/callback");
    assert.equal(url.searchParams.get("scope"), "openid email profile");
  } finally {
    process.env = keep;
  }
});
