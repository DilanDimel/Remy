import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Remy's own pages get the app; anything else is a real 404 (search engines and link checkers can tell),
  // still showing the app so a mistyped link lands somewhere useful. Missing files and API paths get a plain 404.
  const PAGES = /^\/(|path|resume|opportunities|community|calendar|progress|accounts|admin|signin|welcome|about|policies|privacy|terms)\/?$/;
  app.use("/{*path}", (req, res) => {
    const where = req.originalUrl.split(/[?#]/)[0]; // req.path is relative to this mount, so always "/"
    if (PAGES.test(where)) return res.sendFile(path.resolve(distPath, "index.html"));
    if (where.startsWith("/api/")) return res.status(404).json({ message: "Not found." });
    if (/\.[a-z0-9]{2,5}$/i.test(where)) return res.status(404).type("text/plain").send("Not found");
    res.status(404).sendFile(path.resolve(distPath, "index.html"));
  });
}
