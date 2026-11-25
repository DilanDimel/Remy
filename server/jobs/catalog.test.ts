// Remy's employer catalog: what it keeps, how it reads a part, and that it lives in R2 (a fake store here). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, PARTS, catalogPostings, catalogStats, catalogTick, keep, partOf, readPart, resetCatalog, type CatalogBoard } from "./catalog";
import { inUS } from "./fit";
import { fetchBoard, type Raw } from "./sources";

const b: CatalogBoard = { ats: "greenhouse", slug: "acme", company: "Acme" };
const raw = (title: string, location: string, extra: Partial<Raw> = {}): Raw => ({ title, location, url: `https://x.test/${encodeURIComponent(title + location)}`, text: "Duties.", ...extra });

test("catalog list: thousands of boards, spread evenly over the parts", () => {
  assert.ok(CATALOG.length > 15_000);
  assert.ok(CATALOG.every((x) => x.slug && x.company && ["greenhouse", "lever", "ashby", "workable", "recruitee", "smartrecruiters"].includes(x.ats)));
  const sizes = Array.from({ length: PARTS }, (_, p) => CATALOG.filter((_, i) => partOf(i) === p).length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test("inUS: a state, the country or Remote; never abroad or vague", () => {
  for (const l of ["Dallas, TX", "New York, New York, United States", "Remote", "Remote - US", "Austin, Texas; London, UK"]) assert.equal(inUS(l), true, l);
  for (const l of ["London, UK", "Toronto, ON, Canada", "Remote, Germany", "Deutschland, remote", "Hybrid", "", "Bengaluru"]) assert.equal(inUS(l), false, l);
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

test("readPart: reads only its boards, counts failures, keeps going", async () => {
  const boards: CatalogBoard[] = Array.from({ length: 48 }, (_, k) => ({ ats: k === 24 ? "workable" : "lever", slug: `s${k}`, company: `Co ${k}` }));
  const asked: string[] = [];
  const r = await readPart(0, boards, async (x) => { asked.push(x.slug); if (x.slug === "s0") throw new Error("down"); return [raw("Intern", "Denver, CO", { url: `https://x.test/${x.slug}` })]; }, async () => {});
  assert.deepEqual(asked.sort(), ["s0", "s24"]);
  assert.equal(r.stats.boards, 2);
  assert.equal(r.stats.reached, 1);
  assert.equal(r.kept.length, 1);
});

test("catalogTick: one part per run into the store, skipped while fresh; searches read it from memory", async () => {
  resetCatalog();
  const files = new Map<string, unknown>();
  const store = { put: async (k: string, v: unknown) => { files.set(k, structuredClone(v)); }, get: async (k: string) => structuredClone(files.get(k) ?? null), del: async () => {} };
  const read = async (x: CatalogBoard) => [raw("Accounting Intern", "Fort Worth, TX", { url: `https://x.test/${x.slug}` })];
  const first = await catalogTick(store, read, async () => {});
  assert.ok(first && first.reached > 600 && first.kept === first.reached);
  assert.ok(files.has("catalog/part-0") && files.has("catalog/meta"));
  const second = await catalogTick(store, read, async () => {});
  assert.ok(second && files.has("catalog/part-1")); // the next part, not part 0 again
  resetCatalog(); // a fresh server: parts come from the store
  const all = await catalogPostings(store, true);
  assert.equal(all.length, first!.kept + second!.kept);
  const s = await catalogStats(store);
  assert.equal(s?.partsRead, 2);
  assert.equal((await catalogPostings(store)).length, all.length); // already in memory
  assert.equal(s?.employers, CATALOG.length);
});

test("catalogTick: a part where most boards failed keeps its old copy", async () => {
  resetCatalog();
  const files = new Map<string, unknown>();
  const store = { put: async (k: string, v: unknown) => { files.set(k, v); }, get: async (k: string) => files.get(k) ?? null, del: async () => {} };
  assert.equal(await catalogTick(store, async () => { throw new Error("offline"); }, async () => {}), null);
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
