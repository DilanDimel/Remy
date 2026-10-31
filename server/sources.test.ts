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

test("shared catalog: one site read serves the next student; a failed or empty read keeps the last good copy", async () => {
  const { cachedBoard } = await import("./sources");
  const { q } = await import("./sql");
  const b = { company: "Acme", ats: "greenhouse", slug: "acme-cache-test" } as any;
  let calls = 0;
  const ok = async () => { calls++; return [{ title: "Finance Intern", location: "Dallas, TX", url: "https://x.test/1", text: "" }]; };
  assert.equal((await cachedBoard(b, "", "", ok)).length, 1);
  assert.equal((await cachedBoard(b, "", "", ok)).length, 1);
  assert.equal(calls, 1, "the second student reuses the saved copy");
  await q("UPDATE board_cache SET fetched_at = now() - interval '7 hours' WHERE key LIKE '%acme-cache-test%'");
  assert.equal((await cachedBoard(b, "", "", async () => { throw new Error("down"); })).length, 1, "site down: last good copy");
  assert.equal((await cachedBoard(b, "", "", async () => [])).length, 1, "empty answer: last good copy");
});

test("Julio's 48 labeled postings: every relevant one is found, no unrelated or senior one is shown", async () => {
  const { RELEVANCE_CASES } = await import("./fixtures/job-relevance");
  const { discoverJobs } = await import("./sources");
  const { emptyWorkspace } = await import("./db");
  const { q } = await import("./sql");
  const wrong: string[] = [];
  for (const g of RELEVANCE_CASES as any[]) {
    const slug = "julio-" + g.sector;
    const raws = g.cases.map(([title, text]: any, i: number) => ({ title, location: "Dallas, TX", url: `https://x.test/${slug}/${i}`, text }));
    await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", [`greenhouse|${slug}||`, JSON.stringify(raws)]);
    const ws = emptyWorkspace();
    Object.assign(ws.profile, { targetRoles: g.target, classYear: "Sophomore", regions: "Dallas, TX" });
    const kept = new Set((await discoverJobs(ws, [{ company: "Synthetic", ats: "greenhouse", slug } as any], 50)).jobs.map((j) => j.title));
    for (const [title, , want] of g.cases) if (kept.has(title) !== want) wrong.push(`${g.sector}: ${title} (${want ? "missed" : "wrongly shown"})`);
  }
  assert.deepEqual(wrong, []);
});

test("feedback loop: liked employers first, twice-dismissed left out, then the ones not read yet", async () => {
  const { orderEmployers } = await import("./sources");
  const list = ["A", "B", "C", "D", "A"].map((company) => ({ company }));
  const out = orderEmployers(list, new Set(["d"]), new Map([["c", 2]]), { A: "2026-10-29T10:00:00Z" });
  assert.deepEqual(out.map((e) => e.company), ["D", "B", "A"]);
});

test("the specific words of a goal rank first: Mechanical Engineering Intern above Electrical for a mechanical student", async () => {
  const { discoverJobs, specificWords } = await import("./sources");
  const { emptyWorkspace } = await import("./db");
  const { q } = await import("./sql");
  const raws = [["Electrical Engineer Intern", 0], ["Mechanical Engineering Intern", 1]].map(([title, i]) => ({ title, location: "Dallas, TX", url: `https://x.test/spec/${i}`, text: "Design and test hardware." }));
  await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", ["greenhouse|spec-test||", JSON.stringify(raws)]);
  const ws = emptyWorkspace();
  Object.assign(ws.profile, { targetRoles: "mechanical engineering intern", major: "Mechanical Engineering", classYear: "Junior", regions: "Dallas, TX" });
  assert.deepEqual(specificWords(ws), ["mechanical"]);
  const jobs = (await discoverJobs(ws, [{ company: "Spec", ats: "greenhouse", slug: "spec-test" } as any], 10)).jobs;
  assert.equal(jobs[0].title, "Mechanical Engineering Intern");
});

test("Workday locations read like addresses: IL-Rosemont → Rosemont, IL", async () => {
  const { tidyLocation } = await import("./sources");
  assert.equal(tidyLocation("IL-Rosemont"), "Rosemont, IL");
  assert.equal(tidyLocation("TX-Fort-Worth"), "Fort Worth, TX");
  assert.equal(tidyLocation("Dallas, TX"), "Dallas, TX");
  assert.equal(tidyLocation("Remote"), "Remote");
});
