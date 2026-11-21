// The "You're in" email an owner sends when accepting a beta tester applicant (Admin → Beta list → Accept).
// The owner sees this draft, can edit it, and sees the same HTML preview the student gets.

export function acceptDraft(o: { name: string; email: string; cohort: string }) {
  const first = (o.name || "").trim().split(/\s+/)[0] || "there";
  return {
    subject: "You're in: welcome to the Remy beta 🦊",
    message: [
      `Hi ${first},`,
      `You're one of Remy's first beta testers${o.cohort ? ` (${o.cohort})` : ""}. Here's how to get in:`,
      `1. Go to remyai.org and click Sign in.\n2. Click "Continue with Email" and type ${o.email}. It has to be this exact address: it's the one we let in.\n3. Type the 6-digit code Remy emails you (check spam or Promotions if you don't see it).\n4. Setup takes about 5 minutes: add your resume and tell Remy what you're working toward.`,
      `What we ask in return: use Remy about once a week and tell us anything that's confusing or wrong. Just reply to this email.`,
      `Thanks for helping build this,\nThe Remy team`,
    ].join("\n\n"),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The styled email. The message is plain text the owner wrote: escaped, blank lines become paragraphs. */
export function acceptHtml(message: string, host: string) {
  const signin = `https://${host}/signin`;
  const paras = message.trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2a2622">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f1ec">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1ec;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<tr><td style="background:#0e0d12;padding:26px 28px">
<span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-.3px">🦊 Remy</span>
<span style="display:inline-block;margin-left:8px;padding:3px 9px;border-radius:999px;background:#e86a2a;color:#fff;font-size:11px;font-weight:700;vertical-align:middle">BETA TESTER</span>
<div style="margin-top:14px;font-size:22px;font-weight:700;color:#ffffff">You&rsquo;re in.</div>
<div style="margin-top:4px;font-size:14px;color:#c9c3cf">Don&rsquo;t hunt for a job alone.</div>
</td></tr>
<tr><td style="padding:28px">${paras}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr><td style="border-radius:999px;background:#e86a2a">
<a href="${signin}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Sign in to Remy</a>
</td></tr></table>
<p style="margin:10px 0 0;font-size:12px;color:#8a837d">Or open ${esc(signin)}</p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#8a837d">Remy · <a href="mailto:hello@remyai.org" style="color:#8a837d">hello@remyai.org</a></td></tr>
</table></td></tr></table></body></html>`;
}
