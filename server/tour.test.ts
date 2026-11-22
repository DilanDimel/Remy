// Section 5 (Nov 19): Getting started checklist, Interview as its own page, tour settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gettingStarted } from "@shared/progress";
import { chatActions } from "./ai/safety";

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
  const { createSession, emptyWorkspace, ensureUser, saveWorkspace } = await import("./platform/db");
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
  assert.equal((await put("settings", { tour: 3 })).status, 200);
  assert.equal((await put("settings", { tour: "done" })).status, 200);
  assert.equal((await put("settings", { tour: 99 })).status, 400);
});

test("Future of your field: the student's major comes first, even when roles or interests match other fields", async () => {
  const { futureFor } = await import("./jobs/future");
  const ws = (p: any) => ({ profile: { major: "", targetRoles: "", interests: "", ...p } }) as any;
  const a = futureFor(ws({ major: "Nursing", interests: "data analysis" })).fields.map((f) => f.field);
  assert.ok(a.length >= 1);
  assert.match(a[0], /nurs|health/i, JSON.stringify(a));
});

// Nov 19: a cleanup once left index.css with an unclosed block, so ~890 lines only applied on phones with reduced
// motion — and no check reads CSS. This one does.
test("the stylesheet's blocks are balanced and it parses", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"|'[^']*'/g, "");
  let depth = 0;
  for (const ch of css) { if (ch === "{") depth++; else if (ch === "}") { depth--; assert.ok(depth >= 0, "a } with no {"); } }
  assert.equal(depth, 0, "unclosed { in index.css");
  const { transform } = await import("esbuild");
  const r = await transform(readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8"), { loader: "css", logLevel: "silent" });
  assert.equal(r.warnings.filter((w) => /Expected "}"|Unexpected "}"/.test(w.text)).length, 0, r.warnings.map((w) => w.text).join("; "));
});
