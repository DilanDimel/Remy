// Section 5 (Nov 19): Getting started checklist, Interview as its own page, tour settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gettingStarted } from "@shared/progress";
import { chatActions } from "./safety";

const ws = (over: any = {}) => ({ savedJobIds: [], applications: [], resume: undefined, stories: [], contacts: [], ...over }) as any;

test("Getting started: each step is read from what the student did", () => {
  assert.deepEqual(gettingStarted(ws()).map((x) => x.done), [false, false, false, false, false]);
  const done = gettingStarted(ws({
    savedJobIds: ["j1"], resume: { confirmedAt: "2026-11-19" }, applications: [{ jobId: "j1", versions: [{}] }],
    stories: [{ situation: "a", task: "b", action: "c", result: "d" }], contacts: [{ id: "c1" }],
  }));
  assert.deepEqual(done.map((x) => x.done), [true, true, true, true, true]);
  // A story missing a part isn't a story yet; an application with no approved version isn't tailored yet.
  assert.equal(gettingStarted(ws({ stories: [{ situation: "a", task: "", action: "c", result: "d" }] }))[3].done, false);
  assert.equal(gettingStarted(ws({ applications: [{ jobId: "j1", versions: [] }] }))[2].done, false);
  assert.equal(gettingStarted(ws())[3].link, "/interview");
});

test("Remy's chat can point to the new Interview page and the LinkedIn tab", () => {
  assert.equal(chatActions([{ kind: "open", link: "/interview", label: "Practice" }])[0]?.kind, "open");
  assert.equal(chatActions([{ kind: "open", link: "/resume?tab=linkedin", label: "LinkedIn" }])[0]?.kind, "open");
});

test("contacts: where we met and when are saved, email optional, a bad date refused; tour settings accepted", async (t) => {
  const express = (await import("express")).default;
  const { createServer } = await import("node:http");
  const { createSession, emptyWorkspace, ensureUser, saveWorkspace } = await import("./db");
  const { registerRoutes } = await import("./routes");
  const app = express(); app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  await ensureUser({ id: "tour-c", kind: "guest", name: "", email: "", picture: "" });
  await saveWorkspace("tour-c", emptyWorkspace());
  const cookie = "__Host-or_sid=" + (await createSession("tour-c")).token;
  const put = (section: string, value: unknown) => fetch(`${base}/api/ws/${section}`, { method: "PUT", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
  const person = { id: "c1", name: "Sarah Lee", title: "Analyst", org: "Frost Bank", email: "", why: "", tags: [], label: "Student provided", met: "TCU fall career fair", metOn: "2026-11-18" };
  const ok = await put("contacts", [person]);
  assert.equal(ok.status, 200);
  const saved = (await ok.json() as any).contacts?.[0] ?? (await (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).json() as any).workspace.contacts[0];
  assert.equal(saved.met, "TCU fall career fair");
  assert.equal(saved.metOn, "2026-11-18");
  assert.equal((await put("contacts", [{ ...person, metOn: "Nov 18" }])).status, 400);
  assert.equal((await put("settings", { firstWin: 1, introsSeen: ["/opportunities"] })).status, 200);
  assert.equal((await put("settings", { firstWin: 5 })).status, 400);
});
