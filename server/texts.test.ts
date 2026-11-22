import { test } from "node:test";
import assert from "node:assert/strict";
process.env.OWNER_EMAILS = "owner@texts.test";
import { emptyWorkspace, ensureUser, loadWorkspace, saveWorkspace } from "./db";
import { sendTexts, textMode, urgentText, usPhone } from "./texts";

function ws() {
  const w = emptyWorkspace();
  w.onboarding.done = true;
  w.settings.texts = { on: true, phone: "(817) 555-0123" };
  w.calendar = [
    { id: "c1", title: "Chevron Finance Intern", date: "2026-11-23", time: "", kind: "Deadline", source: "test" },
    { id: "c2", title: "Far away", date: "2026-11-30", time: "", kind: "Deadline", source: "test" },
  ] as any;
  return w;
}

test("usPhone accepts US numbers only", () => {
  assert.equal(usPhone("(817) 555-0123"), "+18175550123");
  assert.equal(usPhone("1-817-555-0123"), "+18175550123");
  assert.equal(usPhone("555-0123"), null);
  assert.equal(usPhone("+44 20 7946 0958"), null);
});

test("urgentText: only when on, a deadline today or tomorrow, once per deadline and once a day", () => {
  const w = ws();
  const t = urgentText(w, "2026-11-22", "remyai.org")!;
  assert.match(t.body, /Chevron Finance Intern closes tomorrow/);
  assert.match(t.body, /STOP/);
  w.texts = [{ key: t.key, day: "2026-11-22", at: "", to: "", body: "", mode: "test" }];
  assert.equal(urgentText(w, "2026-11-22", "remyai.org"), null, "one a day");
  assert.equal(urgentText(w, "2026-11-23", "remyai.org"), null, "not twice for the same deadline");
  w.texts = [];
  w.settings.texts = { on: false, phone: "(817) 555-0123" };
  assert.equal(urgentText(w, "2026-11-22", "remyai.org"), null, "opt-in");
  w.settings.texts = { on: true, phone: "12" };
  assert.equal(urgentText(w, "2026-11-22", "remyai.org"), null, "needs a valid number");
});

test("sendTexts: test mode sends nothing, keeps the text, owners only", async () => {
  assert.equal(textMode(), "test");
  for (const [id, email] of [["tx-owner", "owner@texts.test"], ["tx-student", "student@texts.test"]] as const) {
    await ensureUser({ id, kind: "supabase", email, name: "", picture: "" });
    const w = ws();
    w.visits = ["2026-11-21"];
    await saveWorkspace(id, w);
  }
  const calls: string[] = [];
  assert.equal(await sendTexts("2026-11-08", "2026-11-22", async (to) => { calls.push(to); }), 1);
  assert.deepEqual(calls, [], "test mode never calls the sender");
  const kept = (await loadWorkspace("tx-owner")).texts!;
  assert.equal(kept[0].mode, "test");
  assert.equal(kept[0].to, "+18175550123");
  assert.equal((await loadWorkspace("tx-student")).texts, undefined, "a real student gets nothing");
});

test("sendTexts: with Twilio keys it calls the sender, and a failed send isn't recorded", async () => {
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC_test", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+15550000000" });
  try {
    await ensureUser({ id: "tx-owner2", kind: "supabase", email: "owner@texts.test", name: "", picture: "" });
    const w = ws(); w.visits = ["2026-11-21"]; await saveWorkspace("tx-owner2", w);
    const fail = async () => { throw new Error("trial number not verified"); };
    await sendTexts("2026-11-08", "2026-11-22", fail);
    assert.equal((await loadWorkspace("tx-owner2")).texts, undefined);
    const calls: string[] = [];
    await sendTexts("2026-11-08", "2026-11-22", async (to, body) => { calls.push(to + " " + body); });
    assert.ok(calls.some((c) => c.startsWith("+18175550123 Remy: Chevron")));
    assert.equal((await loadWorkspace("tx-owner2")).texts![0].mode, "twilio");
  } finally { for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"]) delete process.env[k]; }
});

test("deadline reminder: owners get Finish it / Not now, and Not now stops reminders and texts for that deadline", async () => {
  const { reminderEmail, dueReminders } = await import("./reminders");
  const w = ws();
  const due = [{ key: "c1:2026-11-23:soon", title: "Chevron <Intern>", date: "2026-11-23", left: 1 }];
  const plain = reminderEmail("Maya", due, "remyai.org");
  assert.equal((plain as any).html, undefined, "students keep the plain email for now");
  const e = reminderEmail("Maya", due, "remyai.org", true);
  assert.match(e.text, /Not now .*https:\/\/remyai\.org\/calendar\?skip=c1%3A2026-11-23/);
  assert.ok(e.html!.includes("Chevron &lt;Intern&gt;") && e.html!.includes("Finish it"));
  // what POST /api/reminders/skip stores
  w.reminded = ["c1:2026-11-23:soon", "c1:2026-11-23:day", "c1:2026-11-23:skip"];
  w.settings.notify.deadlines = true;
  assert.equal(urgentText(w, "2026-11-22", "remyai.org"), null, "no text either");
  assert.equal(dueReminders(w, "2026-11-23").filter((d) => d.key.startsWith("c1:")).length, 0, "no day-of email");
});
