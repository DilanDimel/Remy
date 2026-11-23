import type { Response } from "express";

/** Headers for a response written piece by piece. `text/event-stream` because Cloudflare (in front of remyai.org)
 * holds back other compressible types until they are complete, which made Remy's streamed chat arrive all at once
 * (iPhone round 4). Lines are still one JSON object each, ending in "\n". */
export const STREAM_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  Connection: "keep-alive",
} as const;

export function startStream(res: Response) {
  if (res.headersSent) return;
  res.writeHead(200, STREAM_HEADERS);
  res.flushHeaders?.();
}

/** Writes one line of the stream. */
export function streamLine(res: Response, data: unknown) {
  res.write(JSON.stringify(data) + "\n");
}
