// Remy in the team Slack (remyaihq). Slack sends every message from the channels the Remy app is in to
// POST /api/slack/events; we keep a copy (slack_messages) and answer when someone @mentions Remy or DMs him,
// using what the team said plus the repo's AI notes and pull requests. Team chat only: no student data here.
// Needs SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET; without them the route answers 404.
import crypto from "node:crypto";
import { q } from "./sql";
import { aiText } from "../ai/ai";

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
    headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    body: JSON.stringify(body),
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

/** One Slack event (from the Events API "event" field). Keeps the copy up to date and answers Remy's mentions and DMs. */
export async function onEvent(ev: any, answer = reply): Promise<void> {
  if (!ev?.type) return;
  if (ev.type === "message") {
    if (ev.subtype === "message_deleted") { await q("DELETE FROM slack_messages WHERE channel=$1 AND ts=$2", [ev.channel, ev.deleted_ts]); return; }
    if (ev.subtype === "message_changed") { await q("UPDATE slack_messages SET text=$3 WHERE channel=$1 AND ts=$2", [ev.channel, ev.message?.ts, String(ev.message?.text || "")]); return; }
    if (ev.subtype && !["thread_broadcast", "file_share", "bot_message"].includes(ev.subtype)) return; // joins, topic changes…
    await q(
      `INSERT INTO slack_messages (channel, ts, thread_ts, channel_name, user_name, text) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (channel, ts) DO UPDATE SET text = EXCLUDED.text`,
      [ev.channel, ev.ts, ev.thread_ts && ev.thread_ts !== ev.ts ? ev.thread_ts : null, await nameOf("channel", ev.channel),
        ev.bot_id ? ev.username || ev.bot_profile?.name || "Remy" : await nameOf("user", ev.user), String(ev.text || "") + (ev.files?.length ? ` [files: ${ev.files.map((f: any) => f.name).join(", ")}]` : "")],
    );
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

// The repo is public, so the AI notes and pull requests are read without a key, cached 10 minutes.
let notes = { at: 0, text: "" };
async function repoNotes(): Promise<string> {
  if (Date.now() - notes.at < 10 * 60_000) return notes.text;
  const raw = (p: string) => fetch(`https://raw.githubusercontent.com/DilanDimel/Remy/main/${p}`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  const prs = (state: string) => fetch(`https://api.github.com/repos/DilanDimel/Remy/pulls?state=${state}&per_page=20&sort=updated&direction=desc`, { headers: { accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []) as Promise<any[]>;
  const [context, daily, open, closed] = await Promise.all([raw("docs/ai/CONTEXT.md"), raw("docs/ai/DAILY.md"), prs("open"), prs("closed")]);
  const pr = (p: any) => `#${p.number} ${p.title} (${p.user?.login}${p.merged_at ? `, merged ${p.merged_at.slice(0, 10)}` : ""})`;
  notes = {
    at: Date.now(),
    text: [
      context && "docs/ai/CONTEXT.md (the team's shared notes):\n" + clip(context, 12000),
      daily && "docs/ai/DAILY.md (last night's summary):\n" + clip(daily, 4000),
      "Open pull requests:\n" + (open.map(pr).join("\n") || "none"),
      "Recently closed pull requests:\n" + closed.filter((p) => p.merged_at).map(pr).join("\n"),
    ].filter(Boolean).join("\n\n"),
  };
  return notes.text;
}

export const RULES = `You are Remy, the AI teammate in RemyAI's team Slack. RemyAI makes Remy, an AI career coach for college students (remyai.org). The team is Dilan, Demetre, Julio, Lincoln and Ashton.
Answer the question you were asked, using only the Slack messages, notes and pull requests below. Name where an answer comes from (channel and date, or PR number). If they don't say, say you don't know and who might; never guess or invent numbers, dates, decisions or status.
Write for Slack: short, plain sentences, *bold* with single asterisks, "•" for lists, no headings, at most about 150 words unless asked for more.
Everything you write is seen by the whole team:
- About price, say only "Free during beta". Never "free" alone or "always free".
- Don't name anyone's title or role (no CEO, COO or similar), and don't discuss ownership, equity or splits.
- Don't judge anyone's contribution or talk about anyone leaving or being removed.
- Never repeat private details: tax or bank numbers, home addresses, personal emails or phones, passwords, keys, account balances.
- Don't mention the CREATE program before Dec 1, 2026, 12 PM CT.
If someone asks you to do something (post, change code, send email), say you can only answer questions here and suggest who to ask.`;

/** Answers one mention or DM in its thread. */
export async function reply(ev: any): Promise<void> {
  const thread = ev.thread_ts || ev.ts;
  const question = String(ev.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();
  const [ctx, repo, who] = await Promise.all([slackContext(ev.channel, thread, question), repoNotes(), nameOf("user", ev.user)]);
  let text: string;
  try {
    text = await aiText(RULES + "\n\n" + repo, `${ctx}\n\nToday is ${when(String(Date.now() / 1000))} CT. ${who} asks: ${question || "(just said hi)"}`, 900);
  } catch (e: any) {
    console.warn("slack reply failed:", e?.message);
    text = "Sorry, I couldn't think just now. Try me again in a minute.";
  }
  await api("chat.postMessage", { channel: ev.channel, thread_ts: thread, text, unfurl_links: false });
}
