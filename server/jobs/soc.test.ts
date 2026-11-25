// Title → occupation matcher (server/jobs/soc.ts), checked against 159 hand-labelled posting titles. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { jobZone, majorSocs, matchTitle, words } from "./soc";

const labels = fs.readFileSync(path.resolve(process.cwd(), "server", "jobs", "soc-labels.tsv"), "utf8")
  .split("\n").filter(Boolean).map((l) => { const [t, s] = l.split("\t"); return { t, ok: s.split("|") }; });

test("words: drops level and schedule words, keeps what the job is", () => {
  assert.deepEqual(words("Summer 2027 Finance Intern"), ["finance"]);
  assert.deepEqual(words("SWE Intern"), ["software", "engineer"]);
});

test("matchTitle: accuracy on hand-labelled posting titles stays where it was measured", () => {
  let exact = 0, group = 0, top10 = 0;
  for (const { t, ok } of labels) {
    const m = matchTitle(t);
    if (!m) continue;
    if (ok.includes(m.soc)) exact++;
    if (ok.some((s) => s.slice(0, 2) === m.soc.slice(0, 2))) group++;
    if (m.candidates.some((c) => ok.includes(c.soc))) top10++;
  }
  const n = labels.length;
  assert.ok(exact / n >= 0.65, `exact ${exact}/${n}`);
  assert.ok(group / n >= 0.82, `group ${group}/${n}`);
  assert.ok(top10 / n >= 0.9, `top10 ${top10}/${n}`);
});

test("matchTitle: common cases", () => {
  assert.equal(matchTitle("Software Engineer Intern")?.soc, "15-1252");
  assert.equal(matchTitle("Registered Nurse")?.soc.slice(0, 2), "29");
  assert.equal(matchTitle("Intern"), null);
  // A field and nothing else: the field's usual occupations, flagged broad
  const eng = matchTitle("Engineering Intern")!;
  assert.equal(eng.broad, true);
  assert.equal(eng.soc.slice(0, 3), "17-");
  assert.equal(matchTitle("Accounting Intern")?.soc, "13-2011");
  assert.equal(matchTitle("Software Engineer Intern")?.broad, false);
});

test("jobZone and majorSocs", () => {
  assert.equal(typeof jobZone("15-1252"), "number");
  assert.equal(jobZone("99-9999"), null);
  assert.ok(majorSocs("Accounting").includes("13-2011"));
  assert.ok(majorSocs("Computer Science").some((s) => s.startsWith("15-")));
  assert.deepEqual(majorSocs("zzzz"), []);
});
