import type { Workspace } from "@shared/types";
import { isOwner } from "./admin";
import { loadWorkspace, recentStudents, saveSections } from "./db";

// Redesign stage 5: opt-in texts for urgent deadlines only (an application closing today or tomorrow).
// The sender is swappable: with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM set it texts through Twilio
// (a free trial texts only numbers verified in Twilio, which is fine for owners). Without them it's test mode:
// nothing leaves the server, and the text is kept so owners see it on the dashboard.
export type TextMode = "twilio" | "test";
export interface SentText { key: string; day: string; at: string; to: string; body: string; mode: TextMode }

export const textMode = (): TextMode =>
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM ? "twilio" : "test";

/** A US number as +1XXXXXXXXXX, or null. Other countries can come later. */
export function usPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? "+1" + ten : null;
}

async function twilioSend(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!, token = process.env.TWILIO_AUTH_TOKEN!;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body }),
  });
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const days = (from: string, to: string) => Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 864e5);

/** The one urgent text due today, or null: texts on, a valid number, a deadline today or tomorrow not texted yet,
 *  and at most one text a day. */
export function urgentText(ws: Workspace, today: string, host: string): { key: string; body: string } | null {
  const t = ws.settings.texts;
  if (!t?.on || !usPhone(t.phone || "") || !ws.onboarding.done) return null;
  const sent = ws.texts || [];
  if (sent.some((x) => x.day === today)) return null;
  const done = new Set([...sent.map((x) => x.key), ...(ws.reminded || []).filter((k) => k.endsWith(":skip")).map((k) => k.slice(0, -5))]); // Not now in a reminder email
  const due = ws.calendar
    .filter((c) => c.kind === "Deadline" && c.date && [0, 1].includes(days(today, c.date)) && !done.has(`${c.id}:${c.date}`))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!due) return null;
  const when = days(today, due.date) === 0 ? "today" : "tomorrow";
  return { key: `${due.id}:${due.date}`, body: `Remy: ${due.title} closes ${when}. Finish it: https://${host}/calendar (Reply STOP to stop texts.)` };
}

/** Background run: one urgent text per student who is due. OWNERS ONLY while the redesign is tested. */
export async function sendTexts(activeSince: string, today: string, send: (to: string, body: string) => Promise<void> = twilioSend) {
  const host = process.env.PUBLIC_HOST || "remyai.org";
  const mode = textMode();
  let sent = 0;
  for (const u of await recentStudents(activeSince, true)) {
    if (!(await isOwner({ kind: u.kind as "google", email: u.email }))) continue;
    const ws = await loadWorkspace(u.id);
    const t = urgentText(ws, today, host);
    if (!t) continue;
    const to = usPhone(ws.settings.texts!.phone)!;
    if (mode === "twilio") {
      try { await send(to, t.body); } catch (e: any) { console.error("text failed", e?.message); continue; }
    }
    const rec: SentText = { key: t.key, day: today, at: new Date().toISOString(), to, body: t.body, mode };
    await saveSections(u.id, { texts: [...(ws.texts || []), rec].slice(-100) });
    sent++;
  }
  return sent;
}
