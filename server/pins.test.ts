// Career pins (owners): counted from real data, tiers by quality, secrets, XP, and the "seen" record for the new-pin moment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PINS, newPins, pinXp, pinsOf, pinsSeen } from "../shared/pins";
import { xpOf } from "../shared/game";
import { emptyWorkspace } from "./platform/db";

const pin = (w: ReturnType<typeof emptyWorkspace>, id: string) => pinsOf(w).find((p) => p.id === id)!;

test("pins: nothing earned on an empty workspace, and every pin has a way to earn it", () => {
  const w = emptyWorkspace();
  assert.equal(pinsOf(w).filter((p) => p.earned).length, 0);
  assert.equal(pinXp(w), 0);
  for (const p of PINS) { assert.ok(p.how && p.link && p.tiers.length === p.xp.length, p.id); if (p.kind === "secret") assert.ok(p.hint, p.id); }
  assert.equal(new Set(PINS.map((p) => p.id)).size, PINS.length, "ids are unique");
});

test("pins: tailored applications count for Tailor, plain sends don't", () => {
  const w = emptyWorkspace();
  w.applications = Array.from({ length: 6 }, (_, i) => ({ id: "a" + i, versions: i < 5 ? [{}] : [] }) as any);
  const t = pin(w, "tailor");
  assert.deepEqual([t.n, t.tier, t.next], [5, 2, 15], "5 tailored = silver, gold at 15");
  assert.equal(pinXp(w), 25 + 60);
});

test("pins: Thick skin after a rejection's next steps, Bounce back for an interview after it", () => {
  const w = emptyWorkspace();
  w.tracker = [
    { id: "t1", company: "A", role: "", status: "Rejected", recovery: "added", notes: "", events: [{ id: "e1", at: "2026-10-01T10:00:00Z", status: "Rejected", source: "Manual" }] },
    { id: "t2", company: "B", role: "", status: "Interview", notes: "", events: [{ id: "e2", at: "2026-10-20T10:00:00Z", status: "Interview", source: "Manual" }] },
  ] as any;
  assert.ok(pin(w, "thickskin").earned && pin(w, "bounce").earned && pin(w, "interview").earned);
  w.tracker[1].events[0].at = "2026-09-01T10:00:00Z";
  assert.ok(!pin(w, "bounce").earned, "an interview before the rejection isn't bouncing back");
});

test("pins: Comeback needs a two-week gap; secrets stay secret until earned", () => {
  const w = emptyWorkspace();
  w.game = { weeks: {}, days: { "2026-10-01": ["role"], "2026-10-10": ["role"] } };
  assert.ok(!pin(w, "comeback").earned);
  w.game.days!["2026-10-30"] = ["role"];
  assert.ok(pin(w, "comeback").earned);
  w.steps = [{ at: new Date(2026, 9, 5, 1, 30).toISOString(), kind: "save", ref: "j", xp: 0 }];
  assert.ok(pin(w, "nightowl").earned && !pin(w, "earlybird").earned);
});

test("pins: XP adds to the season total; seen tiers stop the moment repeating", () => {
  const w = emptyWorkspace();
  const before = xpOf(w, { weeks: {} });
  w.contacts = Array.from({ length: 5 }, (_, i) => ({ id: "c" + i }) as any);
  assert.equal(xpOf(w, { weeks: {} }) - before, 85, "Networker bronze + silver");
  assert.deepEqual(newPins(w, {}).map((p) => p.id), ["network"]);
  assert.deepEqual(newPins(w, pinsSeen(w)), []);
  assert.deepEqual(newPins(w, { network: 1 }).map((p) => p.tier), [2], "silver is new after bronze was seen");
});

test("pins: Remy's lapel and corkboard show the best pins first", async () => {
  const { topPins } = await import("../shared/pins");
  const w = emptyWorkspace();
  assert.deepEqual(topPins(w), []);
  w.contacts = Array.from({ length: 5 }, (_, i) => ({ id: "c" + i }) as any); // Networker silver
  w.pitch = { text: "Hi", at: "" }; // a single pin
  w.applications = [{ id: "a", versions: [{}] } as any]; // Tailor bronze
  assert.deepEqual(topPins(w, 3).map((p) => p.id), ["network", "pitch", "tailor"]);
});
