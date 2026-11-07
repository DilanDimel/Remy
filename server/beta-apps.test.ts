// Founding Cohort applications: the form's script posts here; owners accept, wait-list or decline. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "./db";
import { registerRoutes } from "./routes";
import { parseAnswers } from "./beta";

process.env.OWNER_EMAILS = "founder@apps.test";
process.env.OR_BETA_HOOK_SECRET = "test-secret-0123456789";

// Lincoln's form, question titles as written (Nov 7, 2026).
const FORM = {
  "Beta Terms & Age Verification": "I am 18 or older, OR I have parent/guardian permission.",
  "First & Last Name": "Jordan Lee",
  "School / University": "TCU",
  "School Email Address": "  Jordan.Lee@TCU.edu ",
  "Major": "Finance",
  "Class Year": "Sophomore",
  "What are you trying to land next?": "Internship",
  "Where are you stuck right now?": "Getting past the resume screen",
  "What's currently in your job search toolkit?": ["LinkedIn", "Handshake"],
  "Can you give 5 minutes a week for feedback?": "Yes",
  "How did you hear about us?": "tcu-table",
};

test("form answers: every question lands in its own field; the school email isn't mistaken for the school", () => {
  const a = parseAnswers(FORM)!;
  assert.equal(a.email, "jordan.lee@tcu.edu");
  assert.equal(a.name, "Jordan Lee");
  assert.equal(a.school, "TCU");
  assert.equal(a.major, "Finance");
  assert.equal(a.classYear, "Sophomore");
  assert.equal(a.goal, "Internship");
  assert.equal(a.stuck, "Getting past the resume screen");
  assert.equal(a.tools, "LinkedIn, Handshake");
  assert.equal(a.feedback, "Yes");
  assert.equal(a.source, "tcu-table");
  assert.match(a.terms, /18 or older/);
  assert.equal(parseAnswers({ "First & Last Name": "No Email" }), null);
  assert.equal(parseAnswers({ "Email": "not-an-email" }), null);
});

test("applications: secret-only hook, owners decide, accepting lets them sign in, declined can be deleted", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as any };
  };
  await ensureUser({ id: "sb:apps-founder", kind: "supabase", email: "founder@apps.test", name: "", picture: "" });
  await saveWorkspace("sb:apps-founder", emptyWorkspace());
  const owner = { Cookie: "__Host-or_sid=" + (await createSession("sb:apps-founder")).token };
  await ensureUser({ id: "sb:apps-student", kind: "supabase", email: "student@apps.test", name: "", picture: "" });
  await saveWorkspace("sb:apps-student", emptyWorkspace());
  const student = { Cookie: "__Host-or_sid=" + (await createSession("sb:apps-student")).token };

  assert.equal((await call("POST", "/api/beta/form-hook", { answers: FORM })).status, 401);
  assert.equal((await call("POST", "/api/beta/form-hook", { answers: FORM }, { "x-beta-secret": "wrong-secret-0123456789" })).status, 401);
  const ok = await call("POST", "/api/beta/form-hook", { answers: FORM }, { "x-beta-secret": "test-secret-0123456789" });
  assert.equal(ok.status, 200);
  await call("POST", "/api/beta/form-hook", { answers: { ...FORM, "School Email Address": "sam@tcu.edu", "First & Last Name": "Sam" } }, { "x-beta-secret": "test-secret-0123456789" });

  assert.equal((await call("GET", "/api/admin/beta/applications", undefined, student)).status, 403);
  let list = (await call("GET", "/api/admin/beta/applications", undefined, owner)).data;
  assert.equal(list.applications.length, 2);
  assert.equal(list.applications.find((a: any) => a.email === "jordan.lee@tcu.edu").status, "new");

  const accepted = await call("POST", "/api/admin/beta/applications/" + encodeURIComponent("jordan.lee@tcu.edu"), { status: "accepted", cohort: "Cohort 1" }, owner);
  assert.equal(accepted.status, 200);
  assert.ok(accepted.data.list.some((r: any) => r.email === "jordan.lee@tcu.edu"));
  // A re-submission updates the answers but keeps the decision.
  await call("POST", "/api/beta/form-hook", { answers: { ...FORM, Major: "Accounting" } }, { "x-beta-secret": "test-secret-0123456789" });
  list = (await call("GET", "/api/admin/beta/applications", undefined, owner)).data;
  const j = list.applications.find((a: any) => a.email === "jordan.lee@tcu.edu");
  assert.deepEqual([j.status, j.cohort, j.major], ["accepted", "Cohort 1", "Accounting"]);
  // Moving an accepted application back takes them off the sign-in list.
  const back = await call("POST", "/api/admin/beta/applications/" + encodeURIComponent("jordan.lee@tcu.edu"), { status: "next" }, owner);
  assert.equal(back.data.list.some((r: any) => r.email === "jordan.lee@tcu.edu"), false);

  assert.equal((await call("POST", "/api/admin/beta/applications/sam%40tcu.edu", { status: "maybe" }, owner)).status, 400);
  await call("POST", "/api/admin/beta/applications/sam%40tcu.edu", { status: "declined" }, owner);
  const del = await call("DELETE", "/api/admin/beta/applications", undefined, owner);
  assert.equal(del.data.deleted, 1);
  assert.deepEqual(del.data.applications.map((a: any) => a.email), ["jordan.lee@tcu.edu"]);
});
