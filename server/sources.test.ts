// School-district postings from Frontline AppliTrack's listing script. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applitrackPostings } from "./sources";

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
