// Setup's "Where should I look?" choices follow where the student lives (11,041-resume test, Nov 26, 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { regionOptions, TEXAS_REGION_OPTS } from "../shared/regions";
import { emptyWorkspace } from "./platform/db";
import { regionMatch } from "./jobs/fit";

test("region choices: a student outside Texas gets their own city and state, not Fort Worth", () => {
  assert.deepEqual(regionOptions("Columbus, OH"), ["Columbus", "Anywhere in Ohio", "Remote", "Anywhere in the US"]);
  assert.deepEqual(regionOptions("Fargo, North Dakota"), ["Fargo", "Anywhere in North Dakota", "Remote", "Anywhere in the US"]);
  assert.deepEqual(regionOptions("Fort Worth, TX"), [...TEXAS_REGION_OPTS, "Remote", "Anywhere in the US"]);
  assert.equal(regionOptions("Lubbock, TX")[0], "Lubbock");
  assert.deepEqual(regionOptions(""), [...TEXAS_REGION_OPTS, "Remote", "Anywhere in the US"]);
  assert.deepEqual(regionOptions("Lagos, Nigeria"), [...TEXAS_REGION_OPTS, "Remote", "Anywhere in the US"]);
});

const at = (regions: string, location: string) => { const ws = emptyWorkspace(); ws.profile.regions = regions; return regionMatch(ws, { location, format: "" } as never); };
test("regions: any US metro means its whole area, with the state picking the right one", () => {
  assert.equal(at("Columbus, OH", "Dublin, OH"), true);
  assert.equal(at("Columbus, OH", "Columbus, GA"), false);
  assert.equal(at("Atlanta", "Marietta, GA"), true);
  assert.equal(at("Atlanta", "Marietta, OH"), false, "a suburb's name in another state isn't the metro");
  assert.equal(at("Chicago", "Naperville, IL, United States"), true);
  assert.equal(at("Seattle", "Redmond, WA"), true);
  assert.equal(at("Seattle", "Redmond, OR"), false);
  assert.equal(at("St. Louis", "Saint Louis, MO"), true);
  assert.equal(at("New York", "Jersey City, NJ"), true, "New York is the state and the city");
  assert.equal(at("New York", "Buffalo, NY"), true);
  assert.equal(at("Portland, ME", "Portland, OR"), false);
  assert.equal(at("Fargo", "Moorhead, MN"), true, "metros cross state lines");
  assert.equal(at("Dallas, Fort Worth", "Irving, TX"), true);
  assert.equal(at("Boston", "Remote"), true);
});
