// "What's new": one file per note in shared/news/, named by its id ("YYYY-MM-DD-HHMM", older ones "YYYY-MM-DD-NN"),
// so ids are unique and only ever grow and "seen up to this id" counts unseen notes right.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { newsMark, toNews, unseenNews, type NewsNote } from "../shared/news";

const dir = join(import.meta.dirname, "../shared/news");
const loadNews = async () => {
  const files: Record<string, NewsNote> = {};
  for (const f of readdirSync(dir)) files[f] = (await import(join(dir, f))).default;
  return toNews(files);
};

test("What's new: every note file is named by a well-formed id and has its fields", async () => {
  for (const f of readdirSync(dir)) assert.match(f, /^\d{4}-\d{2}-\d{2}-(\d{2}|\d{4})\.ts$/, f);
  const news = await loadNews();
  assert.ok(news.length > 200);
  for (const n of news) {
    assert.ok(["New", "Improved", "Fixed", "Changed"].includes(n.kind), n.id);
    assert.ok(n.title && n.body, n.id);
    assert.equal(n.date, n.id.slice(0, 10));
  }
  assert.ok(news[0].id > news[1].id, "newest first");
});

test("What's new: new accounts start caught up, later notes show as new", async () => {
  const news = await loadNews();
  const mark = newsMark(new Date("2026-11-24T01:30:00Z"));
  assert.equal(mark, "2026-11-24-0130");
  const later = { id: "2026-11-24-0131", date: "2026-11-24", kind: "New" as const, title: "x", body: "y" };
  assert.deepEqual(unseenNews([later, ...news.filter((n) => n.id < mark)], mark).map((n) => n.id), ["2026-11-24-0131"]);
});

test("What's new: notes link to the page their title names", async () => {
  const { newsLink } = await import("../shared/news");
  const n = (title: string, to?: string) => newsLink({ id: "2026-01-01-01", date: "2026-01-01", kind: "New", title, body: "", to });
  assert.equal(n("Calendar and Progress on one screen"), "/calendar");
  assert.equal(n("A mock interview built for your opening"), "/interview");
  assert.equal(n("Anything", "/accounts"), "/accounts");
  assert.equal(n("Faster sign in"), undefined);
});

test("What's new: owner notes stay with owners, Beta 2 notes wait for the redesign release", async () => {
  const { showsNews } = await import("../shared/news");
  const base = { id: "2026-11-24-0210", date: "2026-11-24", kind: "New" as const, title: "x", body: "y" };
  const ownersNote = { ...base, owners: true }, beta2 = { ...base, release: "redesign" as const };
  assert.equal(showsNews(ownersNote, false, true), false); // a student after the release
  assert.equal(showsNews(ownersNote, true), true);
  assert.equal(showsNews(beta2, false, false), false); // a student before the release
  assert.equal(showsNews(beta2, false, true), true);
  assert.equal(showsNews(base, false, false), true);
});
