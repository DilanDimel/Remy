import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, postingField, postingLines } from "@shared/postingText";

test("double-encoded line breaks become real lines with labeled fields", () => {
  const raw = "Date Posted: 2026-11-24&amp;#xa;&amp;#xa; Country: United States of America&#xa;&#xa; Location: US-CT-REMOTE";
  const lines = postingLines(raw);
  assert.deepEqual(lines, ["Date Posted: 2026-11-24", "Country: United States of America", "Location: US-CT-REMOTE"]);
  assert.deepEqual(postingField(lines[0]), ["Date Posted", "2026-11-24"]);
  assert.equal(postingField("Requirements: This job requires a U.S. Person, who is a lawful permanent resident as defined in 8 U.S.C. 1101(a)(20)."), null);
  assert.equal(decodeEntities("R&amp;D &bull; Tom&#8217;s ?a=1&copy=2"), "R&D • Tom’s ?a=1&copy=2");
  assert.deepEqual(postingLines("Date Posted:\n2026-11-24\nCountry:\nUnited States of America\nWhat you'll do:\nBuild models."), ["Date Posted: 2026-11-24", "Country: United States of America", "What you'll do: Build models."]);
});
