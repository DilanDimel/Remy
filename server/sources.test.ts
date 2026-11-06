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

test("feedback loop: liked employers first, unseen next, dismissed employers remain discoverable", async () => {
  const { orderEmployers } = await import("./sources");
  const list = ["A", "B", "C", "D", "A"].map((company) => ({ company }));
  const out = orderEmployers(list, new Set(["d"]), new Map([["c", 2]]), { A: "2026-10-29T10:00:00Z" });
  assert.deepEqual(out.map((e) => e.company), ["D", "B", "A", "C"]);
});

test("employer order: explicit company feedback replaces weak interest, including neutral, without excluding anyone", async () => {
  const { orderEmployers } = await import("./sources");
  const list = ["A", "B", "C", "D"].map((company) => ({ company }));
  const preferences = new Map([["a", 0], ["b", -4], ["d", 4]]);
  const out = orderEmployers(list, new Set(["a", "b"]), new Map([["d", 4]]), {}, preferences);
  assert.deepEqual(out.map((e) => e.company), ["D", "A", "C", "B"]);
  assert.equal(orderEmployers([{ company: "Acme" }, { company: "acme" }], new Set(), new Map(), {}).length, 1);
});

test("discovery: role preference is applied before the four-per-employer cut, and disabling it restores the baseline", async () => {
  const { discoverJobs } = await import("./sources");
  const { interestContext } = await import("./ranking");
  const { emptyWorkspace } = await import("./db");
  const { q } = await import("./sql");
  const ws = emptyWorkspace();
  Object.assign(ws.profile, { major: "Mechanical Engineering", targetRoles: "mechanical", classYear: "Junior", regions: "Dallas, TX" });
  const title = "Mechanical Testing Intern";
  const raws = [...Array.from({ length: 5 }, (_, i) => `Mechanical Design Intern ${i + 1}`), title].map((title, i) => ({ title, location: "Dallas, TX", url: `https://example.test/interest-cut/${i}`, text: "Test mechanical hardware." }));
  await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", ["greenhouse|interest-cut||", JSON.stringify(raws)]);
  const source = { id: "rated", title, company: "Different employer", location: "Austin, TX", format: "", kind: "internship" } as any;
  const at = "2026-11-03T12:00:00Z";
  ws.jobFeedback = { rated: { rating: 5, reason: "role", createdAt: at, updatedAt: at, context: interestContext(ws, source, at) } };
  const board = [{ company: "Synthetic", ats: "greenhouse", slug: "interest-cut" }] as any;
  const baseline = (await discoverJobs(ws, board, 25, false)).jobs;
  const personalized = (await discoverJobs(ws, board, 25, true)).jobs;
  assert.equal(baseline.some((j) => j.title === title), false, "baseline recency/alphabetic tie would cut this candidate");
  assert.equal(personalized[0].title, title);
  assert.equal(personalized.length, 4, "employer diversity cap stays intact");
});

test("discovery: company preference affects selection before the total cut without dropping employer diversity", async () => {
  const { discoverJobs } = await import("./sources");
  const { interestContext } = await import("./ranking");
  const { emptyWorkspace } = await import("./db");
  const { q } = await import("./sql");
  const ws = emptyWorkspace();
  Object.assign(ws.profile, { major: "Mechanical Engineering", targetRoles: "mechanical", classYear: "Junior", regions: "Dallas, TX" });
  const boards = Array.from({ length: 8 }, (_, i) => ({ company: `Synthetic ${i}`, ats: "greenhouse", slug: `interest-total-${i}` }));
  for (const [i, board] of boards.entries()) {
    const raws = Array.from({ length: 6 }, (_, j) => ({ title: `Mechanical Design Intern ${j}`, location: "Dallas, TX", url: `https://example.test/interest-total/${i}/${j}`, text: "Test mechanical hardware." }));
    await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", [`greenhouse|${board.slug}||`, JSON.stringify(raws)]);
  }
  const source = { id: "rated", title: "Mechanical Design Intern", company: "Synthetic 7", location: "Dallas, TX", format: "", kind: "internship" } as any;
  const at = "2026-11-03T12:00:00Z";
  ws.jobFeedback = { rated: { rating: 5, reason: "company", createdAt: at, updatedAt: at, context: interestContext(ws, source, at) } };
  const baseline = (await discoverJobs(ws, boards as any, 25, false)).jobs;
  const personalized = (await discoverJobs(ws, boards as any, 25, true)).jobs;
  assert.equal(baseline.some((j) => j.company === "Synthetic 7"), false);
  assert.equal(personalized[0].company, "Synthetic 7");
  assert.equal(personalized.length, 25);
  const counts = new Map<string, number>();
  for (const job of personalized) counts.set(job.company, (counts.get(job.company) || 0) + 1);
  assert.ok([...counts.values()].every((n) => n <= 4));
  assert.ok(counts.size >= 7);
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

test("openings scout: counts early-career postings, flags sites that fail or return nothing, passes a search word", async () => {
  const { scoutBoards } = await import("./sources");
  const seen: string[] = [];
  const read = async (b: any, field: string) => {
    seen.push(field);
    if (b.company === "Down") throw new Error("HTTP 500");
    if (b.company === "Empty") return [];
    return [{ title: "Finance Intern", location: "", url: "u1", text: "" }, { title: "Senior Manager", location: "", url: "u2", text: "" }];
  };
  const r = await scoutBoards([{ company: "Ok", ats: "workday", slug: "ok", fields: ["Finance"] }, { company: "Down", ats: "lever", slug: "d" }, { company: "Empty", ats: "lever", slug: "e" }] as any, read as any);
  const by = Object.fromEntries(r.map((x) => [x.company, x]));
  assert.deepEqual([by.Ok.ok, by.Ok.total, by.Ok.early], [true, 2, 1]);
  assert.equal(by.Down.error, "HTTP 500");
  assert.deepEqual([by.Empty.ok, by.Empty.total], [true, 0], "answered with nothing: no openings now, not broken");
  assert.ok(seen.includes("finance") || seen.some((f) => f.length > 0), "a field search word is passed for field-search boards");
});

test("screening guide: finds the application system from where an opening came from or its apply link", async () => {
  const { screeningFor } = await import("@shared/screening");
  assert.equal(screeningFor({ sourceName: "Deloitte careers (Workday job board)" })?.system, "Workday");
  assert.equal(screeningFor({ applyUrl: "https://job-boards.greenhouse.io/stripe/jobs/1" })?.system, "Greenhouse");
  assert.equal(screeningFor({ applyUrl: "https://abc.fa.us2.oraclecloud.com/hcmUI/x" })?.system, "Oracle Recruiting");
  assert.equal(screeningFor({ applyUrl: "https://example.com/apply" }), null, "unknown system: nothing guessed");
});

test("conference finder: keeps only events whose page shows the start date, lists them as events for the student's field", async () => {
  const { pageShowsDate, conferencesFor } = await import("./conferences");
  assert.ok(pageShowsDate("NABA National Convention · June 23-26, 2027 · Atlanta", "2027-06-23"));
  assert.ok(pageShowsDate("Join us 23rd June 2027", "2027-06-23"));
  assert.ok(pageShowsDate("Date: 06/23/2027", "2027-06-23"));
  assert.ok(!pageShowsDate("June 2027 · Atlanta", "2027-06-23"), "a month alone isn't the date");
  assert.ok(!pageShowsDate("June 3, 2027", "2027-06-23"));
  const ws = { profile: { major: "Accounting", path: "", targetRoles: "", interests: "" } } as any;
  let asked = "";
  const jobs = await conferencesFor(ws, async (field) => { asked = field; return [{ name: "Future CPA Summit", organizer: "TXCPA", start: "2099-03-05", end: "2099-03-06", location: "Dallas, TX", url: "https://example.org/summit" }]; });
  assert.equal(asked, "Accounting");
  assert.deepEqual(jobs.map((j) => [j.kind, j.title, j.location, j.format]), [["event", "Future CPA Summit", "Dallas, TX", "In person"]]);
  assert.deepEqual(await conferencesFor({ profile: { major: "Underwater basket weaving", path: "", targetRoles: "", interests: "" } } as any, async () => { throw new Error("not asked"); }), []);
});

test("job kind: named programs are programs; jobs that mention 'program' or 'launch' are jobs (persona test Nov 1)", async () => {
  const { kindOf } = await import("./sources");
  for (const t of ["Launch Engineer", "Program Manager", "Technical Program Manager II", "Resident Engineer", "Senior Program Analyst", "Mechanical Designer", "Software Programmer"]) assert.equal(kindOf(t), "job", t);
  for (const t of ["Analyst Development Program", "2027 Rotational Leadership Program", "Diversity Fellowship", "EY Discovery Day", "Women in Finance Insight Week", "Pharmacy Residency", "Emerging Leaders Program", "Staff Accountant - Rotational Program", "Leadership Development Program"]) assert.equal(kindOf(t), "program", t);
  assert.equal(kindOf("Summer Analyst Intern"), "internship");
  assert.equal(kindOf("Programming Intern"), "internship");
  const { COUNTRY_IN_TEXT } = await import("./fit");
  for (const t of ["Africa Programs Intern", "Middle East Studies Fellow", "Sales Intern - Asia Pacific", "Intern, Lima Office"]) assert.equal(COUNTRY_IN_TEXT.test(t), false, t); // titles with regions stay
  assert.equal(COUNTRY_IN_TEXT.test("Financial Analyst - Germany"), true);
});
