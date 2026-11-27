// Remy's private team library: saving a source, tiers, search, removals, reminders, and the key's routes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { putItems, search, badItem, dueReminders, markReminded, listItems } from "./library";
import { takeFiles, tiersFor, libraryText } from "./slack";
import { aiAllowed } from "./aiKey";

test("library: tiers keep Dilan-only items out of channels; words find items; replace drops what's gone", async () => {
  const soon = new Date(Date.now() + 40 * 60_000).toISOString();
  await putItems("calendar", [
    { id: "cal:mike", title: "Mike Mata Zoom", body: "Friday 1-2 PM CT with the team", tier: "team", pinned: true, starts_at: soon, url: "https://zoom.example/1" },
  ], true);
  await putItems("files", [
    { id: "file:llc", title: "RemyAI LLC Certificate of Filing", body: "Texas certificate of filing for the LLC", tier: "team", file_name: "llc.pdf" },
    { id: "file:ein", title: "EIN letter", body: "IRS CP 575 for the LLC", tier: "dilan", file_name: "ein.pdf" },
    { id: "file:old", title: "Old draft", body: "llc draft", tier: "team" },
  ], true);

  const team = await search("send me my LLC document", ["team"]);
  assert.deepEqual(team.map((f) => f.id).sort(), ["cal:mike", "file:llc", "file:old"]); // the meeting is pinned, always read
  assert.ok(!team.some((f) => f.id === "file:ein"));
  assert.ok((await search("LLC EIN letter", ["team", "dilan"])).some((f) => f.id === "file:ein"));

  assert.deepEqual(await putItems("files", [{ id: "file:llc", title: "RemyAI LLC Certificate of Filing", tier: "team", file_name: "llc.pdf" }], true), { saved: 1, removed: 2 });
  assert.deepEqual((await listItems()).map((r) => r.id).sort(), ["cal:mike", "file:llc"]);

  // The reminder goes once, and again only if the meeting moves.
  assert.deepEqual((await dueReminders()).map((r) => r.id), ["cal:mike"]);
  await markReminded("cal:mike");
  assert.equal((await dueReminders()).length, 0);
  await putItems("calendar", [{ id: "cal:mike", title: "Mike Mata Zoom", tier: "team", starts_at: new Date(Date.now() + 50 * 60_000).toISOString() }]);
  assert.equal((await dueReminders()).length, 1);

  assert.match(libraryText(team), /\[file id: file:llc\]/);
});

test("library: pushed items are checked; files only from what was offered; only Dilan's DMs read his tier", () => {
  assert.equal(badItem({ id: "a", title: "A", tier: "team" }), "");
  assert.match(badItem({ id: "a b", title: "A", tier: "team" }), /id/);
  assert.match(badItem({ id: "a", title: "A", tier: "everyone" }), /tier/);
  assert.match(badItem({ id: "a", title: "A", tier: "team", file: { type: "x", b64: "AA==" } }), /file_name/);

  const offered: any[] = [{ id: "file:llc", file_name: "llc.pdf" }, { id: "note", file_name: null }];
  assert.deepEqual(takeFiles("Here it is.\nFILE: file:llc\nFILE: note\nFILE: file:ein", offered), { text: "Here it is.", ids: ["file:llc"] });

  assert.deepEqual(tiersFor({ channel_type: "im", user: "U0CMF0FC48L" }), ["team", "dilan"]);
  assert.deepEqual(tiersFor({ channel_type: "im", user: "U999" }), ["team"]);
  assert.deepEqual(tiersFor({ channel_type: "channel", user: "U0CMF0FC48L" }), ["team"]);

  assert.equal(aiAllowed("POST", "/api/team/library"), true);
  assert.equal(aiAllowed("DELETE", "/api/team/library"), false);
});
