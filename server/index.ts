import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { dbKind, dbReady } from "./platform/sql";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { flushDbBytes } from "./jobs/insights";
import { compress } from "./platform/compress";
import { readOnlyGate } from "./platform/readOnly";

const app = express();
app.disable("x-powered-by"); // don't advertise the server software
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const keepRaw = (req: any, _res: unknown, buf: Buffer) => { req.rawBody = buf; };
const json = express.json({ limit: "1mb", verify: keepRaw });
// The phone app sends uploads as base64 JSON (server/platform/upload.ts): up to 5 MB of file is about 6.7 MB of text.
const jsonUpload = express.json({ limit: "7mb", verify: keepRaw });
const UPLOADS = new Set(["/api/resume/upload", "/api/profile/photo", "/api/import/profile", "/api/feedback", "/api/team/library"]);
app.use((req, res, next) => (UPLOADS.has(req.path) ? jsonUpload : json)(req, res, next));

app.use(express.urlencoded({ extended: false, verify: keepRaw })); // raw kept for Slack's signed slash commands
// During a database move: reads work, saves get a friendly "try again shortly" (server/platform/readOnly.ts).
app.use(readOnlyGate);

// One address: pages opened on the old *.onrender.com address move to PUBLIC_HOST (remyai.org), keeping the path,
// query and any sign-in fragment. API calls aren't redirected, so scheduled jobs and open tabs keep working.
app.use((req, res, next) => {
  const target = (process.env.PUBLIC_HOST || "").trim();
  const host = String(req.headers.host || "").toLowerCase();
  if (target && host.endsWith(".onrender.com") && host !== target && (req.method === "GET" || req.method === "HEAD") && !req.path.startsWith("/api/"))
    return res.redirect(301, `https://${target}${req.originalUrl}`);
  next();
});

// Standard browser security headers. The resume PDF preview is framed by our own
// page, so framing is limited to this site rather than blocked outright.
const supabaseOrigin = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://accounts.google.com https://us.i.posthog.com https://us-assets.i.posthog.com ${supabaseOrigin}`.trim(),
  // PostHog's replay compresses in a blob worker (client/src/lib/analytics.ts).
  "worker-src 'self' blob:",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
// microphone=(self): "Answer out loud" and the Remy mic need it; microphone=() made every browser refuse the mic.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Gzip answers when the client asks for it; streamed chat replies are skipped (server/platform/compress.ts).
app.use(compress);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/** The last few API requests that started (method and path only), named in a freeze report. */
const recent: string[] = [];
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  if (path.startsWith("/api") && path !== "/api/config") { recent.push(`${req.method} ${path.replace(/\/[a-z]*[0-9][\w-]*/gi, "/:id")}`); if (recent.length > 10) recent.shift(); }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Flag slow requests so a repeat of the 40 s stall seen in load testing stands out in the Render logs.
      log(duration > 5000 ? `SLOW ${logLine}` : logLine);
    }
  });

  next();
});

(async () => {
  // Connect and apply server/migrations before taking requests, so a bad DATABASE_URL fails at startup.
  await dbReady();
  log(`database: ${dbKind}`);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "Something went wrong. Please try again." : err.message || "Request error";

    console.error("Request error:", status);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      watchFreezes();
    },
  );

  // Render sends SIGTERM to the old server on each deploy: stop taking new connections, let requests in flight
  // (streamed chat answers) finish, then exit. Render force-kills after its shutdown delay (30 s by default).
  process.once("SIGTERM", () => {
    log("SIGTERM: finishing open requests, then exiting");
    httpServer.close(() => process.exit(0));
    httpServer.closeIdleConnections();
    setTimeout(() => process.exit(0), 25_000).unref();
    flushDbBytes().catch(() => {}); // count the last few minutes of Supabase transfer before this server goes
  });
})();

/** Live, Nov 13 + 17: the server stopped answering for 6-9 s (health checks went unanswered) and nobody could see
 *  why. A timer that should tick every second notices when it ran late, and logs how long the server was stuck and
 *  which request was being handled when it started, so the next freeze explains itself. Never logs student data. */
function watchFreezes() {
  let expected = Date.now() + 1000;
  const t = setInterval(() => {
    const late = Date.now() - expected;
    if (late > 2000) console.warn(`server froze for ${late}ms (recent requests: ${recent.slice(-5).join(", ") || "none"})`);
    expected = Date.now() + 1000;
  }, 1000);
  t.unref();
}
