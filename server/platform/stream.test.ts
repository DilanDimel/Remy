import { test } from "node:test";
import assert from "node:assert/strict";
import { STREAM_HEADERS, startStream, streamLine } from "./stream";

test("streams are sent as event-stream, uncompressed and unbuffered", () => {
  assert.match(STREAM_HEADERS["Content-Type"], /^text\/event-stream/);
  assert.match(STREAM_HEADERS["Cache-Control"], /no-transform/);
  assert.equal(STREAM_HEADERS["X-Accel-Buffering"], "no");
});

test("startStream writes headers once and streamLine writes one JSON line", () => {
  const calls: any[] = [];
  const res: any = { headersSent: false, writeHead(s: number, h: any) { calls.push(["head", s, h]); this.headersSent = true; }, write(x: string) { calls.push(["write", x]); } };
  startStream(res); startStream(res);
  streamLine(res, { reply: "Hi" });
  assert.equal(calls.filter((c) => c[0] === "head").length, 1);
  assert.deepEqual(calls.at(-1), ["write", '{"reply":"Hi"}\n']);
});
