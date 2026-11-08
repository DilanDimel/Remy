// Feedback Remy asks for itself: one question at a moment, and a weekly check-in. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, loadWorkspace, saveWorkspace } from "./db";
import { registerRoutes } from "./routes";
import { q } from "./sql";

test("feedback asks: known keys only, answers become feedback notes, each key asked once, follow-up is optional", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const id = "sb:feedback-asks";
  await ensureUser({ id, kind: "supabase", email: "asks@tcu.edu", name: "", picture: "" });
  await saveWorkspace(id, emptyWorkspace());
  const cookie = "__Host-or_sid=" + (await createSession(id)).token;
  const call = async (path: string, body: unknown) => {
    const r = await fetch(base + path, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as any };
  };
  const notes = async (place: string) => (await q("SELECT message FROM error_reports WHERE user_id = $1 AND kind = 'feedback' AND place = $2", [id, place])).map((r) => String(r.message));

  assert.equal((await call("/api/feedback/ask", { key: "anything", answers: [] })).status, 400, "unknown keys are refused");

  const one = await call("/api/feedback/ask", { key: "moment:resume", answers: [{ q: "What was the hardest part?", a: "The upload read my dates wrong." }] });
  assert.equal(one.status, 200);
  assert.ok(one.data.feedbackAsked["moment:resume"], "marked as asked");
  assert.deepEqual(await notes("ask:moment:resume"), ["What was the hardest part? — The upload read my dates wrong."]);

  // Skipped: marked as asked, nothing recorded.
  const skip = await call("/api/feedback/ask", { key: "moment:day7", answers: [] });
  assert.ok(skip.data.feedbackAsked["moment:day7"]);
  assert.equal((await notes("ask:moment:day7")).length, 0);

  // A check-in: one note per answered question, with its follow-up; unanswered questions leave nothing.
  await call("/api/feedback/ask", { key: "checkin:2026-W46", answers: [
    { q: "What did you try?", a: "Tailoring", fq: "Which posting did you tailor for?", fa: "Deloitte audit intern" },
    { q: "Where did you get stuck?", a: "", fq: "", fa: "" },
    { q: "What should Remy do?", a: "Remind me about deadlines by text" },
  ] });
  const checkin = await notes("ask:checkin:2026-W46");
  assert.equal(checkin.length, 3, "two answers + one follow-up answer, each its own note");
  assert.ok(checkin.includes(`Follow-up to "What did you try?": Which posting did you tailor for? — Deloitte audit intern`));
  assert.ok((await loadWorkspace(id)).feedbackAsked?.["checkin:2026-W46"]);

  // Asked once, enforced by the server: answering again (another tab) records nothing new.
  await call("/api/feedback/ask", { key: "moment:resume", answers: [{ q: "What was the hardest part?", a: "Second tab answer" }] });
  assert.equal((await notes("ask:moment:resume")).length, 1);

  // A long answer and a long follow-up answer both survive whole.
  const long = "x".repeat(320);
  await call("/api/feedback/ask", { key: "moment:approved", answers: [{ q: "Would you send it as is?", a: long, fq: "What would you change first?", fa: long }] });
  assert.ok((await notes("ask:moment:approved")).every((m) => m.endsWith(long)));

  // No AI in tests: the follow-up is simply empty, never an error.
  const f = await call("/api/feedback/followup", { q: "Where did you get stuck?", a: "idk" });
  assert.equal(f.status, 200);
  assert.equal(f.data.followup, "");
});
