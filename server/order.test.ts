// Ranking test (ranking council, Nov 19): a finance/IB sophomore who chose DFW + Texas, "relocate for the right role"
// and three bank dream employers, on the 98 real postings Remy found for that profile. Every ranking change must keep
// the top of the list honest to what the student said.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computeFit } from "./jobs/fit";
import { emptyWorkspace } from "./platform/db";
import { openingRanker } from "../shared/order";

const FINANCE = /financ|bank|invest|account|valuation|treasury|fp&a|capital|m&a|audit|tax|controller|wealth|credit|fintech/i;

test("ranking: the top 10 stay in the student's places (or dream employers) and in their field", () => {
  const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/ranking-finance-dfw.json", import.meta.url), "utf8"));
  const w = emptyWorkspace();
  Object.assign(w.profile, fx.profile);
  w.jobs = fx.jobs;
  // A synthetic resume with the same kind of experience (no personal details).
  const evidence = ["Finance & BIS student. Treasurer: oversee a $5,000 chapter budget, variance analysis.", "Built a DCF model and comparable company analysis in Excel; pitch deck.", "Skills: Excel, PowerPoint, Financial Modeling, Market Research, Alteryx, Project Management", `Class year: ${fx.profile.classYear}`].join("\n");
  const fits = Object.fromEntries(w.jobs.map((j) => [j.id, computeFit(w, j, evidence)]));
  const visible = w.jobs.filter((j) => !fits[j.id].excluded && (fits[j.id].regionMatch !== false || fits[j.id].relocate));
  const top = [...visible].sort(openingRanker(w, w.jobs, fits).compare()).slice(0, 10);
  const dream = (c: string) => /j\.?\s?p\.?\s?morgan|goldman|bank of america/i.test(c);
  const placed = top.filter((j) => fits[j.id].regionMatch !== false || dream(j.company)).length;
  const field = top.filter((j) => FINANCE.test(j.title)).length;
  const show = top.map((j) => `${j.company} | ${j.title} | ${j.location}`).join("\n");
  // Nov 19 baseline: 10 of 10 in places, 7 of 10 finance titles (the council's target is 8: the IT BA, claims and
  // business-operations internships are the next to fix). Raise these as ranking improves; never lower them.
  assert.ok(placed >= 9, `only ${placed} of the top 10 are in the student's places or at a dream employer:\n${show}`);
  assert.ok(field >= 7, `only ${field} of the top 10 have a finance-type title:\n${show}`);
  // Out-of-area openings never sit above in-area ones.
  const firstOut = top.findIndex((j) => fits[j.id].regionMatch === false);
  if (firstOut >= 0) assert.ok(top.slice(firstOut).every((j) => fits[j.id].regionMatch === false), "a group split:\n" + show);
});

test("card reasons: plain facts only (place, title in the field, skills shown, dream employer)", async () => {
  const { reasonLine } = await import("../shared/order");
  const w = emptyWorkspace();
  Object.assign(w.profile, { regions: "DFW area", targetRoles: "Finance, Investment banking", major: "Finance", dreamEmployers: "J.P. Morgan, EY" });
  const fit = { regionMatch: true, matched: ["Excel", "Financial modeling"], gaps: ["SQL"] } as any;
  assert.deepEqual(reasonLine(w, { title: "Finance Intern", company: "JPMorgan Chase & Co.", location: "Plano, TX", format: "" } as any, fit), ["In your area", "Title in your field", "You show 2 of 3 skills", "Dream employer"]);
  assert.deepEqual(reasonLine(w, { title: "Claims Intern", company: "EyeCare Partners", location: "Plano, TX", format: "" } as any, { ...fit, matched: [], gaps: [] }), ["In your area"], "EY isn't EyeCare; no skills known → no skills claim");
});
