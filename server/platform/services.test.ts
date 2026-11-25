// Admin → System AI money: the account balance (all keys) wins over the live key's own cap. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openRouter } from "./services";

function fakeFetch(credits: (auth: string) => Response) {
  return (async (url: string, init?: any) => {
    const auth = String(init?.headers?.Authorization || "");
    if (url.endsWith("/api/v1/credits")) return credits(auth);
    return Response.json({ data: { label: "Remy", usage: 1.39, limit: 10, limit_remaining: 8.61 } });
  }) as typeof fetch;
}

test("uses the account balance from /credits, with the key's usage as detail", async () => {
  const real = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-normal";
  delete process.env.OPENROUTER_MANAGEMENT_KEY;
  globalThis.fetch = fakeFetch(() => Response.json({ data: { total_credits: 20, total_usage: 13.84 } }));
  try {
    const r: any = await openRouter();
    assert.deepEqual(r.account, { left: 6.16, bought: 20, spent: 13.84 });
    assert.equal(r.remaining, 8.61);
    assert.equal(r.label, "Remy");
  } finally { globalThis.fetch = real; }
});

test("tries the management key first, and falls back to the key's cap when /credits refuses", async () => {
  const real = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-normal";
  process.env.OPENROUTER_MANAGEMENT_KEY = "test-mgmt";
  const seen: string[] = [];
  globalThis.fetch = fakeFetch((auth) => { seen.push(auth); return new Response("{}", { status: 403 }); });
  try {
    const r: any = await openRouter();
    assert.deepEqual(seen, ["Bearer test-mgmt", "Bearer test-normal"]);
    assert.equal(r.account, null);
    assert.equal(r.remaining, 8.61);
  } finally { globalThis.fetch = real; delete process.env.OPENROUTER_MANAGEMENT_KEY; }
});
