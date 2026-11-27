import { test } from "node:test";
import assert from "node:assert/strict";
import { opType } from "@shared/opportunityType";

const t = (kind: any, title: string, postingText = "") => opType({ kind, title, postingText });

test("each kind of opening gets its type and the words that decided it (live titles, Nov 27)", () => {
  assert.deepEqual(t("internship", "Accounting Summer Intern (Fort Worth, TX) 2027"), { type: "internship", why: "Says Intern" });
  assert.deepEqual(t("internship", "Student Worker - Audience Research and Data Analysis Internship - BC"), { type: "campus", why: "Says Student Worker" });
  assert.deepEqual(t("job", "Junior Computer Systems Analyst (Part-Time)"), { type: "parttime", why: "Says Part-Time" });
  assert.deepEqual(t("job", "Shop Technician Apprentice"), { type: "apprentice", why: "Says Apprentice" });
  assert.deepEqual(t("job", "Operations Analyst Trainee"), { type: "early", why: "Says Trainee" });
  assert.deepEqual(t("job", "Software Engineer  Entry Level (Network Focus)"), { type: "early", why: "Says Entry Level" });
  assert.deepEqual(t("program", "2027 Summer Undergraduate Research Fellowship in Law and Social Science"), { type: "program", why: "Says Fellowship" });
  assert.deepEqual(t("event", "Fall Career Fair"), { type: "event", why: "An event" });
  assert.deepEqual(t("campus", "Library Desk"), { type: "campus", why: "A job at a school" });
  assert.deepEqual(t("job", "Administrative Assistant"), { type: "early", why: "" });
});

test("part-time from the posting's hours or wording, never from a full-time role", () => {
  assert.deepEqual(t("job", "Ambassador", "Schedule: 15-25 hours per week, nights and weekends."), { type: "parttime", why: "About 25 hours a week" });
  assert.equal(t("job", "Data Analyst", "Standard schedule of 40 hours per week.").type, "early");
  assert.deepEqual(t("job", "Tutor", "This is a part-time position."), { type: "parttime", why: "Says part-time" });
  assert.equal(t("job", "Engineer (Full-Time)", "We also have part-time positions.").type, "early");
});
