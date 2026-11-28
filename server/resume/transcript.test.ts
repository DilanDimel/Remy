import { test } from "node:test";
import assert from "node:assert/strict";
import { numbersPrinted } from "./transcript";

const raw = "TEXAS CHRISTIAN UNIVERSITY  Unofficial Transcript\nFall 2025  ACCT 20653 Intro Financial Accounting  A  3.00\nCumulative GPA: 3.820  Earned Hours: 45.00";

test("transcript facts keep only GPAs and credit totals printed on the transcript", () => {
  assert.equal(numbersPrinted("Cumulative GPA 3.82", raw), true); // 3.820 printed, same number
  assert.equal(numbersPrinted("Earned 45.0 credit hours", raw), true);
  assert.equal(numbersPrinted("Cumulative GPA 3.9", raw), false);
  assert.equal(numbersPrinted("Accounting courses: ACCT 20653 Intro Financial Accounting (A)", raw), true); // no decimals
});

test("a course list counts as grounded when each code is printed with its grade on the same line", async () => {
  const { coursesGrounded } = await import("./transcript");
  const t = "Term: Fall 2025\nACCT\t20653\tUG\tIntro Financial Accounting\tA\t3.00\nFINA-3313\tINVESTMENTS\tB+\t3.00\nMATH_1120 Calculus I 95 4.00";
  assert.equal(coursesGrounded("Accounting courses: ACCT 20653 Intro Financial Accounting (A), FINA 3313 Investments (B+)", t), true);
  assert.equal(coursesGrounded("Taking now: MATH 1120 Calculus I", t), true);
  assert.equal(coursesGrounded("Math courses: MATH 1120 Calculus I (95, latest attempt)", t), true);
  assert.equal(coursesGrounded("Accounting courses: ACCT 20653 Intro Financial Accounting (B)", t), false); // grade not on its line
  assert.equal(coursesGrounded("Finance courses: FINA 4400 Derivatives (A)", t), false); // course not on the transcript
  assert.equal(coursesGrounded("Cumulative GPA 3.82", t), false); // not a course list
});

test("a quote that joins printed pieces of a transcript still counts as grounded", async () => {
  const { transcriptGrounded } = await import("./transcript");
  const t = "Term: Fall 2023\nACCT\t2010\tA\nTerm Comments: Dean's List";
  assert.equal(transcriptGrounded("Dean's List, Fall 2023", "Term: Fall 2023 ... Term Comments: Dean's List", t), true);
  assert.equal(transcriptGrounded("Dean's List, Fall 2023", "Term: Fall 2023 ... President's List", t), false);
});
