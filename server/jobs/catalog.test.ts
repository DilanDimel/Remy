// Remy's employer catalog: what it keeps, how it reads a part, and that it lives in R2 (a fake store here). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, PARTS, allBoards, catalogPostings, catalogStats, catalogTick, csvRows, districtState, jazzList, ukgDescription, icimsJobs, ldPosting, sfJobs, sfPosting, keep, ldDescription, partOf, readBoard, readPart, resetCatalog, stapplyBoards, type CatalogBoard, jobapsJobs, nyJobs, nyPosting } from "./catalog";
import { inUS } from "./fit";
import { fetchBoard, type Raw } from "./sources";

const b: CatalogBoard = { ats: "greenhouse", slug: "acme", company: "Acme" };
const raw = (title: string, location: string, extra: Partial<Raw> = {}): Raw => ({ title, location, url: `https://x.test/${encodeURIComponent(title + location)}`, text: "Duties.", ...extra });

test("catalog list: thousands of boards, spread evenly over the parts", () => {
  assert.ok(CATALOG.length > 15_000);
  assert.ok(CATALOG.every((x) => x.slug && x.company && !/[\t\n]/.test(x.slug)));
  const sizes = Array.from({ length: PARTS }, (_, p) => CATALOG.filter((b) => partOf(b) === p).length);
  const even = CATALOG.length / PARTS;
  assert.ok(Math.max(...sizes) < even * 1.1 && Math.min(...sizes) > even * 0.9, String(sizes));
});

test("inUS: a state, the country or Remote; never abroad or vague", () => {
  for (const l of ["US-OK-CLAREMORE-2210 E L ANDERSON BLVD", "Dallas, TX", "New York, New York, United States", "Remote", "Remote - US", "Austin, Texas; London, UK"]) assert.equal(inUS(l), true, l);
  for (const l of ["London, UK", "Toronto, ON, Canada", "Remote, Germany", "Deutschland, remote", "Hybrid", "", "Bengaluru", "VN-VUNG TAU CITY-65A 30/4 ROAD WARD 9"]) assert.equal(inUS(l), false, l);
});

test("keep: US student-level postings only, with the company and system on each", async () => {
  const out = await keep(b, [
    raw("Finance Intern", "Dallas, TX"),
    raw("Senior Accountant", "Dallas, TX"),
    raw("Software Engineering Intern", "Berlin, Germany"),
    raw("Senior Manager, Campus Recruiting", "Austin, TX"),
    raw("New Grad Analyst", "Remote"),
    { ...raw("Marketing Intern", "Chicago, IL"), url: "" },
  ]);
  assert.deepEqual(out.map((r) => r.title), ["Finance Intern", "New Grad Analyst"]);
  assert.equal(out[0].company, "Acme");
  assert.equal(out[0].ats, "greenhouse");
  assert.equal(out[0].detail, undefined); // stored as plain data
});

test("keep: title-only postings get their text read, at most 12 per board", async () => {
  let reads = 0;
  const many = Array.from({ length: 20 }, (_, k) => raw(`Intern ${k}`, "Plano, TX", { text: "", detail: async () => { reads++; return { text: `Posting ${k}` }; } }));
  const out = await keep(b, many);
  assert.equal(reads, 12);
  assert.equal(out.length, 12);
  assert.equal(out[0].text, "Posting 0");
});

test("keep: at most 12 openings per board, so one giant employer can't fill the catalog", async () => {
  const out = await keep(b, Array.from({ length: 30 }, (_, k) => raw(`Intern ${k}`, "Austin, TX")));
  assert.equal(out.length, 12);
});

test("readPart: reads only its boards, counts failures, keeps going", async () => {
  const boards: CatalogBoard[] = Array.from({ length: 200 }, (_, k) => ({ ats: k % 50 === 0 ? "workable" : "lever", slug: `s${k}`, company: `Co ${k}` }));
  const p = partOf(boards[0]); // s0: a Workable board, read on the slow lane
  const mine = boards.filter((b) => partOf(b) === p).map((b) => b.slug);
  const asked: string[] = [];
  const r = await readPart(p, boards, async (x) => { asked.push(x.slug); if (x.slug === "s0") throw new Error("down"); return [raw("Intern", "Denver, TX", { url: `https://x.test/${x.slug}` })]; }, async () => {});
  assert.deepEqual(asked.sort(), mine.sort());
  assert.ok(mine.length > 2 && mine.length < 20);
  assert.equal(r.stats.boards, mine.length);
  assert.equal(r.stats.reached, mine.length - 1);
  assert.equal(r.kept.length, mine.length - 1);
  assert.equal(r.stats.texas, mine.length - 1);
});

test("Stapply lists: each system's rows become boards Remy's readers take; repo boards win duplicates", async () => {
  const lists: Record<string, string> = {
    greenhouse: 'name,slug,url\n"Acme, Inc.",acme,https://boards.greenhouse.io/acme\nNewCo,newco,https://boards.greenhouse.io/newco\n',
    workday: "name,slug,url\n23Andme,23andme/23,https://23andme.wd5.myworkdayjobs.com/en-US/23\nBad,x,https://example.com\n",
    oracle: "name,slug,url\nEB,ebwg,https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX\n",
    bamboohr: "name,slug,url\nCoker Legal,cokerlegal,https://cokerlegal.bamboohr.com/careers\nBad,../x,https://x\n",
    paylocity: "name,slug,url\nCochran,96be65ce-a51e-4c4e-8db5-091703033567,https://recruiting.paylocity.com/Recruiting/Jobs/All/96be65ce-a51e-4c4e-8db5-091703033567\nBad,nope,https://x\n",
    ukg: "name,slug,url\n2nd Swing,x,https://recruiting2.ultipro.com/NDS1000NDSW/JobBoard/0e836885-d812-4a6b-8037-9c1ca641e913\n",
    adp: "name,slug,url\nHansons,323017e4-7f2e-49e2-bca0-e798b69a8e90/19000101_000001,https://workforcenow.adp.com/x\nBad,nope,https://x\n",
    icims: "name,slug,url\n360care LLC,360care,https://careers-360care.icims.com\n",
    successfactors: "name,slug,url\nAdamed,adamed,https://jobs.adamed.com\nAmkor,amkor,https://career8.successfactors.com/career?company=amkor\n",
    phenom: "url,name,company_code,locale,country\nhttps://careers.browardhealth.org,Broward Health,,en_us,us\nhttps://careers.enbw.com,EnBW,,de_de,de\n",
    applitrack: "name,slug,url\nAldine ISD,https://www.applitrack.com/aldineisd/onlineapp,https://www.applitrack.com/aldineisd/onlineapp\n",
  };
  const got = await stapplyBoards(async (url) => { const a = url.split("/").at(-2)!; if (!lists[a]) throw new Error("404"); return lists[a]; });
  assert.deepEqual(got.map((b) => [b.ats, b.slug, b.company]), [
    ["greenhouse", "acme", "Acme, Inc."], ["greenhouse", "newco", "NewCo"],
    ["workday", "23andme|wd5|23", "23Andme"], ["oracle", "ebwg.fa.us2.oraclecloud.com|CX", "EB"],
    ["bamboohr", "cokerlegal", "Coker Legal"], ["paylocity", "96be65ce-a51e-4c4e-8db5-091703033567", "Cochran"],
    ["applitrack", "aldineisd", "Aldine ISD"],
    ["ukg", "recruiting2|NDS1000NDSW|0e836885-d812-4a6b-8037-9c1ca641e913", "2nd Swing"], ["adp", "323017e4-7f2e-49e2-bca0-e798b69a8e90|19000101_000001", "Hansons"],
    ["icims", "careers-360care", "360care LLC"], ["phenom", "careers.browardhealth.org", "Broward Health"],
    ["successfactors", "jobs.adamed.com", "Adamed"],
  ]);
  assert.equal(districtState("<a href='https://maps.google.com/?q=loc:15010 Aldine Westfield Rd  Houston, TX 77032'>"), "TX");
  assert.equal(districtState("<p>Call 555-12345</p>"), undefined);
  assert.equal(ukgDescription('x new US.Opportunity.CandidateOpportunityDetail({"Id":"1","Description":"\\u003cp\\u003eAssembles \\"parts\\"\\u003c/p\\u003e","X":1})'), 'Assembles "parts"');
  assert.deepEqual(csvRows('a,"b ""c"", d"\r\n1,2'), [["a", 'b "c", d'], ["1", "2"]]);
  resetCatalog();
  const files = new Map<string, unknown>();
  const store = { put: async (k: string, v: unknown) => { files.set(k, structuredClone(v)); }, get: async (k: string) => structuredClone(files.get(k) ?? null), del: async () => {} };
  const dup = CATALOG[0];
  await catalogTick(store, async () => [], async () => {}, async () => [...got, { ...dup, company: "Other name" }]);
  assert.equal(allBoards().length, CATALOG.length + got.filter((b) => !CATALOG.some((c) => c.ats === b.ats && c.slug === b.slug)).length);
  assert.ok(files.has("catalog/boards"));
});

test("catalogTick: one part per run into the store, skipped while fresh; searches read it from memory", async () => {
  resetCatalog();
  const files = new Map<string, unknown>();
  const store = { put: async (k: string, v: unknown) => { files.set(k, structuredClone(v)); }, get: async (k: string) => structuredClone(files.get(k) ?? null), del: async () => {} };
  const read = async (x: CatalogBoard) => [raw("Accounting Intern", "Fort Worth, TX", { url: `https://x.test/${x.slug}` })];
  const first = await catalogTick(store, read, async () => {}, async () => []);
  assert.ok(first && first.reached > 600 && first.kept === first.reached);
  assert.ok(files.has("catalog/part-0") && files.has("catalog/meta"));
  const second = await catalogTick(store, read, async () => {}, async () => []);
  assert.ok(second && files.has("catalog/part-1")); // the next part, not part 0 again
  resetCatalog(); // a fresh server: parts come from the store
  const all = await catalogPostings(store, true);
  assert.equal(all.length, first!.kept + second!.kept);
  const s = await catalogStats(store);
  assert.equal(s?.partsRead, 2);
  assert.ok((s?.peakMb || 0) > 0, "memory after each part is kept with it, so it survives a redeploy");
  assert.equal((await catalogPostings(store)).length, all.length); // already in memory
  assert.equal(s?.employers, CATALOG.length);
});

test("catalogTick: a part where most boards failed keeps its old copy", async () => {
  resetCatalog();
  const files = new Map<string, unknown>();
  const store = { put: async (k: string, v: unknown) => { files.set(k, v); }, get: async (k: string) => files.get(k) ?? null, del: async () => {} };
  assert.equal(await catalogTick(store, async () => { throw new Error("offline"); }, async () => {}, async () => []), null);
  assert.equal(files.size, 0);
});

test("no R2: the catalog does nothing and searches get nothing from it", async () => {
  assert.equal(await catalogTick(null), null);
  assert.deepEqual(await catalogPostings(null), []);
});

test("Workable and Recruitee boards: title, place, link and text", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const body = String(url).includes("workable")
      ? { jobs: [{ title: "Marketing Intern", city: "Austin", state: "Texas", country: "United States", url: "https://apply.workable.com/acme/j/1", description: "<p>Write posts.</p>", telecommuting: false }] }
      : { offers: [{ title: "Data Intern", location: "Remote", remote: true, careers_url: "https://acme.recruitee.com/o/data-intern", description: "<p>Clean data.</p>", requirements: "<p>SQL</p>" }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const w = await fetchBoard({ ats: "workable", slug: "acme", company: "Acme" }, "");
    assert.deepEqual([w[0].title, w[0].location, w[0].url], ["Marketing Intern", "Austin, Texas, United States", "https://apply.workable.com/acme/j/1"]);
    assert.match(w[0].text, /Write posts/);
    const r = await fetchBoard({ ats: "recruitee", slug: "acme", company: "Acme" }, "");
    assert.equal(r[0].url, "https://acme.recruitee.com/o/data-intern");
    assert.match(r[0].location, /Remote/);
    assert.match(r[0].text, /Clean data[\s\S]*SQL/);
  } finally { globalThis.fetch = real; }
});

test("page readers: a JobPosting's description from JSON-LD, and a JazzHR board's links, titles and places", () => {
  const ld = `<script type="application/ld+json">{"@type":"WebSite"}</script><script type="application/ld+json">{"@type":"JobPosting","description":"<p>Learn &amp; build</p>"}</script>`;
  assert.equal(ldDescription(ld), "Learn & build");
  assert.equal(ldDescription("<p>no data</p>"), "");
  const jazz = `<h3 class='list-group-item-heading'>
      <a href="https://acme.applytojob.com/apply/AbC123/Accounting-Intern">
          Accounting Intern    </a>
  </h3>
  <ul class='list-inline list-group-item-text'>
      <li><i class='fa fa-map-marker'></i>Fort Worth, TX</li>
  </ul>`;
  assert.deepEqual(jazzList(jazz), [{ url: "https://acme.applytojob.com/apply/AbC123/Accounting-Intern", title: "Accounting Intern", location: "Fort Worth, TX" }]);
});

test("iCIMS: postings from the sitemap, place and text from the posting's JobPosting data", async () => {
  const xml = "<urlset><url><loc>https://careers-x.icims.com/jobs/search</loc></url><url><loc>https://careers-x.icims.com/jobs/5324/summer-engineering-intern/job</loc><lastmod>2026-11-25T11:04:46-05:00</lastmod></url></urlset>";
  assert.deepEqual(icimsJobs(xml), [{ url: "https://careers-x.icims.com/jobs/5324/summer-engineering-intern/job", title: "Summer Engineering Intern", posted: "2026-11-25T11:04:46-05:00" }]);
  const page = '<script type="application/ld+json">{"@type":"JobPosting","description":"<p>Help our team</p>","jobLocation":[{"address":{"addressLocality":"Houston","addressRegion":"TX","addressCountry":"US","postalCode":"UNAVAILABLE"}}]}</script>';
  assert.deepEqual(ldPosting(page), { text: "Help our team", location: "Houston, TX, US" });
  // A posting listed without a place is kept only if its full posting is in the US.
  const raw = (location: string) => ({ title: "Summer Engineering Intern", location: "", url: "https://x/1", text: "", detail: async () => ({ text: "Help", location }) });
  const b = { ats: "icims" as const, slug: "careers-x", company: "X" };
  assert.equal((await keep(b, [raw("Houston, TX, US")])).length, 1);
  assert.equal((await keep(b, [raw("Toronto, ON, CA")])).length, 0);
  // A Workday site that names a building or "2 Locations" instead of a city: the full posting decides.
  const named = (listed: string, full: string) => ({ ...raw(full), location: listed });
  assert.equal((await keep(b, [named("Medical Plaza North", "Houston, TX, US")])).length, 1);
  assert.equal((await keep(b, [named("2 Locations", "London, UK")])).length, 0);
  assert.equal((await keep(b, [{ ...named("Toronto, ON, Canada", "Houston, TX, US"), detail: async () => { throw new Error("read"); } }])).length, 0);
});

test("SuccessFactors: postings from the career site's sitemap, title, text and place from the page", () => {
  assert.deepEqual(sfJobs("<url><loc>https://jobs.x.com/job/Dallas-%280300%29-Consulting-Analyst-TX-75201/459314600/</loc><lastmod>2026-11-21</lastmod></url>"),
    [{ url: "https://jobs.x.com/job/Dallas-%280300%29-Consulting-Analyst-TX-75201/459314600/", title: "Dallas (0300) Consulting Analyst TX 75201", posted: "2026-11-21" }]);
  const page = '<meta itemprop="addressLocality" content="Dallas (0300-0005)"><meta itemprop="addressRegion" content="TX"><meta itemprop="addressCountry" content="US"><h1 id="job-title" itemprop="title">Consulting Analyst</h1><span itemprop="description" class="jobdescription"><p>Do the work</p></span></div><div>Apply</div>';
  assert.deepEqual(sfPosting(page), { title: "Consulting Analyst", text: "Do the work", location: "Dallas, TX, US" });
});

test("Amazon and Apple career sites: title, place, link and text, each Apple role once", async () => {
  const real = globalThis.fetch;
  const apple = { loaderData: { search: { totalRecords: 2, searchResults: [
    { positionId: "200673612", transformedPostingTitle: "data-internships", postingTitle: "Data Internships", jobSummary: "Work with data.", locations: [{ name: "Austin", countryName: "United States of America" }] },
    { positionId: "200673612", transformedPostingTitle: "data-internships", postingTitle: "Data Internships", jobSummary: "Work with data.", locations: [{ name: "Cupertino", countryName: "United States of America" }] },
  ] } } };
  globalThis.fetch = (async (url: string) => String(url).includes("amazon.jobs")
    ? new Response(JSON.stringify({ hits: 1, jobs: [{ title: "Area Manager Intern", normalized_location: "Dallas, Texas, USA", job_path: "/en/jobs/1/area-manager-intern", description: "Lead a team.", basic_qualifications: "- Enrolled in a degree" }] }), { status: 200 })
    : new Response(`<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify(apple))});</script>`, { status: 200 })) as typeof fetch;
  try {
    const a = await readBoard({ ats: "amazon", slug: "intern", company: "Amazon" });
    assert.deepEqual([a[0].title, a[0].location, a[0].url], ["Area Manager Intern", "Dallas, Texas, USA", "https://www.amazon.jobs/en/jobs/1/area-manager-intern"]);
    assert.match(a[0].text, /Lead a team[\s\S]*Enrolled/);
    const p = await readBoard({ ats: "apple", slug: "team=internships-STDNT-INTRN", company: "Apple" });
    assert.equal(p.length, 1);
    assert.deepEqual([p[0].url, p[0].location, p[0].text], ["https://jobs.apple.com/en-us/details/200673612/data-internships", "Austin, United States; Cupertino, United States", "Work with data."]);
    assert.ok(inUS(p[0].location));
  } finally { globalThis.fetch = real; }
});

test("JobAps RSS: title without its number, place plus state, deadline, internal-only postings dropped", () => {
  const item = (title: string, loc: string) => `<item><title>${title}\n</title><link>https://www.jobapscloud.com/MD/sup/BulPreview.asp?R1=26&amp;R2=1&amp;R3=1</link><pubDate>Wed, 25 Nov 2026 23:59:00 EST</pubDate>
<description>&lt;p&gt;&lt;strong&gt;Filing Deadline:&lt;/strong&gt; 12/9/2026 11:59:00 PM&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Work Location:&lt;/strong&gt; &lt;ul&gt;&lt;li&gt;${loc}&lt;/li&gt;&lt;/ul&gt;&lt;/p&gt;</description></item>`;
  const out = jobapsJobs(item("Investment Intern - #261123-1317AR-001", "Baltimore City") + item("Clerk (Internal Agency Employees Only) - #26-2", "Annapolis"), "Maryland");
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].title, out[0].location, out[0].deadline, out[0].url], ["Investment Intern", "Baltimore City, Maryland", "2026-12-09", "https://www.jobapscloud.com/MD/sup/BulPreview.asp?R1=26&R2=1&R3=1"]);
});

test("EdJoin: a county's search, each opening with its district and date; high-school and internal-only roles dropped", async () => {
  const real = globalThis.fetch; const asked: string[] = [];
  globalThis.fetch = (async (u: any) => {
    asked.push(String(u));
    return new Response(JSON.stringify({ data: [
      { postingID: 1, positionTitle: "High School Tutor", city: "Fresno", stateName: "California", districtName: "Central Unified School District", postingDate: "/Date(1795478400000)/" },
      { postingID: 2, positionTitle: "Student Intern (Internal Candidates Only)", city: "Fresno", stateName: "California", districtName: "Central Unified School District" },
    ] }), { status: 200 });
  }) as any;
  try {
    const out = await readBoard({ ats: "edjoin", slug: "Fresno", company: "EdJoin" } as CatalogBoard);
    assert.ok(asked.length > 1 && asked.every((u) => u.startsWith("https://www.edjoin.org/Home/LoadJobs?") && u.includes("location=Fresno")));
    assert.deepEqual(out.map((r) => [r.title, r.company, r.location, r.url, r.posted]), [["High School Tutor", "Central Unified School District", "Fresno, California", "https://www.edjoin.org/Home/JobPosting/1", "2026-11-24T00:00:00.000Z"]]);
  } finally { globalThis.fetch = real; }
});

test("StateJobsNY: table rows to openings with agency and county; the vacancy page gives pay, the job's own city and text", () => {
  const row = (id: string, title: string) => `<tr class="odd">\n<td>${id}</td>\n<td><a title="${title}" href="vacancyDetailsView.cfm?id=${id}">${title}</a></td>\n<td>NS</td>\n<td>11&#x2f;25&#x2f;26</td>\n<td>12&#x2f;09&#x2f;26</td>\n<td>Taxation and Finance, Department of</td>\n<td>Albany</td>\n</tr>`;
  const out = nyJobs(row("229700", "Tax Technician Trainee 1") + row("229701", "Student Assistant &amp; Aide"));
  assert.deepEqual(out[0], { url: "https://statejobs.ny.gov/public/vacancyDetailsView.cfm?id=229700", title: "Tax Technician Trainee 1", county: "Albany", location: "Albany County, New York", company: "Taxation and Finance, Department of", posted: "2026-11-25", deadline: "2026-12-09" });
  assert.equal(out[1].title, "Student Assistant & Aide");
  const r = (k: string, v: string) => `<p class="row"><span class="leftCol"><a href="/h" class="help"></a> ${k} </span><span class="rightCol">${v}</span> </p>`;
  const d = nyPosting(r("Salary Range", "From $47,000 to $52,000 Annually") + r("City", "Albany") + r("Duties Description", "Review returns.<br />Answer calls.") + r("City", "Contact Town"));
  assert.equal(d.location, "Albany, NY");
  assert.match(d.text, /^Pay: \$47000–\$52000 per year\nDuties Description\nReview returns\./);
});

test("ApplicantPro: site id from the board page, then its JSON job list with place and pay", async () => {
  const real = globalThis.fetch; const asked: string[] = [];
  globalThis.fetch = (async (u: any) => {
    asked.push(String(u));
    if (String(u).endsWith("/jobs/")) return new Response("<script>var domain_id = '18343';</script>", { status: 200 });
    if (String(u).includes("/core/jobs/18343?")) return new Response(JSON.stringify({ data: { jobs: [{ id: 7, title: "Summer Intern", city: "Fargo", abbreviation: "ND", iso3: "USA", startDateRef: "Sep 29, 2026", minSalary: "16", maxSalary: "18", payTypeFrame: "per hour", jobUrl: "https://casscountynd.applicantpro.com/jobs/7" }] } }), { status: 200 });
    return new Response(`<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", description: "<p>Help the county.</p>" })}</script>`, { status: 200 });
  }) as any;
  try {
    const [r] = await readBoard({ ats: "applicantpro", slug: "casscountynd", company: "Cass County" } as CatalogBoard);
    assert.deepEqual([r.title, r.location, r.url], ["Summer Intern", "Fargo, ND, US", "https://casscountynd.applicantpro.com/jobs/7"]);
    assert.match((await r.detail!()).text, /^Pay: \$16–\$18 per hour\nHelp the county\./);
    assert.ok(asked[1].startsWith("https://casscountynd.applicantpro.com/core/jobs/18343?getParams="));
  } finally { globalThis.fetch = real; }
});

test("PageUp RSS: student titles only, full text from the feed, a bare city counted as US, a foreign place kept foreign", async () => {
  const real = globalThis.fetch; const asked: string[] = [];
  const item = (title: string, loc: string) => `<item><link>https://careers.pageuppeople.com/1151/cw/en-us/job/1</link><title>${title}</title><pubDate>Wed, 25 Nov 2026 17:00:00 Z</pubDate><job:description>&lt;p&gt;Help students.&lt;/p&gt;</job:description><job:location>${loc}</job:location></item>`;
  globalThis.fetch = (async (u: any) => { asked.push(String(u)); return new Response(`<rss><channel>${item("Student Assistant", "Denton")}${item("Dean of Engineering", "Denton")}${item("Research Intern", "Australia|Sydney")}</channel></rss>`, { status: 200 }); }) as any;
  try {
    const out = await readBoard({ ats: "pageup", slug: "1151/cw/en-us", company: "UNT" } as CatalogBoard);
    assert.equal(asked[0], "https://careers.pageuppeople.com/1151/cw/en-us/rss");
    assert.deepEqual(out.map((r) => [r.title, r.location, r.text]), [["Student Assistant", "Denton, United States", "Help students."], ["Research Intern", "Sydney, Australia", "Help students."]]);
  } finally { globalThis.fetch = real; }
});
