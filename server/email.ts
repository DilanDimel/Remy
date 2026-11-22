import nodemailer from "nodemailer";

// SMTP_URL picks the sender, e.g. smtps://remy.account%40gmail.com:<app-password>@smtp.gmail.com:465
// (Gmail app password today; Resend, Brevo or SendGrid SMTP later without code changes).
const url = process.env.SMTP_URL || "";
const transport = url ? nodemailer.createTransport(url) : null;

export const emailReady = () => !!transport;

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!transport) throw Object.assign(new Error("Email isn't set up on this server yet."), { status: 503 });
  const from = process.env.MAIL_FROM || `Remy <${decodeURIComponent(new URL(url).username)}>`;
  // MAIL_REPLY_TO (e.g. hello@remyai.org): replies reach a real inbox when sending from a no-inbox address like remy@mail.remyai.org.
  const replyTo = process.env.MAIL_REPLY_TO;
  await transport.sendMail({ from, to, subject, text, ...(html ? { html } : {}), ...(replyTo ? { replyTo } : {}) });
}
