// Owners' Students list (Nov 25): every account shows up, not only applicants and Insiders, with profile counts.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "./db";
import { registerRoutes } from "../routes";
import { q } from "./sql";

process.env.OWNER_EMAILS = "founder@stu.test";

test("students list: every account is listed and counted once; the team isn't counted; students can't read it", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const get = async (cookie: string) => {
    const r = await fetch(base + "/api/admin/students", { headers: { Cookie: "__Host-or_sid=" + cookie } });
    return { status: r.status, data: (await r.json()) as any };
  };
  const user = async (id: string, kind: string, email: string, setUp = false) => {
    await ensureUser({ id, kind, email, name: "", picture: "" } as any);
    const ws = emptyWorkspace();
    if (setUp) ws.onboarding = { ...ws.onboarding, done: true } as any;
    await saveWorkspace(id, ws);
  };
  await user("sb:founder", "supabase", "founder@stu.test");
  await user("sb:new", "supabase", "new.student@stu.test", true); // signed up today, never applied
  await user("g:new", "google", "New.Student@stu.test"); // same person, second sign-in
  await user("sb:old", "supabase", "old@stu.test");
  await q("UPDATE users SET created_at = now() - interval '20 days' WHERE id = 'sb:old'");
  await user("guest:x", "guest", "");

  const owner = (await createSession("sb:founder")).token;
  assert.equal((await get((await createSession("sb:new")).token)).status, 403);

  const { status, data } = await get(owner);
  assert.equal(status, 200);
  const emails = data.people.map((p: any) => p.email).sort();
  assert.deepEqual(emails, ["founder@stu.test", "new.student@stu.test", "old@stu.test"]);
  const fresh = data.people.find((p: any) => p.email === "new.student@stu.test");
  assert.ok(fresh.signedUpAt);
  assert.equal(fresh.appliedAt, null);
  assert.equal(fresh.onList, false);
  assert.equal(data.counts.total, 2); // new + old; the founder is team
  assert.equal(data.counts.today, 1);
  assert.equal(data.counts.week, 1);
  assert.equal(data.counts.month, 2);
  assert.equal(data.counts.setUp, 1);
  assert.equal(data.counts.team, 1);
});
