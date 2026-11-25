import { test } from "node:test";
import assert from "node:assert/strict";
import { newVerifier, parseReturn } from "./auth.ts";

test("parseReturn reads the code or the error from Supabase's return link", () => {
  assert.deepEqual(parseReturn("remy://auth?code=abc-123"), { code: "abc-123", error: undefined });
  assert.deepEqual(parseReturn("exp://u.expo.dev/x/--/auth?code=c1#"), { code: "c1", error: undefined });
  assert.deepEqual(parseReturn("remy://auth?error=access_denied&error_description=User+cancelled"), { code: undefined, error: "User cancelled" });
  assert.deepEqual(parseReturn("remy://auth#error=server_error"), { code: undefined, error: "server_error" });
  assert.deepEqual(parseReturn("remy://auth#access_token=leaked"), { code: undefined, error: undefined });
});

test("newVerifier makes a fresh PKCE verifier Supabase accepts (43-128 unreserved characters)", () => {
  const a = newVerifier(), b = newVerifier();
  assert.match(a, /^[A-Za-z0-9\-._~]{43,128}$/);
  assert.notEqual(a, b);
});
