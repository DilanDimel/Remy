// Interview prep chain (owners): shows only for an interview in the next 5 days, and checks each step from real data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { prepChain } from "../shared/prep";
import { PREP_HEAD } from "../shared/remyOffers";
import { emptyWorkspace } from "./platform/db";

const iv = (id: string, date: string, notes = "") => ({ id, title: `Interview ${id}`, date, time: "", kind: "Interview", source: "Manual", notes } as any);

test("prep chain: only for an interview in the next 5 days, the soonest first", () => {
  const w = emptyWorkspace();
  assert.equal(prepChain(w, "2026-11-24"), null);
  w.calendar = [iv("far", "2026-12-01"), iv("past", "2026-11-20")];
  assert.equal(prepChain(w, "2026-11-24"), null);
  w.calendar.push(iv("b", "2026-11-28"), iv("a", "2026-11-26"));
  const p = prepChain(w, "2026-11-24")!;
  assert.equal(p.event.id, "a");
  assert.equal(p.days, 2);
  assert.ok(p.steps.every((s) => !s.done));
});

test("prep chain: each step is checked from what the student really did", () => {
  const w = emptyWorkspace(), now = Date.parse("2026-11-24T12:00:00Z");
  w.calendar = [iv("a", "2026-11-25", PREP_HEAD + "\n...")];
  w.pitch = { text: "I'm a finance sophomore.", at: "2026-11-20T00:00:00Z" } as any;
  w.stories = [{ situation: "s", task: "t", action: "a", result: "r" }, { situation: "s", task: "t", action: "a", result: "" }] as any;
  w.interviews = [{ finishedAt: "2026-11-10T00:00:00Z" }] as any;
  const done = () => Object.fromEntries(prepChain(w, "2026-11-24", now)!.steps.map((s) => [s.key, s.done]));
  assert.deepEqual(done(), { sheet: true, pitch: true, stories: false, mock: false }, "half a story and an old mock don't count");
  (w.stories as any[])[1].result = "r";
  (w.interviews as any[]).push({ finishedAt: "2026-11-23T00:00:00Z" });
  assert.deepEqual(done(), { sheet: true, pitch: true, stories: true, mock: true });
});
