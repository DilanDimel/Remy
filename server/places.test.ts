import { test } from "node:test";
import assert from "node:assert/strict";
import { placeNow, placeOfHour, type PlaceKey } from "../shared/places";

const all = new Set<PlaceKey>(["office", "cafe", "library", "home"]);

test("Remy follows the time of day", () => {
  assert.equal(placeOfHour(7), "cafe");
  assert.equal(placeOfHour(12), "office");
  assert.equal(placeOfHour(19), "library");
  assert.equal(placeOfHour(23), "home");
  assert.equal(placeOfHour(2), "home");
  assert.equal(placeNow(8, all), "cafe");
});

test("closed places fall back to the office, and an open pick wins", () => {
  assert.equal(placeNow(8, new Set(["office"])), "office");
  assert.equal(placeNow(23, new Set(["office", "cafe"])), "office");
  assert.equal(placeNow(12, all, "home"), "home");
  assert.equal(placeNow(12, new Set(["office"]), "home"), "office");
});
