// Outreach drafts ask for the conversation length the student asked for (live test Nov 19: 15 became "20 to 30").
import { test } from "node:test";
import assert from "node:assert/strict";
import { askedLength, keepAskedLength } from "./outreachAsk";

test("outreach: the student's own conversation length wins over the draft's", () => {
  const asked = "A 15-minute chat about what HPE's finance interns actually work on, and a reminder that I applied.";
  assert.equal(askedLength(asked), "15-minute");
  assert.equal(askedLength("just 15 min over coffee"), "15-minute");
  assert.equal(askedLength("advice on recruiting"), "");
  assert.equal(keepAskedLength("Would you be open to a 20 to 30-minute conversation over phone or Zoom?", asked), "Would you be open to a 15-minute conversation over phone or Zoom?");
  assert.equal(keepAskedLength("Would you have 20-30 minutes this month?", asked), "Would you have 15 minutes this month?");
  assert.equal(keepAskedLength("I'd love 20 minutes of your time for a 20-minute call.", "half an hour"), "I'd love 30 minutes of your time for a 30-minute call.");
  assert.equal(keepAskedLength("Would you be open to a 15-minute call?", asked), "Would you be open to a 15-minute call?");
  assert.equal(keepAskedLength("Would you be open to a 20-30 minute call?", "advice on recruiting"), "Would you be open to a 20-30 minute call?", "no length asked: unchanged");
});
