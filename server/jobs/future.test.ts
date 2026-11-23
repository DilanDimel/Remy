// "Future of your field" from the BLS projections. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Workspace } from "@shared/types";
import { careersFor, futureFor, officialFor } from "./future";

const student = (major: string, targetRoles = "") => ({ profile: { major, targetRoles, interests: "" } } as unknown as Workspace);

test("future: a nursing major sees nursing occupations, growing first", () => {
  const f = futureFor(student("Nursing")).fields.find((x) => x.field === "nursing")!;
  assert.ok(f.growing.length > 0);
  assert.ok(f.growing.some((o) => /nurse/i.test(o.title)));
  for (let i = 1; i < f.growing.length; i++) assert.ok(f.growing[i - 1].change >= f.growing[i].change);
});
test("future: every career field maps to some occupations", () => {
  for (const major of ["Finance", "Marketing", "Computer Science", "Mechanical Engineering", "Education", "Criminal Justice", "Film", "Journalism", "Hospitality", "Sport management", "Nonprofit leadership", "Psychology", "Biology", "Real estate", "Aviation"]) {
    const fs = futureFor(student(major)).fields;
    assert.ok(fs.length > 0, major);
    assert.ok(fs.every((f) => f.total > 0), major);
  }
});
test("future: shrinking lists only declining jobs, worst first", () => {
  const f = futureFor(student("Accounting")).fields[0];
  assert.ok(f.shrinking.every((o) => o.change < 0));
  for (let i = 1; i < f.shrinking.length; i++) assert.ok(f.shrinking[i - 1].change <= f.shrinking[i].change);
});
test("future: no field named, no fields shown", () => {
  assert.equal(futureFor(student("")).fields.length, 0);
});

test("careers: a psychology major sees the jobs that hire the most, busiest first", () => {
  const c = careersFor(student("Psychology"));
  assert.ok(c.length > 0);
  for (const f of c) for (let i = 1; i < f.jobs.length; i++) assert.ok((f.jobs[i - 1].openings ?? 0) >= (f.jobs[i].openings ?? 0));
  assert.ok(careersFor(student(""), "Nursing").some((f) => f.field === "nursing"), "browsing a field works with no major");
});
test("careers: a typed job title finds its official occupation", () => {
  assert.match(officialFor("actuary")!.title, /Actuar/);
  assert.match(officialFor("registered nurse")!.title, /Registered nurses/i);
  assert.equal(officialFor("zzz"), null);
});

// "What's the job?" details (O*NET duties + BLS outlook quote), Nov 21, 2026.
import { occupationDetails } from "./future";
test("occupation details: financial analysts get Labor Department duties, quoted with the source", () => {
  const d = occupationDetails("13-2051")!;
  assert.match(d.title, /financial/i);
  assert.ok(d.duties.length >= 1 && d.duties.length <= 5);
  assert.ok(d.duties.every((t) => t.length > 10));
  assert.match(d.dutiesSource!.url, /^https:\/\/www\.onetonline\.org\/link\/details\/13-2051\.00/);
  assert.match(d.dutiesSource!.licenseUrl, /creativecommons\.org\/licenses\/by\/4\.0/);
});
test("occupation details: every job the Future tab can show is a known code", () => {
  for (const major of ["Finance", "Computer Science", "Nursing", "Education", "Marketing"]) {
    for (const f of futureFor(student(major)).fields) for (const o of [...f.growing, ...f.shrinking]) {
      assert.match(o.soc, /^\d{2}-\d{4}$/);
      assert.ok(occupationDetails(o.soc), o.title);
    }
  }
});
test("occupation details: an outlook quote links to the government's guide and is dropped once it's over 400 days old", () => {
  const d = occupationDetails("11-3031", Date.parse("2026-12-01"))!;
  assert.ok(d.outlook);
  assert.match(d.outlook!.url, /^https:\/\/www\.bls\.gov\/ooh\//);
  assert.equal(occupationDetails("11-3031", Date.parse("2028-01-31"))!.outlook, null);
});
test("occupation details: bad or unknown codes return nothing", () => {
  for (const soc of ["", "13-2051; drop", "../etc", "99-9999", "132051"]) assert.equal(occupationDetails(soc), null);
});
test("occupation details: duties are the tasks O*NET rates most important, or say they're examples", () => {
  const acc = occupationDetails("13-2011")!; // Accountants and auditors: rated
  assert.equal(acc.ranked, true);
  assert.match(acc.duties[0], /accounting records|financial statements/i);
  assert.equal(occupationDetails("13-2051")!.ranked, false); // Financial analysts: O*NET hasn't rated these tasks
});
test("occupation details: shrinking jobs and sentences that lean on the one before show no quote", () => {
  const at = Date.parse("2026-12-01");
  for (const soc of ["15-1244", "23-2011", "19-3092", "27-1014", "27-3043", "45-4011"]) assert.equal(occupationDetails(soc, at)!.outlook, null, soc);
  for (const soc of ["29-2072", "35-3031", "47-2141", "13-1121"]) assert.equal(occupationDetails(soc, at)!.outlook, null, soc); // "However, …" / "In addition, …"
});

test("future: a field the student browses replaces their own major's outlook", () => {
  const f = futureFor(student("Nursing"), "Marketing").fields;
  assert.ok(f.length > 0);
  assert.ok(!f.some((x) => x.field === "nursing"), f.map((x) => x.field).join(","));
});

test("examples follow the student's major: nursing never gets the finance example", async () => {
  const { fieldExample } = await import("@shared/fields");
  assert.equal(fieldExample("Nursing").role, "Registered Nurse");
  assert.equal(fieldExample("Mechanical Engineering").subject, "engineering");
  assert.ok(!/financ/i.test(JSON.stringify(fieldExample("Undeclared"))));
});
