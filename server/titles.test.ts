// Job titles on Opportunities cards drop the employer name they repeat. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shortTitle } from "@shared/org";

test("a leading employer name before a dash is dropped", () => {
  assert.equal(shortTitle("State Street Investment Management - Global Leveraged Finance Intern - 2027 Summer", "State Street"), "Global Leveraged Finance Intern - 2027 Summer");
  assert.equal(shortTitle("State Street Investment Management -Americas Strategy and Insights Analyst - 2027 Summer Internship", "State Street"), "Americas Strategy and Insights Analyst - 2027 Summer Internship");
});
test("a program label prefix and a trailing 'at <employer>' are dropped", () => {
  assert.equal(shortTitle("University – Corporate Finance Intern at Booz Allen Hamilton", "Booz Allen Hamilton"), "Corporate Finance Intern");
});
test("titles without the employer name stay exactly as posted", () => {
  for (const t of ["Commercial Banking Summer Analyst Intern (Summer 2027)", "2027 Technology Summer Internship - Early Careers (Cybersecurity)", "Business Strategy Intern, Data and AI Team - Summer 2027", "Analyst - Sales & Trading"])
    assert.equal(shortTitle(t, "Visa"), t);
  assert.equal(shortTitle("Intern at Deloitte Digital", "Frost Bank"), "Intern at Deloitte Digital");
});
test("never empties a title", () => {
  assert.equal(shortTitle("Goldman Sachs - Intern", "Goldman Sachs"), "Intern");
  assert.equal(shortTitle("Visa - AI", "Visa"), "Visa - AI");
});
test("a department that only starts the employer's name stays", () => {
  assert.equal(shortTitle("Sales - Account Executive Intern", "Salesforce"), "Sales - Account Executive Intern");
  assert.equal(shortTitle("Tech - Intern", "Techstars"), "Tech - Intern");
  assert.equal(shortTitle("Data Analyst at Home", "Home Depot"), "Data Analyst at Home");
  assert.equal(shortTitle("Intelligence - Analyst Intern", "Intel"), "Intelligence - Analyst Intern");
});
