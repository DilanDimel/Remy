// READ_ONLY=1: pages and reads keep working, but nothing can be saved. Used for a few minutes while the database is
// copied to a new host, so a student sees a friendly "try again in a minute" instead of an error page or a lost save.
import type { NextFunction, Request, Response } from "express";

export const READ_ONLY_MESSAGE = "Remy is moving to a faster home. Saving is paused for a few minutes, so please try again shortly.";

export function readOnlyGate(req: Request, res: Response, next: NextFunction) {
  if (process.env.READ_ONLY !== "1" || !req.path.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  res.setHeader("Retry-After", "120");
  res.status(503).json({ message: READ_ONLY_MESSAGE, code: "read_only" });
}
