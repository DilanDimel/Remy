// "Download my data" includes everything Remy stores about the student (Privacy page: "download all your data"),
// and no sign-in secrets.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, saveFile, saveWorkspace } from "./db";
import { registerRoutes } from "./routes";
import { q } from "./sql";

test("data export: account, workspace, files, feedback, AI use, calendar link; no secrets", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;

  const id = "sb:export-student";
  await ensureUser({ id, kind: "supabase", email: "export.student@export.test", name: "Ex Port", picture: "" });
  const ws = emptyWorkspace();
  ws.profile.major = "Finance";
  ws.openingsCheckedAt = new Date().toISOString();
  await saveWorkspace(id, ws);
  const { token } = await createSession(id);
  const cookie = "__Host-or_sid=" + token;
  await saveFile(id, "photo", "photo", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9]));
  await q("INSERT INTO error_reports (kind, place, message, detail, user_id) VALUES ('feedback', '/resume', 'Export test note', 'export.student@export.test', $1)", [id]);
  await q("INSERT INTO google_calendar (user_id, refresh, calendar_id) VALUES ($1, 'SECRET-REFRESH-TOKEN', 'cal-1') ON CONFLICT (user_id) DO NOTHING", [id]);

  const r = await fetch(base + "/api/export/data", { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition") || "", /remy-my-data\.json/);
  const raw = await r.text();
  const d = JSON.parse(raw);
  assert.equal(d.account.email, "export.student@export.test");
  assert.equal(d.workspace.profile.major, "Finance");
  const photo = d.files.find((f: any) => f.kind === "photo");
  assert.deepEqual([...Buffer.from(photo.base64, "base64")], [0x89, 0x50, 0x4e, 0x47, 9, 9]);
  assert.ok(d.feedbackAndErrorReports.some((n: any) => n.message === "Export test note"));
  assert.equal(d.googleCalendar.connected, true);
  assert.equal(typeof d.aiUsage.calls, "number");
  // No sign-in secrets: not the calendar refresh token, not the session cookie or its hash.
  assert.ok(!raw.includes("SECRET-REFRESH-TOKEN"));
  assert.ok(!raw.includes(token));
  assert.ok(!raw.includes("token_hash"));

  // Another student's files and notes never appear.
  await ensureUser({ id: "sb:export-other", kind: "supabase", email: "other@export.test", name: "", picture: "" });
  await saveFile("sb:export-other", "photo", "photo", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 7, 7]));
  await q("INSERT INTO error_reports (kind, place, message, detail, user_id) VALUES ('feedback', '/', 'Someone else entirely', '', 'sb:export-other')");
  const again = await (await fetch(base + "/api/export/data", { headers: { Cookie: cookie } })).text();
  assert.ok(!again.includes("Someone else entirely") && !again.includes("other@export.test"));
});
