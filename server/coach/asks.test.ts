import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace } from "../platform/db";
import { remyAsks } from "@shared/remyAsks";
import { NAME_CHECK } from "@shared/names";
import { answerAsk, tickDone } from "./asks";
import { undoDid } from "../ai/chatDo";

const T = "2026-11-24", at = "2026-11-24T00:00:00Z";
const fact = (id: string, text: string, status: "approved" | "suggested", conflict?: string) => ({ id, text, category: "experience" as const, source: "LinkedIn profile (PDF) import", status, ...(conflict ? { conflict } : {}), createdAt: at, updatedAt: at });
const ws = () => {
  const w = emptyWorkspace();
  w.memory = [fact("f1", "Summer Analyst at TBC Bank", "suggested", "Your resume says Summer Intern at TBC Bank"), fact("f2", "Speaks Georgian", "suggested"), fact("f3", "Volunteered 40 hours", "suggested")];
  w.tasks = [{ id: "t1", title: "Which name should Remy use?", why: 'Your sign-in account is under "Dilandimel", but your resume says "Dilan Desman". More.', due: "", category: "Prepare", done: false, source: NAME_CHECK }];
  w.profileChecks = [{ field: "graduation", resume: "May 2028", profile: "Dec 2027" }];
  w.profile.graduation = "Dec 2027";
  return w;
};
const did = (w: any, r: any) => { w.chat.push({ id: "m1", role: "assistant", text: r.text, at, did: [r.did] }); return r.did; };

test("Remy lists conflicts, the name, profile checks and new facts, most important first", () => {
  const a = remyAsks(ws(), T);
  assert.deepEqual(a.map((x) => x.kind), ["conflict", "name", "profile", "facts"]);
  assert.deepEqual(a[0].vs, [["LinkedIn", "Summer Analyst at TBC Bank"], ["Resume", "Summer Intern at TBC Bank"]]);
  assert.deepEqual(a[3].items!.map((i) => i.id), ["f2", "f3"]);
  assert.match(a[3].text, /I read your LinkedIn and found 2 things/);
});

test("resume is right: the fact goes, no to-do is left, the line to paste comes back, Undo restores it", () => {
  const w = ws(), ask = remyAsks(w, T)[0];
  const r = answerAsk(w, ask, { answer: "resume" }, T);
  assert.equal(r.copy, "Summer Intern at TBC Bank");
  assert.ok(!w.memory.some((m) => m.id === "f1"));
  assert.ok(!w.tasks.some((t) => !t.done && t.source === "LinkedIn profile check"));
  assert.equal(undoDid(w, did(w, r)), null);
  assert.equal(w.memory.find((m) => m.id === "f1")?.conflict, "Your resume says Summer Intern at TBC Bank");
});

test("LinkedIn is right: the fact is kept and a to-do that ticks itself when the resume is edited", () => {
  const w = ws();
  answerAsk(w, remyAsks(w, T)[0], { answer: "source" }, T);
  assert.equal(w.memory.find((m) => m.id === "f1")?.status, "approved");
  assert.ok(w.tasks.some((t) => t.title === "Update your resume to match" && !t.done));
  tickDone(w, (t) => t.title === "Update your resume to match", "You edited your resume.");
  assert.ok(w.tasks.every((t) => t.title !== "Update your resume to match" || t.done));
  assert.equal(w.chat.at(-1)?.did?.[0].kind, "done");
});

test("name, profile and facts answers do the fix; Undo puts each back", () => {
  const w = ws(), [, name, prof, facts] = remyAsks(w, T);
  const n = answerAsk(w, name, { answer: "resume" }, T);
  assert.equal(w.profile.name, "Dilan Desman");
  assert.ok(w.tasks.find((t) => t.id === "t1")!.done);
  const p = answerAsk(w, prof, { answer: "resume" }, T);
  assert.equal(w.profile.graduation, "May 2028");
  assert.deepEqual(w.profileChecks, []);
  const f = answerAsk(w, facts, { keep: ["f2"] }, T);
  assert.equal(w.memory.find((m) => m.id === "f2")?.status, "approved");
  assert.ok(!w.memory.some((m) => m.id === "f3"));
  for (const r of [f, p, n]) undoDid(w, did(w, r));
  assert.equal(w.profile.graduation, "Dec 2027");
  assert.equal(w.profileChecks?.length, 1);
  assert.equal(w.tasks.find((t) => t.id === "t1")!.done, false);
  assert.deepEqual(w.memory.filter((m) => m.status === "suggested").map((m) => m.id).sort(), ["f1", "f2", "f3"]);
});

test("Not now puts a question off for two weeks; quiet week hides them all", () => {
  const w = ws(), ask = remyAsks(w, T)[0];
  answerAsk(w, ask, { answer: "later" }, T);
  assert.ok(!remyAsks(w, T).some((a) => a.id === ask.id));
  assert.ok(remyAsks(w, "2026-12-09").some((a) => a.id === ask.id));
  w.settings.quietUntil = "2026-11-30";
  assert.deepEqual(remyAsks(w, T), []);
});

const pass = (company: string, rating: 1 | 2 | 3 | 4 | 5 = 1, reason?: "company" | "location") => ({ rating, ...(reason ? { reason } : {}), createdAt: at, updatedAt: at,
  context: { rankingVersion: "t", profileKey: "t", capturedAt: at, profile: { major: "", targetRoles: "", interests: "", classYear: "", regions: "", opportunityTypes: "" }, job: { title: "Intern", company, location: "", format: "", kind: "internship" as const } } });

test("two passes at one employer: Remy asks before adding it to the avoid list, and Undo takes it off", () => {
  const w = emptyWorkspace();
  w.jobFeedback = { a: pass("Acme Corp."), b: pass("Acme Corp.", 2, "company"), c: pass("Acme Corp.", 1, "location"), d: pass("Beta LLC"), e: pass("Gamma", 5), f: pass("Gamma", 5) };
  w.profile.avoid = "sales";
  w.fits = { x: {} as never };
  const asks = remyAsks(w, T);
  assert.deepEqual(asks.map((x) => x.id), ["avoid:acme corp."]); // a location pass, a single pass and likes don't count
  assert.match(asks[0].text, /passed on 2 openings at Acme Corp\./);
  const r = answerAsk(w, asks[0], { answer: "avoid" }, T);
  assert.equal(w.profile.avoid, "sales, Acme Corp.");
  assert.deepEqual(w.fits, {});
  assert.equal(remyAsks(w, T).length, 0, "asked once: it's on the list now");
  assert.equal(undoDid(w, did(w, r)), null);
  assert.equal(w.profile.avoid, "sales");
});

test("keep showing an employer: not asked again for a year, and Undo asks again", () => {
  const w = emptyWorkspace();
  w.jobFeedback = { a: pass("Acme"), b: pass("Acme") };
  const ask = remyAsks(w, T)[0];
  const r = answerAsk(w, ask, { answer: "keep" }, T);
  assert.equal(w.profile.avoid || "", "");
  assert.equal(remyAsks(w, T).length, 0);
  assert.equal(remyAsks(w, "2027-06-01").length, 0);
  undoDid(w, did(w, r));
  assert.equal(remyAsks(w, T).length, 1);
});

test("approved versions made before a resume change: Remy asks once, only for ones not sent yet", () => {
  const w = emptyWorkspace();
  const app = (id: string, jobId: string) => ({ id, jobId, versions: [{ v: 1 }], staleReason: "You uploaded a new base resume." } as never);
  w.applications = [app("a1", "j1"), app("a2", "j2"), app("a3", "j3")];
  w.jobs = [{ id: "j1", company: "Acme" }, { id: "j2", company: "Beta" }] as never;
  w.tracker = [{ id: "t", jobId: "j3", status: "Applied" } as never];
  const ask = remyAsks(w, T).find((a) => a.kind === "stale")!;
  assert.equal(ask.id, "stale:a1,a2");
  assert.match(ask.text, /2 tailored versions \(Acme, Beta\)/);
  const r = answerAsk(w, ask, { answer: "keep" }, T);
  assert.ok(!w.applications[0].staleReason && !w.applications[1].staleReason && w.applications[2].staleReason);
  assert.ok(!remyAsks(w, T).some((a) => a.kind === "stale"));
  undoDid(w, did(w, r));
  assert.equal(w.applications[0].staleReason, "You uploaded a new base resume.");
  const r2 = answerAsk(w, remyAsks(w, T).find((a) => a.kind === "stale")!, { answer: "review" }, T);
  assert.match(w.tasks[0].title, /Review your 2 tailored versions/);
  assert.equal(w.tasks[0].due, "2026-11-26");
  undoDid(w, did(w, r2));
  assert.equal(w.tasks.length, 0);
});
