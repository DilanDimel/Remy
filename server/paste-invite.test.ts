// Paste an interview invite (Nov 19): confirming puts the interview on the calendar with the date the student confirmed.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "./platform/db";
import { registerRoutes } from "./routes";

test("confirming an interview email adds it to the calendar and dates the prep to-do; no date, no calendar entry", async (t) => {
  const app = express(); app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise<void>((r) => server.close(() => r())));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  await ensureUser({ id: "paste-a", kind: "guest", name: "", email: "", picture: "" });
  const ws = emptyWorkspace();
  ws.inbox = [{ id: "m1", from: "r@frostbank.com", subject: "Interview", date: "2026-11-19", body: "We'd like to interview you on Tuesday, November 24 at 2:00 PM.", label: "Pasted by student" } as any,
              { id: "m2", from: "r@bdo.com", subject: "Next steps", date: "2026-11-19", body: "Please pick a time that works for an interview next week.", label: "Pasted by student" } as any];
  ws.suggestions = [
    { id: "s1", messageId: "m1", company: "Frost Bank", role: "Analyst Intern", proposed: "Interview", confidence: "high", evidence: "We'd like to interview you", rulesSay: "Interview", createdAt: "2026-11-19", state: "open", date: "2026-11-24", time: "14:00", dateQuote: "Tuesday, November 24 at 2:00 PM" },
    { id: "s2", messageId: "m2", company: "BDO", role: "", proposed: "Interview", confidence: "medium", evidence: "pick a time", rulesSay: "Interview", createdAt: "2026-11-19", state: "open" },
  ] as any;
  await saveWorkspace("paste-a", ws);
  const cookie = "__Host-or_sid=" + (await createSession("paste-a")).token;
  const resolve = async (id: string, body: object) => (await fetch(`${base}/api/suggestions/${id}/resolve`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", status: "Interview", ...body }) })).json() as Promise<any>;
  let w = await resolve("s1", { date: "2026-11-24", time: "14:00" });
  const cal = w.calendar.filter((c: any) => c.kind === "Interview");
  assert.equal(cal.length, 1);
  assert.equal(cal[0].date, "2026-11-24"); assert.equal(cal[0].time, "14:00"); assert.match(cal[0].title, /Frost Bank/);
  assert.equal(w.tasks.find((x: any) => /Frost Bank interview/.test(x.title))?.due, "2026-11-24");
  w = await resolve("s1", { date: "2026-11-24", time: "14:00" }); // confirming again doesn't add a second entry
  assert.equal(w.calendar.filter((c: any) => c.kind === "Interview").length, 1);
  w = await resolve("s2", {});
  assert.equal(w.calendar.filter((c: any) => /BDO/.test(c.title)).length, 0);
  assert.equal(w.tasks.find((x: any) => /BDO interview/.test(x.title))?.due, "");
  // Review, Nov 19: "pick a time" first, then the confirmation with a date: the undated prep to-do gets the day.
  w = await resolve("s2", { date: "2026-12-01", time: "10:00" });
  assert.equal(w.tasks.find((x: any) => /BDO interview/.test(x.title))?.due, "2026-12-01");
  // Rescheduled: Frost Bank moves to Dec 3; the old Nov 24 entry is replaced, not left behind.
  w = await resolve("s1", { date: "2026-12-03", time: "09:00" });
  const frost = w.calendar.filter((c: any) => c.kind === "Interview" && /Frost Bank/.test(c.title));
  assert.equal(frost.length, 1); assert.equal(frost[0].date, "2026-12-03");
  assert.equal(w.tasks.find((x: any) => /Frost Bank interview/.test(x.title))?.due, "2026-12-03");
});
