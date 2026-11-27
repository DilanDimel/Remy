// The pitch is written to be said: no question at the end, no buzzwords, a failed part is replaced, not cut, and no
// pitch at all without one real experience. Practice feedback: pace, fillers, recital, skipped names.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assemblePitch, plainParts } from "./pitch";
import { speechFeedback } from "@shared/speech";

const profile = { name: "Dilan", classYear: "Sophomore", major: "Finance and BIS", school: "TCU", interests: "Finance, Investment banking, Consulting" };
const yes = () => true;
const story = "Last month my team built Remy, an AI career coach, and I worked on the resume tools.";

test("pitch: four spoken parts, joined", () => {
  const t = assemblePitch({ hello: "Hi, I'm Dilan.", study: "I'm a sophomore studying Finance and BIS at TCU.", story, next: "I'm looking for a fintech internship next summer." }, yes, profile);
  assert.equal(t, `Hi, I'm Dilan. I'm a sophomore studying Finance and BIS at TCU. ${story} I'm looking for a fintech internship next summer.`);
});

test("pitch: a question, buzzwords or a failed claim are swapped for a plain true sentence that reads naturally", () => {
  const t = assemblePitch({ hello: "Hi, I'm Dilan!", study: "I'm a passionate finance student.", story, next: "What does your team look for in interns?" }, yes, profile);
  assert.equal(t, `Hi, I'm Dilan! I'm a sophomore studying Finance and BIS at TCU. ${story} I'm interested in finance, investment banking and consulting.`);
  assert.doesNotMatch(t, /\?|passionate/);
});

test("pitch: real things aren't buzzwords, and a quoted question inside a story is fine", () => {
  for (const s of ["I built a data-driven model for dynamic pricing at Uber.", "I interned at Thrive Market on the ops team.", "I asked members \"what would help?\" and built a budget tracker from their answers."]) {
    assert.match(assemblePitch({ hello: "Hi, I'm Dilan.", story: s }, yes, profile), new RegExp(s.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(assemblePitch({ hello: "Hi, I'm Dilan.", story: "I'm a highly driven self-starter." }, yes, profile), "");
});

test("pitch: no confirmed name means no name, even if the AI wrote one", () => {
  const t = assemblePitch({ hello: "Hi, I'm Dilan Dimel.", story }, yes, { ...profile, name: "" });
  assert.match(t, /^Hi, nice to meet you\./);
  assert.doesNotMatch(t, /Dimel/);
});

test("pitch: no real story means no pitch (Remy says why) instead of a generic one", () => {
  assert.equal(assemblePitch({}, yes, profile), "");
  assert.equal(assemblePitch({ hello: "Hi, I'm Dilan.", story: "I raised $2 million." }, (x) => !/\$2 million/.test(x), profile), "");
  assert.deepEqual(plainParts({ name: "", classYear: "", major: "", school: "", interests: "" }), { hello: "Hi, nice to meet you.", study: "", next: "" });
});

const script = "Hi, I'm Dilan. I'm a sophomore studying Finance and BIS at TCU. Last month my team won first place at the Neeley AI Forward competition with a career coach app. I'm looking for a summer internship in fintech.";

test("practice: pace, fillers, word-for-word recital and skipped names", () => {
  const recited = speechFeedback(script, 15, script);
  assert.equal(recited.pace, "ok");
  assert.ok(recited.recited! >= 0.85);
  const told = speechFeedback("um hi I'm Dilan uh I study finance at TCU and like we built an app that won a competition and I'd like to get an internship in fintech", 8, script);
  assert.deepEqual(told.fillers, ["um", "uh", "like"]);
  assert.ok(told.recited! < 0.85);
  assert.equal(told.pace, "fast");
  assert.deepEqual(told.missed, ["BIS", "Neeley", "AI", "Forward"]);
  assert.equal(speechFeedback("hi", 2, script).wpm, null); // too little to judge
});

test("practice (review cases): '&', '-' and '.' names count when said; 'looks like' isn't a filler; extra talk isn't reciting", () => {
  const s2 = "I study at Texas A&M and interned at AT&T in the U.S. through a Co-op program with Coca-Cola.";
  assert.deepEqual(speechFeedback(s2, 8, s2).missed, []);
  assert.deepEqual(speechFeedback("it looks like things like Excel help and we'd like to and I'll like it more and more over time", 8).fillers, []);
  const more = script + " " + "and also I want to add a lot of my own words here about why I care about this so much and what I hope to do next year".repeat(1);
  assert.equal(speechFeedback(more, 30, script).recited, 0);
});

test("a job title as the interest reads as a kind of role, not 'interested in public affairs intern'", () => {
  const next = (interests: string) => plainParts({ ...profile, interests }).next;
  assert.equal(next("Public Affairs Intern"), "I'm interested in public affairs internships.");
  assert.equal(next("Data Analyst, Software Engineer Intern"), "I'm interested in data analyst roles and software engineer internships.");
  assert.equal(next("Finance, Consulting"), "I'm interested in finance and consulting.");
});
