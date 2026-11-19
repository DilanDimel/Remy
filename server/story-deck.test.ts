// Story deck: the student fills missing STAR parts in their own words; Remy's resume-based parts stay as they are.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createSession, emptyWorkspace, ensureUser, loadWorkspace, saveWorkspace } from "./db";
import { registerRoutes } from "./routes";

test("story deck: answer a missing part, edit or clear your own words, never overwrite what the resume says", async (t) => {
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const id = "sb:story-deck-test";
  await ensureUser({ id, kind: "supabase", email: "story@tcu.edu", name: "", picture: "" });
  const ws = emptyWorkspace();
  ws.stories = [{ id: "st1", title: "Hackathon win", theme: "result", situation: "", task: "", action: "Built an AI career coach with four teammates", result: "", missing: "", source: "Built an AI career coach", asks: { situation: "What was the hackathon asking teams to build?" }, mine: [] }];
  await saveWorkspace(id, ws);
  const cookie = "__Host-or_sid=" + (await createSession(id)).token;
  const post = async (body: unknown) => {
    const r = await fetch(`${base}/api/stories/st1/part`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as any };
  };

  const ok = await post({ part: "situation", text: "TCU's AI Forward hackathon asked teams to build an AI tool for students." });
  assert.equal(ok.status, 200);
  let st = (await loadWorkspace(id)).stories![0];
  assert.equal(st.situation, "TCU's AI Forward hackathon asked teams to build an AI tool for students.");
  assert.deepEqual(st.mine, ["situation"]);
  assert.ok((await loadWorkspace(id)).memory.some((m) => m.status === "approved" && m.text.includes("AI Forward hackathon")), "saved as an approved fact");
  assert.match(st.missing, /responsible|problem/); // the next empty part (task) is what's missing now

  assert.equal((await post({ part: "result", text: "idk" })).status, 400);
  assert.equal((await post({ part: "action", text: "I led the whole team and raised $1M" })).status, 400, "the resume's own part can't be overwritten");
  assert.equal((await post({ part: "action", text: "" })).status, 400, "or cleared");
  assert.equal((await post({ part: "feelings", text: "a long enough sentence" })).status, 400);

  assert.equal((await post({ part: "situation", text: "" })).status, 200);
  st = (await loadWorkspace(id)).stories![0];
  assert.equal(st.situation, "");
  assert.deepEqual(st.mine, []);
});

test("story deck: a question that names something the line doesn't is a guess; ordinary questions are fine", async () => {
  const { namesNew } = await import("@shared/stories");
  const line = "Built budget trackers in Microsoft Office & Excel and PowerPoint Finance & BIS, Texas Christian University";
  assert.equal(namesNew("What was NABA's money situation before you built the trackers?", line), true);
  assert.equal(namesNew("Who at Deloitte asked you to build them?", line), true);
  assert.equal(namesNew("What was the measurable outcome after you built the budget trackers?", line), false);
  assert.equal(namesNew("Which Excel features did you use, and why?", line), false);
  assert.equal(namesNew("What was the result for the chapter's finances?", line), true);
  assert.equal(namesNew("How did your team react?", line), true);
  assert.equal(namesNew("What did the budget trackers change?", line), false);
  assert.equal(namesNew("What motivated you to start the UNO Club at TCU?", "Founded club and led effort for official TCU recognition President, TCU UNO Club"), false);
});

test("story deck (review cases): question checks catch guesses but keep good questions", async () => {
  const { namesNew } = await import("@shared/stories");
  const uno = "Founded club from concept to active organization and led effort for official TCU recognition; organized inaugural tournament with 24 participants President, TCU UNO Club";
  for (const q of ["Who were your co-founders?", "How did you raise money from sponsors?", "What obstacles did you face with the administration?", "What did your roommates say?", "NABA's budget: what problem did it have?", "Deloitte asked for what?"]) assert.equal(namesNew(q, uno), true, q);
  assert.equal(namesNew("What did you do at McDonald's?", "Took orders during lunch rush Crew Member at McDonald's"), false);
  assert.equal(namesNew("What was going on? What did you need to solve?", uno), false);
  assert.equal(namesNew("How did your team split the work?", "Built an AI coach with four teammates"), false);
  assert.equal(namesNew("What did your classes cover?", "Tutored classmates in Calculus class"), false);
});

test("story deck: the story's line must be a real resume line, matched despite small copy changes", async () => {
  const { findLine } = await import("@shared/stories");
  const lines = [{ text: "Founded club from concept to active organization and led effort for official TCU recognition", where: "President, TCU UNO Club" }];
  assert.equal(findLine(lines, "Founded club from concept to active organization and led effort for official TCU recognition.")?.where, "President, TCU UNO Club");
  assert.equal(findLine(lines, "“Founded club from concept to active organization and led effort for official TCU recognition”")?.where, "President, TCU UNO Club");
  assert.equal(findLine(lines, "Founded TCU UNO Club with NABA sponsorship and grew it to 40 members"), undefined);
});

test("story deck: editing your answer updates its fact and clearing removes it (no stale 'true' facts)", async (t) => {
  const app = express(); app.use(express.json());
  const server = createServer(app); await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  const id = "sb:story-deck-facts";
  await ensureUser({ id, kind: "supabase", email: "story2@tcu.edu", name: "", picture: "" });
  const ws = emptyWorkspace();
  ws.stories = [{ id: "st1", title: "Volunteering", theme: "", situation: "", task: "", action: "Organized food drives", result: "", missing: "", source: "Organized food drives", mine: [] }];
  await saveWorkspace(id, ws);
  const cookie = "__Host-or_sid=" + (await createSession(id)).token;
  const post = (text: string) => fetch(`${base}/api/stories/st1/part`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ part: "result", text }) });
  assert.equal((await post("I led 5 volunteers and we collected 300 cans.")).status, 200);
  assert.equal((await post("I worked with 3 volunteers and we collected 120 cans.")).status, 200);
  let mem = (await loadWorkspace(id)).memory.filter((m) => m.source === "Told Remy in the story deck");
  assert.equal(mem.length, 1);
  assert.match(mem[0].text, /3 volunteers/);
  assert.equal((await post("")).status, 200);
  mem = (await loadWorkspace(id)).memory.filter((m) => m.source === "Told Remy in the story deck");
  assert.equal(mem.length, 0);
});

test("story deck (second review): no prefix or word-family guesses, natural openers are fine", async () => {
  const { namesNew, sameLine } = await import("@shared/stories");
  for (const [q, line] of [["What did the administration think?", "Wrote a weekly newsletter for a nonprofit"], ["How did the audience react?", "Spoke as a volunteer"], ["What did your manager say?", "Managed social media accounts"], ["Who gave you the funding?", "Taught fundamentals of Excel"], ["What did the judges say?", "Used judgment on cases"], ["What did your friends think?", "Built a friendly chatbot"], ["What event was it?", "Eventually automated reports"], ["What did the board decide?", "Boarding school tutor"]]) assert.equal(namesNew(q, line), true, q);
  for (const q of ["Your role there: what did you own?", "If you started again, what would you change?", "Roughly how many people used it?"]) assert.equal(namesNew(q, "Built a dashboard used weekly"), false, q);
  assert.equal(sameLine("Tutored students in calculus", "Tutored students in calculus and statistics weekly"), false);
  assert.equal(sameLine("Tutored students in calculus.", "“Tutored students in calculus”"), true);
});

test("stories come from things the student did, not course lists or skills", async () => {
  const { storyLines } = await import("./storyLines");
  const doc = { contact: {}, skills: [], sections: [
    { id: "s1", heading: "EDUCATION", entries: [{ id: "e1", org: "TCU", role: "BBA Finance", dates: "", bullets: [{ id: "b1", text: "Relevant Coursework: Financial Accounting, Statistics" }, { id: "b2", text: "Built a DCF model in Excel for a class project" }, { id: "b3", text: "GPA 3.6, Dean's List" }] }] },
    { id: "s2", heading: "Relevant Coursework", entries: [{ id: "e2", org: "", role: "", dates: "", bullets: [{ id: "b4", text: "Corporate Finance" }] }] },
    { id: "s3", heading: "EXPERIENCE", entries: [{ id: "e3", org: "Academy", role: "Sales Associate", dates: "", bullets: [{ id: "b5", text: "Ran the register" }] }] },
  ] } as any;
  assert.deepEqual(storyLines(doc).map((l) => l.text), ["Built a DCF model in Excel for a class project", "Ran the register"]);
});

test("story lines keep experience under mixed headings and drop skills/certification lines anywhere", async () => {
  const { storyLines } = await import("./storyLines");
  const sec = (heading: string, ...bullets: string[]) => ({ id: heading, heading, entries: [{ id: heading + "e", org: "", role: "", dates: "", bullets: bullets.map((text, i) => ({ id: heading + i, text })) }] });
  const doc = { contact: {}, skills: [], sections: [
    sec("Leadership, Skills & Activities", "President of Finance Club"), sec("Projects & Certifications", "Built a Tableau dashboard for a class"),
    sec("Coursework & Projects", "Built a budgeting app for Intro to IS"), sec("Education", "Honors Thesis on bank failures, 40 pages"),
    sec("Additional Information", "Skills: Excel, PowerPoint", "Certifications: Bloomberg Market Concepts", "Interests: golf", "Languages: Spanish"),
    sec("Technical Proficiencies", "Excel, Python"), sec("Skills & Interests", "Excel"),
  ] } as any;
  assert.deepEqual(storyLines(doc).map((l) => l.text), ["President of Finance Club", "Built a Tableau dashboard for a class", "Built a budgeting app for Intro to IS", "Honors Thesis on bank failures, 40 pages"]);
});
