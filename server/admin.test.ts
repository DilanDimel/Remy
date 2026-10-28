// The owners' dashboard: who is an owner, the board, and errors marked fixed. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMember, errors, fixError, isOwner, recordError, removeMember, saveTask, team } from "./admin";

process.env.OWNER_EMAILS = "founder@test.edu";
const user = (email: string, kind: any = "supabase") => ({ kind, email });

test("owners: founders from the server, teammates added in the dashboard, never guests", async () => {
  assert.equal(await isOwner(user("founder@test.edu")), true);
  assert.equal(await isOwner(user("mate@test.edu")), false);
  await addMember("founder@test.edu", { email: "Mate@Test.edu", name: "Mate" });
  assert.equal(await isOwner(user("mate@test.edu")), true);
  assert.equal(await isOwner(user("mate@test.edu", "guest")), false);
  await assert.rejects(removeMember("founder@test.edu", "founder@test.edu"), /yourself/);
  await removeMember("founder@test.edu", "mate@test.edu");
  assert.equal(await isOwner(user("mate@test.edu")), false);
});

test("board: moving a card to Done records who finished it; moving back clears it", async () => {
  await saveTask("founder@test.edu", { title: "Email the Career Center", assignee: "founder@test.edu" });
  let t = (await team("founder@test.edu")).tasks.find((x: any) => x.title === "Email the Career Center")!;
  assert.equal(t.status, "todo");
  await saveTask("founder@test.edu", { id: t.id, status: "doing" });
  await saveTask("founder@test.edu", { id: t.id, status: "done" });
  t = (await team("founder@test.edu")).tasks.find((x: any) => x.id === t.id)!;
  assert.equal(t.done, true);
  assert.equal(t.done_by, "founder@test.edu");
  await saveTask("founder@test.edu", { id: t.id, status: "todo" });
  t = (await team("founder@test.edu")).tasks.find((x: any) => x.id === t.id)!;
  assert.equal(t.done, false);
  assert.equal(t.done_by, "");
  const acts = (await team("founder@test.edu")).activity.map((a: any) => a.action);
  assert.ok(acts.includes("Started a to-do") && acts.includes("Finished a to-do") && acts.includes("Reopened a to-do"));
});

test("errors: marked fixed leaves the open list, and comes back if it happens again", async () => {
  await recordError("browser", "/opportunities", "Boom", "stack");
  assert.ok((await errors()).open.some((e: any) => e.message === "Boom"));
  await fixError("founder@test.edu", "Boom", "browser");
  assert.ok(!(await errors()).open.some((e: any) => e.message === "Boom"));
  await recordError("browser", "/opportunities", "Boom", "stack");
  assert.ok((await errors()).open.some((e: any) => e.message === "Boom"));
});
