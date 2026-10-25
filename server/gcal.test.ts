import { test } from "node:test";
import assert from "node:assert/strict";
process.env.GCAL_CLIENT_SECRET ||= "test-secret";
const g = await import("./gcal");

test("google calendar: events are stable per item, all-day or timed, in Google's id alphabet", () => {
  assert.equal(g.eventId("cal1"), g.eventId("cal1"));
  assert.match(g.eventId("cal-1:x"), /^[a-v0-9]{5,1024}$/);
  const allDay = g.toEvent({ id: "a", title: "Goldman deadline", date: "2026-12-31", time: "", kind: "Deadline", source: "", notes: "" }, "America/Chicago");
  assert.deepEqual([allDay.start, allDay.end], [{ date: "2026-12-31" }, { date: "2027-01-01" }]);
  const timed = g.toEvent({ id: "b", title: "Interview", date: "2026-11-02", time: "23:30", kind: "Interview", source: "", notes: "Zoom" }, "America/Chicago");
  assert.equal(timed.start.dateTime, "2026-11-02T23:30:00");
  assert.equal(timed.end.dateTime, "2026-11-02T23:59:00");
  assert.equal(timed.description, "Interview\n\nZoom");
});

test("google calendar: refresh tokens are encrypted and round-trip", () => {
  const s = g.seal("1//refresh-token");
  assert.ok(!s.includes("refresh"));
  assert.equal(g.unseal(s), "1//refresh-token");
});
