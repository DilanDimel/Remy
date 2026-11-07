// Reply rate on Progress: counts replies from people, from each application's history. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { replyStats } from "@shared/progress";
import type { TrackItem, TrackStatus } from "@shared/types";

let n = 0;
const item = (history: TrackStatus[], tailored = false): TrackItem => ({
  id: "t" + ++n, company: "Co" + n, role: "Intern", status: history[history.length - 1], notes: "",
  events: history.map((status, i) => ({ id: `e${n}-${i}`, at: new Date(2026, 9, 1 + i).toISOString(), status, source: "Manual" })),
  ...(tailored ? { applicationId: "a" + n } : {}),
});

test("reply rate: hidden until 5 applications; saved and withdrawn-before-applying don't count", () => {
  const r = replyStats({ tracker: [item(["Saved"]), item(["Applied"]), item(["Applied", "Heard back"]), item(["Withdrawn"])] });
  assert.equal(r.applied, 2);
  assert.equal(r.replied, 1);
  assert.equal(r.rate, null);
});

test("reply rate: a receipt isn't a reply, a rejection is, and history counts after the card moves on", () => {
  const r = replyStats({ tracker: [
    item(["Applied", "Received"]),            // automatic receipt: no reply
    item(["Applied", "Rejected"]),            // someone answered
    item(["Applied", "Heard back", "No reply"]), // replied once, then went quiet: still replied
    item(["Applied", "Interview", "Offer"]),
    item(["Applied", "No reply"]),
  ] });
  assert.equal(r.applied, 5);
  assert.equal(r.replied, 3);
  assert.equal(r.rate, 60);
  assert.equal(r.interviews, 1);
  assert.equal(r.offers, 1);
  assert.equal(r.split, null);
});

test("reply rate: tailored vs not only once each side has 3 applications", () => {
  const tracker = [item(["Applied", "Heard back"], true), item(["Applied", "Interview"], true), item(["Applied"], true), item(["Applied"]), item(["Applied"]), item(["Applied", "Rejected"])];
  const r = replyStats({ tracker });
  assert.deepEqual([r.split?.tailored.replied, r.split?.tailored.applied, r.split?.tailored.rate], [2, 3, 67]);
  assert.deepEqual([r.split?.plain.replied, r.split?.plain.applied, r.split?.plain.rate], [1, 3, 33]);
  assert.equal(replyStats({ tracker: tracker.slice(0, 5) }).split, null);
});

test("reply rate: a status picked by hand and changed again within 10 minutes is a slip; longer or from an email counts", () => {
  const at = (min: number) => new Date(Date.UTC(2026, 9, 1, 12, min)).toISOString();
  const mk = (events: [TrackStatus, number, string][]): TrackItem => ({ id: "s" + ++n, company: "S" + n, role: "", status: events[events.length - 1][0], notes: "",
    events: events.map(([status, min, source], i) => ({ id: `s${n}-${i}`, at: at(min), status, source })) });
  const r = replyStats({ tracker: [
    mk([["Applied", 0, "Manual"], ["Offer", 1, "Manual correction"], ["Applied", 2, "Manual correction"]]), // slip: not an offer
    mk([["Applied", 0, "Manual"], ["Heard back", 1, "Manual correction"], ["Interview", 2, "Manual correction"], ["Offer", 3, "Manual correction"], ["No reply", 4, "Manual correction"]]), // arrowed through the list
    mk([["Applied", 0, "Manual"], ["Heard back", 0, "Email (pasted) · m1"], ["No reply", 1, "Manual correction"]]), // email evidence stands
    mk([["Applied", 0, "Manual"], ["Interview", 30, "Manual correction"], ["No reply", 50, "Manual correction"]]), // stood 20 minutes
    mk([["Applied", 0, "Manual"]]),
  ] });
  assert.equal(r.applied, 5);
  assert.equal(r.replied, 2);
  assert.equal(r.offers, 0);
  assert.equal(r.interviews, 1);
});
