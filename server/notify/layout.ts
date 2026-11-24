// Remy's branded email (owners only while it's tested; students keep the older emails until Dilan releases it).
// Table layout with inline styles so it holds up in Gmail, Outlook and iPhone Mail. Colours are the site's tokens
// (client/src/index.css): paper #f5f5f3, ink #161616, fox #e86a2a; buttons use --fox-deep so white text passes contrast.
// Dark mode: Apple Mail and Outlook.com read the <style> block; Gmail recolours on its own and these colours survive it.

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Btn = { href: string; label: string };
const FONT = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** A paragraph of plain text (escaped). */
export const para = (text: string, muted = false) =>
  `<p class="${muted ? "rm-muted" : "rm-ink"}" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${muted ? "#5f5f5f" : "#161616"}">${esc(text)}</p>`;

/** A small orange label above a group ("CLOSING THIS WEEK"). */
export const label = (text: string) =>
  `<p style="margin:20px 0 8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c2410c">${esc(text)}</p>`;

const cell = (i: { title: string; sub?: string; href?: string }) =>
  `<div class="rm-ink" style="font-size:15px;font-weight:700;line-height:1.4;color:#161616">${i.href ? `<a href="${esc(i.href)}" class="rm-ink" style="color:#161616;text-decoration:none">${esc(i.title)}</a>` : esc(i.title)}</div>
${i.sub ? `<div class="rm-muted" style="font-size:13px;line-height:1.5;color:#5f5f5f;margin-top:2px">${esc(i.sub)}</div>` : ""}`;

/** Rows with a bold title and a muted line under it; `href` makes the title a link. */
export const rows = (items: { title: string; sub?: string; href?: string }[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">${items.map((i, n) =>
    `<tr><td class="rm-line" style="padding:12px 0;${n ? "border-top:1px solid #e3e1dc;" : ""}">
${cell(i)}</td></tr>`).join("")}</table>`;

/** Feature tiles two to a row on wide screens; on phones (<=520px) they stack into one column. */
export const grid = (items: { title: string; sub?: string; href?: string }[]) => {
  const pairs = Array.from({ length: Math.ceil(items.length / 2) }, (_, n) => items.slice(n * 2, n * 2 + 2));
  const tile = (i: { title: string; sub?: string; href?: string } | undefined, right: boolean) =>
    `<td class="rm-col" width="50%" valign="top" style="width:50%;padding:${right ? "0 0 12px 6px" : "0 6px 12px 0"}">${i ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="rm-tile" bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:14px;padding:14px 16px">${cell(i)}</td></tr></table>` : ""}</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${pairs.map((p) => `<tr>${tile(p[0], false)}${tile(p[1], true)}</tr>`).join("")}</table>`;
};

/** The highlighted card for one opening: who, what, and why it fits. */
export const opening = (o: { kicker: string; title: string; why?: string }) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td class="rm-soft" style="background:#fdecdf;border-radius:14px;padding:18px 20px">
<div style="font-size:12px;font-weight:700;letter-spacing:.04em;color:#c2410c">${esc(o.kicker)}</div>
<div class="rm-ink" style="font-size:17px;font-weight:800;line-height:1.35;color:#161616;margin-top:4px">${esc(o.title)}</div>
${o.why ? `<div class="rm-muted" style="font-size:14px;line-height:1.55;color:#5f5f5f;margin-top:8px">${esc(o.why)}</div>` : ""}</td></tr></table>`;

/** A one-time code, big and spaced so it's easy to read and copy. */
export const code = (c: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td align="center" class="rm-soft" style="background:#fdecdf;border-radius:14px;padding:22px 12px">
<div class="rm-ink" style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#161616">${esc(c)}</div></td></tr></table>`;

const button = (b: Btn, primary: boolean) =>
  `<td style="padding:0 8px 8px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td ${primary ? 'style="border-radius:999px;background:#c2410c"' : 'class="rm-btn2" style="border-radius:999px;border:1.5px solid #e3e1dc;background:#ffffff"'}>
<a href="${esc(b.href)}" style="display:inline-block;padding:${primary ? "13px 24px" : "11.5px 22px"};font-family:${FONT};font-size:15px;font-weight:700;line-height:1;text-decoration:none;border-radius:999px;color:${primary ? "#ffffff" : "#161616"}"${primary ? "" : ' class="rm-ink"'}>${esc(b.label)}</a></td></tr></table></td>`;

/** The whole email. `blocks` are HTML from the helpers above. `name` is the student's first name ("" leaves the greeting out). */
export function brandEmail(o: { host: string; preheader: string; heading: string; name?: string; blocks: string[]; primary?: Btn; secondary?: Btn; why: string; manage?: Btn }) {
  const site = `https://${o.host}`;
  const buttons = o.primary || o.secondary
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px"><tr>${o.primary ? button(o.primary, true) : ""}${o.secondary ? button(o.secondary, false) : ""}</tr></table>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(o.heading)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .rm-bg { background:#121212 !important; } .rm-card { background:#1c1c1c !important; }
  .rm-ink { color:#f5f5f3 !important; } .rm-muted { color:#a8a8a3 !important; } .rm-line { border-color:#333331 !important; }
  .rm-soft { background:#2a1d15 !important; } .rm-btn2 { background:#1c1c1c !important; border-color:#333331 !important; } .rm-tile { background:#262624 !important; }
}
[data-ogsc] .rm-bg { background:#121212 !important; } [data-ogsc] .rm-card { background:#1c1c1c !important; }
[data-ogsc] .rm-ink { color:#f5f5f3 !important; } [data-ogsc] .rm-muted { color:#a8a8a3 !important; } [data-ogsc] .rm-soft { background:#2a1d15 !important; } [data-ogsc] .rm-tile { background:#262624 !important; }
@media (max-width:520px) { .rm-pad { padding:22px 18px !important; } .rm-h1 { font-size:22px !important; } .rm-col { display:block !important; width:100% !important; padding:0 0 10px !important; } }
</style></head>
<body class="rm-bg" style="margin:0;padding:0;background:#f5f5f3;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}${"&#8199;&#65279;&#847; ".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rm-bg" style="background:#f5f5f3"><tr><td align="center" style="padding:20px 12px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;font-family:${FONT}">
<tr><td style="padding:0 4px 12px"><a href="${site}" style="text-decoration:none"><img src="${site}/email/remy-smile.png" width="44" height="44" alt="" style="vertical-align:middle;border:0;display:inline-block"><span class="rm-ink" style="font-size:22px;font-weight:800;letter-spacing:-.5px;color:#161616;vertical-align:middle;margin-left:8px">Remy</span></a></td></tr>
<tr><td class="rm-card rm-pad" style="background:#ffffff;border-radius:20px;padding:28px 32px 24px">
<h1 class="rm-ink rm-h1" style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-.4px;color:#161616">${esc(o.heading)}</h1>
${o.name ? para(`Hi ${o.name},`) : ""}${o.blocks.join("\n")}
${buttons}
<p class="rm-ink" style="margin:14px 0 0;font-size:15px;line-height:1.5;color:#161616">Remy<br><span class="rm-muted" style="font-size:13px;color:#5f5f5f">Your career coach</span></p>
</td></tr>
<tr><td class="rm-muted" style="padding:14px 8px 0;font-size:12px;line-height:1.6;color:#8a8a85">${esc(o.why)}${o.manage ? ` <a href="${esc(o.manage.href)}" class="rm-muted" style="color:#5f5f5f;text-decoration:underline">${esc(o.manage.label)}</a>` : ""}<br>
Remy, an AI career coach for college students · <a href="${site}" class="rm-muted" style="color:#5f5f5f">${esc(o.host)}</a> · <a href="mailto:hello@remyai.org" class="rm-muted" style="color:#5f5f5f">hello@remyai.org</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** A 6-digit code email (sign-in, alumni check). */
export function codeEmail(o: { host: string; code: string; name?: string; heading: string; intro: string; why: string }) {
  return brandEmail({
    host: o.host, name: o.name, heading: o.heading, preheader: `${o.code} · expires in 10 minutes`,
    blocks: [para(o.intro), code(o.code), para("Type it on the page you came from. It works on any device and expires in 10 minutes.", true)],
    why: o.why,
  });
}
