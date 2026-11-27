import { test } from "node:test";
import assert from "node:assert/strict";
import { toBlocks, clip } from "@shared/autoHours";

test("events under an hour apart are one stretch, padded 15 minutes each side", () => {
  const b = toBlocks([["Dilan", "2026-11-26T10:00:00Z", "A"], ["Dilan", "2026-11-26T10:50:00Z", "B (#5)"], ["Dilan", "2026-11-26T13:00:00Z", "Merge main"], ["Demetre", "2026-11-26T10:10:00Z", "C"]]);
  assert.deepEqual(b.map((x) => [x.who, x.start.slice(11, 16), x.end.slice(11, 16), x.note]), [
    ["Dilan", "09:45", "11:05", "A; B"],
    ["Demetre", "09:55", "10:25", "C"],
    ["Dilan", "12:45", "13:15", "Bookkeeping and merges"],
  ]);
});

test("clocked time is cut out of an estimate", () => {
  const t = (h: string) => Date.parse(`2026-11-26T${h}:00Z`);
  assert.deepEqual(clip({ start: "2026-11-26T09:00:00Z", end: "2026-11-26T12:00:00Z" }, [{ start: t("10:00"), end: t("11:55") }]).map((p) => [p.start.slice(11, 16), p.end.slice(11, 16)]), [["09:00", "10:00"]]);
});

test("sync: file events plus newer GitHub commits become auto entries around clocked time, rebuilt each run", async () => {
  const { syncAutoHours } = await import("./contrib");
  const { q } = await import("./sql");
  const owners = { people: [{ name: "Dilan", login: "DilanDimel", status: "s.md" }, { name: "Demetre", login: "dondhnk8", status: "d.md" }] };
  const file = { until: "2026-11-26T12:00:00Z", events: [["Dilan", "2026-11-26T10:00Z", "Old work"], ["Ashley", "2026-11-26T10:00Z", "Not on the team"]] };
  const pulls = [{ number: 9, title: "New thing", user: { login: "dondhnk8" }, created_at: "2026-11-26T14:00:00Z", updated_at: "2026-11-26T15:00:00Z" }];
  const commits = [{ author: null, commit: { author: { date: "2026-11-26T14:40:00Z" }, message: "Claude on Demetre's PR\n\nbody" } }];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const body = url.includes("owners.json") ? owners : url.includes("estimated.json") ? file : url.includes("/commits") ? commits : pulls;
    return new Response(JSON.stringify(body));
  }) as any;
  try {
    const members = [{ email: "dilan@t.edu", name: "Dilan D" }, { email: "dem@t.edu", name: "Demetre" }];
    await q("INSERT INTO time_entries (id, member, start_at, end_at, note) VALUES ('tm_clock_t', 'dilan@t.edu', '2026-11-26T09:30:00Z', '2026-11-26T10:00:00Z', 'clocked')");
    assert.equal(await syncAutoHours(members), 2);
    assert.equal(await syncAutoHours(members), 2, "a second run replaces, never adds");
    const rows = await q("SELECT member, start_at, end_at, note FROM time_entries WHERE source = 'auto' ORDER BY member");
    assert.deepEqual(rows.map((r) => [r.member, new Date(r.start_at).toISOString().slice(11, 16), new Date(r.end_at).toISOString().slice(11, 16), r.note]), [
      ["dem@t.edu", "13:45", "14:55", "New thing; Claude on Demetre's PR"],
      ["dilan@t.edu", "10:00", "10:15", "Old work"],
    ]);
  } finally {
    globalThis.fetch = real;
    await q("DELETE FROM time_entries WHERE id = 'tm_clock_t' OR source = 'auto'");
  }
});
