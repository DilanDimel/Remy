// School-district postings from Frontline AppliTrack's listing script. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applitrackPostings, CAREERONESTOP, fetchBoard, taleoDescription } from "./sources";

const posting = (id: number, title: string, closing: string) =>
  `<ul class=\\'postingsList\\' id=\\'p${id}_\\'><table class=\\'title\\'><tr><td id=\\'wrapword\\' style=\\'width: 950px;\\'>${title}</td><td> JobID: ${id} </td></tr></table>` +
  `<li><span class="label" >Date Posted:</span><br/>&nbsp;&nbsp;<span class="normal">10/1/2026</span><br/><br/></li>` +
  `<li><span class="label" >Location:</span><br/>&nbsp;&nbsp;<span class="normal">Plano Senior High School</span><br/><br/></li>` +
  `<li><span class="label" > Closing Date: </span><br/>&nbsp;&nbsp;<span class=\\'normal\\'>${closing}</span><br/><br/></li>` +
  `<span id=\\'DescriptionText${id}_\\'><p>Supports students in <strong>math</strong>.</p></span></ul>`;

test("AppliTrack: keeps student-friendly roles with campus, city, deadline and link", () => {
  const js = `var x = 1;\ndocument.write('${posting(1041, "Teacher CTE - Auto Tech", "Until Filled ")}${posting(2001, "35770* Generic - AVID Tutor&#160;&#160;", "11/5/2026")}');`;
  const out = applitrackPostings(js, "pisd", "Plano, TX");
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "AVID Tutor");
  assert.equal(out[0].location, "Plano Senior High School, Plano, TX");
  assert.equal(out[0].deadline, "2026-11-05");
  assert.equal(out[0].student, true);
  assert.match(out[0].url, /applitrack\.com\/pisd\/onlineapp\/default\.aspx\?AppliTrackJobId=2001&/);
  assert.match(out[0].text, /Supports students in math/);
});
test("AppliTrack: 'Until Filled' leaves the deadline empty", () => {
  const out = applitrackPostings(posting(7, "Substitute Teacher", "Until Filled "), "risd", "Richardson, TX");
  assert.equal(out[0].deadline, "");
});

test("AppliTrack: internships for the district's own high schoolers are skipped", () => {
  assert.equal(applitrackPostings(posting(9, "CTE Practicum Intern for High School Student", "Until Filled "), "kisd", "Keller, TX").length, 0);
});
test("Taleo: description comes from the page's encoded state", () => {
  const long = "Assists students in building academic skills and competency in a specific subject area. ".repeat(4);
  const html = `<input id="initialHistory" value="ftlx0!|!short!|!${encodeURIComponent("!*!<p>" + long + "</p>")}!|!x" />`;
  assert.match(taleoDescription(html), /^Assists students in building academic skills/);
});
test("CareerOneStop: sends the bearer token and a DFW search, reads the jobs", async () => {
  process.env.COS_USER_ID = "u123"; process.env.COS_TOKEN = "tok";
  const real = globalThis.fetch;
  const calls: { url: string; auth: string }[] = [];
  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url, auth: init.headers.Authorization });
    return new Response(JSON.stringify({ Jobs: [{ JobTitle: "Planning Intern", Company: "City of Denton", Location: "Denton, TX", URL: `https://de.jobsyn.org/${calls.length}`, DescriptionSnippet: "Supports planning staff." }] }));
  }) as any;
  try {
    const out = await fetchBoard(CAREERONESTOP, "government", "Dallas-Fort Worth");
    assert.equal(calls.length, 3);
    assert.ok(calls.every((c) => c.auth === "Bearer tok"));
    assert.match(calls[0].url, /^https:\/\/api\.careeronestop\.org\/v1\/jobsearch\/u123\/government%20intern\/Dallas%2C%20TX\/50\/0\/0\/0\/100\/30$/);
    assert.equal(out[0].company, "City of Denton");
    assert.equal(out[0].nearby, true);
  } finally {
    globalThis.fetch = real; delete process.env.COS_USER_ID; delete process.env.COS_TOKEN;
  }
});
