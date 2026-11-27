import assert from "node:assert/strict";
import { test } from "node:test";
import { jobPay, payOf } from "./pay.ts";

test("hourly and yearly ranges, as the posting states them", () => {
  assert.equal(payOf("The hourly rate for this internship is $22.50 - $28.00 per hour."), "$22.50–$28.00/hr");
  assert.equal(payOf("Salary range: $65,000 to $80,000 a year plus benefits."), "$65,000–$80,000/yr");
  assert.equal(payOf("Pay: $25/hr"), "$25/hr");
  assert.equal(payOf("Compensation: $60k - 80k"), "$60,000–$80,000/yr");
  assert.equal(payOf("This paid internship pays $18 per hour."), "$18/hr");
});

test("a bare amount needs a pay word next to it", () => {
  assert.equal(payOf("Base salary $72,000"), "$72,000/yr");
  assert.equal(payOf("You will manage a $2,500 event budget."), "");
  assert.equal(payOf("Join us at the $20 event"), "");
});

test("bonuses, tuition, funding and revenue are not pay", () => {
  assert.equal(payOf("$5,000 sign-on bonus per year"), "");
  assert.equal(payOf("We raised $200 million in funding."), "");
  assert.equal(payOf("Tuition reimbursement up to $5,250 per year"), "");
});

test("implausible amounts and posting text with no pay give nothing", () => {
  assert.equal(payOf("Hourly pay $2 per hour"), "");
  assert.equal(payOf("Work with a team of 10 on cool projects."), "");
  assert.equal(payOf(""), "");
});

test("the posting text wins, then the summary; events show nothing", () => {
  assert.equal(jobPay({ postingText: "Pay: $30/hr", summary: "Pay: $20/hr" }), "$30/hr");
  assert.equal(jobPay({ postingText: "No numbers here", summary: "Pay: $20/hr" }), "$20/hr");
  assert.equal(jobPay({ kind: "event", summary: "Pay: $20/hr" }), "");
});
