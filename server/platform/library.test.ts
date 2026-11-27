// Remy's private team library: saving a source, tiers, search, removals, reminders, and the key's routes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { putItems, search, badItem, dueReminders, markReminded, listItems } from "./library";
import { takeFiles, tiersFor, libraryText, tidy, askedFiles } from "./slack";
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
  // A short file entry still comes along when many longer notes match better.
  await putItems("memory", Array.from({ length: 14 }, (_, i) => ({ id: `memory:n${i}`, title: `Remy logo note ${i}`, body: "remy logo remy logo remy fox logo colours", tier: "team" as const })), true);
  // ...and when longer files (meeting notes saying "Remy" a lot) match too: titles rank first.
  await putItems("logos", [{ id: "file:fox", title: "remy fox", body: "Image: remy fox", tier: "team", file_name: "remy-fox.png" },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `file:meet${i}`, title: `meeting summary ${i}`, body: "remy remy send logo remy remy", tier: "team" as const, file_name: `m${i}.md` }))], true);
  assert.ok((await search("Send me the Remy fox logo", ["team"])).some((f) => f.id === "file:fox"));
  await putItems("memory", [], true);
  await putItems("logos", [], true);

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
  assert.deepEqual(takeFiles("Notes below.\n\n[file: llc]", offered), { text: "Notes below.", ids: ["file:llc"] });
  assert.deepEqual(takeFiles("See [file id: file:llc] here.", offered).ids, ["file:llc"]);
  // The model sometimes forgets the FILE line for a plain "send me X", and names the library anyway.
  const found: any[] = [{ id: "file:llc", title: "RemyAI LLC Certificate of Filing", file_name: "llc.pdf" }, { id: "file:fox", title: "remy fox", file_name: "remy-fox.png" }];
  assert.deepEqual(askedFiles("Send me our LLC certificate of filing.", found), ["file:llc"]);
  assert.deepEqual(askedFiles("Send me the Remy fox logo.", found), ["file:fox"]);
  assert.deepEqual(askedFiles("When is the call?", found), []);
  const more: any[] = [{ id: "file:erin", title: "2026 11 25 erin and team summary", file_name: "erin.md" }, { id: "file:dilan", title: "dilan studio (team photos)", file_name: "dilan-studio.jpg" }];
  assert.deepEqual(askedFiles("Send me the team photos.", more), ["file:dilan"]); // not the notes that only share "team"
  more.push({ id: "file:demetre", title: "demetre studio (team photos)", file_name: "demetre-studio.jpg" });
  assert.deepEqual(askedFiles("Send me the team photos.", more), ["file:dilan", "file:demetre"]); // every photo, not one
  assert.equal(tidy("Instagram: *https://instagram.com/coachremyai* now"), "Instagram: <https://instagram.com/coachremyai> now");
  assert.equal(tidy("From the daily summary (docs/ai/DAILY.md, Nov 26)."), "From the daily summary (our notes, Nov 26).");
  assert.equal(tidy("Here's the certificate, dated Nov 20 (team library, legal folder)."), "Here's the certificate, dated Nov 20.");
  assert.equal(tidy("Your EIN is in the team library under company docs."), "Your EIN is in our notes under company docs.");

  assert.deepEqual(tiersFor({ channel_type: "im", user: "U0CMF0FC48L" }), ["team", "dilan"]);
  assert.deepEqual(tiersFor({ channel_type: "im", user: "U999" }), ["team"]);
  assert.deepEqual(tiersFor({ channel_type: "channel", user: "U0CMF0FC48L" }), ["team"]);

  assert.equal(aiAllowed("POST", "/api/team/library"), true);
  assert.equal(aiAllowed("DELETE", "/api/team/library"), false);
});
