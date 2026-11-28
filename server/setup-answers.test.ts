// A fast Continue (or a second tab) sends the setup step without the answer still saving: it must not drop it.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, loadWorkspace, saveWorkspace } from "./platform/db";
import { registerRoutes } from "./routes";

test("setup answers: a stale step change keeps saved answers; starting over still clears them", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  await ensureUser({ id: "setup-answers", kind: "guest", name: "", email: "", picture: "" });
  const ws = emptyWorkspace();
  ws.onboarding = { ...ws.onboarding, step: 4, questions: ["Q1", "Q2"], answers: [{ q: "Q1", a: "A1" }, { q: "Q2", a: "A2" }] };
  await saveWorkspace("setup-answers", ws);
  const cookie = "__Host-or_sid=" + (await createSession("setup-answers")).token;
  const put = (value: unknown) => fetch(base + "/api/ws/onboarding", { method: "PUT", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ value }) });

  // The stale tab only knew the first answer.
  assert.equal((await put({ ...ws.onboarding, step: 5, answers: [{ q: "Q1", a: "A1" }] })).status, 200);
  let now = (await loadWorkspace("setup-answers")).onboarding;
  assert.equal(now.step, 5);
  assert.deepEqual(now.answers.map((a) => a.a), ["A1", "A2"]);

  // "Start over" clears the questions with the answers, so it still works.
  assert.equal((await put({ ...ws.onboarding, step: 1, questions: [], answers: [] })).status, 200);
  now = (await loadWorkspace("setup-answers")).onboarding;
  assert.equal(now.answers.length, 0);
});
