import compression from "compression";
import type { Request, Response } from "express";

/** Gzips the server's answers (Dilan said go, Nov 24). Most API answers are the student's whole workspace as JSON,
 * which shrinks about 5-10x, so pages and the app load faster on slow phones and the Render to Cloudflare hop
 * carries less. It changes no behaviour: a client that doesn't ask for gzip gets the plain answer.
 * Streamed answers (Remy's chat, `text/event-stream` from `startStream`) are never compressed, so they still arrive
 * line by line. They also send `Cache-Control: no-transform`, which `compression` respects on its own. */
export function skipCompression(req: Request, res: Response) {
  const type = String(res.getHeader("Content-Type") || "");
  if (type.startsWith("text/event-stream")) return true;
  if (req.headers["x-no-compression"]) return true;
  return false;
}

export const compress = compression({
  threshold: 1024, // small answers aren't worth it
  filter: (req, res) => !skipCompression(req as Request, res as Response) && compression.filter(req, res),
});
