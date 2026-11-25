import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReturn } from "./auth.ts";

test("parseReturn reads the token or the error from Supabase's return link", () => {
  assert.deepEqual(parseReturn("remy://auth#access_token=abc&refresh_token=r&token_type=bearer"), { token: "abc", error: undefined });
  assert.deepEqual(parseReturn("exp://u.expo.dev/x/--/auth#access_token=t1"), { token: "t1", error: undefined });
  assert.deepEqual(parseReturn("remy://auth?error=access_denied&error_description=User+cancelled"), { token: undefined, error: "User cancelled" });
  assert.deepEqual(parseReturn("remy://auth#error=server_error"), { token: undefined, error: "server_error" });
  assert.deepEqual(parseReturn("remy://auth"), { token: undefined, error: undefined });
});
