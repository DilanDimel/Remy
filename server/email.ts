import nodemailer, { type Transporter } from "nodemailer";

// SMTP_URL picks the sender. Today: Gmail (smtps://remy.account%40gmail.com:<app-password>@smtp.gmail.com:465).
// Planned (Dilan, Nov 22): Resend on mail.remyai.org, i.e. SMTP_URL=smtps://resend:<api-key>@smtp.resend.com:465,
// MAIL_FROM="Remy <remy@mail.remyai.org>", MAIL_REPLY_TO=hello@remyai.org.
// SMTP_FALLBACK_URL (optional, e.g. the old Gmail URL): used only when the main sender fails, so a bad key or an
// unverified domain can't stop sign-in codes. Its From is MAIL_FALLBACK_FROM or its own login.
type Sender = { transport: Transporter; from: string };

const fromOf = (url: string, set?: string) => set || `Remy <${decodeURIComponent(new URL(url).username)}>`;
const make = (url: string, from?: string): Sender | null => (url ? { transport: nodemailer.createTransport(url), from: fromOf(url, from) } : null);

/** Main sender plus optional fallback; exported for tests. */
export function mailer(main: Sender | null, fallback: Sender | null, replyTo?: string) {
  return {
    ready: () => !!(main || fallback),
    async send(to: string, subject: string, text: string, html?: string) {
      const first = main || fallback;
      if (!first) throw Object.assign(new Error("Email isn't set up on this server yet."), { status: 503 });
      const mail = { to, subject, text, ...(html ? { html } : {}), ...(replyTo ? { replyTo } : {}) };
      try {
        await first.transport.sendMail({ ...mail, from: first.from });
      } catch (e: any) {
        if (!fallback || first === fallback) throw e;
        console.error("main email sender failed, using the fallback:", e?.message);
        await fallback.transport.sendMail({ ...mail, from: fallback.from });
      }
    },
  };
}

const live = mailer(
  make(process.env.SMTP_URL || "", process.env.MAIL_FROM),
  make(process.env.SMTP_FALLBACK_URL || "", process.env.MAIL_FALLBACK_FROM),
  process.env.MAIL_REPLY_TO, // replies reach a real inbox when sending from a no-inbox address
);

export const emailReady = live.ready;
export const sendEmail = (to: string, subject: string, text: string, html?: string) => live.send(to, subject, text, html);
