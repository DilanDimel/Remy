// My Path's direction counts and Opportunities' "?role=" list use one rule (shared/roleMatch.ts), checked on real titles
// (skeptic review, Nov 20: 60 title pairs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesRole, shownForRole } from "@shared/roleMatch";

const yes: [string, string][] = [
  ["Corporate Financial Analyst", "Financial Analyst Intern, Hardware FP&A - Summer 2027"],
  ["Investment Banking Analyst", "Summer Analyst, Investment Banking, BDO Capital Advisors"],
  ["Commercial Banking Credit Analyst", "Credit Analyst Intern - Commercial Banking"],
  ["Tax Associate", "Tax Intern"], ["Wealth Management Associate", "Wealth Management Intern"], ["Marketing Specialist", "Marketing Intern"],
  ["Software Engineer", "Software Developer Intern"], ["Software Developers", "Software Engineering Intern"],
  ["Actuary", "Actuarial Intern"], ["Consultant", "Consulting Intern"], ["Registered Nurses", "Nursing Intern"],
  ["Accountants and auditors", "Audit IT Assurance Intern - Summer 2027"], ["Accountants and auditors", "Accounting Intern"],
  ["FP&A Analyst", "FP&A Intern"], ["UX Designer", "UX/UI Design Intern"], ["Personal financial advisors", "Financial Advisor Intern"],
];
const no: [string, string][] = [
  ["Commercial Banking Credit Analyst", "Summer Analyst, Investment Banking, BDO Capital Advisors"], // no "credit"
  ["Investment Banking Analyst", "Investment Management Analyst"],
  ["FP&A Analyst", "Data Analyst"], ["Data Analyst", "Financial Analyst"], ["Credit Analyst", "Analyst"],
  ["Accountants and auditors", "Account Management & Sales Strategy Corporate Internship"], // account ≠ accounting
  ["Sales representatives, wholesale and manufacturing", "Manufacturing Engineer Intern"], // not split on the comma
  ["Software Engineer", "Sales Engineer"], ["", "Accounting Intern"],
];

test("role match: the work has to match; the kind of position (analyst, associate, intern) doesn't", () => {
  for (const [r, t] of yes) assert.ok(matchesRole(r, t), `should match: ${r} → ${t}`);
  for (const [r, t] of no) assert.ok(!matchesRole(r, t), `shouldn't match: ${r} → ${t}`);
});

test("role match: the count is what Opportunities shows (not ruled out, not hidden, in their places, not an event)", () => {
  const jobs = [
    { id: "a", title: "Tax Intern", kind: "internship" }, { id: "b", title: "Tax Intern", kind: "internship" },
    { id: "c", title: "Tax Intern", kind: "internship" }, { id: "d", title: "Tax Intern", kind: "internship" },
    { id: "e", title: "Tax Careers Info Session", kind: "event" }, { id: "f", title: "Tax Intern", kind: "internship" },
  ];
  const fits = { a: {}, b: { excluded: true }, c: { regionMatch: false }, d: { regionMatch: false, relocate: "dream employer" }, e: {}, f: {} };
  assert.deepEqual(shownForRole("Tax Associate", jobs, fits, ["f"]).map((j) => j.id), ["a", "d"]);
});
