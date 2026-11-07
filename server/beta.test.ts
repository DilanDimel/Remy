// Founding Cohort beta gate: with OR_BETA_ONLY=true only accepted emails and the team get in. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, newSigninCode, saveWorkspace } from "./db";
import { registerRoutes } from "./routes";

process.env.OWNER_EMAILS = "founder@beta.test";

test("beta gate: guests, outsiders and old accounts are kept out; accepted emails and the team get in; off changes nothing", async (t) => {
  const flag = process.env.OR_BETA_ONLY;
  t.after(() => { if (flag === undefined) delete process.env.OR_BETA_ONLY; else process.env.OR_BETA_ONLY = flag; });
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  async function call(cookie: string, method: string, path: string, body?: unknown) {
    const r = await fetch(base + path, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as any, setCookie: r.headers.get("set-cookie") || "" };
  }
  async function account(id: string, email: string) {
    await ensureUser({ id, kind: "supabase", email, name: "", picture: "" });
    const ws = emptyWorkspace();
    ws.profile.major = "Finance";
    ws.openingsCheckedAt = new Date().toISOString(); // no outbound searches in this test
    await saveWorkspace(id, ws);
    return "__Host-or_sid=" + (await createSession(id)).token;
  }
  const old = await account("sb:beta-old", "old.tester@beta.test");
  const founder = await account("sb:beta-founder", "founder@beta.test");

  await t.test("switch off: nothing changes", async () => {
    process.env.OR_BETA_ONLY = "false";
    assert.equal((await call(old, "GET", "/api/jobs")).status, 200);
    assert.equal((await call("", "GET", "/api/config")).data.beta.on, false);
    assert.equal((await call("", "POST", "/api/auth/guest")).status, 200);
  });

  await t.test("switch on: outsiders, guests and old accounts are stopped, with the reason", async () => {
    process.env.OR_BETA_ONLY = "true";
    const cfg = (await call("", "GET", "/api/config")).data;
    assert.equal(cfg.beta.on, true);
    const guest = await call("", "POST", "/api/auth/guest");
    assert.equal(guest.status, 403);
    assert.equal(guest.data.code, "beta");
    const jobs = await call(old, "GET", "/api/jobs");
    assert.equal(jobs.status, 403);
    assert.equal(jobs.data.code, "beta");
    const me = await call(old, "GET", "/api/me");
    assert.equal(me.data.me, null);
    assert.equal(me.data.beta.blocked, true);
    assert.equal(me.data.beta.email, "old.tester@beta.test");
    assert.match(me.setCookie, /or_sid=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i); // that browser is signed out
    // Same answer as an accepted email (no probing who's in), but no code exists to sign in with.
    const start = await call("", "POST", "/api/auth/email/start", { email: "stranger@beta.test" });
    assert.equal(start.status, 200);
    assert.equal(start.data.sent, true);
    const guess = await call("", "POST", "/api/auth/email/verify", { email: "stranger@beta.test", code: "123456" });
    assert.equal(guess.status, 400);
    // A code issued before the switch still can't open an account outside the list.
    const code = await newSigninCode("stranger@beta.test");
    const verify = await call("", "POST", "/api/auth/email/verify", { email: "stranger@beta.test", code });
    assert.equal(verify.status, 403);
    assert.equal(verify.data.code, "beta");
  });

  await t.test("the team always gets in; only owners manage the list", async () => {
    process.env.OR_BETA_ONLY = "true";
    assert.equal((await call(founder, "GET", "/api/jobs")).status, 200);
    const outsider = await account("sb:beta-member", "member@beta.test");
    assert.equal((await call(outsider, "GET", "/api/admin/beta")).status, 403); // blocked before the owner check, still no access
    const listed = await call(founder, "POST", "/api/admin/beta", { emails: "Member@Beta.test, old.tester@beta.test\nnot-an-email  member@beta.test", notify: false });
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.data.added.sort(), ["member@beta.test", "old.tester@beta.test"]);
    assert.deepEqual(listed.data.wrong, ["not-an-email"]);
    assert.equal(listed.data.list.length, 2);
    const again = await call(founder, "POST", "/api/admin/beta", { emails: "old.tester@beta.test" });
    assert.deepEqual(again.data.already, ["old.tester@beta.test"]);
    assert.equal((await call(outsider, "GET", "/api/admin/beta")).status, 403); // accepted, but not an owner
  });

  await t.test("accepted: old account works again, and a new email can sign in by code", async () => {
    process.env.OR_BETA_ONLY = "true";
    const fresh = await account("sb:beta-old2", "old.tester@beta.test");
    assert.equal((await call(fresh, "GET", "/api/jobs")).status, 200);
    assert.equal((await call("", "POST", "/api/auth/email/start", { email: "member@beta.test" })).status, 200);
    const code = await newSigninCode("member@beta.test");
    const signedIn = await call("", "POST", "/api/auth/email/verify", { email: "member@beta.test", code });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.data.me.email, "member@beta.test");
  });

  await t.test("removing an email locks it out again at once", async () => {
    process.env.OR_BETA_ONLY = "true";
    const fresh = await account("sb:beta-old3", "old.tester@beta.test");
    const removed = await call(founder, "DELETE", "/api/admin/beta/" + encodeURIComponent("Old.Tester@beta.test"));
    assert.equal(removed.status, 200);
    assert.equal(removed.data.list.some((r: any) => r.email === "old.tester@beta.test"), false);
    assert.equal((await call(fresh, "GET", "/api/jobs")).status, 403);
  });
});
