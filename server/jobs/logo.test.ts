import { test } from "node:test";
import assert from "node:assert/strict";
import { baseDomain, boardPage, domainFits, nameWords, pageNames, siteFromBoard } from "./logo";
import { logoSrc } from "@shared/logos";

test("nameWords drops legal and filler words, keeps accents readable", () => {
  assert.deepEqual(nameWords("Cain Watters & Associates, LLC"), ["cain", "watters"]);
  assert.deepEqual(nameWords("EōS Fitness"), ["eos", "fitness"]);
});

test("domainFits only accepts a domain named like the company", () => {
  assert.equal(domainFits("opensesame.com", "OpenSesame"), true);
  assert.equal(domainFits("cainwatters.com", "Cain Watters & Associates, LLC"), true);
  assert.equal(domainFits("prolific.com", "Prolific Academic Ltd"), true);
  assert.equal(domainFits("intellimize.co", "OpenSesame"), false);
  assert.equal(domainFits("ey.com", "Disney"), false);
});

test("board pages only for applicant systems whose board lists the employer's links", () => {
  assert.equal(boardPage("https://boards.greenhouse.io/opensesame/jobs/1"), "https://job-boards.greenhouse.io/opensesame");
  assert.equal(boardPage("https://jobs.lever.co/ibotta/abc"), "https://jobs.lever.co/ibotta");
  assert.equal(boardPage("https://evil.example.com/x"), "");
  assert.equal(baseDomain("security.opensesame.com"), "opensesame.com");
  assert.equal(baseDomain("careers.acme.co.uk"), "acme.co.uk");
});

test("the employer's site from its board page, and the name check on a guessed site", () => {
  const html = `<a href="https://log.intellimize.co/x">t</a><a href="https://www.linkedin.com/company/opensesame">in</a><a href="https://security.opensesame.com/">s</a>`;
  assert.equal(siteFromBoard(html, "OpenSesame"), "opensesame.com");
  assert.equal(pageNames("<title>Cain Watters &amp; Associates | Dallas</title>", "Cain Watters & Associates, LLC"), true);
  assert.equal(pageNames("<title>Domain for sale</title>", "Dominium"), false);
});

test("logoSrc asks the server only when no domain is known", () => {
  assert.match(logoSrc("Deloitte LLP").src, /favicons\?domain=deloitte\.com/);
  assert.equal(logoSrc("OpenSesame", "https://boards.greenhouse.io/opensesame/jobs/1", "https://remyai.org").src, "https://remyai.org/api/logo?company=OpenSesame&url=https%3A%2F%2Fboards.greenhouse.io%2Fopensesame%2Fjobs%2F1");
  assert.equal(logoSrc("").src, "");
});
