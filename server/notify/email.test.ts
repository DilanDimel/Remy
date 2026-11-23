import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { mailer } from "./email";

const ok = () => nodemailer.createTransport({ jsonTransport: true });
const broken = () => nodemailer.createTransport({ name: "broken", version: "1", send: (_m: any, cb: any) => cb(new Error("domain not verified")) } as any);

test("mailer: main sender with reply-to; falls back when the main one fails; errors when both fail", async () => {
  const main = { transport: ok(), from: "Remy <remy@mail.remyai.org>" };
  const sent: any[] = [];
  const spy = (t: any) => { const s = t.sendMail.bind(t); t.sendMail = async (m: any) => { sent.push(m); return s(m); }; return t; };
  spy(main.transport);
  const m = mailer(main, null, "hello@remyai.org");
  assert.equal(m.ready(), true);
  await m.send("a@x.test", "Code", "123456");
  assert.equal(sent[0].from, "Remy <remy@mail.remyai.org>");
  assert.equal(sent[0].replyTo, "hello@remyai.org");

  const gmail = { transport: spy(ok()), from: "Remy <remy.careercoach@gmail.com>" };
  await mailer({ transport: broken(), from: "Remy <remy@mail.remyai.org>" }, gmail, "hello@remyai.org").send("a@x.test", "Code", "123456");
  assert.equal(sent.at(-1).from, "Remy <remy.careercoach@gmail.com>", "fallback used");

  await assert.rejects(mailer({ transport: broken(), from: "x" }, { transport: broken(), from: "y" }).send("a@x.test", "s", "t"), /domain not verified/);
  await assert.rejects(mailer(null, null).send("a@x.test", "s", "t"), /isn't set up/);
  assert.equal(mailer(null, null).ready(), false);
});

test("logEmail keeps the student's last 30 emails, newest last", async () => {
  const { logEmail } = await import("./email");
  let ws: { emails?: any[] } = {};
  for (let i = 0; i < 35; i++) ws = { emails: logEmail(ws, "match", `s${i}`, `2026-11-${String(i % 28 + 1).padStart(2, "0")}T00:00:00Z`) };
  assert.equal(ws.emails!.length, 30);
  assert.equal(ws.emails!.at(-1).subject, "s34");
});
