// "Delete everything" (DELETE /api/ws) after the move to DigitalOcean: sign-in no longer goes through Supabase, so
// email-code and LinkedIn accounts (kind "supabase") are fully gone with their account row, and the answer never tells
// the student a sign-in record is left over (it used to call a Supabase-only database function that no longer exists).
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "./platform/db";
import { registerRoutes } from "./routes";
import { q } from "./platform/sql";

test("delete everything: email-code and LinkedIn accounts are removed and nothing is reported left over", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  for (const id of ["sb:em-3f2c1a9e-aaaa-4bbb-8ccc-000000000001", "li:linkedin-sub-77", "g:google-sub-5"]) {
    await ensureUser({ id, kind: id.startsWith("g:") ? "google" : "supabase", email: `${id.replace(/[^a-z0-9]/gi, "")}@del.test`, name: "", picture: "" });
    await saveWorkspace(id, emptyWorkspace());
    const cookie = "__Host-or_sid=" + (await createSession(id)).token;
    const r = await fetch(base + "/api/ws", { method: "DELETE", headers: { Cookie: cookie } });
    assert.equal(r.status, 200, id);
    const body = (await r.json()) as any;
    assert.equal(body.deleted, true);
    assert.equal(body.loginRemoved, true, `${id}: no "sign-in record couldn't be removed" message`);
    assert.equal((await q("SELECT 1 FROM users WHERE id=$1", [id])).length, 0);
    assert.equal((await q("SELECT 1 FROM workspaces WHERE user_id=$1", [id])).length, 0);
    assert.equal((await fetch(base + "/api/jobs", { headers: { Cookie: cookie } })).status, 401, "the session is gone");
  }
});
