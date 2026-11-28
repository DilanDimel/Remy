// Feature releases (Nov 24): Interview and Community are locked for students with a teaser, Rewards is owners-only,
// and owners release a feature from Admin → Beta without a deploy. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "./db";
import { registerRoutes } from "../routes";
import { accessOf, appOut, featureAt, redesignOut, releasesOf } from "../../shared/features";

process.env.OWNER_EMAILS = "boss@release.test";

test("releases: defaults, a bad saved value, and what owners and students see", () => {
  const r = releasesOf({ interview: "nonsense", community: "released" });
  assert.deepEqual([r.interview, r.community, r.rewards], ["locked", "released", "owners"]);
  assert.equal(accessOf(r, "interview", false), "locked");
  assert.equal(accessOf(r, "interview", true), "open");
  assert.equal(accessOf(r, "community", false), "open");
  assert.equal(accessOf(r, "rewards", false), "hidden");
  assert.equal(accessOf(r, "unknown", false), "hidden"); // anything not in the list stays with owners
  assert.equal(featureAt("/interview?job=1")?.key, "interview");
  assert.equal(featureAt("/opportunities"), undefined);
  // The whole redesign has no page: it never matches a path, starts with owners, and releases on its own.
  assert.equal(featureAt("/"), undefined);
  assert.equal(redesignOut(r), false);
  assert.equal(redesignOut(releasesOf({ redesign: "released" })), true);
  assert.equal(releasesOf({ redesign: "released" }).rewards, "released"); // Rewards rides with The Big Upgrade (Dilan, Nov 24)
  assert.equal(releasesOf({ rewards: "released" }).rewards, "owners"); // and never on its own
  // The phone app has its own switch: owners-only by default, and releasing the redesign doesn't release it.
  assert.equal(appOut(r), false);
  assert.equal(appOut(releasesOf({ redesign: "released" })), false);
  assert.equal(appOut(releasesOf({ app: "released" })), true);
});

test("releases: owners flip a feature, students can't, and locked interviews are refused", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const call = async (cookie: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as any };
  };
  const account = async (id: string, email: string) => {
    await ensureUser({ id, kind: "supabase", email, name: "", picture: "" });
    const ws = emptyWorkspace();
    ws.openingsCheckedAt = new Date().toISOString();
    await saveWorkspace(id, ws);
    return "__Host-or_sid=" + (await createSession(id)).token;
  };
  const boss = await account("sb:rel-boss", "boss@release.test");
  const kid = await account("sb:rel-kid", "kid@release.test");

  assert.deepEqual((await call("", "GET", "/api/config")).data.features, { redesign: "owners", interview: "locked", community: "locked", app: "owners", places: "owners", guide: "released", competitions: "owners", rewards: "owners", languages: "owners", explore: "released" });
  assert.equal((await call(kid, "POST", "/api/admin/features", { key: "interview", state: "released" })).status, 403);
  assert.equal((await call(boss, "POST", "/api/admin/features", { key: "nope", state: "released" })).status, 400);
  assert.equal((await call(boss, "POST", "/api/admin/features", { key: "interview", state: "yes" })).status, 400);
  const locked = await call(kid, "POST", "/api/interviews", {});
  assert.equal(locked.status, 403);
  assert.match(locked.data.message || locked.data.error || "", /future update/);

  const done = await call(boss, "POST", "/api/admin/features", { key: "interview", state: "released" });
  assert.equal(done.status, 200);
  assert.equal(done.data.features.interview, "released");
  assert.equal((await call("", "GET", "/api/config")).data.features.interview, "released");
  const open = await call(kid, "POST", "/api/interviews", {});
  assert.doesNotMatch(String(open.data.message || open.data.error || ""), /future update/);
  assert.notEqual(open.status, 403); // released: students get past the owners-only gate too
});
