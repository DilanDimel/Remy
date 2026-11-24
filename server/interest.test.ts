import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Job, Workspace } from "@shared/types";
import { createSession, emptyWorkspace, ensureUser, loadWorkspace, saveSections, saveWorkspace } from "./platform/db";
import { registerRoutes } from "./routes";
import { q } from "./platform/sql";

const opening = (id: string, kind: Job["kind"] = "internship"): Job => ({
  id, kind, title: "Software Engineering Intern", company: "Synthetic Test Co", location: "Dallas, TX",
  format: "Remote", dates: "", deadline: "", deadlineText: "", eligibility: [], requirements: [], summary: "",
  applyUrl: "https://example.com/" + id, sourceUrl: "https://example.com/" + id,
  sourceName: "Synthetic test fixture", label: "Student provided", checkedAt: new Date().toISOString(), checks: [], origin: "manual",
});

test("interest API: ownership, strict inputs, concurrent updates, ranking and data controls", async (t) => {
  const flag = process.env.OR_JOB_INTEREST_ENABLED;
  process.env.OR_JOB_INTEREST_ENABLED = "true";
  t.after(() => { if (flag === undefined) delete process.env.OR_JOB_INTEREST_ENABLED; else process.env.OR_JOB_INTEREST_ENABLED = flag; });
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  async function call(cookie: string, method: string, path: string, body?: unknown) {
    const r = await fetch(base + path, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json() as any };
  }
  async function student(id: string, jobs: Job[]) {
    await ensureUser({ id, kind: "guest", name: "", email: "", picture: "" });
    const ws = emptyWorkspace();
    ws.profile.major = "Computer Science";
    ws.profile.targetRoles = "Software Engineering";
    ws.openingsCheckedAt = new Date().toISOString(); // no outbound discovery in this test
    ws.jobs = jobs;
    await saveWorkspace(id, ws);
    return "__Host-or_sid=" + (await createSession(id)).token;
  }
  const cookie = await student("interest-a", [opening("a"), opening("b"), opening("event", "event")]);
  const other = await student("interest-b", [opening("private")]);

  await t.test("old workspaces without feedback fields remain readable and writable", async () => {
    await q("UPDATE workspaces SET data = data - 'jobFeedback' - 'jobFeedbackVersion', updated_at = now() WHERE user_id=$1", ["interest-a"]);
    const ws = await loadWorkspace("interest-a");
    assert.deepEqual(ws.jobFeedback, {});
    assert.equal(ws.jobFeedbackVersion, 0);
    assert.equal(ws.jobs.length, 3);
    assert.equal(ws.profile.major, "Computer Science");
  });
  await t.test("authentication, isolation and invalid inputs", async () => {
    assert.equal((await call("", "PUT", "/api/jobs/a/interest", { rating: 5 })).status, 401);
    assert.equal((await call(other, "PUT", "/api/jobs/a/interest", { rating: 5 })).status, 404);
    assert.equal((await call(other, "DELETE", "/api/jobs/a/interest")).status, 404);
    assert.equal((await call(cookie, "PUT", "/api/jobs/event/interest", { rating: 5 })).status, 400);
    for (const body of [{}, { rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: "5" }, { rating: null }, { rating: 4, reason: "unknown" }, { rating: 4, userId: "interest-b" }])
      assert.equal((await call(cookie, "PUT", "/api/jobs/a/interest", body)).status, 400, JSON.stringify(body));
    assert.equal((await call(cookie, "PUT", "/api/ws/jobFeedback", { value: { a: { rating: 5 } } })).status, 400);
    assert.deepEqual((await loadWorkspace("interest-a")).jobFeedback, {});
  });
  await t.test("parallel ratings and another section save all survive", async () => {
    const results = await Promise.all([
      call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5, reason: "role" }),
      call(cookie, "PUT", "/api/jobs/b/interest", { rating: 1, reason: "location" }),
      saveSections("interest-a", { savedJobIds: ["a"] }),
    ]);
    assert.equal((results[0] as any).status, 200);
    assert.equal((results[1] as any).status, 200);
    const ws = await loadWorkspace("interest-a");
    assert.equal(ws.jobFeedback?.a.rating, 5);
    assert.equal(ws.jobFeedback?.b.rating, 1);
    assert.equal(ws.jobFeedbackVersion, 2);
    assert.deepEqual(ws.savedJobIds, ["a"]);
    assert.equal(ws.jobFeedback?.a.context.profile.major, "Computer Science");
    assert.equal(ws.jobFeedback?.a.context.rankingVersion, "interest-v1");
    assert.deepEqual(Object.keys(ws.jobFeedback!.a.context.profile).sort(), ["classYear", "interests", "major", "opportunityTypes", "regions", "targetRoles"]);
    assert.deepEqual((await loadWorkspace("interest-b")).jobFeedback, {});
  });
  await t.test("'Not for me' hides in the same request; two quick passes both stay hidden; Show it again un-hides", async () => {
    const [x, y] = await Promise.all([
      call(cookie, "PUT", "/api/jobs/a/interest", { rating: 1, hide: true }),
      call(cookie, "PUT", "/api/jobs/b/interest", { rating: 1, reason: "role", hide: true }),
    ]);
    assert.equal(x.status, 200); assert.equal(y.status, 200);
    assert.deepEqual([...(await loadWorkspace("interest-a")).hiddenJobIds].sort(), ["a", "b"]);
    assert.equal((await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 1, hide: "yes" })).status, 400);
    const shown = await call(cookie, "DELETE", "/api/jobs/a/interest?unhide=1");
    assert.deepEqual(shown.data.hiddenJobIds, ["b"]);
    assert.equal(shown.data.jobFeedback.a, undefined);
    const kept = await call(cookie, "DELETE", "/api/jobs/b/interest"); // without unhide, the hidden list is left alone
    assert.deepEqual(kept.data.hiddenJobIds, ["b"]);
    await saveSections("interest-a", { hiddenJobIds: [] });
    await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5, reason: "role" });
    await call(cookie, "PUT", "/api/jobs/b/interest", { rating: 1, reason: "location" });
  });
  await t.test("Keep (stage 3) rates and saves in one request, once", async () => {
    const before = (await loadWorkspace("interest-a")).savedJobIds;
    const r = await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5, keep: true });
    assert.equal(r.status, 200);
    assert.equal(r.data.jobFeedback.a.rating, 5);
    const again = await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5, keep: true });
    assert.equal(again.data.savedJobIds.filter((x: string) => x === "a").length, 1);
    await saveSections("interest-a", { savedJobIds: before });
    await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5, reason: "role" });
  });
  await t.test("editing keeps createdAt; neutral is explicit and fit stays unchanged", async () => {
    const before = (await call(cookie, "GET", "/api/jobs")).data;
    assert.equal(before.interestEnabled, true);
    assert.equal(before.interest.a.adjustment, 8);
    assert.equal(before.interest.b.adjustment, -8);
    assert.match(before.interest.a.reasons[0], /More like this/);
    const createdAt = (await loadWorkspace("interest-a")).jobFeedback!.a.createdAt;
    const result = await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 3 });
    assert.equal(result.status, 200);
    assert.equal(result.data.jobFeedback.a.createdAt, createdAt);
    assert.equal(result.data.jobFeedback.a.reason, undefined);
    const after = (await call(cookie, "GET", "/api/jobs")).data;
    assert.equal(after.interest.a, undefined); // neutral: nothing moved, nothing to explain
    assert.deepEqual(after.fits, before.fits);
  });
  await t.test("profile change refreshes context on next rating", async () => {
    const before = (await loadWorkspace("interest-a")).jobFeedback!.a.context.profileKey;
    await call(cookie, "PUT", "/api/ws/profile", { value: { major: "Finance", targetRoles: "Finance" } });
    const rated = await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 4, reason: "company" });
    assert.notEqual(rated.data.jobFeedback.a.context.profileKey, before);
    const exported = (await call(cookie, "GET", "/api/export/data")).data.workspace as Workspace;
    assert.deepEqual(exported.jobFeedback, rated.data.jobFeedback);
  });
  await t.test("rollback retains data and still allows deletion/reset", async () => {
    process.env.OR_JOB_INTEREST_ENABLED = "false";
    const list = (await call(cookie, "GET", "/api/jobs")).data;
    assert.equal(list.interestEnabled, false);
    assert.deepEqual(list.interest, {}); // paused: ratings stop moving openings (saves still count on the page itself)
    assert.equal((await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5 })).status, 503);
    assert.equal((await loadWorkspace("interest-a")).jobFeedback!.a.rating, 4);
    assert.equal((await call(cookie, "DELETE", "/api/jobs/a/interest")).status, 200);
    assert.equal((await loadWorkspace("interest-a")).jobFeedback!.b.rating, 1);
    const cleared = await call(cookie, "DELETE", "/api/jobs/interests");
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.data.jobFeedback, {});
    const repeated = await call(cookie, "DELETE", "/api/jobs/interests");
    assert.equal(repeated.data.jobFeedbackVersion, cleared.data.jobFeedbackVersion);
    process.env.OR_JOB_INTEREST_ENABLED = "true";
  });
  await t.test("deleting an opening also removes its rating atomically", async () => {
    await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5 });
    await call(cookie, "DELETE", "/api/jobs/a");
    const ws = await loadWorkspace("interest-a");
    assert.equal(ws.jobs.some((j) => j.id === "a"), false);
    assert.equal(ws.jobFeedback!.a, undefined);
    assert.equal((await call(cookie, "PUT", "/api/jobs/a/interest", { rating: 5 })).status, 404);
  });
  await t.test("deleting the account removes ratings and invalidates the session", async () => {
    await call(cookie, "PUT", "/api/jobs/b/interest", { rating: 2 });
    assert.equal((await call(cookie, "DELETE", "/api/ws")).status, 200);
    assert.deepEqual(await q("SELECT 1 FROM workspaces WHERE user_id=$1", ["interest-a"]), []);
    assert.equal((await call(cookie, "GET", "/api/jobs")).status, 401);
    assert.equal((await call(other, "GET", "/api/jobs")).status, 200);
  });
});
