import Database from "better-sqlite3";
import crypto from "node:crypto";
import type { Me, Workspace } from "@shared/types";

const db = new Database(process.env.OR_DB_PATH || "data.db");
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, email TEXT DEFAULT '', name TEXT DEFAULT '',
  picture TEXT DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workspaces (
  user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (user_id TEXT NOT NULL, at INTEGER NOT NULL);
`);

export const nowIso = () => new Date().toISOString();
export const uid = (p = "") => p + crypto.randomBytes(6).toString("hex");
export const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function emptyWorkspace(): Workspace {
  return {
    version: 2,
    started: false,
    onboarding: { step: 0, done: false, answers: [], questions: [] },
    profile: {
      name: "", preferredName: "", email: "", applicationEmail: "", school: "", major: "", classYear: "",
      graduation: "", location: "", targetRoles: "", goals: "", interests: "", workAuth: "", relocation: "",
    },
    imports: [],
    memory: [],
    jobs: [],
    savedJobIds: [],
    jobChecks: {},
    fits: {},
    hiddenJobIds: [],
    applications: [],
    tracker: [],
    inbox: [],
    suggestions: [],
    tasks: [],
    calendar: [],
    contacts: [],
    outreach: [],
    chat: [],
    aiLog: [],
    incidents: [],
    settings: { theme: "light", assistantOpen: true, navCollapsed: false, notify: { deadlines: true, statusChanges: true, weeklyPlan: false } },
    updatedAt: nowIso(),
  };
}

export function ensureUser(me: Me) {
  const row = db.prepare("SELECT id FROM users WHERE id=?").get(me.id);
  if (!row) {
    db.prepare("INSERT INTO users (id,kind,email,name,picture,created_at) VALUES (?,?,?,?,?,?)").run(
      me.id, me.kind, me.email, me.name, me.picture, nowIso(),
    );
  } else if (me.kind === "google") {
    db.prepare("UPDATE users SET email=?, name=?, picture=? WHERE id=?").run(me.email, me.name, me.picture, me.id);
  }
}
export function getUser(id: string): Me | null {
  const r = db.prepare("SELECT * FROM users WHERE id=?").get(id) as any;
  return r ? { id: r.id, kind: r.kind, email: r.email, name: r.name, picture: r.picture } : null;
}

export function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30;
  db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(sha(token), userId, expires);
  return { token, expires };
}
export function sessionUser(token: string): string | null {
  const r = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash=?").get(sha(token)) as any;
  if (!r || r.expires_at < Date.now()) return null;
  return r.user_id;
}
export function deleteSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(token));
}

export function loadWorkspace(userId: string): Workspace {
  const r = db.prepare("SELECT data FROM workspaces WHERE user_id=?").get(userId) as any;
  if (!r) return emptyWorkspace();
  try {
    const parsed = JSON.parse(r.data);
    if (parsed?.version !== 2) return emptyWorkspace();
    // forward-fill any keys added later
    return { ...emptyWorkspace(), ...parsed, settings: { ...emptyWorkspace().settings, ...parsed.settings } };
  } catch {
    return emptyWorkspace();
  }
}
export function hasWorkspace(userId: string) {
  return !!db.prepare("SELECT 1 FROM workspaces WHERE user_id=?").get(userId);
}
export function saveWorkspace(userId: string, ws: Workspace) {
  ws.updatedAt = nowIso();
  if (ws.aiLog.length > 300) ws.aiLog = ws.aiLog.slice(-300);
  if (ws.chat.length > 200) ws.chat = ws.chat.slice(-200);
  const data = JSON.stringify(ws);
  if (data.length > 4_000_000) throw Object.assign(new Error("Workspace is too large."), { status: 413 });
  db.prepare(
    "INSERT INTO workspaces (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
  ).run(userId, data, ws.updatedAt);
}
export function deleteWorkspace(userId: string) {
  db.prepare("DELETE FROM workspaces WHERE user_id=?").run(userId);
}

export function aiAllowed(userId: string): { ok: boolean; message?: string } {
  const now = Date.now();
  db.prepare("DELETE FROM ai_usage WHERE at < ?").run(now - 86_400_000);
  const day = (db.prepare("SELECT COUNT(*) c FROM ai_usage WHERE user_id=?").get(userId) as any).c;
  const recent = (db.prepare("SELECT COUNT(*) c FROM ai_usage WHERE user_id=? AND at > ?").get(userId, now - 60_000) as any).c;
  if (day >= 120) return { ok: false, message: "Daily AI limit reached for this account (120 requests per 24 hours)." };
  if (recent >= 12) return { ok: false, message: "That was a lot of AI requests at once. Please wait a minute and try again." };
  db.prepare("INSERT INTO ai_usage (user_id, at) VALUES (?,?)").run(userId, now);
  return { ok: true };
}
