// "Delete everything" must leave nothing that identifies the student (privacy policy). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { accountsWithEmail, deleteAccount, emptyWorkspace, ensureUser, saveWorkspace } from "./platform/db";
import { add, parseAnswers, saveApplication } from "./platform/beta";
import { recordError } from "./platform/admin";
import { q } from "./platform/sql";

test("delete account: feedback, error reports, beta application and beta-list entry go too; others stay", async () => {
  for (const [id, email] of [["sb:del-me", "Del.Me@tcu.edu"], ["sb:del-other", "other@tcu.edu"]]) {
    await ensureUser({ id, kind: "supabase", email, name: "", picture: "" });
    await saveWorkspace(id, emptyWorkspace());
    await recordError("feedback", "/home", "Love it", email, id);
    await saveApplication(parseAnswers({ "First & Last Name": "X", "School Email Address": email })!);
    await add("founder@tcu.edu", email);
  }
  await deleteAccount("sb:del-me");
  assert.equal((await q("SELECT 1 FROM error_reports WHERE user_id = 'sb:del-me'")).length, 0);
  assert.equal((await q("SELECT 1 FROM beta_applications WHERE email = 'del.me@tcu.edu'")).length, 0);
  assert.equal((await q("SELECT 1 FROM beta_list WHERE email = 'del.me@tcu.edu'")).length, 0);
  assert.equal((await q("SELECT 1 FROM users WHERE id = 'sb:del-me'")).length, 0);
  assert.equal((await q("SELECT 1 FROM error_reports WHERE user_id = 'sb:del-other'")).length, 1);
  assert.equal((await q("SELECT 1 FROM beta_list WHERE email = 'other@tcu.edu'")).length, 1);
});

test("delete account: every sign-in account with the same email is found, so none survives to catch the next sign-in", async () => {
  await ensureUser({ id: "g:dee", kind: "google", email: "Dee@tcu.edu", name: "", picture: "" });
  await ensureUser({ id: "sb:em-dee", kind: "supabase", email: "dee@tcu.edu", name: "", picture: "" });
  await ensureUser({ id: "sb:not-dee", kind: "supabase", email: "notdee@tcu.edu", name: "", picture: "" });
  assert.deepEqual((await accountsWithEmail("g:dee")).sort(), ["g:dee", "sb:em-dee"]);
  assert.deepEqual(await accountsWithEmail("guest:nobody"), ["guest:nobody"]);
});
