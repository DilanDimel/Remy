// The Review tab: each problem points at the exact field, entry or bullet, with the same rules as the resume checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { ResumeDoc } from "@shared/types";
import { reviewResume } from "@shared/review";
import { createSession, emptyWorkspace, ensureUser, saveWorkspace } from "../platform/db";
import { registerRoutes } from "../routes";

const doc = (): ResumeDoc => ({
  contact: { name: "Maya Lee", email: "maya@tcu.edu", phone: "", location: "Fort Worth, TX", links: "" },
  sections: [
    { id: "s1", heading: "Education", entries: [{ id: "e1", org: "TCU", role: "BBA Finance", location: "", dates: "May 2029", bullets: [{ id: "c1", text: "Coursework: Accounting, Statistics" }] }] },
    { id: "s2", heading: "Experience", entries: [
      { id: "e2", org: "NABA", role: "Treasurer", location: "", dates: "", bullets: [{ id: "b1", text: "Responsible for the chapter budget and reimbursements" }, { id: "b2", text: "Built budget trackers in Excel for the chapter" }] },
      { id: "e3", org: "Cafe", role: "Server", location: "", dates: "2024 – Present", bullets: [{ id: "b3", text: "Served 80 tables a night during weekend rush hours" }] },
    ] },
  ],
  skills: [{ id: "k1", label: "Tools", items: "Excel" }],
} as unknown as ResumeDoc);

test("review: points at the missing fields, the undated entry and the bullets without numbers or an action", () => {
  const { todo, good } = reviewResume(doc());
  const contact = todo.find((t) => t.kind === "contact") as any;
  assert.deepEqual(contact.fields, ["phone", "links"]);
  assert.match(contact.title, /phone and LinkedIn link/);
  const dates = todo.find((t) => t.kind === "dates") as any;
  assert.deepEqual(dates.entries.map((e: any) => e.entryId), ["e2"]);
  const nums = todo.find((t) => t.kind === "numbers") as any;
  assert.deepEqual(nums.bullets.map((b: any) => b.id), ["b1", "b2"]); // coursework isn't judged; b3 has a number
  const verbs = todo.find((t) => t.kind === "verbs") as any; // "Responsible for…" isn't an action: 2 of 3 = 67%, under the 70% bar
  assert.deepEqual(verbs.bullets.map((b: any) => b.id), ["b1"]);
  assert.equal(verbs.title, "1 bullet doesn't start with what you did");
});

test("review: a complete resume is all good", () => {
  const d = doc();
  d.contact.phone = "817-555-0100"; d.contact.links = "linkedin.com/in/maya";
  d.sections[1].entries[0].dates = "Aug 2025 – Present";
  d.sections[1].entries[0].bullets = [{ id: "b1", text: "Managed a $5,000 budget and reimbursements for 40 members" } as any, { id: "b2", text: "Built budget trackers in Excel used by 12 officers" } as any];
  const { todo, good } = reviewResume(d);
  assert.deepEqual(todo.filter((t) => t.kind !== "tip"), []);
  // A real one-pager would pass these too; this short test resume correctly gets the length and bullet-count tips.
  assert.deepEqual(todo.map((t) => t.title), ["Only 52 words", "Only 3 bullets", "Dates use different formats"]); // "Aug 2025" vs "2024"
  assert.ok(good.length >= 4);
});

test("bullet draft: needs a real number for 'numbers', a known kind, and a line", async (t) => {
  const app = express(); app.use(express.json());
  const server = createServer(app); await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  await ensureUser({ id: "sb:review", kind: "supabase", email: "review@tcu.edu", name: "", picture: "" });
  await saveWorkspace("sb:review", emptyWorkspace());
  const cookie = "__Host-or_sid=" + (await createSession("sb:review")).token;
  const post = async (body: unknown) => (await fetch(`${base}/api/resume/bullet-draft`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status;
  assert.equal(await post({ kind: "numbers", text: "Ran the chapter budget", answer: "idk" }), 400);
  assert.equal(await post({ kind: "numbers", text: "Ran the chapter budget", answer: "a lot" }), 400);
  assert.equal(await post({ kind: "rewrite", text: "Ran the chapter budget" }), 400);
  assert.equal(await post({ kind: "verbs", text: "" }), 400);
  assert.equal(await post({ kind: "verbs", text: "Helped with social media posts", answer: "idk" }), 400, "Remy asks what you did; it doesn't guess");
});

test("bullet draft check: the student's words only; 'helped' is never upgraded; numbers exactly as given", async () => {
  const { draftOk } = await import("../ai/bulletDraft");
  // Good drafts
  assert.equal(draftOk("verbs", "Helped with social media posts for the club", "wrote and scheduled the posts on Instagram", "Wrote and scheduled social media posts on Instagram for the club"), true);
  assert.equal(draftOk("verbs", "Responsible for the chapter budget and reimbursements", "tracked spending and approved reimbursements", "Tracked spending and approved reimbursements for the chapter budget"), true);
  assert.equal(draftOk("verbs", "Helped with the annual gala fundraiser", "made flyers", "Made flyers for the annual gala fundraiser"), true);
  assert.equal(draftOk("verbs", "Helped organize the career fair", "booked the venue", "Booked the venue for the career fair"), true);
  assert.equal(draftOk("numbers", "Tutored students in calculus", "12 students", "Tutored 12 students in calculus"), true);
  // Upgrades and inventions
  assert.equal(draftOk("verbs", "Helped organize the career fair", "booked the venue", "Organized the career fair and booked the venue"), false);
  assert.equal(draftOk("verbs", "Helped plan the 200 person conference", "sent emails", "Planned the 200 person conference and sent emails"), false);
  assert.equal(draftOk("verbs", "Assisted in creating the budget model", "checked formulas", "Created the budget model and checked formulas"), false);
  assert.equal(draftOk("numbers", "Tutored students in calculus", "12 students", "Tutored 12+ students in calculus"), false);
  assert.equal(draftOk("numbers", "Tutored students in calculus", "12 students", "Tutored 12 students in calculus, raising grades by 20%"), false);
  // The student can say they did the hedged action themselves
  assert.equal(draftOk("verbs", "Helped organize the career fair", "organized the employer booths", "Organized the employer booths for the career fair"), true);
});

test("bullet draft check (second review): no 'took part' line becomes 'did it', on either fix", async () => {
  const { draftOk } = await import("../ai/bulletDraft");
  for (const [kind, line, ans, draft] of [
    ["verbs", "Supported the launch of the club app", "wrote release notes", "Launched the club app and wrote release notes"],
    ["numbers", "Supported the launch of the app", "500 users", "Launched the app to 500 users"],
    ["verbs", "Helped with the planning of the spring gala", "sent invites", "Planned the spring gala and sent invites"],
    ["verbs", "Helped with planning the spring gala", "sent invites", "Planned the spring gala and sent invites"],
    ["verbs", "Helped my manager organize the career fair", "booked the venue", "Organized the career fair and booked the venue"],
    ["verbs", "Worked on the chapter website redesign", "wrote the copy", "Redesigned the chapter website and wrote the copy"],
    ["verbs", "Helped organize the career fair", "booked the venue", "Booked the venue and organized the career fair with the venue"],
  ] as const) assert.equal(draftOk(kind, line, ans, draft), false, draft);
  assert.equal(draftOk("numbers", "Supported the launch of the app", "500 users", "Supported the launch of the app to 500 users"), true);
  assert.equal(draftOk("verbs", "Worked on the chapter website redesign", "wrote the copy", "Wrote the copy for the chapter website redesign"), true);
});
