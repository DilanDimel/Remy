import type { Express, NextFunction, Request, Response } from "express";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { CATALOG, SAMPLE_CONTACTS, SAMPLE_INBOX } from "@shared/catalog";
import type {
  Application, AppConfig, BulletChange, ClaimFlag, Job, JobCheck, JobFit, Me, MemoryFact, ResumeDoc, Suggestion, TrackStatus, Workspace,
} from "@shared/types";
import { aiAllowed, cleanupOld, deleteAccount, ensureUser, getFile, hasWorkspace, loadWorkspace, nowIso, saveFile, saveWorkspace, uid } from "./db";
import { aiJson, aiStatus, AiUnavailable, lastUsedModel, markAiAuthFailure, model } from "./ai";
import { endSession, googleClientId, identify, newGuest, startSession, supabaseConfig, supabaseProviders, verifyGoogle, verifySupabase } from "./auth";
import { aiExtractPosting, aiParseResume, CLOSED_SIGNALS, extractSkills, fetchPublic, fileToText, htmlToText, norm, resumeToText, rulesParse } from "./parse";
import { atsChecks, claimCheck } from "./claims";
import { classYearOf, computeFit, FIELD_TITLES } from "./fit";
import { atsScore, keywordsFrom } from "./ats";
import { boardsFor, discoverJobs, EMPLOYERS } from "./sources";
import { alumniList, matchAlumni } from "./alumni";
import { letterDocx, letterPdf, resumeDocx, resumePdf, resumeTxt } from "./docs";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
// Turns upload errors into messages a student can act on instead of a generic 500.
const uploadFile = (req: Request, res: Response, next: NextFunction) =>
  upload.single("file")(req, res, (err: any) => {
    if (!err) return next();
    const tooBig = err?.code === "LIMIT_FILE_SIZE";
    res.status(tooBig ? 413 : 400).json({ message: tooBig ? "That file is over 5 MB. Export a smaller PDF, or upload a Word (.docx) file." : "That upload didn't come through. Please try again." });
  });

type Ctx = { me: Me; ws: Workspace; save: () => void; ip: string };
type H = (req: Request, res: Response, ctx: Ctx) => Promise<unknown> | unknown;

// shortcut: in-memory counters reset on restart and assume one server process; move to the DB if we ever run more than one.
const hits = new Map<string, number[]>();
function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  hits.set(key, list);
  return true;
}
// Render sits behind Cloudflare, which sets the real visitor address.
const clientIp = (req: Request) => String(req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket.remoteAddress || "").trim();

function route(fn: H, opts: { create?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = clientIp(req);
      let me = identify(req);
      if (!me) {
        if (!opts.create) return res.status(401).json({ message: "Please sign in or choose Explore demo." });
        if (!allow("guest:" + ip, 10, 60 * 60_000)) return res.status(429).json({ message: "Too many new guest workspaces from this network. Please try again in an hour, or sign in." });
        me = newGuest(res);
      }
      const ws = loadWorkspace(me.id);
      // A request can run for seconds (AI calls). On save, re-read the stored
      // workspace and write back only the sections this request changed, so a
      // slow request never erases edits saved meanwhile by another one.
      // shortcut: merges per top-level section; two requests editing the same section still last-write-wins.
      const before = new Map(Object.entries(ws).map(([k, v]) => [k, JSON.stringify(v)]));
      const save = () => {
        const fresh = loadWorkspace(me!.id) as unknown as Record<string, unknown>;
        const mine = ws as unknown as Record<string, unknown>;
        for (const k of Object.keys(mine)) if (k !== "updatedAt" && JSON.stringify(mine[k]) !== before.get(k)) fresh[k] = mine[k];
        saveWorkspace(me!.id, fresh as unknown as Workspace);
        Object.assign(ws, fresh);
        for (const [k, v] of Object.entries(fresh)) before.set(k, JSON.stringify(v));
      };
      const ctx: Ctx = { me, ws, ip, save };
      await fn(req, res, ctx);
    } catch (e: any) {
      if (e instanceof AiUnavailable) return res.status(503).json({ message: e.message, code: "ai-unavailable" });
      const status = e?.status || 500;
      if (status >= 500) console.error("route error", e?.message);
      // Errors we raised on purpose carry a status and a user-facing message; anything else stays generic.
      const message = e?.status ? e.message : "Something went wrong. Please try again.";
      if (!res.headersSent) res.status(status).json({ message, code: e?.code });
      else next(e);
    }
  };
}

// Outbound page reads (posting import, link re-checks, job-board scans): 20 per user and 40 per network per 10 minutes.
function fetchAllowed(ctx: Ctx) {
  if (!allow("fetch:" + ctx.me.id, 20, 10 * 60_000) || !allow("fetch-ip:" + ctx.ip, 40, 10 * 60_000))
    bad("You've checked a lot of links in a short time. Please wait a few minutes.", 429);
}

function bad(msg: string, status = 400): never {
  throw Object.assign(new Error(msg), { status });
}

function logAi(ws: Workspace, purpose: string, started: number, ok: boolean, note?: string) {
  ws.aiLog.push({ id: uid("ai"), at: nowIso(), purpose, model: lastUsedModel(), ok, ms: Date.now() - started, note });
}
async function withAi<T>(ctx: Ctx, purpose: string, fn: () => Promise<T>): Promise<T> {
  if (!allow("ai-ip:" + ctx.ip, 60, 60 * 60_000)) bad("Lots of AI requests are coming from this network. Please wait a bit and try again.", 429);
  const lim = aiAllowed(ctx.me.id, ctx.me.kind === "guest" || ctx.me.kind === "visitor");
  if (!lim.ok) bad(lim.message!, 429);
  const t = Date.now();
  try {
    const r = await fn();
    markAiAuthFailure(false);
    logAi(ctx.ws, purpose, t, true);
    return r;
  } catch (e: any) {
    logAi(ctx.ws, purpose, t, false, String(e?.message || e).slice(0, 160));
    ctx.save();
    if (e instanceof AiUnavailable) throw e;
    const st = Number(e?.status) || 0;
    if (st === 401 || st === 403) markAiAuthFailure(true);
    if (st === 401 || st === 403) throw Object.assign(new Error("The AI service rejected this server's credentials. AI features are temporarily unavailable — everything else still works."), { status: 503, code: "ai-unavailable" });
    if (st === 402 || (st === 429 && /quota|daily limit|credits/i.test(String(e?.message)))) throw Object.assign(new Error("Today's AI allowance on this demo is used up. AI features come back automatically; everything else still works."), { status: 503, code: "ai-quota" });
    if (st === 429) throw Object.assign(new Error("The AI service is busy. Please try again in a minute."), { status: 503, code: "ai-busy" });
    if (st >= 400 || /timeout|ECONN|fetch failed/i.test(String(e?.message))) throw Object.assign(new Error("The AI request didn't complete. Please try again."), { status: 502 });
    throw e;
  }
}

const approvedFacts = (ws: Workspace) => ws.memory.filter((m) => m.status === "approved").map((m) => m.text);
const evidenceOf = (ws: Workspace) =>
  [ws.resume?.rawText || "", ws.resume ? resumeToText(ws.resume.doc) : "", ws.profile.classYear ? `Class year: ${ws.profile.classYear}` : "", ...approvedFacts(ws)].join("\n");
const allJobs = (ws: Workspace): Job[] => [...CATALOG.map((j) => ({ ...j, checks: ws.jobChecks[j.id] || [] })), ...ws.jobs];
const findJob = (ws: Workspace, id: string) => allJobs(ws).find((j) => j.id === id);

function profileSummary(ws: Workspace) {
  const p = ws.profile;
  return [
    `Name: ${p.preferredName || p.name}`, `School: ${p.school}`, `Major: ${p.major}`, `Class year: ${p.classYear || classYearOf(ws)}`, `Graduation: ${p.graduation}`,
    `Location: ${p.location}`, `Wants opportunities in: ${p.regions}`, `Opportunity types wanted: ${p.opportunityTypes}`, `Target roles: ${p.targetRoles}`, `Goals: ${p.goals}`, `Interests: ${p.interests}`,
    `Skills found on resume: ${(ws.resume?.skills || []).join(", ")}`,
  ].filter((l) => !/:\s*$/.test(l)).join("\n");
}

function addFact(ws: Workspace, text: string, category: MemoryFact["category"], source: string, status: MemoryFact["status"]) {
  const t = text.trim();
  if (!t || ws.memory.some((m) => norm(m.text) === norm(t))) return false;
  ws.memory.push({ id: uid("f"), text: t.slice(0, 400), category, source, status, createdAt: nowIso(), updatedAt: nowIso() });
  return true;
}

// ---------- deterministic fit (server/fit.ts) ----------
const fitOf = (ws: Workspace, job: Job) => computeFit(ws, job, evidenceOf(ws));

// Openings that can't be applied to anymore. Checked on every read rather than cached in
// fits, because a deadline passes and a link breaks without the student doing anything.
const centralToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const catalogHealth = new Map<string, JobCheck>();
async function checkCatalogLinks() {
  for (const j of CATALOG) {
    const url = j.sourceUrl || j.applyUrl;
    if (!url) continue;
    try {
      const r = await fetchPublic(url);
      const closed = CLOSED_SIGNALS.test(htmlToText(r.html));
      catalogHealth.set(j.id, { at: nowIso(), httpStatus: r.status, result: r.status >= 400 ? "unreachable" : closed ? "closed-signal" : "reachable", note: `Checked automatically: HTTP ${r.status}` });
    } catch {
      // network hiccup: keep the previous result rather than calling a posting dead
    }
  }
}
function closedReason(ws: Workspace, job: Job): string | undefined {
  if (job.deadline && job.deadline < centralToday()) return `The deadline passed on ${job.deadline}.`;
  const latest = (ws.jobChecks[job.id] || job.checks || [])[0] || catalogHealth.get(job.id);
  if (latest?.result === "closed-signal") return "The posting page says applications are closed.";
  if (latest?.result === "unreachable" && (latest.httpStatus === 404 || latest.httpStatus === 410)) return `The posting link is gone (HTTP ${latest.httpStatus}).`;
  return undefined;
}
// Remy only recommends once it knows something about the student (resume, major or target roles).
const knowsStudent = (ws: Workspace) => !!(ws.resume || ws.profile.major.trim() || ws.profile.targetRoles.trim());
const NEEDS_PROFILE = "Tell Remy about yourself first: upload your resume or add your major and the roles you want (Account → Profile).";
const openJobs = (ws: Workspace) => allJobs(ws).filter((j) => !closedReason(ws, j) && !fitOf(ws, j).excluded);

// ---------- tailoring helpers ----------
const stripPlaceholders = (letter: string) =>
  letter.replace(/[ \t]*\[(?:PERSONALIZE|ADD|TODO|INSERT|YOUR|NAME|DATE|COMPANY|HIRING)[^\]]{0,120}\][ \t]*/gi, " ").replace(/ +([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+|[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
function composeResume(ws: Workspace, app: Application): ResumeDoc {
  const doc: ResumeDoc = JSON.parse(JSON.stringify(ws.resume!.doc));
  for (const c of app.changes) {
    if (c.status !== "accepted" && c.status !== "edited") continue;
    for (const s of doc.sections) for (const e of s.entries) for (const b of e.bullets) if (b.id === c.bulletId) b.text = c.status === "edited" ? c.edited || c.revised : c.revised;
  }
  return doc;
}
function fileBase(ws: Workspace, job: Job, doc: "Resume" | "Cover-Letter") {
  const n = (ws.profile.name || ws.resume?.doc.contact.name || "Student").replace(/[^A-Za-z]+/g, "-");
  return `${n}-${job.company.replace(/[^A-Za-z0-9]+/g, "-")}-${doc}`.replace(/-+/g, "-");
}
function entryContextOf(ws: Workspace, bulletId: string) {
  for (const s of ws.resume?.doc.sections || []) for (const e of s.entries) if (e.bullets.some((b) => b.id === bulletId)) return [e.org, e.role, ...e.bullets.map((b) => b.text)].join(" ");
  return "";
}
function changeFlags(ws: Workspace, c: BulletChange): ClaimFlag[] {
  if (c.confirmedTrue) return [];
  const text = c.status === "edited" ? c.edited || "" : c.revised;
  const job = ws.applications.flatMap((a) => (a.changes.includes(c) ? [findJob(ws, a.jobId)] : []))[0];
  return claimCheck(text, evidenceOf(ws), { original: c.original, entryContext: entryContextOf(ws, c.bulletId), postingText: job ? [job.summary, ...job.requirements.map((r) => r.quote)].join(" ") : "" });
}
function letterFlagsFor(ws: Workspace, app: Application, job: Job) {
  return claimCheck(app.letter, evidenceOf(ws), {
    allowedNames: [job.company, job.title, job.location, job.dates, ws.profile.school, ws.profile.name, ws.profile.preferredName, ws.profile.classYear, ...job.requirements.map((r) => r.keyword)].filter(Boolean),
    postingText: [job.summary, job.dates, job.deadlineText, ...job.requirements.map((r) => r.quote), ...job.eligibility].filter(Boolean).join("\n"),
    postingNumbersOk: true,
  });
}
function refreshAts(ws: Workspace, app: Application) {
  const job = findJob(ws, app.jobId);
  if (job && ws.resume) app.ats = atsChecks(composeResume(ws, app), job, fileBase(ws, job, "Resume"));
}

export async function registerRoutes(_server: Server, app: Express) {
  // Expired sessions and guest workspaces idle for 30 days are removed at start-up and every 6 hours.
  const sweep = () => { try { const n = cleanupOld(30); if (n) console.log(`cleanup: removed ${n} idle guest accounts`); } catch (e: any) { console.error("cleanup failed", e?.message); } };
  sweep();
  checkCatalogLinks().catch(() => {});
  setInterval(() => checkCatalogLinks().catch(() => {}), 12 * 60 * 60_000).unref();
  setInterval(sweep, 6 * 60 * 60_000).unref();

  // ---------- config + identity ----------
  app.get("/api/config", async (req, res) => {
    const host = String(req.headers.host || "");
    const sb = supabaseConfig();
    const cfg: AppConfig = {
      googleClientId: googleClientId(),
      ai: aiStatus(),
      hosting: /localhost|127\.0\.0\.1/.test(host) ? "local" : req.header("x-visitor-id") ? "preview" : "published",
      today: new Date().toISOString().slice(0, 10),
      supabase: sb ? { ...sb, providers: await supabaseProviders() } : null,
    };
    res.json(cfg);
  });

  // Browser errors reported by the client's error boundary, so crashes on the live
  // site show up in the host's logs. Capped per process to keep logs readable.
  let clientErrors = 0;
  app.post("/api/client-error", (req, res) => {
    // Per-network limit so one visitor can't flood the log and bury real errors.
    if (allow("client-error:" + clientIp(req), 20, 10 * 60_000) && clientErrors++ < 500) {
      const b = req.body || {};
      console.error("client error", JSON.stringify({ where: String(b.where || "").slice(0, 80), message: String(b.message || "").slice(0, 500), url: String(b.url || "").slice(0, 200), stack: String(b.stack || "").slice(0, 1500) }));
    }
    res.json({ ok: true });
  });

  app.get("/api/me", (req, res) => {
    const me = identify(req);
    if (!me) return res.json({ me: null, workspace: null });
    res.json({ me, workspace: loadWorkspace(me.id) });
  });

  app.post("/api/auth/guest", route(async (_req, res, ctx) => {
    if (!ctx.ws.started) {
      ctx.ws.started = true;
      ctx.save();
    }
    res.json({ me: ctx.me, workspace: ctx.ws });
  }, { create: true }));

  app.post("/api/auth/google", async (req, res) => {
    try {
      const prev = identify(req);
      const me = await verifyGoogle(String(req.body?.credential || ""));
      // carry an in-progress demo workspace into a brand-new Google account
      if (!hasWorkspace(me.id) && prev && prev.id !== me.id && hasWorkspace(prev.id)) {
        saveWorkspace(me.id, loadWorkspace(prev.id));
      }
      const ws = loadWorkspace(me.id);
      ws.started = true;
      if (!ws.profile.name) ws.profile.name = me.name;
      if (!ws.profile.email) ws.profile.email = me.email;
      if (!ws.profile.applicationEmail) ws.profile.applicationEmail = me.email;
      saveWorkspace(me.id, ws);
      startSession(res, me.id);
      res.json({ me, workspace: ws });
    } catch (e: any) {
      res.status(e?.status || 401).json({ message: e?.message || "Google sign-in failed." });
    }
  });

  app.post("/api/auth/supabase", async (req, res) => {
    try {
      const prev = identify(req);
      const u = await verifySupabase(String(req.body?.accessToken || ""));
      const me: Me = { id: "sb:" + u.id, kind: "supabase", email: u.email, name: u.name, picture: u.picture };
      ensureUser(me);
      // carry an in-progress guest workspace into a brand-new account
      if (!hasWorkspace(me.id) && prev && prev.id !== me.id && hasWorkspace(prev.id)) saveWorkspace(me.id, loadWorkspace(prev.id));
      const ws = loadWorkspace(me.id);
      ws.started = true;
      if (!ws.profile.name) ws.profile.name = u.name;
      if (!ws.profile.email) ws.profile.email = u.email;
      if (!ws.profile.applicationEmail) ws.profile.applicationEmail = u.email;
      saveWorkspace(me.id, ws);
      startSession(res, me.id);
      res.json({ me, workspace: ws });
    } catch (e: any) {
      res.status(e?.status || 401).json({ message: e?.message || "Sign-in failed." });
    }
  });

  // LinkedIn as a connector: the student approves on LinkedIn (via Supabase's
  // LinkedIn OIDC provider). OIDC only shares name, email and photo, not work history.
  app.post("/api/connect/linkedin", route(async (req, res, ctx) => {
    const u = await verifySupabase(String(req.body?.accessToken || ""));
    if (u.provider && u.provider !== "linkedin_oidc") bad("That consent wasn't from LinkedIn.");
    ctx.ws.imports = ctx.ws.imports.filter((i) => i.kind !== "LinkedIn (connected)");
    ctx.ws.imports.unshift({ id: uid("i"), kind: "LinkedIn (connected)", fileName: [u.name, u.email].filter(Boolean).join(" · ") || "LinkedIn account", at: nowIso(), label: "Live", factsAdded: 0 });
    if (!ctx.ws.profile.name && u.name) ctx.ws.profile.name = u.name;
    ctx.save();
    res.json(ctx.ws);
  }));

  app.post("/api/auth/logout", (req, res) => {
    endSession(req, res);
    res.json({ ok: true });
  });

  // ---------- simple app-owned sections ----------
  const SECTIONS = ["profile", "settings", "tasks", "calendar", "tracker", "savedJobIds", "hiddenJobIds", "memory", "outreach", "onboarding", "started", "plan", "contacts"] as const;
  // The shape each section must have, so one malformed save can't break later requests.
  // Objects keep unknown extra fields (loose) but every field the server relies on is checked.
  const str = (max = 600) => z.string().max(max);
  const ids = z.array(str(120)).max(1000);
  const TRACK = z.enum(["Saved", "Applied", "Received", "Interview", "Offer", "Rejected", "Withdrawn"]);
  const SHAPES: Partial<Record<(typeof SECTIONS)[number], z.ZodType>> = {
    profile: z.looseObject({}),
    settings: z.object({
      theme: z.enum(["light", "dark"]).optional(), assistantOpen: z.boolean().optional(), navCollapsed: z.boolean().optional(),
      notify: z.object({ deadlines: z.boolean(), statusChanges: z.boolean(), weeklyPlan: z.boolean() }).partial().optional(),
      demoConnections: z.array(str(80)).max(20).optional(),
    }),
    tasks: z.array(z.looseObject({ id: str(120), title: str(300), why: str(2000), due: str(10), category: z.enum(["Explore", "Prepare", "Apply", "Connect", "Academic"]), done: z.boolean(), source: str(200), link: str(500).optional() })).max(500),
    calendar: z.array(z.looseObject({ id: str(120), title: str(300), date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/), time: z.string().regex(/^(\d{2}:\d{2})?$/), kind: z.enum(["Deadline", "Event", "Task", "Interview", "Advising"]), source: str(200), linkedId: str(120).optional(), notes: str(4000).optional() })).max(1000),
    tracker: z.array(z.looseObject({ id: str(120), company: str(200), role: str(300), jobId: str(120).optional(), applicationId: str(120).optional(), status: TRACK, notes: str(4000), events: z.array(z.looseObject({ id: str(120), at: str(40), status: TRACK, source: str(300), evidence: str(2000).optional() })).max(200) })).max(500),
    savedJobIds: ids,
    hiddenJobIds: ids,
    memory: z.array(z.looseObject({ id: str(120).optional(), text: str(2000) })).max(300),
    outreach: z.array(z.looseObject({ id: str(120), contactId: str(120), to: str(320), subject: str(300), body: str(8000), linkedin: str(400).optional(), status: z.enum(["draft", "approved", "handed-off"]), createdAt: str(40) })).max(500),
    onboarding: z.object({ step: z.number().int().min(0).max(50), done: z.boolean(), answers: z.array(z.object({ q: str(500), a: str(2000) })).max(50), questions: z.array(str(500)).max(20) }),
    started: z.boolean(),
    plan: z.looseObject({ nextAction: z.looseObject({ title: str(300), why: str(2000), link: str(300) }), careers: z.array(z.looseObject({ id: str(120), title: str(300) })).max(20), skills: z.array(z.looseObject({ id: str(120), name: str(300) })).max(30), academic: z.array(z.looseObject({ id: str(120), term: str(100) })).max(20) }),
    contacts: z.array(z.looseObject({ id: str(120), name: str(200), title: str(300), org: str(300), email: str(320), why: str(2000), tags: z.array(str(120)).max(30), label: str(40) })).max(1000),
  };
  app.put("/api/ws/:section", route((req, res, ctx) => {
    const section = req.params.section as (typeof SECTIONS)[number];
    if (!SECTIONS.includes(section)) bad("Unknown section");
    let value = req.body?.value;
    if (value === undefined) bad("Missing value");
    if (JSON.stringify(value).length > 400_000) bad("That's too much data for one update.", 413);
    const checked = SHAPES[section]!.safeParse(value);
    if (!checked.success) {
      const i = checked.error.issues[0];
      bad(`That ${section} update wasn't saved: ${[section, ...i.path].join(".")} — ${i.message}.`);
    }
    value = checked.data;
    if (section === "profile") {
      const before = JSON.stringify(ctx.ws.profile);
      const p = { ...ctx.ws.profile };
      for (const k of Object.keys(p) as (keyof typeof p)[]) if (typeof value[k] === "string") p[k] = value[k].slice(0, 600);
      ctx.ws.profile = p;
      if (before !== JSON.stringify(p)) {
        for (const a of ctx.ws.applications)
          if (a.versions.length) a.staleReason = `Your profile changed on ${new Date().toLocaleDateString("en-US")}. This approved version was not changed — review whether it still fits.`;
        for (const j of allJobs(ctx.ws)) if (ctx.ws.fits[j.id]?.by === "rules") delete ctx.ws.fits[j.id];
      }
    } else if (section === "memory") {
      if (!Array.isArray(value)) bad("Memory must be a list");
      ctx.ws.memory = value.slice(0, 300).map((m: any): MemoryFact => ({
        id: String(m.id || uid("f")), text: String(m.text || "").slice(0, 400), category: m.category || "other", source: String(m.source || "Edited by student"),
        status: (m.status === "suggested" ? "suggested" : "approved") as MemoryFact["status"], createdAt: m.createdAt || nowIso(), updatedAt: nowIso(),
      })).filter((m: MemoryFact) => m.text.trim());
    } else if (section === "settings") {
      ctx.ws.settings = { ...ctx.ws.settings, ...value, notify: { ...ctx.ws.settings.notify, ...(value.notify || {}) } };
    } else {
      (ctx.ws as any)[section] = value;
    }
    ctx.save();
    res.json(ctx.ws);
  }));

  // One to-do at a time, so two quick clicks can't undo each other.
  app.patch("/api/tasks/:id", route((req, res, ctx) => {
    const t = ctx.ws.tasks.find((x) => x.id === req.params.id);
    if (!t) bad("That to-do isn't there anymore.", 404);
    if (typeof req.body?.done !== "boolean") bad("Send done: true or false.");
    t!.done = req.body.done;
    ctx.save();
    res.json(ctx.ws);
  }));

  // ---------- resume ----------
  async function ingestResume(ctx: Ctx, raw: string, fileName: string) {
    if (raw.replace(/\s/g, "").length < 200) bad("We couldn't read enough text from that file. If it's a scanned image, export a text-based PDF or upload a .docx.");
    let doc: ResumeDoc;
    let parsedBy: "ai" | "rules" = "rules";
    if (aiStatus().available) {
      try {
        doc = await withAi(ctx, "Parse resume", () => aiParseResume(raw));
        parsedBy = "ai";
      } catch {
        doc = rulesParse(raw);
      }
    } else doc = rulesParse(raw);
    ctx.ws.resume = { fileName, uploadedAt: nowIso(), rawText: raw.slice(0, 30000), parsedBy, doc, skills: extractSkills(doc, raw) };
    ctx.ws.imports.unshift({ id: uid("i"), kind: "Resume", fileName, at: nowIso(), label: "Student provided", factsAdded: 0 });
    // prefill only empty profile fields
    const p = ctx.ws.profile;
    const edu = doc.sections.find((s) => /educ/i.test(s.heading))?.entries[0];
    if (!p.name && doc.contact.name) p.name = doc.contact.name;
    if (!p.email && doc.contact.email && !/example\.com/.test(doc.contact.email)) p.email = doc.contact.email;
    if (!p.location && doc.contact.location) p.location = doc.contact.location;
    if (edu) {
      if (!p.school) p.school = edu.org;
      if (!p.major) p.major = edu.role.split("|")[0].trim();
      if (!p.graduation) p.graduation = edu.dates.replace(/expected( graduation)?:?\s*/i, "").trim();
    }
    // Class standing: stated on the resume, or worked out from the graduation date.
    if (!p.classYear) p.classYear = classYearOf(ctx.ws);
    for (const a of ctx.ws.applications) if (a.versions.length) a.staleReason = "You uploaded a new base resume. Approved versions were kept as they were — regenerate if you want them to use the new resume.";
    ctx.ws.fits = {};
    ctx.save();
  }

  app.post("/api/resume/upload", uploadFile, route(async (req, res, ctx) => {
    const f = (req as any).file as Express.Multer.File | undefined;
    if (!f) bad("Choose a file to upload.");
    const raw = await fileToText(f!.buffer, f!.originalname, f!.mimetype);
    await ingestResume(ctx, raw, f!.originalname);
    const mime = /\.pdf$/i.test(f!.originalname) ? "application/pdf" : /\.docx$/i.test(f!.originalname) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain; charset=utf-8";
    saveFile(ctx.me.id, "resume", f!.originalname, mime, f!.buffer);
    ctx.ws.resume!.original = { name: f!.originalname, mime, size: f!.size };
    ctx.save();
    res.json(ctx.ws);
  }));

  // The exact file the student uploaded (inline, so a PDF previews in the browser).
  app.get("/api/resume/original", route((req, res, ctx) => {
    const f = getFile(ctx.me.id, "resume");
    if (!f || !ctx.ws.resume?.original) bad("No uploaded file is stored — this resume was pasted or is the sample.", 404);
    res.setHeader("Content-Type", f!.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${f!.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120)}"`);
    res.send(f!.data);
  }));

  // ATS readiness score with a breakdown. ?app=<id> scores that tailored version
  // against its posting (and returns the base score for comparison).
  app.get("/api/resume/ats", route((req, res, ctx) => {
    if (!ctx.ws.resume) bad("Upload a resume first.");
    const appId = String(req.query.app || "");
    const a = appId ? ctx.ws.applications.find((x) => x.id === appId) : undefined;
    const job = a ? findJob(ctx.ws, a.jobId) : undefined;
    if (a && job) {
      const kws = job.requirements.map((r) => r.keyword);
      res.json({
        tailored: atsScore(composeResume(ctx.ws, a), kws, `in the ${job.company} posting`),
        base: atsScore(ctx.ws.resume!.doc, kws, `in the ${job.company} posting`),
      });
      return;
    }
    const top = openJobs(ctx.ws)
      .filter((j) => !ctx.ws.fits[j.id]?.excluded)
      .sort((x, y) => (ctx.ws.fits[y.id]?.score ?? 0) - (ctx.ws.fits[x.id]?.score ?? 0))
      .slice(0, 5);
    res.json({ base: atsScore(ctx.ws.resume!.doc, keywordsFrom(top), "from your top openings") });
  }));

  // The base resume as Remy reads it (including the student's edits), as a clean PDF or Word file.
  app.get("/api/resume/export", route(async (req, res, ctx) => {
    if (!ctx.ws.resume) bad("Upload a resume first.");
    const fmt = req.query.format === "docx" ? "docx" : "pdf";
    const doc = ctx.ws.resume!.doc;
    const buf = fmt === "pdf" ? await resumePdf(doc) : await resumeDocx(doc);
    const name = (ctx.ws.profile.name || doc.contact.name || "Resume").replace(/[^A-Za-z]+/g, "-") + "-Resume";
    res.setHeader("Content-Type", fmt === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.${fmt}"`);
    res.send(buf);
  }));

  app.post("/api/resume/text", route(async (req, res, ctx) => {
    const raw = String(req.body?.text || "");
    await ingestResume(ctx, raw, "Pasted resume text");
    res.json(ctx.ws);
  }));

  app.post("/api/resume/sample", route(async (_req, res, ctx) => {
    const p = path.resolve(process.cwd(), "server", "sample-resume.txt");
    const raw = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
    if (!raw) bad("Sample resume is missing on this server.", 500);
    await ingestResume(ctx, raw, "Sample: Dilandimel Desman (shared with consent, contact details removed)");
    res.json(ctx.ws);
  }));

  app.put("/api/resume/doc", route((req, res, ctx) => {
    if (!ctx.ws.resume) bad("Upload a resume first.");
    const d = req.body?.doc as ResumeDoc;
    if (!d || !Array.isArray(d.sections)) bad("Invalid resume");
    ctx.ws.resume!.doc = d;
    ctx.ws.resume!.confirmedAt = req.body?.confirm ? nowIso() : ctx.ws.resume!.confirmedAt;
    // Student edits are the student's own words and already count as evidence through
    // the edited doc (evidenceOf), so the original upload text stays as it was. The
    // slice also shrinks accounts that grew under the old append-on-every-save code.
    ctx.ws.resume!.rawText = ctx.ws.resume!.rawText.slice(0, 30000);
    ctx.ws.fits = {};
    ctx.save();
    res.json(ctx.ws);
  }));

  // ---------- other profile imports (LinkedIn PDF, Handshake/Stellic text, etc.) ----------
  app.post("/api/import/profile", uploadFile, route(async (req, res, ctx) => {
    const kind = String(req.body?.kind || "Other");
    const f = (req as any).file as Express.Multer.File | undefined;
    const raw = f ? await fileToText(f.buffer, f.originalname, f.mimetype) : String(req.body?.text || "");
    if (raw.trim().length < 40) bad("Add a file or paste at least a few lines of profile text.");
    const out = await withAi(ctx, `Import ${kind}`, () =>
      aiJson<{ facts: { text: string; category: MemoryFact["category"]; quote: string }[] }>(
        "You extract factual statements about a student from their own exported profile text. Only include facts stated in the text. Keep each fact short and specific. Include a verbatim supporting quote.",
        `Source: ${kind}\nReturn {"facts":[{"text":"","category":"background|goal|preference|skill|experience|constraint|other","quote":"exact words"}]} with at most 15 facts.\n\nTEXT:\n"""${raw.slice(0, 12000)}"""`,
      ),
    );
    const n = norm(raw);
    let added = 0;
    for (const f2 of out.facts || []) {
      if (f2.quote && !n.includes(norm(f2.quote).slice(0, 80))) continue; // drop anything not grounded in the text
      if (addFact(ctx.ws, f2.text, f2.category || "other", `${kind} import`, "suggested")) added++;
    }
    ctx.ws.imports.unshift({ id: uid("i"), kind, fileName: f?.originalname || "Pasted text", at: nowIso(), label: "Student provided", factsAdded: added });
    ctx.save();
    res.json({ workspace: ctx.ws, added });
  }));

  // ---------- AI: onboarding questions + plan ----------
  app.post("/api/ai/questions", route(async (_req, res, ctx) => {
    const out = await withAi(ctx, "Onboarding questions", () =>
      aiJson<{ questions: string[] }>(
        "You are Remy, a friendly career companion for university students. Ask short, warm, specific follow-up questions that fill the most important gaps for planning. One idea per question. No yes/no questions.",
        `Student profile:\n${profileSummary(ctx.ws)}\n\nResume headings and roles:\n${ctx.ws.resume ? ctx.ws.resume.doc.sections.map((s) => s.heading + ": " + s.entries.map((e) => e.role || e.org).join("; ")).join("\n") : "(no resume yet)"}\n\nApproved facts:\n${approvedFacts(ctx.ws).join("\n") || "(none)"}\n\nReturn {"questions":["","",""]} with exactly 3 questions.`,
        800,
      ),
    );
    ctx.ws.onboarding.questions = (out.questions || []).slice(0, 3).map(String);
    ctx.save();
    res.json(ctx.ws);
  }));

  app.post("/api/ai/plan", route(async (_req, res, ctx) => {
    if (!knowsStudent(ctx.ws)) bad(NEEDS_PROFILE, 409);
    const today = new Date().toISOString().slice(0, 10);
    const jobs = openJobs(ctx.ws).map((j) => `${j.id}: ${j.company} — ${j.title} (deadline ${j.deadline || "n/a"})`).join("\n");
    const out = await withAi(ctx, "Initial plan", () =>
      aiJson<any>(
        `You are Remy, a truthful career companion for a university student. Base every suggestion on the student's real background. Never invent university requirements, official certifications, or guarantees. Mark anything the student must verify (with an advisor, the registrar, or the official catalog) in "verify". Today is ${today}.`,
        `PROFILE:\n${profileSummary(ctx.ws)}\n\nRESUME:\n${ctx.ws.resume ? resumeToText(ctx.ws.resume.doc).slice(0, 6000) : "(none)"}\n\nAPPROVED FACTS:\n${approvedFacts(ctx.ws).join("\n") || "(none)"}\n\nONBOARDING ANSWERS:\n${ctx.ws.onboarding.answers.map((a) => a.q + " → " + a.a).join("\n") || "(none)"}\n\nKNOWN OPENINGS (id: description):\n${jobs}\n
Return JSON:
{"nextAction":{"title":"","why":"","link":"/resume|/opportunities|/path|/community|/calendar"},
 "tasks":[{"title":"","why":"one sentence tied to their background","due":"YYYY-MM-DD or empty","category":"Explore|Prepare|Apply|Connect|Academic","link":"/opportunities?kind=program etc or empty"}],
 "careers":[{"title":"","what":"2 sentences on what the work is","fit":["evidence from their resume"],"gaps":["honest gap"],"steps":["practical next step"]}],
 "skills":[{"name":"","type":"skill|certification|course","why":"","verify":"what to verify and where, or 'Illustrative suggestion'"}],
 "academic":[{"term":"e.g. Spring 2027","items":["planning idea"],"note":"Illustrative — confirm with your academic advisor and the official degree plan."}]}
Give 5 tasks (use real deadlines from KNOWN OPENINGS when relevant), 3 careers, 5 skills, 2 academic terms.`,
        3500,
      ),
    );
    const tasks = (out.tasks || []).slice(0, 8).map((t: any) => ({
      id: uid("t"), title: String(t.title || ""), why: String(t.why || ""), due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || "") ? t.due : "",
      category: ["Explore", "Prepare", "Apply", "Connect", "Academic"].includes(t.category) ? t.category : "Prepare",
      done: false, source: "AI plan (review)", link: String(t.link || ""),
    }));
    ctx.ws.tasks = [...ctx.ws.tasks.filter((t) => t.source !== "AI plan (review)" || t.done), ...tasks];
    ctx.ws.plan = {
      generatedAt: nowIso(), generatedBy: lastUsedModel(),
      nextAction: { title: String(out.nextAction?.title || "Tailor your resume for your strongest opening"), why: String(out.nextAction?.why || ""), link: String(out.nextAction?.link || "/resume") },
      careers: (out.careers || []).slice(0, 4).map((c: any) => ({ id: uid("cp"), title: String(c.title), what: String(c.what || ""), fit: (c.fit || []).map(String), gaps: (c.gaps || []).map(String), steps: (c.steps || []).map(String) })),
      skills: (out.skills || []).slice(0, 8).map((s: any) => ({ id: uid("sk"), name: String(s.name), type: ["skill", "certification", "course"].includes(s.type) ? s.type : "skill", why: String(s.why || ""), verify: String(s.verify || "Illustrative suggestion") })),
      academic: (out.academic || []).slice(0, 4).map((a: any) => ({ id: uid("ac"), term: String(a.term), items: (a.items || []).map(String), note: String(a.note || "Illustrative — confirm with your academic advisor.") })),
      chosenCareerId: ctx.ws.plan?.chosenCareerId,
    };
    ctx.save();
    res.json(ctx.ws);
  }));

  // ---------- assistant chat ----------
  app.post("/api/ai/chat", route(async (req, res, ctx) => {
    const message = String(req.body?.message || "").slice(0, 2000).trim();
    const page = String(req.body?.page || "home");
    if (!message) bad("Type a message first.");
    const history = ctx.ws.chat.slice(-8).map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.text}`).join("\n");
    const apps = ctx.ws.applications.map((a) => { const j = findJob(ctx.ws, a.jobId); return `${j?.company} ${j?.title}: ${a.versions.length ? "approved v" + a.versions.length : a.generatedAt ? "draft" : "not started"}`; }).join("; ");
    const out = await withAi(ctx, "Assistant chat", () =>
      aiJson<{ reply: string; remember: string[] }>(
        `You are Remy, a friendly fox career coach for university students. Be concise (under 140 words), warm, practical and honest. Use only facts you are given; if you don't know something (like a specific university rule), say so and suggest who to ask. Never claim to have sent emails, applied, or changed calendars — you can only suggest. If the student shares a durable fact or preference worth remembering, propose it in "remember" (short third-person statements); otherwise return an empty list.`,
        `Current page: ${page}\nPROFILE:\n${profileSummary(ctx.ws)}\nAPPROVED MEMORY:\n${approvedFacts(ctx.ws).slice(0, 40).join("\n") || "(none)"}\nRESUME: ${ctx.ws.resume ? ctx.ws.resume.doc.sections.map((s) => s.heading + ": " + s.entries.map((e) => [e.role, e.org].filter(Boolean).join(" at ")).join("; ")).join(" | ") : "(not uploaded)"}\nAPPLICATIONS: ${apps || "(none)"}\nSAVED OPENINGS: ${ctx.ws.savedJobIds.map((id) => findJob(ctx.ws, id)?.title).filter(Boolean).join("; ") || "(none)"}\n\nRECENT CHAT:\n${history}\n\nStudent: ${message}\n\nReturn {"reply":"","remember":[]}`,
        900,
      ),
    );
    ctx.ws.chat.push({ id: uid("m"), role: "user", text: message, at: nowIso(), page });
    ctx.ws.chat.push({ id: uid("m"), role: "assistant", text: String(out.reply || "Sorry — I couldn't form a reply."), at: nowIso(), page, memorySuggestions: (out.remember || []).slice(0, 3).map(String) });
    ctx.save();
    res.json(ctx.ws);
  }));

  app.post("/api/memory/remember", route((req, res, ctx) => {
    const text = String(req.body?.text || "");
    addFact(ctx.ws, text, "other", "Assistant chat (approved by student)", "approved");
    ctx.save();
    res.json(ctx.ws);
  }));

  // ---------- opportunities ----------
  app.get("/api/jobs", route((_req, res, ctx) => {
    if (!knowsStudent(ctx.ws)) return res.json({ jobs: [], fits: {}, needsProfile: NEEDS_PROFILE });
    let changed = false;
    const jobs = allJobs(ctx.ws).map((j) => {
      const f = ctx.ws.fits[j.id];
      if (!f || (f.by === "rules" && f.score === undefined)) {
        ctx.ws.fits[j.id] = fitOf(ctx.ws, j);
        changed = true;
      }
      return j;
    });
    if (changed) ctx.save();
    const fits: Record<string, JobFit> = {};
    for (const j of jobs) {
      const closed = closedReason(ctx.ws, j);
      fits[j.id] = closed ? { ...ctx.ws.fits[j.id], closed, excluded: true, score: 0, eligibilityNote: closed } : ctx.ws.fits[j.id];
    }
    res.json({ jobs, fits });
  }));

  app.post("/api/jobs/import", route(async (req, res, ctx) => {
    const url = String(req.body?.url || "").trim();
    let text = String(req.body?.text || "").trim();
    let finalUrl = url;
    let status: number | null = null;
    if (!text) {
      if (!url) bad("Paste a public posting link or the posting text.");
      fetchAllowed(ctx);
      const r = await fetchPublic(url);
      status = r.status;
      finalUrl = r.finalUrl || url;
      if (r.status >= 400) bad(`The page returned HTTP ${r.status}. Open it in your browser and paste the posting text instead.`, 422);
      text = htmlToText(r.html);
      if (text.length < 400)
        return res.status(422).json({ message: "This page loads its content with JavaScript or needs a login, so Remy couldn't read it. Paste the posting text instead.", code: "needs-text" });
    }
    if (text.length < 150) bad("That posting text is too short to analyze.");
    const x = await withAi(ctx, "Import posting", () => aiExtractPosting(text));
    const closed = CLOSED_SIGNALS.test(text);
    const job: Job = {
      id: uid("job"), kind: x.kind as Job["kind"], title: x.title, company: x.company, location: x.location, format: x.format, dates: x.dates,
      deadline: x.deadline, deadlineText: x.deadlineText, eligibility: x.eligibility, requirements: x.requirements, summary: x.summary,
      applyUrl: url ? finalUrl : "", sourceUrl: url ? finalUrl : "", sourceName: url ? new URL(finalUrl).hostname : "Pasted by student",
      label: url ? "Live" : "Student provided", checkedAt: nowIso().slice(0, 10),
      checks: url ? [{ at: nowIso(), httpStatus: status, result: closed ? "closed-signal" : "reachable", note: closed ? "Page text suggests applications are closed." : "Page was readable when imported." }] : [],
      origin: "imported", postingText: text.slice(0, 15000),
    };
    if (!job.requirements.length) bad("The AI couldn't find requirements quoted from this posting. Try pasting the full posting text.", 422);
    ctx.ws.jobs.unshift(job);
    ctx.ws.fits[job.id] = fitOf(ctx.ws, job);
    if (!ctx.ws.savedJobIds.includes(job.id)) ctx.ws.savedJobIds.push(job.id);
    ctx.save();
    res.json({ job, workspace: ctx.ws, droppedQuotes: x.droppedQuotes });
  }));

  // Live openings from employers' public job boards, picked for this student.
  app.post("/api/jobs/discover", route(async (req, res, ctx) => {
    if (!knowsStudent(ctx.ws)) bad(NEEDS_PROFILE, 409);
    fetchAllowed(ctx);
    const named: string[] = (Array.isArray(req.body?.companies) ? req.body.companies : []).map(String).map((x: string) => x.trim()).filter(Boolean).slice(0, 10);
    // Which employers to read: the AI picks from the directory for this student's profile;
    // without AI, employers whose fields match the student's are used.
    const p = ctx.ws.profile;
    const wants = [p.targetRoles, p.major, p.interests].join(" ").toLowerCase();
    let picked = EMPLOYERS.filter((e) => (e.fields || []).some((f) => wants.includes(f) || FIELD_TITLES.some(([field, title]) => field.test(wants) && title.test(f))));
    if (!named.length && aiStatus().available) {
      try {
        const out = await withAi(ctx, "Pick employers", () =>
          aiJson<{ companies: string[] }>(
            "You pick employers for a university student's early-career search, only from the list given. Choose employers that hire for the student's fields and are realistic for their level and location.",
            `STUDENT:\n${profileSummary(ctx.ws)}\n\nEMPLOYERS (name — fields):\n${EMPLOYERS.map((e) => `${e.company} — ${(e.fields || []).join(", ")}`).join("\n")}\n\nReturn {"companies":["exact name from the list", ...]} with up to 15 names.`,
            600,
          ),
        );
        const names = new Set((out.companies || []).map((x) => String(x).toLowerCase()));
        const ai = EMPLOYERS.filter((e) => names.has(e.company.toLowerCase()));
        if (ai.length) picked = ai;
      } catch {}
    }
    if (!picked.length) picked = EMPLOYERS;
    const boards = [...named.flatMap(boardsFor), ...picked.slice(0, 15)];
    const seen = new Set<string>();
    const unique = boards.filter((b) => { const k = b.ats + ":" + b.slug; if (seen.has(k)) return false; seen.add(k); return true; });
    const r = await discoverJobs(ctx.ws, unique);
    console.log(`discover: read ${r.reached}/${unique.length} (${unique.map((b) => b.company).join(", ")}), added ${r.jobs.length}`);
    ctx.ws.jobs.unshift(...r.jobs);
    for (const j of r.jobs) ctx.ws.fits[j.id] = fitOf(ctx.ws, j);
    ctx.save();
    res.json({ added: r.jobs.length, reached: r.reached, scanned: unique.length, workspace: ctx.ws });
  }));

  app.post("/api/jobs/:id/check", route(async (req, res, ctx) => {
    const job = findJob(ctx.ws, String(req.params.id));
    if (!job) bad("Opening not found", 404);
    const url = job!.sourceUrl || job!.applyUrl;
    if (!url) bad("This opening has no link to check.");
    let check;
    try {
      fetchAllowed(ctx);
      const r = await fetchPublic(url);
      const text = htmlToText(r.html);
      const closed = CLOSED_SIGNALS.test(text);
      check = {
        at: nowIso(), httpStatus: r.status,
        result: (r.status >= 400 ? "unreachable" : closed ? "closed-signal" : "reachable") as "reachable" | "closed-signal" | "unreachable",
        note: r.status >= 400 ? `HTTP ${r.status}` : closed ? "The page text suggests applications are closed." : "Page reachable; no 'closed' wording detected. Still confirm the deadline on the page.",
      };
    } catch (e: any) {
      check = { at: nowIso(), httpStatus: null, result: "unreachable" as const, note: e?.message || "Could not reach the page." };
    }
    if (job!.origin === "verified-catalog") (ctx.ws.jobChecks[job!.id] ||= []).unshift(check);
    else {
      const j = ctx.ws.jobs.find((x) => x.id === job!.id)!;
      j.checks.unshift(check);
    }
    ctx.save();
    res.json({ check, workspace: ctx.ws });
  }));

  app.post("/api/jobs/:id/fit", route(async (req, res, ctx) => {
    const job = findJob(ctx.ws, String(req.params.id));
    if (!job) bad("Opening not found", 404);
    const base = fitOf(ctx.ws, job!);
    const out = await withAi(ctx, "Explain fit", () =>
      aiJson<{ why: string; matched: string[]; gaps: string[] }>(
        "You are Remy, a friendly career coach. Explain honestly how the student's real background relates to an opening, speaking directly to them as \"you\" — like a mentor who's on their side, never in the third person. Cite only evidence that is in the resume or approved facts. Be specific and brief.",
        `OPENING: ${job!.company} — ${job!.title}\nREQUIREMENTS:\n${job!.requirements.map((r) => "- " + r.quote).join("\n")}\nELIGIBILITY:\n${job!.eligibility.join("\n")}\n\nRESUME:\n${ctx.ws.resume ? resumeToText(ctx.ws.resume.doc).slice(0, 6000) : "(none)"}\nFACTS:\n${approvedFacts(ctx.ws).join("\n")}\n\nReturn {"why":"2 sentences addressed to the student as 'you'","matched":["requirement → your evidence"],"gaps":["honest gap + one way you could address it"]}`,
        900,
      ),
    );
    ctx.ws.fits[job!.id] = { ...base, by: "ai", why: String(out.why || base.why), matched: (out.matched || []).map(String), gaps: (out.gaps || []).map(String) };
    ctx.save();
    res.json(ctx.ws.fits[job!.id]);
  }));

  app.delete("/api/jobs/:id", route((req, res, ctx) => {
    ctx.ws.jobs = ctx.ws.jobs.filter((j) => j.id !== req.params.id);
    ctx.save();
    res.json(ctx.ws);
  }));

  // ---------- applications (tailored resume + cover letter) ----------
  app.post("/api/applications", route((req, res, ctx) => {
    const jobId = String(req.body?.jobId || "");
    if (!findJob(ctx.ws, jobId)) bad("Opening not found", 404);
    let a = ctx.ws.applications.find((x) => x.jobId === jobId);
    if (!a) {
      a = { id: uid("app"), jobId, createdAt: nowIso(), gaps: [], changes: [], letter: "", letterFlags: [], letterApproved: false, personalize: [], ats: [], versions: [] };
      ctx.ws.applications.unshift(a);
      if (!ctx.ws.savedJobIds.includes(jobId)) ctx.ws.savedJobIds.push(jobId);
      ctx.save();
    }
    res.json({ application: a, workspace: ctx.ws });
  }));

  const getApp = (ctx: Ctx, id: string) => {
    const a = ctx.ws.applications.find((x) => x.id === id);
    if (!a) bad("Application not found", 404);
    return a!;
  };

  app.post("/api/applications/:id/generate", route(async (req, res, ctx) => {
    const a = getApp(ctx, String(req.params.id));
    const job = findJob(ctx.ws, a.jobId)!;
    if (!ctx.ws.resume) bad("Upload your base resume first.");
    // Answers the student gave Remy before/while tailoring become approved facts,
    // so the letter can use them and the claim checker treats them as evidence.
    const answers = (Array.isArray(req.body?.answers) ? req.body.answers : []).map((x: any) => ({ q: String(x?.q || "").slice(0, 200), a: String(x?.a || "").trim().slice(0, 800) })).filter((x: any) => x.a);
    for (const x of answers) addFact(ctx.ws, `${x.q} — ${x.a}`, "goal", `Told Remy while tailoring for ${job.company}`, "approved");
    const bullets = ctx.ws.resume!.doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => ({ id: b.id, where: `${s.heading} › ${[e.role, e.org].filter(Boolean).join(", ")}`, text: b.text }))));
    const out = await withAi(ctx, `Tailor for ${job.company}`, () =>
      aiJson<any>(
        `You tailor a student's EXISTING resume and write a cover letter for one opening. ABSOLUTE RULES:
- Never invent or inflate experience, titles, employers, dates, numbers, tools, skills, certifications or outcomes.
- A revised bullet may only reword, reorder or emphasize facts already in THAT bullet. You may adopt the posting's vocabulary only when it truthfully describes the same activity.
- Do not add numbers that are not in the original bullet.
- Do not add purpose or outcome clauses (e.g. "ensuring…", "to keep…", "resulting in…") unless the original bullet states that outcome.
- Do not state the student's class standing (freshman/sophomore/first-year etc.) unless it is given in the profile.
- Choose only material changes (at most 6). Leave strong bullets alone.
- The cover letter may only use facts from the resume, approved facts and the student's own answers. Write it complete and ready to send, using the student's answers for motivation and personal details. Never use placeholders or brackets of any kind; if a detail is unknown, leave it out.`,
        `OPENING: ${job.company} — ${job.title}
LOCATION/FORMAT: ${job.location} · ${job.format}
SUMMARY: ${job.summary}
REQUIREMENTS (id: exact quote):
${job.requirements.map((r) => `${r.id}: ${r.quote}`).join("\n")}
ELIGIBILITY: ${job.eligibility.join(" | ")}

STUDENT PROFILE:
${profileSummary(ctx.ws)}

RESUME BULLETS (id | where | text):
${bullets.map((b) => `${b.id} | ${b.where} | ${b.text}`).join("\n")}

SKILLS: ${ctx.ws.resume!.doc.skills.map((k) => k.label + ": " + k.items).join(" / ")}
APPROVED FACTS:
${approvedFacts(ctx.ws).join("\n") || "(none)"}
STUDENT'S OWN ANSWERS FOR THIS APPLICATION (use them in the letter in place of placeholders, faithfully; you may smooth the wording):
${answers.map((x: any) => `${x.q} → ${x.a}`).join("\n") || "(none)"}

Return JSON:
{"strongestMatch":{"text":"one sentence: the single strongest truthful connection","requirementId":"r1","evidenceBulletId":"b..."},
 "changes":[{"bulletId":"","revised":"","requirementId":"","reason":"why this change helps for this posting"}],
 "gaps":[{"requirementId":"","note":"honest gap and how to address it without exaggerating, written to the student as you"}],
 "coverLetter":"3-4 short paragraphs separated by blank lines, under 330 words, starting 'Dear ${job.company} Recruiting Team,' and ending with a sign-off using the student's name",
 "personalize":[]}`,
        4500,
        process.env.OR_AI_TAILOR_CHAIN, // optional stronger model for tailoring only (see render.yaml)
      ),
    );
    const byId = new Map(bullets.map((b) => [b.id, b]));
    const postingCtx = [job.summary, ...job.requirements.map((r) => r.quote)].join(" ");
    const reqById = new Map(job.requirements.map((r) => [r.id, r]));
    const ev = evidenceOf(ctx.ws);
    const changes: BulletChange[] = [];
    for (const c of out.changes || []) {
      const b = byId.get(String(c.bulletId));
      const r = reqById.get(String(c.requirementId));
      const revised = String(c.revised || "").trim();
      if (!b || !r || !revised || norm(revised) === norm(b.text)) continue;
      const flags = claimCheck(revised, ev, { original: b.text, entryContext: entryContextOf(ctx.ws, b.id), postingText: postingCtx });
      changes.push({
        id: uid("ch"), bulletId: b.id, entryLabel: b.where, original: b.text, revised, requirementId: r.id, requirementQuote: r.quote,
        reason: String(c.reason || ""), evidence: b.text, status: "pending", flags,
      });
      if (flags.length)
        ctx.ws.incidents.unshift({ id: uid("inc"), at: nowIso(), kind: "AI overstatement caught", where: `${job.company} resume bullet`, text: revised, flags });
    }
    const sm = out.strongestMatch || {};
    const smReq = reqById.get(String(sm.requirementId));
    const smEv = byId.get(String(sm.evidenceBulletId));
    a.strongestMatch = { text: String(sm.text || ""), requirementQuote: smReq?.quote || "", evidence: smEv?.text || "" };
    a.gaps = (out.gaps || []).map((g: any) => ({ requirementQuote: reqById.get(String(g.requirementId))?.quote || "", note: String(g.note || "") })).filter((g: any) => g.note);
    a.changes = changes;
    a.letter = stripPlaceholders(String(out.coverLetter || "").trim());
    a.letterFlags = letterFlagsFor(ctx.ws, a, job);
    if (a.letterFlags.some((f) => f.type !== "placeholder"))
      ctx.ws.incidents.unshift({ id: uid("inc"), at: nowIso(), kind: "AI overstatement caught", where: `${job.company} cover letter`, text: a.letter.slice(0, 600), flags: a.letterFlags.filter((f) => f.type !== "placeholder") });
    a.letterApproved = false;
    a.personalize = []; // Remy asks before writing; the letter never carries fill-in-the-blank gaps
    a.generatedAt = nowIso();
    a.generatedBy = lastUsedModel();
    a.audit = undefined;
    refreshAts(ctx.ws, a);
    ctx.save();
    res.json({ application: a, workspace: ctx.ws });
  }));

  app.put("/api/applications/:id/change/:cid", route((req, res, ctx) => {
    const a = getApp(ctx, String(req.params.id));
    const c = a.changes.find((x) => x.id === req.params.cid);
    if (!c) bad("Change not found", 404);
    const { status, edited, confirmedTrue } = req.body || {};
    if (status && !["pending", "accepted", "edited", "rejected"].includes(status)) bad("Invalid status");
    if (status) c!.status = status;
    if (typeof edited === "string") {
      c!.edited = edited.slice(0, 600);
      c!.status = "edited";
    }
    if (confirmedTrue === true) {
      c!.confirmedTrue = true;
      addFact(ctx.ws, `Student confirmed as accurate: "${c!.status === "edited" ? c!.edited : c!.revised}"`, "experience", "Confirmed during resume review", "approved");
    }
    c!.flags = changeFlags(ctx.ws, c!);
    refreshAts(ctx.ws, a);
    ctx.save();
    res.json({ application: a, workspace: ctx.ws });
  }));

  app.put("/api/applications/:id/letter", route((req, res, ctx) => {
    const a = getApp(ctx, String(req.params.id));
    const job = findJob(ctx.ws, a.jobId)!;
    a.letter = String(req.body?.letter || "").slice(0, 8000);
    a.letterApproved = false;
    a.letterFlags = letterFlagsFor(ctx.ws, a, job);
    ctx.save();
    res.json({ application: a, workspace: ctx.ws });
  }));

  app.post("/api/applications/:id/audit", route(async (req, res, ctx) => {
    const a = getApp(ctx, String(req.params.id));
    const job = findJob(ctx.ws, a.jobId)!;
    const doc = composeResume(ctx.ws, a);
    const out = await withAi(ctx, "Second-opinion claim audit", () =>
      aiJson<{ findings: { claim: string; why: string }[] }>(
        "You are a strict fact-checker. Compare the TAILORED documents to the student's ORIGINAL evidence. List every claim in the tailored documents that is not clearly supported by the evidence (overstated scope, new skills, implied titles, new numbers, invented motivations presented as fact). Placeholders in [brackets] are fine. If everything is supported, return an empty list.",
        `ORIGINAL EVIDENCE:\n${evidenceOf(ctx.ws).slice(0, 9000)}\n\nTAILORED RESUME:\n${resumeToText(doc)}\n\nTAILORED COVER LETTER for ${job.company}:\n${a.letter}\n\nReturn {"findings":[{"claim":"quote","why":""}]}`,
        1200,
      ),
    );
    a.audit = { at: nowIso(), findings: (out.findings || []).slice(0, 12).map((f) => ({ claim: String(f.claim), why: String(f.why) })) };
    ctx.save();
    res.json({ application: a, workspace: ctx.ws });
  }));

  app.post("/api/applications/:id/approve", route((req, res, ctx) => {
    const a = getApp(ctx, String(req.params.id));
    const job = findJob(ctx.ws, a.jobId)!;
    if (!a.generatedAt) bad("Generate a tailored draft first.");
    const pending = a.changes.filter((c) => c.status === "pending");
    if (pending.length) bad(`Review ${pending.length} remaining change${pending.length > 1 ? "s" : ""} before approving.`, 409);
    for (const c of a.changes) c.flags = c.status === "rejected" ? [] : changeFlags(ctx.ws, c);
    const blocked = a.changes.filter((c) => (c.status === "accepted" || c.status === "edited") && c.flags.length);
    if (blocked.length) bad("Some accepted changes still contain unsupported claims. Edit, reject, or confirm them first.", 409);
    // The letter is written from the student's resume and their own answers, so approval
    // doesn't re-check it; any stray fill-in brackets are simply removed.
    a.letter = stripPlaceholders(a.letter);
    for (const p of a.personalize) p.done = true;
    a.letterFlags = [];
    a.letterApproved = true;
    refreshAts(ctx.ws, a);
    const doc = composeResume(ctx.ws, a);
    a.versions.push({ v: a.versions.length + 1, at: nowIso(), resume: doc, letter: a.letter, note: String(req.body?.note || "") });
    a.staleReason = undefined;
    const t = ctx.ws.tracker.find((x) => x.applicationId === a.id || x.jobId === a.jobId);
    if (!t)
      ctx.ws.tracker.unshift({
        id: uid("tr"), company: job.company, role: job.title, jobId: job.id, applicationId: a.id, status: "Saved", notes: "",
        events: [{ id: uid("ev"), at: nowIso(), status: "Saved", source: "Materials approved in Remy" }],
      });
    if (job.deadline && !ctx.ws.calendar.some((c) => c.linkedId === job.id))
      ctx.ws.calendar.push({ id: uid("cal"), title: `${job.company} deadline`, date: job.deadline, time: "", kind: "Deadline", source: "From verified posting", linkedId: job.id, notes: job.deadlineText });
    ctx.save();
    res.json({ application: a, workspace: ctx.ws });
  }));

  app.get("/api/applications/:id/export", route(async (req, res, ctx) => {
    const a = getApp(ctx, String(req.params.id));
    const job = findJob(ctx.ws, a.jobId)!;
    const v = req.query.v ? a.versions.find((x) => x.v === Number(req.query.v)) : a.versions[a.versions.length - 1];
    if (!v) bad("Approve this application first — only approved versions can be downloaded.", 409);
    const kind = req.query.doc === "letter" ? "letter" : "resume";
    const fmt = ["docx", "pdf", "txt"].includes(String(req.query.format)) ? String(req.query.format) : "docx";
    const base = fileBase(ctx.ws, job, kind === "letter" ? "Cover-Letter" : "Resume") + `-v${v!.v}`;
    const contact = [v!.resume.contact.location, v!.resume.contact.email, v!.resume.contact.phone].filter(Boolean).join(" | ");
    let buf: Buffer;
    if (kind === "resume") buf = fmt === "docx" ? await resumeDocx(v!.resume) : fmt === "pdf" ? await resumePdf(v!.resume) : Buffer.from(resumeTxt(v!.resume));
    else buf = fmt === "docx" ? await letterDocx(v!.resume.contact.name, contact, v!.letter) : fmt === "pdf" ? await letterPdf(v!.resume.contact.name, contact, v!.letter) : Buffer.from(v!.letter);
    const mime = fmt === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : fmt === "pdf" ? "application/pdf" : "text/plain; charset=utf-8";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${base}.${fmt}"`);
    res.send(buf);
  }));

  app.delete("/api/applications/:id", route((req, res, ctx) => {
    ctx.ws.applications = ctx.ws.applications.filter((a) => a.id !== req.params.id);
    ctx.save();
    res.json(ctx.ws);
  }));

  app.post("/api/safeguard/test", route((req, res, ctx) => {
    const text = String(req.body?.text || "Managed a $250,000 student investment fund using Python and Bloomberg Terminal as Investment Committee Chair.");
    const flags = claimCheck(text, evidenceOf(ctx.ws));
    ctx.ws.incidents.unshift({ id: uid("inc"), at: nowIso(), kind: "Safeguard test", where: "Deliberate false-claim test", text, flags });
    ctx.save();
    res.json({ flags, workspace: ctx.ws });
  }));

  // ---------- community outreach ----------
  app.post("/api/community/sample", route((_req, res, ctx) => {
    for (const c of SAMPLE_CONTACTS) if (!ctx.ws.contacts.some((x) => x.id === c.id)) ctx.ws.contacts.push(c);
    ctx.save();
    res.json(ctx.ws);
  }));
  // TCU alumni matched to this student (top matches only; the list stays server-side).
  // Alumni names and emails are personal data: only students signed in with a school
  // email see matches, the match list carries no emails, and a student can only save
  // alumni from their own current matches.
  const ALUMNI_DOMAINS = (process.env.OR_ALUMNI_EMAIL_DOMAINS || "tcu.edu").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  const schoolEmail = (me: Me) => ALUMNI_DOMAINS.some((d) => me.email.toLowerCase().endsWith("@" + d));
  const signedIn = (me: Me) => me.kind === "google" || me.kind === "supabase" || me.kind === "local";
  const alumniOk = (me: Me) => me.kind === "local" || (signedIn(me) && schoolEmail(me));
  const myMatches = (ctx: Ctx) => {
    const companies = Array.from(new Set([...ctx.ws.savedJobIds, ...ctx.ws.applications.map((a) => a.jobId)].map((id) => findJob(ctx.ws, id)?.company).filter(Boolean) as string[]));
    return matchAlumni(ctx.ws, companies);
  };
  app.get("/api/community/alumni", route((_req, res, ctx) => {
    const list = alumniList();
    const base = { source: list.source, total: list.alumni.length, matches: [] };
    if (!signedIn(ctx.me)) return res.json({ ...base, signInRequired: true });
    if (!alumniOk(ctx.me)) return res.json({ ...base, schoolEmailRequired: true, domains: ALUMNI_DOMAINS });
    if (!allow("alumni:" + ctx.me.id, 30, 60 * 60_000)) bad("You've refreshed your alumni matches a lot. Please try again in an hour.", 429);
    res.json({ ...base, matches: myMatches(ctx).map(({ email, ...rest }) => rest) });
  }));
  app.post("/api/community/alumni/:id/contact", route((req, res, ctx) => {
    if (!alumniOk(ctx.me)) bad(`Sign in with your ${ALUMNI_DOMAINS.map((d) => "@" + d).join(" or ")} email to contact TCU alumni.`, 403);
    const a = myMatches(ctx).find((x) => x.id === String(req.params.id));
    if (!a) bad("That alum isn't in your current matches.", 404);
    if (!ctx.ws.contacts.some((x) => x.id === "alum-" + a!.id) && !allow("alumni-contact:" + ctx.me.id, 25, 24 * 60 * 60_000))
      bad("You've saved 25 alumni today. Reach out to those first, then come back tomorrow.", 429);
    const id = "alum-" + a!.id;
    let c = ctx.ws.contacts.find((x) => x.id === id);
    if (!c) {
      c = {
        id, name: a!.name, title: a!.title || a!.role, org: a!.employer, email: a!.email,
        why: `TCU alum${a!.year ? `, Class of ${a!.year}` : ""} · ${[a!.industry, a!.location].filter(Boolean).join(" · ")}${a!.majors.length ? ` · ${a!.majors.join("/")} major` : ""}`,
        tags: ["TCU alumni list", a!.industry, a!.role].filter(Boolean), label: "Live",
      };
      ctx.ws.contacts.unshift(c);
      ctx.save();
    }
    res.json({ contact: c, workspace: ctx.ws });
  }));

  // Outreach email from the student's own answers to Remy's questions. Follows the
  // career office's informational-interview guide; never leaves placeholders.
  app.post("/api/ai/outreach", route(async (req, res, ctx) => {
    const c = ctx.ws.contacts.find((x) => x.id === req.body?.contactId);
    if (!c) bad("Contact not found", 404);
    const answers: { q: string; a: string }[] = (Array.isArray(req.body?.answers) ? req.body.answers : [])
      .map((x: any) => ({ q: String(x?.q || "").slice(0, 300), a: String(x?.a || "").trim().slice(0, 800) }))
      .filter((x: { a: string }) => x.a);
    const purpose = String(req.body?.purpose || answers[0]?.a || "a brief informational conversation").slice(0, 300);
    for (const x of answers) addFact(ctx.ws, `${x.q} — ${x.a}`, "goal", `Told Remy while writing to ${c!.name}`, "approved");
    const p = ctx.ws.profile;
    const me = p.preferredName || p.name || "Your name";
    const sig = [p.name || me, p.applicationEmail || p.email].filter(Boolean).join("\n");
    let out: { subject: string; body: string; linkedin: string };
    if (aiStatus().available) {
      out = await withAi(ctx, "Draft outreach", () =>
        aiJson<{ subject: string; body: string; linkedin: string }>(
          `You write a university student's networking email, following their career office's guidance for informational interviews: say who you are (school, year, major), how you found the person, why them specifically, ask for a 20-30 minute conversation (phone, Zoom or in person) and offer flexibility; warm, specific, professional, under 170 words. Use ONLY the facts and answers given — never invent experience, mutual connections or details. Never use placeholders or brackets of any kind: if a detail is unknown, leave it out. End with the student's sign-off exactly as given. Also write a LinkedIn connection note under 200 characters.`,
          `TO: ${c!.name}, ${c!.title} at ${c!.org}\nABOUT THEM: ${c!.why}\nHOW THE STUDENT FOUND THEM: ${c!.tags.includes("TCU alumni list") ? "the TCU Neeley alumni networking list from the career office" : "student-added contact"}\nSTUDENT:\n${profileSummary(ctx.ws)}\nRESUME HIGHLIGHTS: ${ctx.ws.resume ? ctx.ws.resume.doc.sections.flatMap((s) => s.entries.map((e) => [e.role, e.org].filter(Boolean).join(" at "))).slice(0, 6).join("; ") : "(none)"}\nSTUDENT'S ANSWERS:\n${answers.map((x) => `${x.q} → ${x.a}`).join("\n") || `Purpose → ${purpose}`}\nSIGN-OFF:\nBest regards,\n${sig}\n\nReturn {"subject":"","body":"","linkedin":""}`,
          1200,
        ),
      );
    } else {
      // No AI: the guide's sample structure, filled with the student's answers.
      const first = c!.name.split(/\s+/)[0];
      const ans = (i: number) => answers[i]?.a || "";
      const who = [p.classYear && p.classYear.toLowerCase(), "at Texas Christian University", p.major && `studying ${p.major}`].filter(Boolean).join(" ");
      out = {
        subject: `TCU student — ${ans(0) ? "quick question about your path" : "informational interview request"}`,
        body: [`Dear ${first},`, `I'm ${me}, a ${who}. I found your contact information through the TCU Neeley alumni networking list${ans(1) ? ` and was especially interested in ${ans(1)}` : ` and was interested in your work at ${c!.org}`}.`,
          ans(2), `Might you be available for a 20-30 minute conversation${ans(3) ? ` — I'm generally free ${ans(3)}` : ""}? ${ans(0) ? `I'd love to ${ans(0).replace(/^(to |i'd like to |i want to )/i, "")}.` : "I'd appreciate hearing about your experience and any advice you have."}`,
          "Thank you in advance for your consideration.", `Best regards,\n${sig}`].filter(Boolean).join("\n\n"),
        linkedin: `Hi ${first}, I'm a TCU student interested in ${c!.org} and your path into ${c!.title || "your field"}. I'd love to connect and learn from you. — ${me}`.slice(0, 199),
      };
    }
    const clean = (t: string) => t.replace(/\[[^\]]{2,80}\]/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const d = { id: uid("o"), contactId: c!.id, to: c!.email, subject: clean(String(out.subject || "")), body: clean(String(out.body || "")), linkedin: clean(String(out.linkedin || "")).slice(0, 200), status: "draft" as const, createdAt: nowIso() };
    ctx.ws.outreach.unshift(d);
    ctx.save();
    res.json({ draft: d, workspace: ctx.ws });
  }));

  // ---------- inbox → status suggestions ----------
  app.post("/api/inbox/sample", route((_req, res, ctx) => {
    for (const m of SAMPLE_INBOX) if (!ctx.ws.inbox.some((x) => x.id === m.id)) ctx.ws.inbox.push(m);
    ctx.save();
    res.json(ctx.ws);
  }));
  app.post("/api/inbox/paste", route((req, res, ctx) => {
    const body = String(req.body?.body || "").slice(0, 8000);
    if (body.trim().length < 30) bad("Paste the full email text.");
    ctx.ws.inbox.unshift({ id: uid("m"), from: String(req.body?.from || "").slice(0, 200), subject: String(req.body?.subject || "(no subject)").slice(0, 200), date: new Date().toISOString().slice(0, 10), body, label: "Pasted by student" });
    ctx.save();
    res.json(ctx.ws);
  }));

  function rulesClassify(text: string): { status: TrackStatus | "Unclear"; evidence: string } {
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
    const tests: [TrackStatus, RegExp][] = [
      ["Offer", /\b(pleased to offer|offer of (employment|internship)|extend (you )?an offer|congratulations[^.]*offer)\b/i],
      ["Rejected", /\b(not (be )?moving forward|unable to offer|decided to (pursue|move forward with) other|regret to inform|not selected)\b/i],
      ["Interview", /\b(invite you to (an? |a )?(first-round |final-round )?interview|schedule (an |your )?interview|interview invitation|superday|choose a time)\b/i],
      ["Received", /\b(received your application|application (has been )?received|thank you for applying|confirms? (that )?we have received)\b/i],
    ];
    for (const [status, re] of tests) {
      const s = sentences.find((x) => re.test(x));
      if (s) return { status, evidence: s };
    }
    return { status: "Unclear", evidence: "" };
  }

  app.post("/api/inbox/:id/classify", route(async (req, res, ctx) => {
    const m = ctx.ws.inbox.find((x) => x.id === req.params.id);
    if (!m) bad("Message not found", 404);
    const rules = rulesClassify(m!.body);
    let ai: { status: TrackStatus | "Unclear"; evidence: string; company: string; role: string } | null = null;
    if (aiStatus().available) {
      try {
        ai = await withAi(ctx, "Classify email", () =>
          aiJson<any>(
            "Classify a recruiting email. Distinguish carefully: an application receipt is NOT an interview; an interview invitation is NOT an offer; 'decisions about interviews and offers in the coming weeks' is Unclear. Quote the exact sentence that justifies the label.",
            `FROM: ${m!.from}\nSUBJECT: ${m!.subject}\nBODY:\n${m!.body}\n\nReturn {"status":"Received|Interview|Offer|Rejected|Unclear","evidence":"exact sentence","company":"","role":""}`,
            500,
          ),
        );
        if (ai && ai.evidence && !norm(m!.body).includes(norm(ai.evidence))) ai.evidence = ""; // quotes must be real
      } catch {
        ai = null;
      }
    }
    const aiStatusVal = (ai?.status as TrackStatus | "Unclear") || undefined;
    const agree = !!ai && ai.status === rules.status && rules.status !== "Unclear";
    const proposed: TrackStatus | "Unclear" = rules.status !== "Unclear" ? rules.status : aiStatusVal || "Unclear";
    const evidence = rules.evidence || ai?.evidence || "";
    const company = ai?.company || m!.from.split("@")[1]?.split(".").slice(-2, -1)[0] || "";
    const existing = ctx.ws.tracker.find((t) => company && norm(t.company).includes(norm(company)));
    const s: Suggestion = {
      id: uid("sg"), messageId: m!.id, trackId: existing?.id, company: existing?.company || company, role: existing?.role || ai?.role || "",
      proposed: proposed === "Unclear" ? "Applied" : proposed,
      confidence: proposed === "Unclear" || !evidence ? "low" : agree ? "high" : "medium",
      evidence, rulesSay: rules.status, aiSays: aiStatusVal, createdAt: nowIso(), state: "open",
    };
    ctx.ws.suggestions = [s, ...ctx.ws.suggestions.filter((x) => !(x.messageId === m!.id && x.state === "open"))];
    ctx.save();
    res.json({ suggestion: s, workspace: ctx.ws });
  }));

  app.post("/api/suggestions/:id/resolve", route((req, res, ctx) => {
    const s = ctx.ws.suggestions.find((x) => x.id === req.params.id);
    if (!s) bad("Suggestion not found", 404);
    if (req.body?.action === "dismiss") {
      s!.state = "dismissed";
    } else {
      const status = (req.body?.status || s!.proposed) as TrackStatus;
      const m = ctx.ws.inbox.find((x) => x.id === s!.messageId);
      let t = ctx.ws.tracker.find((x) => x.id === (req.body?.trackId || s!.trackId));
      if (!t) {
        const company = String(req.body?.company || s!.company || "Unknown company");
        const role = String(req.body?.role || s!.role || "");
        t = ctx.ws.tracker.find((x) => norm(x.company) === norm(company) && norm(x.role) === norm(role));
        if (!t) {
          t = { id: uid("tr"), company, role, status, events: [], notes: "" };
          ctx.ws.tracker.unshift(t);
        }
      }
      // duplicate guard: same message + same status is applied once
      if (!t.events.some((e) => e.status === status && e.evidence === s!.evidence && e.source.includes(s!.messageId))) {
        t.events.push({ id: uid("ev"), at: nowIso(), status, source: `${m?.label || "Email"} · ${s!.messageId}`, evidence: s!.evidence });
      }
      t.status = status;
      s!.state = "applied";
      s!.trackId = t.id;
      if (status === "Interview" && !ctx.ws.tasks.some((x) => x.title === `Prepare for ${t!.company} interview`))
        ctx.ws.tasks.unshift({ id: uid("t"), title: `Prepare for ${t.company} interview`, why: "An interview invitation was confirmed from an email you reviewed.", due: "", category: "Prepare", done: false, source: "Status update" });
    }
    ctx.save();
    res.json(ctx.ws);
  }));

  // ---------- calendar export ----------
  app.get("/api/calendar.ics", route((req, res, ctx) => {
    const id = req.query.id ? String(req.query.id) : null;
    const items = ctx.ws.calendar.filter((c) => !id || c.id === id);
    const esc = (s: string) => s.replace(/[,;\\]/g, (m) => "\\" + m).replace(/\r\n|\r|\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Remy//EN", "CALSCALE:GREGORIAN"];
    for (const c of items) {
      const d = c.date.replace(/-/g, "");
      lines.push("BEGIN:VEVENT", `UID:${c.id}@remy`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`);
      if (c.time) {
        const t = c.time.replace(":", "") + "00";
        lines.push(`DTSTART:${d}T${t}`, `DURATION:PT1H`);
      } else lines.push(`DTSTART;VALUE=DATE:${d}`);
      lines.push(`SUMMARY:${esc(c.title)}`, `DESCRIPTION:${esc(c.notes || c.kind)}`, "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="remy${id ? "-" + id : ""}.ics"`);
    res.send(lines.join("\r\n"));
  }));

  // ---------- data controls ----------
  app.get("/api/export/data", route((_req, res, ctx) => {
    res.setHeader("Content-Disposition", 'attachment; filename="remy-my-data.json"');
    res.json({ exportedAt: nowIso(), account: ctx.me, workspace: ctx.ws });
  }));
  // Deletes everything Remy stores about the student — workspace, files, AI usage,
  // sessions and the account record — and signs them out.
  // shortcut: a Supabase sign-in account itself is not deleted (that needs the Supabase service key); say so in the UI.
  app.delete("/api/ws", route((req, res, ctx) => {
    deleteAccount(ctx.me.id);
    endSession(req, res);
    res.json({ deleted: true });
  }));
}
