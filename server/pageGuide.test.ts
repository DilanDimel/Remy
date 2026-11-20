// Remy explains the screen the student is on (owner feedback #59): every student page and tab has a guide line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageGuide, PAGE_GUIDE } from "./pageGuide";

// The tabs students see, as labelled in client/src/pages (add here when a page gains a tab).
const SCREENS: [string, string[]][] = [
  ["/", ["To-Dos", "Events", "Opportunities"]],
  ["/path", ["Career exploration", "Your field's road", "Future of your field", "Skills & certifications"]],
  ["/resume", ["Base resume", "Review", "Edit", "File & export", "Tailor for an opening", "Review Remy's changes", "Read your cover letter", "Approve & download", "LinkedIn", "Approved & exports"]],
  ["/opportunities", ["All", "Jobs & internships", "Campus jobs", "Events"]],
  ["/interview", []], ["/community", []], ["/calendar", []],
  ["/progress", ["Applications", "Email updates", "To-dos", "Hours"]],
  ["/accounts", ["Profile", "Connected sources", "AI memory", "Appearance & alerts", "Account & data"]],
];

test("page guide: every student page and tab has a line", () => {
  for (const [path, tabs] of SCREENS) {
    assert.ok(PAGE_GUIDE[path]?.page, `no guide for ${path}`);
    for (const t of tabs) assert.ok(PAGE_GUIDE[path].tabs?.[t], `no guide for ${path} → ${t}`);
  }
});

test("page guide: the address picks the page, selected tabs add their lines, counts in tab names are ignored", () => {
  const g = pageGuide("/resume?tab=tailor&app=app1", ["Tailor for an opening", "Approve & download"]);
  assert.match(g, /^Resume\/CV/);
  assert.match(g, /Tailor for an opening tab:/);
  assert.match(g, /Approve & download tab: Step 3 of 3/);
  assert.match(pageGuide("/resume", ["Changes (3)"]), /^Resume\/CV[^\n]*$/); // old tab names add nothing
  assert.match(pageGuide("/progress", ["Email updates (2)"]), /Email updates tab: Paste an employer email/);
  assert.equal(pageGuide("/admin", ["Overview"]), "");
  assert.match(pageGuide("", []), /^Home\./);
});
