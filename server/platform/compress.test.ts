// Gzipped answers (Nov 24): big JSON answers are compressed when asked for, small ones and streams are not, and
// streamed lines still arrive one by one. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, get } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { compress } from "./compress";
import { startStream, streamLine } from "./stream";

function raw(url: string, headers: Record<string, string> = {}) {
  return new Promise<{ headers: Record<string, unknown>; body: Buffer; chunks: number }>((resolve, reject) => {
    get(url, { headers }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(parts), chunks: parts.length }));
    }).on("error", reject);
  });
}

test("compress: big JSON is gzipped on request, small JSON and streams are left alone", async (t) => {
  const app = express();
  app.use(compress);
  const big = { jobs: Array.from({ length: 400 }, (_, i) => ({ id: "job" + i, title: "Analyst intern", company: "Acme" })) };
  app.get("/api/big", (_req, res) => { res.json(big); });
  app.get("/api/small", (_req, res) => { res.json({ ok: true }); });
  app.get("/api/stream", async (_req, res) => {
    startStream(res);
    for (let i = 0; i < 3; i++) { streamLine(res, { i, pad: "x".repeat(800) }); await new Promise((r) => setTimeout(r, 30)); }
    res.end();
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;

  const zipped = await raw(base + "/api/big", { "Accept-Encoding": "gzip" });
  assert.equal(zipped.headers["content-encoding"], "gzip");
  const plainSize = Buffer.byteLength(JSON.stringify(big));
  assert.ok(zipped.body.length < plainSize / 5, `gzip ${zipped.body.length} vs ${plainSize}`);
  assert.deepEqual(JSON.parse(gunzipSync(zipped.body).toString()), big);

  const notAsked = await raw(base + "/api/big");
  assert.equal(notAsked.headers["content-encoding"], undefined);
  assert.deepEqual(JSON.parse(notAsked.body.toString()), big);

  const small = await raw(base + "/api/small", { "Accept-Encoding": "gzip" });
  assert.equal(small.headers["content-encoding"], undefined);

  const stream = await raw(base + "/api/stream", { "Accept-Encoding": "gzip" });
  assert.equal(stream.headers["content-encoding"], undefined);
  assert.equal(stream.body.toString().trim().split("\n").length, 3);
  assert.ok(stream.chunks >= 3, "streamed lines arrive one by one");
});
