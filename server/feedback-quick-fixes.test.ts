// Fixes from the owners' first feedback round (Nov 13): long notes kept whole, non-answers never become facts,
// "MS Excel" counts as Excel, no question at the end of the pitch, honest photo line, extension errors ignored.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { errors, fixError, fromExtension, recordError } from "./admin";
import { isNonAnswer, skillProof } from "@shared/words";
import { linkedinBasics } from "@shared/linkedin";

test("feedback: a 1,000-character note is saved whole, and Handled still clears it", async () => {
  const note = "The checks dropdown hides what matters. ".repeat(24).trim() + " END";
  assert.ok(note.length > 900 && note.length <= 1000);
  await recordError("feedback", "/resume", note, "a@test.edu", "u1");
  const saved = (await errors()).feedback.find((f: any) => f.message.startsWith("The checks dropdown"));
  assert.equal(saved?.message, note);
  await fixError("founder@test.edu", note, "feedback");
  assert.ok(!(await errors()).feedback.some((f: any) => f.message === note));
});

test("errors: crashes inside a browser extension are not Remy's", () => {
  assert.equal(fromExtension("i: Failed to connect to MetaMask\n at Object.connect (chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/scripts/inpage.js:9:6184)"), true);
  assert.equal(fromExtension("at x (moz-extension://abc/content.js:1:1)"), true);
  assert.equal(fromExtension("TypeError: Failed to fetch\n at ne (https://remyai.org/assets/index-BPDtDrGC.js:50:47486)"), false);
  assert.equal(fromExtension(""), false);
});

test("tailoring: 'idk' and 'I don't really have one' are skips, real answers are kept", () => {
  for (const x of ["skip", "Skip.", "idk", "IDK", "I dont really have one", "I don't really have one", "i don't know", "not sure", "no idea", "nothing really", "n/a", "none", "-", "", "  ", "nope", "pass"]) {
    assert.equal(isNonAnswer(x), true, x);
  }
  for (const x of ["y", "yes", "R", "C++", "2027", "9-5", "我想学习运营", "운영을 배우고 싶어요", "None of that, but I led a club", "Ai Hackathon won", "Their eye-care work; my grandma had cataract surgery", "No prior internship, but I led a 12-person project", "Not sure yet, but I like that the team works on supply chain", "I don't know much about medtech but I want to learn operations", "Summer 2027, available from May 20"]) {
    assert.equal(isNonAnswer(x), false, x);
  }
});

test("Evidence Passport: 'MS Excel' is proven by 'Microsoft Office & Excel'", () => {
  const lines = ["Analyst, Campus Fund", "Built models in Microsoft Office & Excel and PowerPoint"];
  assert.equal(skillProof("MS Excel", lines), lines[1]);
  assert.equal(skillProof("Microsoft Excel", lines), lines[1]);
  assert.equal(skillProof("Excel", lines), lines[1]);
  assert.equal(skillProof("PowerPoint", lines), lines[1]);
  assert.equal(skillProof("Tableau", lines), undefined);
  assert.equal(skillProof("MS Word", lines), undefined); // "Microsoft Office" doesn't prove Word
  assert.equal(skillProof("R", ["Ran regressions in R and Python"]), "Ran regressions in R and Python");
  assert.equal(skillProof("R", ["Recruited members"]), undefined);
  // Everyday words keep their "Microsoft"/"MS": a class project isn't MS Project.
  assert.equal(skillProof("MS Project", ["Led a class project on supply chain"]), undefined);
  assert.equal(skillProof("Microsoft Teams", ["Worked in cross-functional teams"]), undefined);
  assert.equal(skillProof("MS Office", ["Front Office Assistant, Dean's Office"]), undefined);
  assert.equal(skillProof("MS Access", ["Gave members access to shared drive"]), undefined);
  assert.equal(skillProof("Microsoft Word", ["Drafted word-of-mouth campaign"]), undefined);
  assert.equal(skillProof("MS Outlook", ["Market outlook report"]), undefined);
  assert.equal(skillProof("MS Office", lines), lines[1]); // "Microsoft Office & Excel"
  assert.equal(skillProof("MS Project", ["Planned timelines in Microsoft Project"]), "Planned timelines in Microsoft Project");
});

test("LinkedIn coach: the photo line says Remy can't see it, without telling the student to go check", () => {
  const photo = linkedinBasics("Summary\nTop Skills\nExperience").find((b) => b.label === "Profile photo")!;
  assert.equal(photo.ok, null);
  assert.match(photo.tip, /can't see your photo/);
  assert.doesNotMatch(photo.tip, /check this/i);
});

test("pitch: the prompt no longer asks to end with a question", () => {
  const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const prompt = src.slice(src.indexOf('app.post("/api/ai/pitch"'), src.indexOf('app.post("/api/ai/pitch"') + 1200);
  assert.doesNotMatch(prompt, /End with one short question/);
  assert.match(prompt, /No questions/); // and server/pitch.test.ts checks a question is never kept
});
