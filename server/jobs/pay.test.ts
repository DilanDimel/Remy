import assert from "node:assert/strict";
import { test } from "node:test";
import { jobPay, payLine, payOf, withPay } from "@shared/pay";
import { ldPosting } from "./catalog";

test("hourly and yearly ranges, as the posting states them", () => {
  assert.equal(payOf("The hourly rate for this internship is $22.50 - $28.00 per hour."), "$22.50–$28.00/hr");
  assert.equal(payOf("Salary range: $65,000 to $80,000 a year plus benefits."), "$65,000–$80,000/yr");
  assert.equal(payOf("Compensation: $60k - 80k"), "$60,000–$80,000/yr");
  assert.equal(payOf("You will manage a $2,500 event budget."), "");
  assert.equal(payOf("$5,000 sign-on bonus per year"), "");
});

test("a board's own pay fields become a line payOf reads", () => {
  assert.equal(payOf(payLine(22.5, 28, "per-hour-wage")), "$22.50–$28.00/hr"); // Lever
  assert.equal(payOf(payLine("55000", "72000", "PA")), "$55,000–$72,000/yr"); // USAJOBS
  assert.equal(payOf(payLine(18, 0, "Per Hour")), "$18/hr"); // EdJoin single rate
  assert.equal(payOf(payLine(40000, 52000, "")), "$40,000–$52,000/yr"); // SchoolSpring, no unit: told by size
  assert.equal(payLine(0, "", "HOUR"), "");
  assert.equal(payOf(withPay("Pay: $211.4K – $290.6K", "About the role")), "$211,400–$290,600/yr"); // Ashby summary
});

test("schema.org baseSalary goes first in the posting text", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", description: "<p>Help students.</p>", baseSalary: { currency: "USD", value: { minValue: 16, maxValue: 19, unitText: "HOUR" } } })}</script>`;
  assert.equal(payOf(ldPosting(html).text), "$16–$19/hr");
});

test("the saved pay wins, then the posting text, then the summary; events show nothing", () => {
  assert.equal(jobPay({ pay: "$25/hr", postingText: "Pay: $30/hr" }), "$25/hr");
  assert.equal(jobPay({ postingText: "No numbers here", summary: "Pay: $20/hr" }), "$20/hr");
  assert.equal(jobPay({ kind: "event", pay: "$20/hr" }), "");
});
