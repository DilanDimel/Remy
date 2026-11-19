// Profile facts never claim a skill level the profile doesn't state (live test Nov 19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { noUpgrade } from "./noUpgrade";

test("profile facts: level words the source doesn't use are removed; ones it does use stay", () => {
  const linkedin = "Top Skills\nTeam Building\nCross-functional Team Leadership\nOrganizational Leadership\nLanguages\nTamil (Native or Bilingual)";
  assert.equal(noUpgrade("Proficient in Team Building, Cross-functional Team Leadership, and Organizational Leadership", linkedin), "Team Building, Cross-functional Team Leadership, and Organizational Leadership");
  assert.equal(noUpgrade("Has strong organizational leadership skills", linkedin), "Has organizational leadership skills");
  assert.equal(noUpgrade("Fluent in Tamil and English", linkedin), "Tamil and English");
  assert.equal(noUpgrade("Advanced Excel user", "Skills: Advanced Excel, PowerPoint"), "Advanced Excel user", "the source says it");
  assert.equal(noUpgrade("Recipient of TCU Community Scholarship", linkedin), "Recipient of TCU Community Scholarship");
});
