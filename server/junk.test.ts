import { test } from "node:test";
import assert from "node:assert/strict";
import { nameConcern, textConcern } from "../shared/junk";

test("joke names get a gentle note; real names, including unusual ones, don't", () => {
  for (const n of ["daddy", "Daddy", "big daddy", "asdf", "test", "lol", "😎 Mike", "xX_gamer_Xx", "john123", "aaaaa", "fuck you", "Deez Nuts", "a", "me@gmail.com"])
    assert.ok(nameConcern(n), n);
  for (const n of ["Maria López", "Dilan Desman", "Nguyễn Văn An", "O'Brien-Smith", "Jean-Luc Picard", "Mary Ann St. James", "王伟", "Cassandra Dickens", "Wu", "Sexton Hall", "Precious King", "Jesus Martinez", ""])
    assert.equal(nameConcern(n), "", n);
});

test("resume lines with profanity get flagged; ordinary ones don't", () => {
  assert.ok(textConcern("Managed this shit show of a budget"));
  assert.ok(textConcern("Professional napper and certified sexy beast"));
  assert.equal(textConcern("Analyzed sexual harassment policy for HR compliance"), "", "policy work about the topic is fine");
  assert.equal(textConcern("Led a team of 5 to build an Essex County dashboard"), "");
  assert.equal(textConcern("Assessed class assignments for Dr. Dickens"), "");
});
