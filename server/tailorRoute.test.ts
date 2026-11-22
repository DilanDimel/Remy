import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Job } from "@shared/types";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "./db";
import { FIT_RULES_VERSION } from "./fit";
import { registerRoutes } from "./routes";

// The tailoring route after it was split into tailorApplication (stage 5b): the eligibility conflict still answers 409.
test("generate: an eligibility conflict answers 409 before any AI call; reminder Not now keeps only real keys", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const job: Job = {
    id: "j1", kind: "internship", title: "Finance Intern", company: "Synthetic Co", location: "Dallas, TX", format: "On-site", dates: "", deadline: "",
    deadlineText: "", eligibility: [], requirements: [], summary: "", applyUrl: "", sourceUrl: "", sourceName: "test", label: "Student provided",
    checkedAt: new Date().toISOString(), checks: [], origin: "manual",
  };
  await ensureUser({ id: "tr-1", kind: "guest", name: "", email: "", picture: "" });
  const ws = emptyWorkspace();
  ws.openingsCheckedAt = new Date().toISOString();
  ws.jobs = [job];
  ws.resume = { doc: { sections: [], skills: [] } } as any;
  ws.fits = { j1: { at: "", by: "rules", v: FIT_RULES_VERSION, eligibility: "unlikely", eligibilityNote: "Seniors only", matched: [], gaps: [], why: "" } };
  ws.applications = [{ id: "app1", jobId: "j1", createdAt: "", gaps: [], changes: [], letter: "", letterFlags: [], letterApproved: false, personalize: [], ats: [], versions: [] }];
  await saveWorkspace("tr-1", ws);
  const cookie = "__Host-or_sid=" + (await createSession("tr-1")).token;
  const r = await fetch(base + "/api/applications/app1/generate", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(r.status, 409);
  const body = await r.json() as any;
  assert.equal(body.code, "eligibility-conflict");
  assert.match(body.message, /Seniors only/);
  // Not now from a reminder email (same harness): only well-formed deadline keys are kept.
  const skip = await fetch(base + "/api/reminders/skip", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ keys: ["c1:2026-11-23", "bad key", "x:notadate"] }) });
  assert.equal(skip.status, 200);
  assert.equal((await skip.json() as any).skipped, 1);
  const { loadWorkspace } = await import("./db");
  assert.deepEqual((await loadWorkspace("tr-1")).reminded, ["c1:2026-11-23:soon", "c1:2026-11-23:day", "c1:2026-11-23:skip"]);
  const none = await fetch(base + "/api/reminders/skip", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ keys: ["nope"] }) });
  assert.equal(none.status, 400);
});
