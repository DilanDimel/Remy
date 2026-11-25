#!/usr/bin/env node
// Remy post checker: flags AI tells and Remy's house limits before a draft goes out.
// Usage: node check-post.mjs draft.txt | node check-post.mjs < draft.txt | node check-post.mjs --self-test
import { readFileSync } from "node:fs";

const RULES = [
  // [level, regex, message]
  ["ERROR", /[—–]/, "Em or en dash. Use a period, comma or colon."],
  ["ERROR", /\b(it'?s|this is|that'?s|remy is)\s+not\s+(just\s+)?[^.!?\n]{1,40}[,;.]\s*(it'?s|this is|that'?s|remy is)\b/i, "\"It's not X, it's Y\" construction."],
  ["ERROR", /\bnot just\b[^.!?\n]{1,40}\bbut\b/i, "\"Not just X but Y\" construction."],
  ["ERROR", /\bno\s+\w+(\s+\w+)?,\s*no\s+\w+(\s+\w+)?,\s*no\s+\w+/i, "\"No X, no Y, no Z\" list."],
  ["ERROR", /\b(free coach|always free|100% free|free forever|completely free|totally free)\b/i, "Pricing: say only \"Free during beta\"."],
  ["ERROR", /\bstudent project\b|\btcu project\b|\bclass project\b/i, "Don't present RemyAI as a student or TCU project."],
  ["ERROR", /\b(game[- ]?changer|unlock(s|ing)?|elevate|seamless(ly)?|supercharge|delve|revolutioni[sz]e|in today'?s fast-paced)\b/i, "AI-sounding buzzword."],
  ["ERROR", /\bhere'?s the (thing|kicker|truth)\b/i, "Rhetorical setup line."],
  ["WARN", /\bCREATE\b/, "CREATE mention: not allowed publicly before Dec 1 2026, 12 PM CT."],
  ["WARN", /\b(we|remy)\s+(will\s+)?(send|email|apply|submit)s?\b[^.!?\n]{0,30}\b(for you|on your behalf)\b/i, "Remy never sends anything for the student."],
  ["WARN", /\b(track(s|ing)?|analytics)\b/i, "Tracking/analytics claim: the Privacy page promises no analytics trackers."],
  ["WARN", /\b(interview coach|mock interview|community|phone app|app store|google play)\b/i, "Locked or owners-only feature: only as \"coming next\"."],
  ["WARN", /\b\d[\d,.]*\s*(%|x\b|k\b|students|users|people|interviews|offers|applications|internships|jobs|replies|schools)/i, "Number claim: make sure we can show the source."],
];

export function check(text) {
  const out = [];
  for (const [level, re, message] of RULES) {
    const m = text.match(re);
    if (m) out.push({ level, message, match: m[0].trim().slice(0, 60) });
  }
  const tags = (text.match(/(^|\s)#\w+/g) || []).length;
  if (tags > 3) out.push({ level: "ERROR", message: `${tags} hashtags; 3 max.`, match: "" });
  const emoji = (text.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emoji > 2) out.push({ level: "ERROR", message: `${emoji} emoji; 2 max.`, match: "" });
  return out;
}

function selfTest() {
  const cases = [
    ["Remy fixed my resume. Free during beta at remyai.org.", 0],
    ["It's not a chatbot, it's a coach.", 1],
    ["Remy is a game-changer — free forever!", 3],
    ["No fluff, no filler, no fake claims.", 1],
    ["#a #b #c #d", 1],
  ];
  let ok = true;
  for (const [text, errors] of cases) {
    const n = check(text).filter((r) => r.level === "ERROR").length;
    if (n !== errors) { ok = false; console.error(`FAIL (${n} errors, wanted ${errors}): ${text}`); }
  }
  console.log(ok ? "self-test passed" : "self-test failed");
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  if (process.argv[2] === "--self-test") selfTest();
  const text = process.argv[2] ? readFileSync(process.argv[2], "utf8") : readFileSync(0, "utf8");
  const results = check(text);
  for (const r of results) console.log(`${r.level}: ${r.message}${r.match ? `  [${r.match}]` : ""}`);
  const errors = results.filter((r) => r.level === "ERROR").length;
  console.log(errors ? `${errors} error(s). Fix before sharing.` : results.length ? "No errors; check the warnings." : "Clean.");
  process.exit(errors ? 1 : 0);
}
