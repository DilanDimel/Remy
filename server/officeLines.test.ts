import { test } from "node:test";
import assert from "node:assert/strict";
import { QUOTES, TAPS, POKES, dateLine, timeLine } from "../shared/officeLines";

test("Remy's office has 100+ things to say, every quote has an author", () => {
  const n = QUOTES.length + Object.values(TAPS).flat().length + POKES.length;
  assert.ok(n >= 100, `only ${n} lines`);
  for (const q of QUOTES) assert.ok(q.q && q.by);
});

test("special days and times of day", () => {
  assert.match(dateLine(new Date(2026, 10, 26))!, /Happy Thanksgiving/); // 4th Thursday of Nov 2026
  assert.match(dateLine(new Date(2026, 10, 24))!, /Thanksgiving week/);
  assert.match(dateLine(new Date(2026, 9, 31))!, /Halloween/);
  assert.equal(dateLine(new Date(2026, 6, 8)), null);
  assert.equal(timeLine(9, 1), "Monday. New week, fresh start.");
  for (let h = 0; h < 24; h++) assert.ok(timeLine(h, 3).length > 5);
});
