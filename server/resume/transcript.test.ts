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
