// The "You're in" email owners send on Accept. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptDraft, acceptHtml } from "@shared/acceptEmail";

test("accept email: draft uses the first name, the exact sign-in email and the cohort", () => {
  const d = acceptDraft({ name: "Jordan Lee", email: "jordan.lee@tcu.edu", cohort: "Cohort 1" });
  assert.match(d.message, /^Hi Jordan,/);
  assert.match(d.message, /type jordan\.lee@tcu\.edu/);
  assert.match(d.message, /\(Cohort 1\)/);
  assert.match(acceptDraft({ name: "", email: "x@y.edu", cohort: "" }).message, /^Hi there,/);
});

test("accept email: the owner's text is escaped, paragraphs kept, sign-in button points to the host", () => {
  const html = acceptHtml("Hi <b>Sam</b> & co\nline two\n\n<script>alert(1)</script>", "remyai.org");
  assert.ok(!html.includes("<script>") && !html.includes("<b>Sam</b>"));
  assert.ok(html.includes("Hi &lt;b&gt;Sam&lt;/b&gt; &amp; co<br>line two"));
  assert.equal((html.match(/<p style="margin:0 0 16px/g) || []).length, 2);
  assert.ok(html.includes('href="https://remyai.org/signin"'));
});
