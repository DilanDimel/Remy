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
  assert.deepEqual(all.map((o) => o.id), ["iv:c1", "close:j1", "follow:t1"]);
  assert.deepEqual(all[0].action, { kind: "start", what: "interview", jobId: "j1" });
  assert.equal(offerFor(all, "/progress")!.id, "iv:c1");
  assert.equal(offerFor(all, "/resume"), undefined);
  ws.settings.offersSeen = ["iv:c1"];
  assert.equal(offerFor(remyOffers(ws, "2026-11-23"), "/")!.id, "close:j1");
  ws.applications = [{ jobId: "j1" } as any];
  assert.equal(offerFor(remyOffers(ws, "2026-11-23"), "/"), undefined);
});
