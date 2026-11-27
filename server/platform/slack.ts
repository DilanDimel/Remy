// Remy in the team Slack (remyaihq). Slack sends every message from the channels the Remy app is in to
// POST /api/slack/events; we keep a copy (slack_messages) and answer when someone @mentions Remy or DMs him,
// using what the team said plus the repo's AI notes and pull requests. Team chat only: no student data here.
// Needs SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET; without them the route answers 404. Answers use their own OpenRouter key
// (REMY_SLACK_OPENROUTER_KEY, with its own spending limit), never the students' key; without it Remy says he isn't set up.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { q } from "./sql";
import { privacyRouting } from "../ai/ai";
import { search, fileFor, dueReminders, markReminded, type Found, type Tier } from "./library";

export const slackOn = () => !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET);

/** Slack's request signature (v0 HMAC of "v0:ts:body"), refused when older than 5 minutes. */
export function verifySlack(raw: unknown, ts: string, sig: string, secret = process.env.SLACK_SIGNING_SECRET || "", now = Date.now()): boolean {
  if (!Buffer.isBuffer(raw) || !secret || !ts || !sig || !(Math.abs(now / 1000 - Number(ts)) <= 300)) return false;
  const mine = Buffer.from("v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${raw.toString("utf8")}`).digest("hex"));
  const got = Buffer.from(sig);
  return mine.length === got.length && crypto.timingSafeEqual(mine, got);
}

async function api(method: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    // Form encoding: Slack's read methods (users.info, conversations.history) don't take JSON bodies.
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    body: new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j.ok) console.warn(`slack ${method}: ${j.error || r.status}`);
  return j;
}

const names = new Map<string, string>();
async function nameOf(kind: "user" | "channel", id: string): Promise<string> {
  if (!id) return "";
  const k = kind + ":" + id;
  if (!names.has(k)) {
    const j = kind === "user" ? await api("users.info", { user: id }) : await api("conversations.info", { channel: id });
    const n = kind === "user" ? j.user?.profile?.display_name || j.user?.real_name || j.user?.name : j.channel?.is_im ? "DM" : j.channel?.name && "#" + j.channel.name;
    if (n) names.set(k, n);
    else return id;
  }
  return names.get(k)!;
}

/** Stores one message in the copy; false for subtypes we skip (joins, topic changes…). */
async function keep(channel: string, m: any): Promise<boolean> {
  if (m.subtype && !["thread_broadcast", "file_share", "bot_message"].includes(m.subtype)) return false;
  await q(
    `INSERT INTO slack_messages (channel, ts, thread_ts, channel_name, user_name, text) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (channel, ts) DO UPDATE SET text = EXCLUDED.text`,
    [channel, m.ts, m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : null, await nameOf("channel", channel),
      m.bot_id ? m.username || m.bot_profile?.name || "Remy" : await nameOf("user", m.user), String(m.text || "") + (m.files?.length ? ` [files: ${m.files.map((f: any) => f.name).join(", ")}]` : "")],
  );
  return true;
}

// The first event from a channel after each deploy copies its recent history, so Remy knows what was said before he joined.
// shortcut: top-level messages only (last 200), thread replies before joining are skipped; add conversations.replies if needed.
const filled = new Set<string>();
async function backfill(channel: string): Promise<void> {
  const j = await api("conversations.history", { channel, limit: 200 });
  for (const m of j.messages || []) await keep(channel, m);
}

/** One Slack event (from the Events API "event" field). Keeps the copy up to date and answers Remy's mentions and DMs. */
export async function onEvent(ev: any, answer = reply): Promise<void> {
  if (!ev?.type) return;
  if (ev.type === "app_home_opened") { if (ev.tab === "home") await api("views.publish", { user_id: ev.user, view: JSON.stringify(await homeView()) }); return; }
  if (ev.channel && !filled.has(ev.channel)) { filled.add(ev.channel); await backfill(ev.channel); }
  if (ev.type === "message") {
    if (ev.subtype === "message_deleted") { await q("DELETE FROM slack_messages WHERE channel=$1 AND ts=$2", [ev.channel, ev.deleted_ts]); return; }
    if (ev.subtype === "message_changed") { await q("UPDATE slack_messages SET text=$3 WHERE channel=$1 AND ts=$2", [ev.channel, ev.message?.ts, String(ev.message?.text || "")]); return; }
    if (!(await keep(ev.channel, ev))) return; // joins, topic changes…
    // A DM to Remy (channel mentions arrive as app_mention instead, so they aren't answered twice).
    if (ev.channel_type === "im" && !ev.bot_id && !ev.subtype) await answer(ev);
    return;
  }
  if (ev.type === "app_mention" && !ev.bot_id) await answer(ev);
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
const when = (ts: string) => new Date(Number(ts) * 1000).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const line = (m: any) => `[${when(m.ts)} CT, ${m.channel_name}] ${m.user_name}: ${clip(String(m.text).replace(/\s+/g, " "), 600)}`;

/** What Remy reads before answering: the last 14 days of every channel, this thread, and older messages sharing the question's words. */
export async function slackContext(channel: string, thread: string, question: string): Promise<string> {
  const since = String(Date.now() / 1000 - 14 * 86400);
  const recent = (await q("SELECT * FROM slack_messages WHERE ts > $1 ORDER BY ts DESC LIMIT 400", [since])).reverse();
  const here = await q("SELECT * FROM slack_messages WHERE channel=$1 AND (ts=$2 OR thread_ts=$2) ORDER BY ts", [channel, thread]);
  const words = Array.from(new Set(question.toLowerCase().match(/[a-z0-9][a-z0-9.-]{3,}/g) || [])).slice(0, 6).map((w) => `%${w}%`);
  const older = words.length ? await q("SELECT * FROM slack_messages WHERE ts <= $1 AND text ILIKE ANY($2) ORDER BY ts DESC LIMIT 40", [since, words]) : [];
  return [
    older.length ? "Older messages that mention the question's words:\n" + older.reverse().map(line).join("\n") : "",
    "Team Slack, last 14 days (oldest first):\n" + (recent.map(line).join("\n") || "(nothing yet)"),
    "This conversation:\n" + here.map(line).join("\n"),
  ].filter(Boolean).join("\n\n");
}

// What the team's AIs know: docs/ai on disk (the deployed copy of main, refreshed by every merge) plus GitHub's PR list.
// The top files always go in; the per-thread entries in status/lead/ are ranked by the question's words, up to ~60k chars.
const AI_DIR = path.join(process.cwd(), "docs", "ai");
const read = (f: string) => { try { return fs.readFileSync(path.join(AI_DIR, f), "utf8"); } catch { return ""; } };
export function aiNotes(question: string, budget = 60_000): string {
  const words = Array.from(new Set(question.toLowerCase().match(/[a-z0-9][a-z0-9.-]{3,}/g) || []));
  const top = ["TEAM.md", "CONTEXT.md", "DECISIONS.md", "DAILY.md", "status/lead.md", "status/demetre.md", "status/julio.md"];
  let lead: string[] = [];
  try { lead = fs.readdirSync(path.join(AI_DIR, "status", "lead")).filter((f) => f.endsWith(".md")).map((f) => "status/lead/" + f); } catch {}
  const hits = (t: string) => words.reduce((n, w) => n + (t.toLowerCase().split(w).length - 1), 0);
  const ranked = lead.map((f) => ({ f, t: read(f) })).map((x) => ({ ...x, n: hits(x.f + " " + x.t) })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n);
  const out: string[] = [];
  let left = budget;
  for (const { f, t } of [...top.map((f) => ({ f, t: read(f) })), ...ranked]) {
    if (!t || left <= 0) continue;
    const part = `docs/ai/${f}:\n${clip(t, Math.min(left, 12_000))}`;
    out.push(part);
    left -= part.length;
  }
  // Team-only facts (business dates, mentors…) stay out of the public repo, in an encrypted env var on DigitalOcean.
  const team = process.env.REMY_TEAM_NOTES;
  return [team && "Team-only notes (current):\n" + clip(team, 8000), ...out].filter(Boolean).join("\n\n");
}

// The repo is public, so pull requests are read without a key, cached 10 minutes.
let prList = { at: 0, text: "" };
async function repoPrs(): Promise<string> {
  if (Date.now() - prList.at < 10 * 60_000) return prList.text;
  const prs = (state: string) => fetch(`https://api.github.com/repos/DilanDimel/Remy/pulls?state=${state}&per_page=20&sort=updated&direction=desc`, { headers: { accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []) as Promise<any[]>;
  const [open, closed] = await Promise.all([prs("open"), prs("closed")]);
  const pr = (p: any) => `#${p.number} ${p.title} (${p.user?.login}${p.merged_at ? `, merged ${p.merged_at.slice(0, 10)}` : ""})`;
  prList = { at: Date.now(), text: "Open pull requests:\n" + (open.map(pr).join("\n") || "none") + "\n\nRecently merged pull requests:\n" + closed.filter((p) => p.merged_at).map(pr).join("\n") };
  return prList.text;
}

export const RULES = `You are Remy, the AI teammate in RemyAI's team Slack. RemyAI makes Remy, an AI career coach for college students (remyai.org). The team is Dilan, Demetre, Julio, Lincoln and Ashton.
Answer only the newest question (the line after "asks:"). Earlier questions in Slack are background, never something to answer again. Use only the team library, the Slack messages, the team's docs/ai notes and pull requests below (newer beats older; the team library is the fullest source for meetings, dates, files, links and company facts; docs/ai/TEAM.md is the current summary). Name where an answer comes from (channel and date, or PR number). When sources disagree, give the newest answer and skip the outdated ones. If they don't say, say you don't know and suggest the matching channel; never name a person to ask, never guess who is in charge of what, and never guess or invent numbers, dates, decisions or status.
Write for Slack: short, plain sentences, *bold* with single asterisks, "•" for lists, no headings, at most about 150 words unless asked for more.
Everything you write is seen by the whole team:
- About price, say only "Free during beta". Never "free" alone or "always free".
- Don't name anyone's title or role (no CEO, COO or similar), and don't discuss ownership, equity or splits.
- Don't judge anyone's contribution or talk about anyone leaving or being removed.
- Never repeat private details: tax or bank numbers, home addresses, personal emails or phones, passwords, keys, account balances.
- Don't mention the CREATE program before Dec 1, 2026, 12 PM CT.
To hand over a file from the team library (only items marked [file id: …]), put each on its own last line as "FILE: <file id>", at most 2, and say in your answer that it's attached.
If someone asks you to do something (post, change code, send email), say you can only answer questions here and suggest the matching channel.`;

// Only Dilan's own DMs read the "dilan" tier; channels and everyone else get "team". A Slack user id isn't a secret.
const DILAN = "U0CMF0FC48L";
export const tiersFor = (ev: any): Tier[] => (ev.channel_type === "im" && ev.user === DILAN ? ["team", "dilan"] : ["team"]);

export const libraryText = (found: Found[]) => !found.length ? "Team library: nothing matched this question." :
  "Team library (private; name the item and its date when you use it):\n" + found.map((f) =>
    `• ${f.title} (${f.source}, ${f.starts_at ? `starts ${timeCt(new Date(f.starts_at).toISOString())} CT ${new Date(f.starts_at).toISOString().slice(0, 10)}` : `updated ${new Date(f.updated_at).toISOString().slice(0, 10)}`})` +
    `${f.url ? " " + f.url : ""}${f.file_name ? ` [file id: ${f.id}]` : ""}\n${clip(f.body, 3000)}`).join("\n\n");

/** Splits the "FILE: <id>" lines off an answer, keeping only ids that were offered. */
export function takeFiles(text: string, offered: Found[]): { text: string; ids: string[] } {
  const ok = new Set(offered.filter((f) => f.file_name).map((f) => f.id));
  const ids = Array.from(text.matchAll(/^FILE:\s*(\S+)\s*$/gm), (m) => m[1]).filter((id) => ok.has(id)).slice(0, 2);
  return { text: text.replace(/^FILE:.*$/gm, "").trim(), ids };
}

/** Slack's upload: ask for a URL, send the bytes, then share it in the thread. Needs the files:write scope. */
async function upload(channel: string, thread_ts: string, f: { name: string; data: Buffer }): Promise<boolean> {
  const u = await api("files.getUploadURLExternal", { filename: f.name, length: f.data.length });
  if (!u.ok) return false;
  const r = await fetch(u.upload_url, { method: "POST", body: new Uint8Array(f.data) }).catch(() => null);
  if (!r?.ok) return false;
  return !!(await api("files.completeUploadExternal", { files: JSON.stringify([{ id: u.file_id, title: f.name }]), channel_id: channel, thread_ts })).ok;
}

/** Haiku on the bot's own OpenRouter key, zero data retention. */
async function think(system: string, user: string): Promise<string> {
  const key = process.env.REMY_SLACK_OPENROUTER_KEY;
  if (!key) return "I'm not set up to answer yet: my AI key (REMY_SLACK_OPENROUTER_KEY) is missing.";
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    // Same routing as students' AI (zero-retention Bedrock); thinking off, or it can eat the whole token budget and leave no text.
    body: JSON.stringify({ model: "anthropic/claude-haiku-5.5", max_tokens: 1500, reasoning: { enabled: false }, provider: privacyRouting("anthropic/claude-haiku-5.5"),
      messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  const j: any = await r.json().catch(() => ({}));
  const text = j.choices?.[0]?.message?.content;
  if (!r.ok || !text) throw new Error(j.error?.message || `openrouter ${r.status} finish=${j.choices?.[0]?.finish_reason}`);
  return text;
}

/** Answers one mention or DM in its thread. */
export async function reply(ev: any): Promise<void> {
  const thread = ev.thread_ts || ev.ts;
  const question = String(ev.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();
  const tiers = tiersFor(ev);
  const [ctx, prs, who, found] = await Promise.all([slackContext(ev.channel, thread, question), repoPrs(), nameOf("user", ev.user),
    search(question, tiers).catch((e) => { console.warn("library search failed:", e?.message); return [] as Found[]; })]);
  const repo = aiNotes(question) + "\n\n" + prs;
  let text: string, ids: string[] = [];
  try {
    ({ text, ids } = takeFiles(await think(RULES + "\n\n" + repo, `${libraryText(found)}\n\n${ctx}\n\nToday is ${when(String(Date.now() / 1000))} CT. ${who} asks: ${question || "(just said hi)"}`), found));
  } catch (e: any) {
    console.warn("slack reply failed:", e?.message);
    text = "Sorry, I couldn't think just now. Try me again in a minute.";
  }
  const failed: string[] = [];
  for (const id of ids) {
    const f = await fileFor(id, tiers).catch(() => null);
    if (!f || !(await upload(ev.channel, thread, f))) failed.push(found.find((x) => x.id === id)?.file_name || id);
  }
  if (failed.length) text += `\n\n_I couldn't attach ${failed.join(", ")} just now._`;
  await api("chat.postMessage", { channel: ev.channel, thread_ts: thread, text, unfurl_links: false });
}

// ---------- Remy's own posts (run by the background sweep: at boot, every 6 hours and hourly from the remy-tick cron) ----------
export const CHANNELS = { all: "C0CM5225JF5", alerts: "C0CN69XEY9E", website: "C0CLVU1GH39", database: "C0CM9ASGWK0", app: "C0CN5LR46F2", business: "C0CM9ASGQJJ" };
// The side bar on Remy's posts, from client/src/index.css: --fox, --sage, --error.
export const COLOR = { fox: "#e86a2a", ok: "#15803d", alert: "#b42318" };

export async function post(channel: string, text: string, color = COLOR.fox): Promise<boolean> {
  if (!slackOn()) return false;
  const attachments = JSON.stringify([{ color, text, fallback: text, mrkdwn_in: ["text"] }]);
  return !!(await api("chat.postMessage", { channel, attachments, unfurl_links: false })).ok;
}

/** Something needs someone now (backups stopped, database nearly full): one line in #alerts. */
export const alert = (text: string) => post(CHANNELS.alerts, `:rotating_light: ${text}`, COLOR.alert).catch(() => false);

// ---------- Remy's Home tab, /bug and the "Ask Remy about this" message shortcut ----------
const md = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });
export const HOME = {
  type: "home",
  blocks: [
    { type: "header", text: { type: "plain_text", text: ":fox_face: Hi, I'm Remy" } },
    md("I'm the team's AI teammate. I read our channels, the repo's AI notes and open pull requests, so you can ask me what's going on."),
    { type: "divider" },
    md("*How to use me*\n• *@Remy* in any channel, or DM me: ask anything about Remy or the team\n• *`/bug`* what broke: logs it in #website (start with `app` for #app)\n• *⋮ on any message → Ask Remy about this*: I explain it or help in its thread"),
    md("*Where things go*\n• #all-remyai: everyone, decisions, the morning brief\n• #website, #app, #database: work on each part\n• #business, #social: partners, mentors, posts\n• #alerts: site down or backups stopped. Keep its notifications on."),
    md("*When I post*\n• 6 AM CT: backup check in #database\n• 12 PM and 9 PM CT: what shipped, in #website\n• Any time: warnings in #alerts"),
    { type: "context", elements: [{ type: "mrkdwn", text: "<https://remyai.org|remyai.org> · Start here: the canvas in #all-remyai" }] },
  ],
};

let backupStatus: (() => Promise<{ configured: boolean; lastAt: string | null; lastFull: string | null }>) | undefined;
/** The Home tab: the guide above plus what's live now (last backup, what shipped in 24 hours, open pull requests). */
export async function homeView(now = new Date(), open?: any[]): Promise<typeof HOME> {
  const [b, shipped, prs] = await Promise.all([
    backupStatus?.().catch(() => null) ?? null,
    shippedSince(new Date(now.getTime() - 24 * 3600_000).toISOString()).catch(() => [] as string[]),
    open ?? fetch("https://api.github.com/repos/DilanDimel/Remy/pulls?state=open&per_page=20", { headers: { accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]);
  const prList: any[] = Array.isArray(prs) ? prs : [];
  const backup = !b ? "not checked yet" : !b.lastAt ? ":warning: no backup has finished yet" : `:white_check_mark: last copy ${timeCt(b.lastAt)} CT`;
  const openLines = prList.slice(0, 8).map((p) => `• <${p.html_url}|#${p.number}> ${p.title}`);
  const live = [
    { type: "divider" },
    { type: "header", text: { type: "plain_text", text: "Right now" } },
    md(`*Backup:* ${backup}`),
    md(`*Shipped in the last 24 hours* (${shipped.length})\n${shipped.slice(0, 8).join("\n") || "Nothing yet today."}`),
    md(`*Open pull requests* (${prList.length})\n${openLines.join("\n") || "None open."}`),
  ];
  const blocks = [...HOME.blocks];
  return { ...HOME, blocks: [...blocks.slice(0, -1), ...live, blocks[blocks.length - 1]] as any };
}

/** /bug <what broke>: posts it in #website (or #app when it starts with "app") and answers only the sender. */
export async function command(body: Record<string, string>): Promise<{ response_type: "ephemeral"; text: string }> {
  const text = String(body.text || "").trim();
  if (body.command !== "/bug") return { response_type: "ephemeral", text: "I don't know that command." };
  if (!text) return { response_type: "ephemeral", text: "Tell me what broke, like `/bug Save button does nothing on My Path`. Start with `app` for the phone app." };
  const app = /^app\b[:\s-]*/i.test(text);
  const what = app ? text.replace(/^app\b[:\s-]*/i, "") : text;
  const channel = app ? CHANNELS.app : CHANNELS.website;
  // Recent merges whose titles share a word with the report: often the change that caused it.
  const words = new Set(what.toLowerCase().match(/[a-z]{4,}/g) || []);
  const recent = (await shippedSince(new Date(Date.now() - 72 * 3600_000).toISOString()).catch(() => [] as string[]))
    .filter((l) => (l.toLowerCase().match(/[a-z]{4,}/g) || []).some((w) => words.has(w))).slice(0, 3);
  const ok = await post(channel, `:beetle: *Bug* from <@${body.user_id}>: ${what}${recent.length ? `\n_Recent changes that may be related:_\n${recent.join("\n")}` : ""}`, COLOR.alert);
  return { response_type: "ephemeral", text: ok ? `Logged in <#${channel}>. Thanks!` : "I couldn't post that just now. Try again in a minute." };
}

/** Interactivity (Slack sends it as a form field "payload"): the "Ask Remy about this" message shortcut. */
export async function interact(p: any, answer = reply): Promise<void> {
  if (p?.type !== "message_action" || p.callback_id !== "ask_remy" || !p.message) return;
  await answer({ channel: p.channel?.id, ts: p.message.ts, thread_ts: p.message.thread_ts, user: p.user?.id,
    text: `Explain this message and help with it: "${clip(String(p.message.text || ""), 2000)}"` });
}

const ct = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
const timeCt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });

/** "Shipped" lines: pull requests merged after `since` (ISO), newest first. */
export async function shippedSince(since: string, list?: any[]): Promise<string[]> {
  const prs = list ?? await fetch("https://api.github.com/repos/DilanDimel/Remy/pulls?state=closed&per_page=50&sort=updated&direction=desc", { headers: { accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return (Array.isArray(prs) ? prs : []).filter((p: any) => p.merged_at && p.merged_at > since).sort((a: any, b: any) => b.merged_at.localeCompare(a.merged_at))
    .map((p: any) => `• <${p.html_url}|#${p.number}> ${p.title}`);
}

/** The daily posts that are due and not sent yet: #database backup check from 6 AM CT, #website "Shipped" digests from
 *  12 PM and 9 PM CT. Each slot is remembered in site_settings, so a restart or an extra cron call can't post it twice.
 *  shortcut: the cron is hourly, so a post lands within the hour after its time; add a finer timer if that matters. */
export async function dailyPosts(backup: () => Promise<{ configured: boolean; lastAt: string | null; lastFull: string | null }>, now = new Date()): Promise<string[]> {
  if (!slackOn()) return [];
  backupStatus = backup; // the Home tab shows it too
  const { day, hour } = ct(now);
  const sent: string[] = [];
  const once = async (slot: string, due: boolean, make: () => Promise<{ channel: string; text: string; color?: string } | null>) => {
    const key = `slack_post_${slot}`;
    if (!due || (await q("SELECT 1 FROM site_settings WHERE key = $1 AND value = $2", [key, day])).length) return;
    const m = await make();
    if (m && !(await post(m.channel, m.text, m.color))) return; // Slack said no: try again next run
    await q(`INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2, 'slack')
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [key, day]);
    if (m) sent.push(slot);
  };
  await once("backup", hour >= 6, async () => {
    const b = await backup();
    const text = !b.configured ? ":warning: *Backup check*: backups aren't set up on this server (no R2 settings)."
      : !b.lastAt ? ":warning: *Backup check*: no backup has finished yet."
      : `:white_check_mark: *Backup check*: last copy ${timeCt(b.lastAt)} CT${b.lastFull ? `, last full copy ${b.lastFull}` : ""}.`;
    return { channel: CHANNELS.database, text, color: b.lastAt ? COLOR.ok : COLOR.alert };
  });
  const digest = (slot: string, from: number) => once(slot, hour >= from, async () => {
    const last = (await q("SELECT updated_at FROM site_settings WHERE key LIKE 'slack_post_shipped%' ORDER BY updated_at DESC LIMIT 1"))[0]?.updated_at;
    const since = last ? new Date(last).toISOString() : new Date(now.getTime() - 12 * 3600_000).toISOString();
    const lines = await shippedSince(since);
    return lines.length ? { channel: CHANNELS.website, text: `:fox_face: *Shipped since ${timeCt(since)} CT* (${lines.length})\n${lines.slice(0, 15).join("\n")}` } : null; // nothing new: stay quiet
  });
  await digest("shipped_noon", 12);
  await digest("shipped_evening", 21);
  return sent;
}

/** "Starts in about an hour" for team calendar items from the library, posted once each (every 5 minutes from routes.ts). */
export async function reminders(now = new Date()): Promise<number> {
  if (!slackOn()) return 0;
  let n = 0;
  for (const r of await dueReminders(now)) {
    const at = new Date(r.starts_at);
    const mins = Math.max(1, Math.round((at.getTime() - now.getTime()) / 60_000));
    const text = `:alarm_clock: *${r.title}* starts ${timeCt(at.toISOString())} CT, in about ${mins} min.${r.url ? ` <${r.url}|Open link>` : ""}`;
    if (await post(r.channel || CHANNELS.all, text)) { await markReminded(r.id); n++; }
  }
  return n;
}
