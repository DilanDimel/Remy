import assert from "node:assert/strict";
import { test } from "node:test";
import { isOffline, setOffline } from "./net.ts";

test("offline flag flips and stays put when set twice", () => {
  assert.equal(isOffline(), false);
  setOffline(true);
  setOffline(true);
  assert.equal(isOffline(), true);
  setOffline(false);
  assert.equal(isOffline(), false);
});
