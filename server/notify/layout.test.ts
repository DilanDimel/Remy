import { test } from "node:test";
import assert from "node:assert/strict";
import { brandEmail, codeEmail, rows } from "./layout";
import { reminderEmail, weeklyDigest } from "./reminders";

test("branded email: escaped text, the student's name, fox from the site, dark mode, buttons", () => {
  const h = brandEmail({ host: "remyai.org", name: "Maya", heading: "A <new> one", preheader: "p&q", blocks: [rows([{ title: "A&B", sub: "<x>" }])], primary: { href: "https://remyai.org/a?x=1&y=2", label: "Go" }, why: "Because." });
  assert.ok(h.includes("Hi Maya,") && h.includes("A &lt;new&gt; one") && h.includes("A&amp;B") && !h.includes("<x>"));
  assert.ok(h.includes("https://remyai.org/email/remy-fox.png") && h.includes("prefers-color-scheme: dark"));
  assert.ok(h.includes('href="https://remyai.org/a?x=1&amp;y=2"'));
  assert.ok(!brandEmail({ host: "remyai.org", heading: "h", preheader: "", blocks: [], why: "" }).includes("Hi ,"), "no empty greeting");
});

test("code email shows the code big; students' reminder and digest stay plain until release", () => {
  assert.match(codeEmail({ host: "remyai.org", code: "019267", heading: "Your sign-in code", intro: "i", why: "w" }), /019267/);
  const due = [{ key: "c1:2026-11-24:soon", title: "Deloitte", date: "2026-11-24", left: 1 }];
  assert.equal(reminderEmail("Maya", due, "remyai.org").html, undefined);
  assert.match(reminderEmail("Maya", due, "remyai.org", true).html!, /Closes tomorrow · Tue, Nov 24/);
  const ws: any = { settings: { notify: { weeklyPlan: true } }, onboarding: { done: true }, profile: { name: "" }, resume: null, tasks: [], hiddenJobIds: [], fits: {}, savedJobIds: [], applications: [],
    jobs: [{ id: "a", title: "Analyst", company: "Frost", foundAt: "2026-11-22" }], calendar: [] };
  assert.equal((weeklyDigest(ws, "2026-11-22", 0, "remyai.org") as any).html, undefined);
  const d = weeklyDigest(ws, "2026-11-22", 0, "remyai.org", true, "Maya Lee")!;
  assert.match(d.html!, /Hi Maya,/);
  assert.match(d.text, /Hi Maya,/);
});
