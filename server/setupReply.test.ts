// Setup replies say only what really happened to an answer; skipped Preferences fields aren't asked again. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_QUESTION, fitsField, inField, keepQuestions, setupReply, skippedPrefs } from "../shared/setupReply";

// No reply may promise a search, a ranking or "top of my search" (no search runs after the answers).
const FALSE_PROMISES = /top of my search|check their career sites first|I'll look for openings|leave those out|stay hidden|focus on openings that start|That tells me a lot/i;

test("a long sentence for a search field isn't claimed as added to the search (Grace, Nov 2)", () => {
  const a = "Get a full-time case manager job in Houston and start my MSW part-time.";
  assert.equal(fitsField("targetRoles", a), false);
  const r = setupReply(a, "targetRoles", false);
  assert.match(r, /AI memory/);
  assert.doesNotMatch(r, /roles you're looking for/);
});

test("short role names are added to the search, and the reply says so", () => {
  assert.equal(fitsField("targetRoles", "Child protective services"), true);
  assert.match(setupReply("Child protective services", "targetRoles", true), /Saved to the roles/);
});

test("answers that start with 'I' stay notes, not search words", () => {
  assert.equal(fitsField("dreamEmployers", "I like Boeing"), false);
  assert.equal(fitsField("interests", "I like seeing parts I designed get built"), true); // not a search field
});

test("dream employers: no 'top of my search', says what Remy actually does", () => {
  const r = setupReply("Lockheed Martin, Bell, SpaceX", "dreamEmployers", true);
  assert.doesNotMatch(r, FALSE_PROMISES);
  assert.match(r, /dream employers/);
});

test("avoid: says the real rule (company name or job title), not 'I'll leave those out'", () => {
  const r = setupReply("defense sales roles", "avoid", true);
  assert.match(r, /exact phrase/);
});

test("no reply in any case makes a false promise", () => {
  for (const t of ["targetRoles", "dreamEmployers", "avoid", "timeline", "interests", "goals", undefined, "nonsense"])
    for (const saved of [true, false])
      for (const a of ["", "I'm not sure yet", "Boeing", "This spring for a campus job"])
        assert.doesNotMatch(setupReply(a, t, saved), FALSE_PROMISES, `${t} ${saved} ${a}`);
});

test("off-topic answer gets a neutral line, not 'That tells me a lot' (Jaylen, Nov 2)", () => {
  assert.equal(setupReply("This spring for a campus job", "interests", false), "Thanks. I saved that to your AI memory, and your plan will use it.");
});

test("skip and not-sure replies", () => {
  assert.match(setupReply("", "avoid", false), /come back/);
  assert.match(setupReply("idk", "timeline", false), /start date/);
});

test("fields left empty on Preferences count as skipped once Preferences is done", () => {
  assert.deepEqual(skippedPrefs(4, { timeline: "", dreamEmployers: "  ", avoid: "tobacco" }), ["timeline", "dreamEmployers"]);
  assert.deepEqual(skippedPrefs(4, { timeline: "Summer 2027", dreamEmployers: "PwC", avoid: "x" }), []);
  assert.deepEqual(skippedPrefs(3, { timeline: "" }), []); // Preferences not reached yet: unknown, not skipped
});

test("a comma list answer counts as saved after the save, not only while saving (skeptic #1)", () => {
  const a = "Lockheed Martin, Bell, SpaceX";
  assert.equal(inField({ dreamEmployers: "" }, "dreamEmployers", a, true), true);
  assert.equal(inField({ dreamEmployers: "PwC, Lockheed Martin, Bell, SpaceX" }, "dreamEmployers", a), true);
  assert.equal(inField({ dreamEmployers: "PwC, Bell" }, "dreamEmployers", a), false);
  assert.equal(inField({ dreamEmployers: "PwC; lockheed martin;bell , spacex" }, "dreamEmployers", a), true);
});

test("'I'm not sure' never goes into a profile field (skeptic #4)", () => {
  for (const t of ["timeline", "interests", "goals", "targetRoles"]) assert.equal(fitsField(t, "I'm not sure yet"), false, t);
  assert.equal(inField({ timeline: "Summer 2027" }, "timeline", "I'm not sure yet", true), false);
});

test("questions about skipped fields are dropped, by label or by wording (skeptic #6)", () => {
  const qs = [
    { q: "When would you like to start?", saveTo: "goals" },
    { q: "Which companies would you love to work for?", saveTo: "interests" },
    { q: "What did you enjoy most at Lockheed?", saveTo: "interests" },
    { q: "Anything to leave out?", saveTo: "avoid" },
  ];
  assert.deepEqual(keepQuestions(qs, ["timeline", "dreamEmployers", "avoid"]).map((x) => x.q), ["What did you enjoy most at Lockheed?"]);
  assert.equal(keepQuestions(qs, []).length, 4);
});

test("if every question is about a skipped field, one goal question is asked instead of none (skeptic #5)", () => {
  assert.deepEqual(keepQuestions([{ q: "Any dream employers?", saveTo: "dreamEmployers" }], ["dreamEmployers"]), [FALLBACK_QUESTION]);
  assert.deepEqual(keepQuestions([], ["dreamEmployers"]), []); // AI returned nothing: unchanged
});
