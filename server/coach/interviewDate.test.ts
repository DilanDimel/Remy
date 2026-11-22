import { test } from "node:test";
import assert from "node:assert/strict";
import { checkedInterviewDate, zoneIn } from "./interviewDate";

const T = "2026-11-19";
test("an interview date is kept only when the quoted words state it", () => {
  const one = "Your interview is scheduled for Tuesday, November 24, 2026 at 2:00 PM Central.";
  assert.equal(checkedInterviewDate(one, "Tuesday, November 24, 2026 at 2:00 PM Central", "2026-11-24", T), "2026-11-24");
  assert.equal(checkedInterviewDate("Can you do Tuesday at 2 PM?", "Tuesday at 2 PM", "2026-11-24", T), "", "no date in the words");
  assert.equal(checkedInterviewDate("See you tomorrow at 10am.", "tomorrow at 10am", "2026-11-20", T), "");
  assert.equal(checkedInterviewDate("Pick Nov 24 at 2 PM or Nov 25 at 10 AM.", "Nov 24 at 2 PM", "2026-11-24", T), "", "several slots");
  assert.equal(checkedInterviewDate("Interview on November 24.", "November 24", "2027-11-24", T), "", "a year the email didn't state");
  assert.equal(checkedInterviewDate("Interview on November 24.", "24", "2026-11-24", T), "", "too short to be the email's words");
  assert.equal(checkedInterviewDate("Interview on November 24.", "November 24", "2026-11-25", T), "", "a different day");
  assert.equal(checkedInterviewDate("Interview on 11/24 at 3pm.", "on 11/24 at 3pm", "2026-11-24", T), "2026-11-24");
  assert.equal(checkedInterviewDate("Interview on November 2.", "November 2", "2026-11-02", T), "", "in the past");
});
test("a time zone named in the email is noticed", () => {
  assert.equal(zoneIn("Tuesday, November 24 at 2:00 PM ET"), "Eastern");
  assert.equal(zoneIn("at 2:00 PM Central"), "Central");
  assert.equal(zoneIn("at 2:00 PM"), "");
});
