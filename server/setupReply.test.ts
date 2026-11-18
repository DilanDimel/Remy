// Setup replies say only what really happened to an answer; skipped Preferences fields aren't asked again. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_QUESTION, fitsField, inField, isUnsure, keepQuestions, setupReply, skippedPrefs } from "../shared/setupReply";

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
  assert.match(r, /company, the job title or the skills/);
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

test("a comma list answer counts as saved only once it's in the field (the screen says Saving… until then)", () => {
  const a = "Lockheed Martin, Bell, SpaceX";
  assert.equal(inField({ dreamEmployers: "" }, "dreamEmployers", a), false);
  assert.equal(inField({ dreamEmployers: "PwC, Lockheed Martin, Bell, SpaceX" }, "dreamEmployers", a), true);
  assert.equal(inField({ dreamEmployers: "PwC, Bell" }, "dreamEmployers", a), false);
  assert.equal(inField({ dreamEmployers: "PwC; lockheed martin;bell , spacex" }, "dreamEmployers", a), true);
});

test("'I'm not sure' never goes into a profile field (skeptic #4)", () => {
  for (const t of ["timeline", "interests", "goals", "targetRoles"]) assert.equal(fitsField(t, "I'm not sure yet"), false, t);
  assert.equal(inField({ timeline: "Summer 2027, I'm not sure yet" }, "timeline", "I'm not sure yet"), false);
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

// Second review, Nov 2: other ways students say they don't know.
const UNSURE_ANSWERS = ["I don’t know", "Haven’t decided yet", "I’m not sure yet", "I have no idea", "I have no clue", "I'm still figuring it out",
  "Still figuring that out", "Not sure what I want", "Not sure what I want to do yet", "no idea lol", "Not sure about that", "Haven't thought about it",
  "Haven't really thought about it", "Maybe", "To be determined", "Not decided", "Unknown", "Not yet", "Hmm", "Still deciding", "Undecided", "No preference", "Not certain", "Not really sure", "Not 100% sure", "I do not know",
  "Haven't decided yet", "dunno", "TBD", "?", "Honestly I'm not really sure yet", "idk tbh", "I don't really know"];
test("every way of saying 'I don't know' stays out of profile fields and gets the not-sure reply", () => {
  for (const a of UNSURE_ANSWERS) {
    assert.equal(isUnsure(a), true, a);
    for (const t of ["targetRoles", "dreamEmployers", "avoid", "timeline", "interests", "goals"]) assert.equal(fitsField(t, a), false, `${t}: ${a}`);
    assert.doesNotMatch(setupReply(a, "targetRoles", false), /Saved/, a);
  }
});

test("answers that say something besides 'not sure' aren't treated as unsure", () => {
  for (const a of ["Not sure about finance but love consulting", "I love building things, unsure which industry", "Mechanical design", "Summer 2027", "Boeing"])
    assert.equal(isUnsure(a), false, a);
  // They stay out of search fields and the start date (they hedge) but are kept as interests, and the reply says where they went.
  assert.equal(fitsField("targetRoles", "Not sure about finance but love consulting"), false);
  assert.equal(fitsField("timeline", "not sure, maybe summer 2027"), false);
  assert.equal(fitsField("interests", "I love building things, unsure which industry"), true);
  assert.match(setupReply("Not sure about finance but love consulting", "targetRoles", false), /AI memory/);
});

test("'no', 'none', 'N/A' add nothing to a list, and the leave-out reply says so", () => {
  for (const a of ["no", "None", "N/A", "nothing really", "nope.", "Nope, none", "None really", "Nothing specific", "Nothing to avoid",
    "Nothing comes to mind", "Nah not really", "No thanks", "No, nothing", "not really", "Not that I can think of", "No, I’m good", "None of the above", "Not that I know of", "None that I know of", "Nothing, I'm open", "Not really, I'm flexible"]) {
    for (const t of ["avoid", "dreamEmployers", "targetRoles"]) assert.equal(fitsField(t, a), false, `${t}: ${a}`);
    assert.equal(setupReply(a, "avoid", false), "Got it. Nothing added to your leave-out list.");
  }
});

test("leave-out pieces of 2 letters or fewer aren't saved (the filter ignores them, so 'hidden' would be false)", () => {
  assert.equal(fitsField("avoid", "HR"), false);
  assert.equal(fitsField("avoid", "tobacco, HR"), false);
  assert.equal(fitsField("avoid", "tobacco, cold calling"), true);
});

test("the backup question doesn't assume the student is in school", () => {
  assert.doesNotMatch(FALLBACK_QUESTION.q, /school|class|semester/i);
});


test("real names aren't mistaken for 'not sure' or 'nothing'", () => {
  for (const a of ["Uncertainty quantification", "No Kid Hungry", "Nowhere Inc", "Notion", "Nothing Phone", "Boeing", "日本電産"]) assert.equal(isUnsure(a), false, a);
  assert.equal(fitsField("dreamEmployers", "No Kid Hungry"), true);
  assert.equal(fitsField("avoid", "tobacco, cold calling"), true);
});

test("'open to anything' names nothing to search for, hide or start on", () => {
  for (const a of ["Open to anything", "Anything", "Doesn't matter", "I'm flexible", "Whatever", "either one", "Open to anything really",
    "Open to all roles", "Any role", "Not picky", "Any company", "Anywhere", "Whenever", "Anytime", "Pretty flexible"])
    for (const t of ["targetRoles", "dreamEmployers", "avoid", "timeline"]) assert.equal(fitsField(t, a), false, `${t}: ${a}`);
  assert.equal(fitsField("timeline", "Summer 2027"), true);
});

test("real role levels and long employer lists are saved (third review)", () => {
  assert.equal(fitsField("targetRoles", "Software Engineer I"), true);
  assert.equal(fitsField("targetRoles", "Analyst I, Analyst II"), true);
  assert.equal(fitsField("dreamEmployers", "Lockheed Martin, Bell, SpaceX, Boeing, Raytheon, Northrop Grumman"), true);
  assert.equal(fitsField("dreamEmployers", "I like Boeing"), false);
  assert.equal(fitsField("dreamEmployers", "Any role in finance at Goldman"), true); // names something real
});

// Nov 17 audit: Remy offered "Tracking sales and inventory" for "What did you do best at Academy Sports?"; one tap
// made it a fact, then the plan, chat and My Path said Chris had that experience.
test("setup: a tapped Remy answer about a resume experience waits for the student to confirm it", async () => {
  const { tappedResumeClaim, setupReply } = await import("@shared/setupReply");
  const names = { orgs: ["Academy Sports + Outdoors", "Texas Christian University", "Finance Club", "Campus Recreation"], roles: ["Sales Associate", "BBA Finance, GPA 3.6", "Member"] };
  const q = "What did you enjoy most about your work at Academy Sports?";
  const opts = ["Helping customers", "Tracking sales and inventory"];
  assert.equal(tappedResumeClaim(q, "Tracking sales and inventory", opts, "interests", names), true);
  assert.equal(tappedResumeClaim("What did you do best as a Sales Associate?", "Helping customers", opts, "goals", names), true);
  // Typed in their own words: theirs.
  assert.equal(tappedResumeClaim(q, "Talking to customers about running shoes", opts, "interests", names), false);
  // Preferences, not claims about the past.
  assert.equal(tappedResumeClaim("Would you rather work with people, numbers or ideas?", "Numbers", ["People", "Numbers", "Ideas"], "interests", names), false);
  assert.equal(tappedResumeClaim("Which roles excite you most?", "Investment banking", ["Investment banking"], "targetRoles", names), false);
  // Shortened names still count.
  const n2 = { orgs: ["Academy Sports and Outdoors", "Chick-fil-A Southlake"], roles: [] };
  assert.equal(tappedResumeClaim("What did you do best at Academy Sports?", "Helping customers", opts, "interests", n2), true);
  assert.equal(tappedResumeClaim("What did you enjoy at Chick-fil-A?", "Helping customers", opts, "interests", n2), true);
  // One common word from a resume isn't a question about that experience.
  for (const [q2, a2] of [["Do you prefer sales or analysis work?", "Analysis work"], ["Would you rather stay in Texas or move?", "Stay in Texas"], ["Which finance topics do you like most?", "Valuation"], ["What's one goal for your campus job search this year?", "Land an internship"]])
    assert.equal(tappedResumeClaim(q2, a2, [a2, "Other"], "goals", names), false, q2);
  const n3 = { orgs: ["Target"], roles: [] };
  assert.equal(tappedResumeClaim("Which industries do you want to target first?", "Retail", ["Retail"], "goals", n3), false);
  assert.equal(tappedResumeClaim("What did you enjoy most at Target?", "Retail", ["Retail"], "interests", n3), true);
  assert.match(setupReply("Tracking sales and inventory", "interests", false, true), /confirm/);
  assert.doesNotMatch(setupReply("Tracking sales and inventory", "interests", false, true), /plan will use it/);
});
