// TLS choice per database host. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sslFor } from "./sql";

test("private-network and local hosts skip TLS; public hosts check the certificate", () => {
  assert.equal(sslFor("postgresql://u:p@localhost:5432/db"), undefined);
  assert.equal(sslFor("postgresql://u:p@dpg-abc123-a/remy"), undefined);
  assert.equal(sslFor("postgresql://u:p@dpg-abc123-a:5432/remy"), undefined);
  assert.deepEqual(sslFor("postgresql://u:p@dpg-abc123-a.virginia-postgres.render.com/remy"), { rejectUnauthorized: true });
  assert.deepEqual(sslFor("postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres"), { rejectUnauthorized: true });
});
