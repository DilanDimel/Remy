import { test } from "node:test";
import assert from "node:assert/strict";
import { nameConcern, textConcern } from "../shared/junk";

test("joke names get a gentle note; real names from many cultures don't", () => {
  for (const n of ["daddy", "Daddy", "big daddy", "asdf", "sdfsdf", "test", "lol", "😎 Mike", "xX_gamer_Xx", "john123", "aaaaa", "fuck you",
    "Deez Nuts", "me@gmail.com", "Bullshit", "Motherfucker", "Bigdick", "John Doe", "Jane Doe", "First Last", "Your Name", "kkk", "poop"])
    assert.ok(nameConcern(n), n);
  for (const n of ["Maria López", "Dilan Desman", "Nguyễn Văn An", "O'Brien-Smith", "Jean-Luc Picard", "Mary Ann St. James", "王伟", "伟", "O", "Q",
    "Cassandra Dickens", "Wu", "Sexton Hall", "Precious King", "Jesus Martinez", "Jesus", "Baby", "Lola", "Lolita", "J", "Me", "Hi", "God",
    "Pornthip Rojanasunan", "Pornchai", "Sachin Wankhede", "Yuki Shitara", "Shitaye Alemu", "Moshe Shitrit", "Eugen Slutsky", "Joe Bastardi",
    "Niggemann", "Dick", "Dick Smith", "Philip K. Dick", "Peter Dicks", "Wanda Cocks", "Robert (Bob) Smith", 'Robert "Bob" Smith',
    "William “Bill” Gates", "Anand Kumar s/o Raju", "Gil·let", "阿卜杜拉·阿卜杜", "Al‐Hassan", "Martin Luther King Jr.", "John Smith III", ""])
    assert.equal(nameConcern(n), "", n);
  assert.match(nameConcern("daddy", true), /talks to you/, "the call-me field doesn't claim it goes on the resume");
});

test("resume lines with profanity get flagged; ordinary ones (honors, medicine, economics, store names) don't", () => {
  for (const t of ["Managed this shit show of a budget", "Professional napper and certified sexy beast", "Handled bullshit complaints", "clusterfuck of a project",
    "dumbass customers", "F*ck it we ship", "batshit crazy deadlines"])
    assert.ok(textConcern(t), t);
  for (const t of ["Graduated magna cum laude", "Summa Cum Laude, Honors College", "Sales associate at Dick's Sporting Goods", "Moby Dick essay contest winner",
    "Applied tit for tat strategy", "Assisted with vaginal deliveries during OB clinical rotation", "Researched penile cancer outcomes",
    "Analyzed Slutsky equation in intermediate micro", "Wankel engine research", "Researched pornography addiction recovery", "Ran a shiitake mushroom stand",
    "Analyzed sexual harassment policy for HR compliance", "Led a team of 5 to build an Essex County dashboard", "Assessed class assignments for Dr. Dickens", "Cockpit systems intern at Lockheed"])
    assert.equal(textConcern(t), "", t);
});
