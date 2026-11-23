import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace } from "./platform/db";
import { offerFor, remyOffers } from "@shared/remyOffers";

test("Remy's in-page offers: interview tomorrow, a saved opening closing soon, a quiet application, once each", () => {
  const ws = emptyWorkspace();
  ws.resume = { doc: { contact: { name: "", email: "", phone: "", location: "", links: "" }, sections: [], skills: [] }, uploadedAt: "2026-11-01" } as any;
  ws.jobs = [{ id: "j1", kind: "internship", title: "Analyst Intern", company: "PwC", deadline: "2026-11-25" } as any];
  ws.savedJobIds = ["j1"];
  ws.calendar = [{ id: "c1", title: "PwC interview", date: "2026-11-24", time: "", kind: "Interview", source: "x", notes: "" }];
  ws.tracker = [{ id: "t1", company: "Q2", role: "Intern", status: "Applied", events: [{ id: "e", at: "2026-11-01T10:00:00Z", status: "Applied", source: "x" }], notes: "" }];
  const all = remyOffers(ws, "2026-11-23");
  assert.deepEqual(all.map((o) => o.id), ["prep:c1", "iv:c1", "close:j1", "follow:t1"]);
  assert.deepEqual(all[1].action, { kind: "start", what: "interview", jobId: "j1" });
  assert.equal(offerFor(all, "/progress")!.id, "iv:c1");
  assert.equal(offerFor(all, "/resume"), undefined);
  ws.settings.offersSeen = ["iv:c1"];
  assert.equal(offerFor(remyOffers(ws, "2026-11-23"), "/")!.id, "close:j1");
  ws.applications = [{ jobId: "j1" } as any];
  assert.equal(offerFor(remyOffers(ws, "2026-11-23"), "/"), undefined);
});

test("streak save: evening, a 2+ day streak and nothing yet today", () => {
  const ws = emptyWorkspace();
  ws.game = { ...(ws.game || {}), days: { "2026-11-21": ["openings"], "2026-11-22": ["openings"] } } as any;
  assert.equal(remyOffers(ws, "2026-11-23", 10).length, 0); // morning: no
  const [o] = remyOffers(ws, "2026-11-23", 19);
  assert.equal(o.id, "streak:2026-11-23");
  assert.match(o.text, /2-day streak/);
  ws.game!.days!["2026-11-23"] = ["openings"];
  assert.equal(remyOffers(ws, "2026-11-23", 19).length, 0); // done today
});

test("prep offer shows on Calendar for an interview without a sheet", () => {
  const ws = emptyWorkspace();
  ws.calendar = [{ id: "c1", title: "PwC interview", date: "2026-11-25", time: "", kind: "Interview", source: "x", notes: "" }];
  assert.equal(offerFor(remyOffers(ws, "2026-11-23"), "/calendar")!.id, "prep:c1");
  ws.calendar[0].notes = "Prep sheet from Remy\n...";
  assert.equal(offerFor(remyOffers(ws, "2026-11-23"), "/calendar"), undefined);
});
