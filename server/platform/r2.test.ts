import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { r2Get, r2Ready, seal, signR2, unseal } from "./r2";

test("cache files round-trip sealed, and can't be read under another student's name", () => {
  const key = crypto.randomBytes(32);
  const value = { v: "2026-11-24", data: { jobs: [{ title: "Analyst" }] } };
  const box = seal(key, "ws/a", value);
  assert.ok(!box.includes(Buffer.from("Analyst")));
  assert.deepEqual(unseal(key, "ws/a", box), value);
  assert.throws(() => unseal(key, "ws/b", box));
  assert.throws(() => unseal(crypto.randomBytes(32), "ws/a", box));
});

test("not configured: reads are empty and nothing is sent", async () => {
  assert.equal(r2Ready(), false);
  assert.equal(await r2Get("ws/a"), null);
});

test("requests are signed for R2's S3 API", () => {
  const h = signR2("GET", "acct.r2.cloudflarestorage.com", "/b/ws/a", Buffer.alloc(0), "AK", "SK", new Date("2026-11-24T18:00:00Z"));
  assert.equal(h["x-amz-date"], "20261124T180000Z");
  assert.match(h.authorization, /^AWS4-HMAC-SHA256 Credential=AK\/20261124\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
});
