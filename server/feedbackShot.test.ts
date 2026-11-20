// "Send feedback" with a screenshot (owner feedback #57): stored under the student and the note, shown to owners only,
// and only real images are kept.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "./db";
import { registerRoutes } from "./routes";
import { q1 } from "./sql";

process.env.OWNER_EMAILS = [process.env.OWNER_EMAILS, "founder@shot.test"].filter(Boolean).join(",");

test("feedback screenshot: saved with the note, owners can open it, students can't, only real images", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  async function account(id: string, email: string) {
    await ensureUser({ id, kind: "supabase", email, name: "", picture: "" });
    const ws = emptyWorkspace();
    ws.profile.major = "Finance";
    ws.openingsCheckedAt = new Date().toISOString();
    await saveWorkspace(id, ws);
    return "__Host-or_sid=" + (await createSession(id)).token;
  }
  const student = await account("sb:shot-student", "student@shot.test");
  const founder = await account("sb:shot-founder", "founder@shot.test");
  const send = (cookie: string, bytes: Uint8Array | null, message = "The tour flickered on this page") => {
    const fd = new FormData();
    fd.append("message", message);
    fd.append("page", "/resume");
    if (bytes) fd.append("file", new Blob([bytes]), "screenshot.png");
    return fetch(base + "/api/feedback", { method: "POST", headers: { Cookie: cookie }, body: fd });
  };
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);

  const ok = await send(student, png);
  assert.equal(ok.status, 200);
  const row = await q1("SELECT id FROM error_reports WHERE kind = 'feedback' AND user_id = $1 ORDER BY id DESC LIMIT 1", ["sb:shot-student"]);
  const url = `${base}/api/admin/feedback/${row.id}/screenshot`;
  const asOwner = await fetch(url, { headers: { Cookie: founder } });
  assert.equal(asOwner.status, 200);
  assert.equal(asOwner.headers.get("content-type"), "image/png");
  assert.equal(asOwner.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await asOwner.arrayBuffer()), png);
  assert.notEqual((await fetch(url, { headers: { Cookie: student } })).status, 200); // students can't open the owners' link

  const list = await (await fetch(base + "/api/admin/errors", { headers: { Cookie: founder } })).json() as any;
  assert.equal(list.feedback.find((f: any) => f.id === row.id)?.shot, true);

  assert.equal((await send(student, new TextEncoder().encode("<svg onload=alert(1)>"))).status, 400); // not an image
  const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]); // "RIFF....WAVE"
  assert.equal((await send(student, wav)).status, 400);
  assert.equal((await send(student, null, "No screenshot this time")).status, 200); // a note alone still works
  assert.equal((await fetch(`${base}/api/admin/feedback/999999/screenshot`, { headers: { Cookie: founder } })).status, 404);

  // Each student keeps their newest 3 screenshots (storage cap).
  for (const n of [2, 3, 4]) assert.equal((await send(student, png, `Screenshot note number ${n}`)).status, 200);
  const shots = async () => (await q1("SELECT COUNT(*)::int AS n FROM files WHERE user_id = $1 AND kind LIKE 'feedback:%'", ["sb:shot-student"])).n;
  assert.equal(await shots(), 3);
  assert.equal((await fetch(url, { headers: { Cookie: founder } })).status, 404); // the oldest one went

  // "Handled" deletes the note's screenshot.
  const fix = await fetch(base + "/api/admin/errors/fix", { method: "POST", headers: { Cookie: founder, "Content-Type": "application/json" }, body: JSON.stringify({ message: "Screenshot note number 4", kind: "feedback" }) });
  assert.equal(fix.status, 200);
  assert.equal(await shots(), 2);
  // The team log keeps a reference, not the student's words (those leave with the account).
  const logged = await q1("SELECT detail FROM team_activity WHERE action = 'Handled feedback' ORDER BY at DESC LIMIT 1");
  assert.match(logged.detail, /^note #\d+ on \/resume$/);
  assert.ok(!logged.detail.includes("Screenshot note number 4"));
});
