// The team Slack's Remy app: signature check, keeping the copy of messages, and what Remy reads before answering.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { onEvent, slackContext, verifySlack, RULES, aiNotes, dailyPosts, shippedSince, CHANNELS } from "./slack";

test("signature: Slack's v0 HMAC passes; wrong secret, edited body or old timestamp fail", () => {
  const body = Buffer.from('{"type":"event_callback"}');
  const ts = "1795740000";
  const sig = "v0=" + crypto.createHmac("sha256", "s3cret").update(`v0:${ts}:${body}`).digest("hex");
  const now = 1795740000 * 1000 + 30_000;
  assert.equal(verifySlack(body, ts, sig, "s3cret", now), true);
  assert.equal(verifySlack(body, ts, sig, "other", now), false);
  assert.equal(verifySlack(Buffer.from('{"type":"x"}'), ts, sig, "s3cret", now), false);
  assert.equal(verifySlack(body, ts, sig, "s3cret", now + 10 * 60_000), false);
  assert.equal(verifySlack(undefined, ts, sig, "s3cret", now), false);
});

test("messages: kept, edited, deleted; a mention or DM gets an answer, joins don't", async () => {
  const realFetch = globalThis.fetch; // names come from Slack; answer with stand-ins
  globalThis.fetch = (async (url: any, init: any) => {
    const b = Object.fromEntries(new URLSearchParams(String(init?.body || "")));
    const j = String(url).endsWith("users.info") ? { ok: true, user: { real_name: b.user === "U1" ? "Julio" : "Dilan" } }
      : String(url).endsWith("conversations.history") ? { ok: true, messages: [{ ts: "1795000000.000100", user: "U2", text: "Mike call is Friday 1 PM" }] }
      : { ok: true, channel: { name: "website" } };
    return new Response(JSON.stringify(j));
  }) as any;
  try {
    const asked: any[] = [];
    const now = (Date.now() / 1000).toFixed(6);
    await onEvent({ type: "message", channel: "C1", ts: now, user: "U2", text: "Saved openings go under My Path on phones" }, async (e) => { asked.push(e); });
    await onEvent({ type: "message", channel: "C1", ts: now + "1", thread_ts: now, user: "U1", text: "ok, typo" }, async (e) => { asked.push(e); });
    await onEvent({ type: "message", subtype: "message_changed", channel: "C1", message: { ts: now + "1", text: "ok, got it" } });
    await onEvent({ type: "message", subtype: "channel_join", channel: "C1", ts: now + "2", user: "U1", text: "joined" });
    await onEvent({ type: "app_mention", channel: "C1", ts: now + "3", thread_ts: now, user: "U1", text: "<@UREMY> where do saved openings go?" }, async (e) => { asked.push(e); });
    await onEvent({ type: "message", channel_type: "im", channel: "D1", ts: now + "4", user: "U1", text: "hi" }, async (e) => { asked.push(e); });
    assert.deepEqual(asked.map((e) => e.type), ["app_mention", "message"]);

    const ctx = await slackContext("C1", now, "where do saved openings go");
    assert.match(ctx, /#website\] Dilan: Saved openings go under My Path/);
    assert.match(ctx, /Julio: ok, got it/);
    assert.doesNotMatch(ctx, /joined|typo/);
    assert.match(await slackContext("C1", now, "when is the mike call"), /Dilan: Mike call is Friday/); // copied from history on first event

    await onEvent({ type: "message", subtype: "message_deleted", channel: "C1", deleted_ts: now + "1" });
    assert.doesNotMatch(await slackContext("C1", now, "x"), /got it/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("rules: team-visible wording rules are in Remy's instructions", () => {
  assert.match(RULES, /Free during beta/);
  assert.match(RULES, /title or role/);
  assert.match(RULES, /CREATE/);
  assert.match(RULES, /newest question/);
  assert.match(RULES, /never name a person to ask/);
});

test("notes: Remy reads docs/ai from disk, team facts first, lead entries matched to the question", () => {
  const n = aiNotes("digitalocean move");
  assert.match(n, /docs\/ai\/TEAM\.md:/);
  assert.match(n, /docs\/ai\/status\/lead\/digitalocean-move\.md/);
  assert.ok(aiNotes("x", 5000).length < 20_000);
});

test("daily posts: backup check from 6 AM CT and a Shipped digest from noon, each once a day", async () => {
  const realFetch = globalThis.fetch, env = { ...process.env };
  process.env.SLACK_BOT_TOKEN = "xoxb-test"; process.env.SLACK_SIGNING_SECRET = "s";
  const posted: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    if (String(url).includes("api.github.com")) return new Response(JSON.stringify([
      { number: 9, title: "Fix the jobs page on phones", html_url: "https://x/9", merged_at: "2026-11-27T15:00:00Z" },
      { number: 8, title: "Closed without merging", html_url: "https://x/8", merged_at: null },
    ]));
    posted.push(Object.fromEntries(new URLSearchParams(String(init?.body || ""))));
    return new Response(JSON.stringify({ ok: true }));
  }) as any;
  const backup = async () => ({ configured: true, lastAt: "2026-11-27T08:10:00Z", lastFull: "2026-11-23" });
  try {
    assert.deepEqual(await dailyPosts(backup, new Date("2026-11-27T10:00:00Z")), []); // 4 AM CT: nothing due
    assert.deepEqual(await dailyPosts(backup, new Date("2026-11-27T19:00:00Z")), ["backup", "shipped_noon"]); // 1 PM CT
    assert.deepEqual(await dailyPosts(backup, new Date("2026-11-27T20:00:00Z")), []); // already sent today
    assert.equal(posted[0].channel, CHANNELS.database);
    assert.match(posted[0].text, /Backup check\*: last copy Fri 2:10 AM CT, last full copy 2026-11-23/);
    assert.equal(posted[1].channel, CHANNELS.website);
    assert.match(posted[1].text, /#9> Fix the jobs page on phones/);
    assert.doesNotMatch(posted[1].text, /#8/);
    assert.deepEqual(await shippedSince("2026-11-28T00:00:00Z", [{ number: 9, merged_at: "2026-11-27T15:00:00Z" }]), []);
  } finally {
    globalThis.fetch = realFetch; process.env = env;
  }
});
