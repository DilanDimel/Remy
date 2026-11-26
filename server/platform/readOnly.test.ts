// Read-only mode during a database move. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readOnlyGate } from "./readOnly";

function run(method: string, path: string) {
  let status = 0, passed = false;
  const res: any = { setHeader() {}, status(s: number) { status = s; return res; }, json() { return res; } };
  readOnlyGate({ method, path } as any, res, () => { passed = true; });
  return passed ? "next" : status;
}

test("READ_ONLY=1 turns away saves with 503 but lets reads and pages through", () => {
  delete process.env.READ_ONLY;
  assert.equal(run("POST", "/api/workspace"), "next");
  process.env.READ_ONLY = "1";
  try {
    assert.equal(run("POST", "/api/workspace"), 503);
    assert.equal(run("DELETE", "/api/jobs/interests"), 503);
    assert.equal(run("GET", "/api/me"), "next");
    assert.equal(run("POST", "/some-page"), "next");
  } finally {
    delete process.env.READ_ONLY;
  }
});
