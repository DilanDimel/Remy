import { test } from "node:test";
import assert from "node:assert/strict";
import { baseDomain, boardPage, domainFits, govGuesses, logoOnBoard, logoPage, nameWords, pageNames, siteFromBoard } from "./logo";
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

test("job boards' own logo images are found for Greenhouse, Lever, Ashby, Workable and JazzHR", () => {
  assert.equal(logoOnBoard('<img src="https://s8-recruiting.cdn.greenhouse.io/external_greenhouse_job_boards/logos/400/110/500/original/Atari.png?1737">'), "https://s8-recruiting.cdn.greenhouse.io/external_greenhouse_job_boards/logos/400/110/500/original/Atari.png?1737");
  assert.equal(logoOnBoard('<img src="/img/lever-logo-refresh.svg"><img src="https://lever-client-logos.s3.us-west-2.amazonaws.com/abc.png">'), "https://lever-client-logos.s3.us-west-2.amazonaws.com/abc.png");
  assert.equal(logoOnBoard('"logoWordmarkImageUrl":"https://app.ashbyhq.com/api/images/w.png","logoSquareImageUrl":"https://app.ashbyhq.com/api/images/s.png"'), "https://app.ashbyhq.com/api/images/s.png");
  assert.equal(logoOnBoard('<link rel="icon" href="https://d2y4rc9q318ytb.cloudfront.net/accounts/a947-6a/192x192/1.png" />'), "https://d2y4rc9q318ytb.cloudfront.net/accounts/a947-6a/192x192/1.png");
  assert.equal(logoOnBoard('<img src="//s3.amazonaws.com/resumator/customer_1/logos/mec.png"><img src="/img/v1.1/logos/jazzhr-logo.png">'), "https://s3.amazonaws.com/resumator/customer_1/logos/mec.png");
  assert.equal(logoPage("https://apply.workable.com/j/2D1B9D4A3C"), "https://apply.workable.com/j/2D1B9D4A3C");
  assert.equal(logoPage("https://htx.bamboohr.com/careers/156"), "https://htx.bamboohr.com/careers/company-info");
  assert.equal(logoPage("https://www.usajobs.gov/job/1"), "");
});

test("federal agencies get their initials' .gov site; Careers is dropped from a name", () => {
  assert.deepEqual(govGuesses("Securities and Exchange Commission"), ["sec.gov"]);
  assert.deepEqual(govGuesses("Department of Veterans Affairs"), ["va.gov", "dva.gov"]);
  assert.deepEqual(nameWords("Baylor Careers"), ["baylor"]);
  assert.deepEqual(nameWords("Jobs for Humanity"), ["jobs", "for", "humanity"]);
});

test("a site named only like the company's first word isn't taken for it", () => {
  assert.equal(pageNames("<title>Advanced | Home</title>", "Advanced Agrilytics", "advanced"), false);
  assert.equal(pageNames("<title>Boise Cascade Company</title>", "Boise Cascade", "boise"), true);
});
